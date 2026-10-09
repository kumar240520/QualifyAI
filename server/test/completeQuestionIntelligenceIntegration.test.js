import test from 'node:test'
import assert from 'node:assert/strict'

import {
  QUESTION_TYPES_CATALOG,
  CANONICAL_QUESTION_TYPES,
  normalizeQuestionType,
  isValidQuestionType,
  isMicDefaultOn,
  normalizeQuestionPayload,
  validateQuestionSchema,
  evaluateAnswerDeterministically,
} from '../src/services/interview/questionTypeRegistry.js'

import {
  adaptivePolicyService,
} from '../src/services/interview/adaptivePolicyService.js'

import {
  createRealtimeQuestionGenerator,
  resolvePermittedQuestionTypes,
} from '../src/services/interview/realtimeQuestionGenerator.js'

import {
  validateCreateJobPayload,
  validateAnswerSubmissionPayload,
  validateCreateInvitationPayload,
} from '../src/validators/index.js'

test('1. All 15 Canonical Enterprise Question Types: Specifications, Schemas & Aliases', () => {
  assert.equal(QUESTION_TYPES_CATALOG.length, 15, 'Registry must define exactly 15 canonical question types')

  const expected15 = [
    'MULTIPLE_CHOICE',
    'MULTI_SELECT',
    'TRUE_FALSE',
    'SHORT_ANSWER',
    'DESCRIPTIVE',
    'FILL_IN_THE_BLANK',
    'CODING_CHALLENGE',
    'PREDICT_CODE_OUTPUT',
    'DEBUGGING',
    'COMPLETE_THE_CODE',
    'ARRANGE_ORDER',
    'SELECT_MOST_APPROPRIATE',
    'SLIDER_SCALE',
    'MATCHING_PAIRS',
    'NUMERICAL_APTITUDE',
  ]

  for (const type of expected15) {
    assert.equal(CANONICAL_QUESTION_TYPES.includes(type), true, `Type ${type} must be in CANONICAL_QUESTION_TYPES`)
    assert.equal(isValidQuestionType(type), true, `isValidQuestionType must return true for ${type}`)
  }

  // Verify specification identifiers / canonicalKeys normalize accurately
  const specKeyMap = {
    single_select: 'MULTIPLE_CHOICE',
    multi_select: 'MULTI_SELECT',
    true_false: 'TRUE_FALSE',
    short_answer: 'SHORT_ANSWER',
    descriptive: 'DESCRIPTIVE',
    fill_blank: 'FILL_IN_THE_BLANK',
    coding_challenge: 'CODING_CHALLENGE',
    predict_output: 'PREDICT_CODE_OUTPUT',
    debugging: 'DEBUGGING',
    complete_code: 'COMPLETE_THE_CODE',
    ordering: 'ARRANGE_ORDER',
    best_option: 'SELECT_MOST_APPROPRIATE',
    slider: 'SLIDER_SCALE',
    matching: 'MATCHING_PAIRS',
    numerical: 'NUMERICAL_APTITUDE',
  }

  for (const [key, canonical] of Object.entries(specKeyMap)) {
    assert.equal(normalizeQuestionType(key), canonical, `Key "${key}" must normalize to "${canonical}"`)
    assert.equal(normalizeQuestionType(key.toUpperCase()), canonical, `Key "${key.toUpperCase()}" must normalize to "${canonical}"`)
    assert.equal(normalizeQuestionType({ type: key }), canonical, `Object with type "${key}" must normalize to "${canonical}"`)
  }
})

test('2. Strict Microphone Defaults: Strictly ON for SHORT_ANSWER and DESCRIPTIVE, OFF for other 13', () => {
  for (const q of QUESTION_TYPES_CATALOG) {
    const isMicOn = isMicDefaultOn(q.id)
    const isMicOnObj = isMicDefaultOn({ type: q.id })

    if (q.id === 'SHORT_ANSWER' || q.id === 'DESCRIPTIVE') {
      assert.equal(isMicOn, true, `${q.id} must have micDefault ON`)
      assert.equal(isMicOnObj, true, `${q.id} (object) must have micDefault ON`)
      assert.equal(q.micDefault, true, `${q.id} catalog record must have micDefault true`)
    } else {
      assert.equal(isMicOn, false, `${q.id} must have micDefault OFF`)
      assert.equal(isMicOnObj, false, `${q.id} (object) must have micDefault OFF`)
      assert.equal(q.micDefault, false, `${q.id} catalog record must have micDefault false`)
    }
  }
})

test('3. Schema Validation & Normalization for Interactive Question Formats', () => {
  // 1. MULTIPLE_CHOICE requires at least 2 options
  const mcNorm = normalizeQuestionPayload({ text: 'What is idempotency?', type: 'MULTIPLE_CHOICE' })
  assert.equal(Array.isArray(mcNorm.options) && mcNorm.options.length >= 2, true)
  assert.equal(validateQuestionSchema(mcNorm).valid, true)
  assert.equal(validateQuestionSchema({ text: 'No options', type: 'MULTIPLE_CHOICE', options: [] }).valid, false)

  // 2. TRUE_FALSE requires 2 options
  const tfNorm = normalizeQuestionPayload({ text: 'HTTP is stateless.', type: 'TRUE_FALSE' })
  assert.deepEqual(tfNorm.options, ['True', 'False'])
  assert.equal(validateQuestionSchema(tfNorm).valid, true)

  // 3. FILL_IN_THE_BLANK requires blank placeholder
  const fibNorm = normalizeQuestionPayload({ text: 'In SQL, the keyword is used to sort.', type: 'FILL_IN_THE_BLANK' })
  assert.equal(fibNorm.text.includes('___'), true)
  assert.equal(validateQuestionSchema(fibNorm).valid, true)

  // 4. CODING_CHALLENGE requires codeSnippet
  const codeNorm = normalizeQuestionPayload({ text: 'Implement quicksort.', type: 'CODING_CHALLENGE' })
  assert.equal(Boolean(codeNorm.codeSnippet), true)
  assert.equal(codeNorm.language, 'javascript')
  assert.equal(validateQuestionSchema(codeNorm).valid, true)

  // 5. DEBUGGING requires codeSnippet
  const debugNorm = normalizeQuestionPayload({ text: 'Fix the off-by-one error.', type: 'DEBUGGING' })
  assert.equal(Boolean(debugNorm.codeSnippet), true)
  assert.equal(validateQuestionSchema(debugNorm).valid, true)

  // 6. ARRANGE_ORDER requires items
  const orderNorm = normalizeQuestionPayload({ text: 'Order the CI/CD stages.', type: 'ARRANGE_ORDER' })
  assert.equal(Array.isArray(orderNorm.items) && orderNorm.items.length >= 2, true)
  assert.equal(validateQuestionSchema(orderNorm).valid, true)

  // 7. MATCHING_PAIRS requires leftItems and rightItems
  const matchNorm = normalizeQuestionPayload({ text: 'Match technologies to paradigms.', type: 'MATCHING_PAIRS' })
  assert.equal(Array.isArray(matchNorm.leftItems) && matchNorm.leftItems.length > 0, true)
  assert.equal(Array.isArray(matchNorm.rightItems) && matchNorm.rightItems.length > 0, true)
  assert.equal(validateQuestionSchema(matchNorm).valid, true)

  // 8. SLIDER_SCALE requires sliderConfig
  const sliderNorm = normalizeQuestionPayload({ text: 'Rate priority of zero-downtime deploy.', type: 'SLIDER_SCALE' })
  assert.equal(sliderNorm.sliderConfig.min, 1)
  assert.equal(sliderNorm.sliderConfig.max, 10)
  assert.equal(validateQuestionSchema(sliderNorm).valid, true)

  // 9. NUMERICAL_APTITUDE requires numericalConfig
  const numNorm = normalizeQuestionPayload({ text: 'Calculate amortized time complexity in ms.', type: 'NUMERICAL_APTITUDE' })
  assert.equal(typeof numNorm.numericalConfig.tolerance, 'number')
  assert.equal(validateQuestionSchema(numNorm).valid, true)
})

test('4. Deterministic Evaluation for Objective Types vs Rubric Fallback for Subjective Types', () => {
  // MULTIPLE_CHOICE
  const mcQ = {
    type: 'MULTIPLE_CHOICE',
    options: ['Option A: Redis', 'Option B: Memcached', 'Option C: SQLite', 'Option D: S3'],
    expectedAnswer: 'Option A: Redis',
  }
  const mcResCorrect = evaluateAnswerDeterministically(mcQ, 'Option A: Redis')
  assert.equal(mcResCorrect.isDeterministic, true)
  assert.equal(mcResCorrect.correct, true)
  assert.equal(mcResCorrect.score, 10)

  const mcResLetter = evaluateAnswerDeterministically(mcQ, 'a')
  assert.equal(mcResLetter.correct, true)
  assert.equal(mcResLetter.score, 10)

  const mcResWrong = evaluateAnswerDeterministically(mcQ, 'Option C: SQLite')
  assert.equal(mcResWrong.correct, false)
  assert.equal(mcResWrong.score, 2)

  // TRUE_FALSE
  const tfQ = { type: 'TRUE_FALSE', expectedAnswer: 'true' }
  assert.equal(evaluateAnswerDeterministically(tfQ, 'true').correct, true)
  assert.equal(evaluateAnswerDeterministically(tfQ, 'False').correct, false)

  // FILL_IN_THE_BLANK
  const fibQ = { type: 'FILL_IN_THE_BLANK', expectedAnswer: 'ORDER BY' }
  assert.equal(evaluateAnswerDeterministically(fibQ, 'order by').correct, true)
  assert.equal(evaluateAnswerDeterministically(fibQ, 'GROUP BY').correct, false)

  // PREDICT_CODE_OUTPUT
  const predQ = { type: 'PREDICT_CODE_OUTPUT', expectedAnswer: '[2, 4, 6]' }
  assert.equal(evaluateAnswerDeterministically(predQ, '[2, 4, 6]').correct, true)
  assert.equal(evaluateAnswerDeterministically(predQ, 'undefined').correct, false)

  // ARRANGE_ORDER
  const orderQ = { type: 'ARRANGE_ORDER', expectedAnswer: ['Build', 'Test', 'Deploy'] }
  assert.equal(evaluateAnswerDeterministically(orderQ, null, { orderedItems: ['Build', 'Test', 'Deploy'] }).correct, true)
  assert.equal(evaluateAnswerDeterministically(orderQ, null, { orderedItems: ['Deploy', 'Test', 'Build'] }).correct, false)

  // MATCHING_PAIRS
  const matchQ = { type: 'MATCHING_PAIRS', expectedAnswer: { Redis: 'Cache', Postgres: 'RDBMS' } }
  assert.equal(evaluateAnswerDeterministically(matchQ, null, { pairs: { Redis: 'Cache', Postgres: 'RDBMS' } }).correct, true)
  assert.equal(evaluateAnswerDeterministically(matchQ, null, { pairs: { Redis: 'RDBMS', Postgres: 'Cache' } }).correct, false)

  // NUMERICAL_APTITUDE
  const numQ = { type: 'NUMERICAL_APTITUDE', expectedAnswer: 100, numericalConfig: { tolerance: 0.05 } }
  assert.equal(evaluateAnswerDeterministically(numQ, '102').correct, true) // within 5%
  assert.equal(evaluateAnswerDeterministically(numQ, '115').correct, false) // outside 5%

  // Subjective types return null (requires rubric/LLM assessment)
  assert.equal(evaluateAnswerDeterministically({ type: 'DESCRIPTIVE' }, 'Detailed architectural essay'), null)
  assert.equal(evaluateAnswerDeterministically({ type: 'SHORT_ANSWER' }, 'Short explanation'), null)
  assert.equal(evaluateAnswerDeterministically({ type: 'CODING_CHALLENGE' }, 'function solve() {}'), null)
  assert.equal(evaluateAnswerDeterministically({ type: 'DEBUGGING' }, 'Fixed line 4'), null)
})

test('5. Strict Recruiter Question-Type Selection Enforcement (Single Type & Multi-Type)', () => {
  // Case A: Recruiter selects ONLY 'NUMERICAL_APTITUDE'
  const singleConfig = { allowed_question_types: ['NUMERICAL_APTITUDE'] }
  const singleResolved = resolvePermittedQuestionTypes(singleConfig)
  assert.deepEqual(singleResolved.allPermittedTypes, ['NUMERICAL_APTITUDE'])
  assert.equal(singleResolved.allPermittedTypes.length, 1)

  // Case B: Recruiter selects specification aliases ['numerical', 'slider']
  const aliasConfig = { allowed_question_types: ['numerical', 'slider'] }
  const aliasResolved = resolvePermittedQuestionTypes(aliasConfig)
  assert.deepEqual(aliasResolved.allPermittedTypes, ['NUMERICAL_APTITUDE', 'SLIDER_SCALE'])

  // Case C: Realtime Question Generator strictly restricts prompt schema to configured types
  const restrictedGenerator = createRealtimeQuestionGenerator({
    async generateStructured(req) {
      assert.deepEqual(req.schema.properties.question.properties.type.enum, ['NUMERICAL_APTITUDE'])
      return {
        data: {
          action: 'ASK_QUESTION',
          relationship: 'INITIAL',
          question: {
            text: 'Calculate the cache hit ratio given 950 hits and 50 misses.',
            type: 'NUMERICAL_APTITUDE',
            skill: 'Quantitative Reasoning',
            topic: 'Caching',
            difficulty: 'MEDIUM',
            reason: 'Test quantitative precision',
            basedOnQuestionId: null,
          },
        },
      }
    },
  })

  // Verify generation resolves properly
  return restrictedGenerator.decideNextAction({
    job: singleConfig,
    sequence: 1,
    rubricCriteria: [{ id: 'quant', name: 'Quantitative Reasoning', weight: 10 }],
  }).then((decision) => {
    assert.equal(decision.question.type, 'NUMERICAL_APTITUDE')
  })
})

test('6. Evidence-Based Pillar Tracking: Inactive Turns Never Count as Assessed', () => {
  const initialMatrix = [
    { name: 'System Architecture', weight: 40, evidence: [], status: 'UNASSESSED', attempts: 0 },
    { name: 'Data Engineering', weight: 30, evidence: [], status: 'UNASSESSED', attempts: 0 },
    { name: 'Security & Auth', weight: 30, evidence: [], status: 'UNASSESSED', attempts: 0 },
  ]

  // Turn 1: Inactive/silent turn (noResponse = true, empty text)
  const afterSilence = adaptivePolicyService.updateCoverageMatrix(initialMatrix, {
    criterionName: 'System Architecture',
    analysis: null,
    evidenceQuotes: [],
    candidateAnswer: '',
    noResponse: true,
  })

  const archPillar = afterSilence.find((p) => p.name === 'System Architecture')
  assert.equal(archPillar.status, 'IN_PROGRESS', 'Unanswered pillar transitions to IN_PROGRESS without false assessment')
  assert.equal(archPillar.attempts, 0, 'Silent turn must NOT increment attempts')
  assert.equal(archPillar.evidence.length, 0, 'Silent turn must NOT add false evidence')

  // Turn 2: Real candidate response with substantial depth
  const afterAnswer = adaptivePolicyService.updateCoverageMatrix(afterSilence, {
    criterionName: 'System Architecture',
    analysis: { depth: 8, correctness: 9, relevance: 9, concepts_detected: ['CQRS event sourcing'] },
    evidenceQuotes: ['Designed event-driven CQRS pipeline on Kafka'],
    candidateAnswer: 'I implemented CQRS with event sourcing using Apache Kafka and DynamoDB.',
    noResponse: false,
  })

  const archPillarAssessed = afterAnswer.find((p) => p.name === 'System Architecture')
  assert.equal(archPillarAssessed.attempts, 1)
  assert.equal(archPillarAssessed.status === 'SUFFICIENTLY_EVALUATED' || archPillarAssessed.status === 'MASTERY_PROVEN', true)
  assert.equal(archPillarAssessed.evidence.length > 0, true)

  // Other pillars must remain untouched
  const dataPillar = afterAnswer.find((p) => p.name === 'Data Engineering')
  assert.equal(dataPillar.status, 'UNASSESSED')
  assert.equal(dataPillar.attempts, 0)
})

test('7. Job Requisition Validation: Supports All 15 Canonical Types, Backgrounds, and Complex Payloads', () => {
  const validRequisition = {
    title: 'Staff Distributed Systems Engineer',
    description: 'Lead high-throughput event processing and fault tolerant distributed systems engineering.',
    department: 'Core Infrastructure',
    seniority: 'STAFF',
    target_difficulty: 'HARD',
    background_type: 'TECHNICAL',
    custom_background: 'High-Frequency Trading & Low Latency',
    ask_about_projects: true,
    allowed_question_types: [
      'single_select',
      'multi_select',
      'true_false',
      'coding_challenge',
      'debugging',
      'complete_code',
      'predict_output',
      'ordering',
      'best_option',
      'slider',
      'matching',
      'numerical',
    ],
  }

  const result = validateCreateJobPayload(validRequisition)
  assert.equal(result.valid, true, `Validation failed: ${JSON.stringify(result.errors)}`)
  assert.equal(result.data.seniority, 'STAFF')
  assert.equal(result.data.target_difficulty, 'HARD')
  assert.equal(result.data.allowed_question_types.length, 12)
})

test('8. Answer Submission Payload Validation: Extracts and Transmits structuredAnswer', () => {
  const textSubmission = {
    token: 'invitation-test-token-1234567890',
    answerText: 'This is a voice or text answer.',
  }
  const textValid = validateAnswerSubmissionPayload(textSubmission)
  assert.equal(textValid.valid, true)
  assert.equal(textValid.data.answerText, 'This is a voice or text answer.')

  const structuredSubmission = {
    token: 'invitation-test-token-1234567890',
    answerText: 'Option B selected',
    structuredAnswer: {
      selectedOption: 'Option B: Asynchronous Queue',
      selectedIndex: 1,
    },
  }
  const structValid = validateAnswerSubmissionPayload(structuredSubmission)
  assert.equal(structValid.valid, true)
  assert.equal(structValid.data.answerText, 'Option B selected')
  assert.deepEqual(structValid.data.structuredAnswer, {
    selectedOption: 'Option B: Asynchronous Queue',
    selectedIndex: 1,
  })
})

test('9. Strict Assessment Deadline: 60 Seconds Reserved Exclusively for Feedback', () => {
  // If remaining time is 45 seconds (< 60s reserved threshold), wrapUpMode must be activated
  let wrapUpActivated = false
  const wrapUpGenerator = createRealtimeQuestionGenerator({
    async generateStructured(req) {
      if (req.prompt.includes('final minute for candidate feedback')) {
        wrapUpActivated = true
      }
      return {
        data: {
          action: 'ASK_QUESTION',
          relationship: 'INITIAL',
          question: {
            text: 'We have reserved our final minute for feedback. How would you rate the AI interviewer from 1 to 5?',
            type: 'SHORT_ANSWER',
            skill: 'Interview Feedback',
            topic: 'Candidate Experience',
            difficulty: 'EASY',
            reason: 'Mandatory final-minute candidate feedback phase',
            basedOnQuestionId: null,
          },
          aiMessage: 'Thank you for your time. Please share your feedback and rate the experience from 1 to 5.',
        },
      }
    },
  })

  return wrapUpGenerator.decideNextAction({
    sequence: 15,
    timeRemainingSeconds: 45, // < 60s
    wrapUpMode: true,
  }).then((decision) => {
    assert.equal(wrapUpActivated, true, 'Prompt must instruct final-minute feedback collection')
    assert.equal(decision.question.type, 'SHORT_ANSWER')
  })
})

test('10. Recruiter Custom Interview Duration: Validation, Bounds, and Token Context Ingestion', () => {
  const dummyUUID = '550e8400-e29b-41d4-a716-446655440000'

  // Valid custom durations within [5, 180]
  const valid25 = validateCreateInvitationPayload({ candidateId: dummyUUID, interviewDurationMinutes: 25 })
  assert.equal(valid25.valid, true)
  assert.equal(valid25.data.interviewDurationMinutes, 25)

  const valid120 = validateCreateInvitationPayload({ candidateId: dummyUUID, interviewDurationMinutes: 120 })
  assert.equal(valid120.valid, true)
  assert.equal(valid120.data.interviewDurationMinutes, 120)

  // Default duration when omitted
  const validDefault = validateCreateInvitationPayload({ candidateId: dummyUUID })
  assert.equal(validDefault.valid, true)
  assert.equal(validDefault.data.interviewDurationMinutes, 30)

  // Invalid: below minimum (< 5)
  const invalidLow = validateCreateInvitationPayload({ candidateId: dummyUUID, interviewDurationMinutes: 4 })
  assert.equal(invalidLow.valid, false)
  assert.match(invalidLow.errors.interviewDurationMinutes, /5/)

  // Invalid: above maximum (> 180)
  const invalidHigh = validateCreateInvitationPayload({ candidateId: dummyUUID, interviewDurationMinutes: 240 })
  assert.equal(invalidHigh.valid, false)
  assert.match(invalidHigh.errors.interviewDurationMinutes, /180/)
})

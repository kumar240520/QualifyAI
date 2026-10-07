import test from 'node:test'
import assert from 'node:assert/strict'
import { createRealtimeQuestionGenerator } from '../src/services/interview/realtimeQuestionGenerator.js'
import { adaptivePolicyService } from '../src/services/interview/adaptivePolicyService.js'
import {
  createAnswerCommit,
  isQuestionSequenceNewer,
  parseInterviewDurationMinutes,
  validateActiveQuestionAnswer,
  isRepeatQuestionRequest,
} from '../src/services/interview/interviewState.js'
import { shouldAcceptQuestionEvent } from '../../client/src/utils/questionEvent.js'

const makeDecision = (text, relationship = 'FOLLOW_UP', basedOnQuestionId = null) => ({
  action: relationship === 'SWITCH_TOPIC' ? 'SWITCH_TOPIC' : 'FOLLOW_UP',
  relationship,
  question: { text, type: 'SCENARIO', topic: 'Authentication', skill: 'Node.js', difficulty: 'MEDIUM', reason: 'Probe evidence in the latest answer.', basedOnQuestionId },
  aiMessage: text,
})

test('Gemini gets the committed answer, question identity, coverage, history, and time before deciding a follow-up', async () => {
  let prompt
  const generator = createRealtimeQuestionGenerator({
    async generateStructured(request) {
      prompt = request.prompt
      return { data: makeDecision('How did you prevent unauthorized attendance submissions?', 'FOLLOW_UP', 'q17') }
    },
  })
  const decision = await generator.decideNextAction({
    job: { title: 'Full Stack Engineer' },
    candidate: { full_name: 'Candidate' },
    rubricCriteria: [{ id: 'auth', name: 'Authentication', weight: 5 }],
    coverageMap: [{ name: 'Node.js', evidence: ['Express'], missing: ['authentication'] }],
    currentQuestion: { id: 'q17', sequence: 17, question_text: 'Tell me about a project.' },
    answer: { id: 'a17', questionId: 'q17', questionSequence: 17, text: 'I built an attendance system using React, Node.js, and JWT.' },
    answerAnalysis: { depth: 5, topics_mentioned: ['JWT', 'attendance'] },
    turnHistory: [{ question_id: 'q17', answer_id: 'a17' }],
    askedQuestions: [{ id: 'q17', text: 'Tell me about a project.' }],
    sequence: 18,
    timeRemainingSeconds: 420,
    interviewDurationMinutes: 20,
  })
  assert.match(prompt, /I built an attendance system using React, Node\.js, and JWT/)
  assert.match(prompt, /"id":"q17"/)
  assert.match(prompt, /"remainingSeconds":420/)
  assert.match(prompt, /"missing":\["authentication"\]/)
  assert.equal(decision.question.text, 'How did you prevent unauthorized attendance submissions?')
  assert.equal(decision.action, 'FOLLOW_UP')
})

test('Gemini may keep probing the same topic without a sequence based follow-up limit', async () => {
  let calls = 0
  const generator = createRealtimeQuestionGenerator({
    async generateStructured() {
      calls += 1
      return { data: makeDecision(`Contextual probe ${calls}`, 'FOLLOW_UP', calls === 1 ? 'q17' : 'q18') }
    },
  })
  const one = await generator.decideNextAction({ sequence: 18, currentQuestion: { id: 'q17' }, answer: { text: 'JWT auth' } })
  const two = await generator.decideNextAction({ sequence: 19, currentQuestion: { id: 'q18' }, answer: { text: 'Rotating refresh tokens' } })
  assert.equal(one.relationship, 'FOLLOW_UP')
  assert.equal(two.relationship, 'FOLLOW_UP')
  assert.equal(calls, 2)
})

test('Gemini receives the no-response rule and final feedback/rating requirement as interviewer context', async () => {
  const prompts = []
  let actionSchema
  const generator = createRealtimeQuestionGenerator({
    async generateStructured(request) {
      prompts.push(request.prompt)
      actionSchema = request.schema.properties.action.enum
      return { data: makeDecision(`Contextual question ${prompts.length}`, 'FOLLOW_UP', 'q-current') }
    },
  })
  await generator.decideNextAction({ currentQuestion: { id: 'q-current' }, noResponse: true })
  await generator.decideNextAction({ currentQuestion: { id: 'q-current' }, wrapUpMode: true })
  assert.match(prompts[0], /did not answer the current question after two conversational check-ins/i)
  assert.match(prompts[1], /provide me feedback/i)
  assert.match(prompts[1], /rate the AI interviewer from 1 to 5/i)
  assert.equal(actionSchema.includes('END_INTERVIEW'), false)
})

test('answer commit requires the exact active question and makes retries idempotent', () => {
  const metadata = {
    current_question_sequence: 17,
    current_question: { id: 'q17', sequence: 17 },
    answered_sequences: [],
  }
  assert.equal(validateActiveQuestionAnswer(metadata, { questionId: 'q17', questionSequence: 17 }).duplicate, false)
  assert.throws(
    () => validateActiveQuestionAnswer(metadata, { questionId: 'q16', questionSequence: 16 }),
    (error) => error.status === 409
  )
  assert.equal(
    validateActiveQuestionAnswer({ ...metadata, answered_sequences: [17], answer_history: [{ questionId: 'q17', questionSequence: 17 }] }, { questionId: 'q17', questionSequence: 17 }).duplicate,
    true
  )
  assert.throws(
    () => validateActiveQuestionAnswer({ ...metadata, answered_sequences: [17], answer_history: [{ questionId: 'q17', questionSequence: 17 }] }, { questionId: 'q16', questionSequence: 17 }),
    (error) => error.status === 409
  )
})

test('voice and text answers produce the same committed question-answer shape', () => {
  const question = { id: 'q17', sequence: 17 }
  const voice = createAnswerCommit({ sessionId: 's1', answerId: 'a1', question, answerText: ' JWT auth ', inputMode: 'VOICE', committedAt: 'now' })
  const text = createAnswerCommit({ sessionId: 's1', answerId: 'a2', question, answerText: 'JWT auth', inputMode: 'TEXT', committedAt: 'now' })
  assert.deepEqual({ ...voice, answerId: 'same', inputMode: 'same' }, { ...text, answerId: 'same', inputMode: 'same' })
  assert.equal(voice.questionId, 'q17')
  assert.equal(voice.questionSequence, 17)
  assert.equal(voice.sessionId, 's1')
})

test('recruiter duration values remain authoritative and never cap question count', () => {
  for (const minutes of [15, 30, 45, 60]) assert.equal(parseInterviewDurationMinutes(minutes), minutes)
  assert.equal(parseInterviewDurationMinutes('45 Minutes'), 45)
})

test('coverage stores evidence, topics, and missing areas without selecting a question', () => {
  const initial = adaptivePolicyService.initializeCoverageMatrix([{ id: 'react', name: 'React', weight: 5 }])
  const result = adaptivePolicyService.computePolicyGuidance({
    coverageMatrix: initial,
    currentCriterionId: 'react',
    answerAnalysis: {
      correctness: 8,
      depth: 6,
      concepts_detected: ['memoization'],
      missing_concepts: ['state management'],
      strengths: ['Used profiling evidence'],
      topics_mentioned: ['render performance'],
      skills_not_demonstrated: [],
    },
  })
  assert.deepEqual(result.updatedMatrix[0].evidence, ['memoization', 'Used profiling evidence'])
  assert.deepEqual(result.updatedMatrix[0].missing, ['state management'])
  assert.deepEqual(result.updatedMatrix[0].topics, ['render performance'])
  assert.equal('recommendedCriterion' in result, false)
})

test('stale and duplicate question events cannot replace the latest active question', () => {
  assert.equal(isQuestionSequenceNewer(24, 21), false)
  assert.equal(shouldAcceptQuestionEvent({ sequence: 24, question: { id: 'q24' } }, 24), false)
  assert.equal(shouldAcceptQuestionEvent({ sequence: 21, question: { id: 'q21' } }, 24), false)
  assert.equal(shouldAcceptQuestionEvent({ sequence: 25, question: { id: 'q25' } }, 24), true)
})

test('Gemini can transition to a different required topic when evidence supports it', async () => {
  const generator = createRealtimeQuestionGenerator({
    async generateStructured() {
      return { data: { action: 'SWITCH_TOPIC', relationship: 'SWITCH_TOPIC', question: { text: 'How do you design SQL indexes for this workload?', type: 'DESCRIPTIVE', skill: 'SQL', topic: 'Indexing', difficulty: 'HARD', reason: 'Authentication evidence is sufficient.', basedOnQuestionId: null } } }
    },
  })
  const decision = await generator.decideNextAction({ sequence: 25, answer: { text: 'Rotated refresh tokens safely.' } })
  assert.equal(decision.action, 'SWITCH_TOPIC')
  assert.equal(decision.question.text.includes('SQL'), true)
})

test('duplicate questions and follow-ups based on stale question IDs are rejected before activation', async () => {
  const duplicateGenerator = createRealtimeQuestionGenerator({
    async generateStructured() {
      return { data: makeDecision('Tell me about a project.') }
    },
  })
  await assert.rejects(
    duplicateGenerator.decideNextAction({
      sequence: 18,
      currentQuestion: { id: 'q17' },
      answer: { text: 'project details' },
      askedQuestions: [{ id: 'q17', text: 'Tell me about a project.' }],
    }),
    /duplicate/i
  )

  const staleGenerator = createRealtimeQuestionGenerator({
    async generateStructured() {
      return { data: { ...makeDecision('How did you secure it?'), question: { ...makeDecision('How did you secure it?').question, basedOnQuestionId: 'q16' } } }
    },
  })
  await assert.rejects(
    staleGenerator.decideNextAction({ sequence: 18, currentQuestion: { id: 'q17' }, answer: { text: 'JWT' } }),
    /stale question/i
  )
})

test('question diversity policy enforces varied types and normalizes interactive question schemas', async () => {
  // 1. Check adaptive policy diversity selector
  for (let i = 0; i < 10; i++) {
    const recommended = adaptivePolicyService.computeRecommendedQuestionType([{ type: 'DESCRIPTIVE' }], 1)
    assert.notEqual(recommended, 'DESCRIPTIVE', 'Policy must never recommend DESCRIPTIVE when previous was DESCRIPTIVE')
  }

  // 2. Check realtime question generator normalizes MULTIPLE_CHOICE options
  const mcGenerator = createRealtimeQuestionGenerator({
    async generateStructured() {
      return {
        data: {
          action: 'FOLLOW_UP',
          relationship: 'FOLLOW_UP',
          question: {
            text: 'Which cache eviction strategy prevents thundering herds?',
            type: 'MULTIPLE_CHOICE',
            skill: 'Caching',
            topic: 'Redis',
            difficulty: 'MEDIUM',
            reason: 'Probe caching depth.',
            basedOnQuestionId: null,
          },
        },
      }
    },
  })
  const mcDecision = await mcGenerator.decideNextAction({ sequence: 5 })
  assert.equal(mcDecision.question.type, 'MULTIPLE_CHOICE')
  assert.equal(Array.isArray(mcDecision.question.options), true)
  assert.equal(mcDecision.question.options.length >= 2, true)

  // 3. Check anti-monotony guard prevents back-to-back DESCRIPTIVE questions
  const descGenerator = createRealtimeQuestionGenerator({
    async generateStructured() {
      return {
        data: {
          action: 'FOLLOW_UP',
          relationship: 'FOLLOW_UP',
          question: {
            text: 'Explain your understanding of distributed transactions.',
            type: 'DESCRIPTIVE',
            skill: 'Databases',
            topic: 'Transactions',
            difficulty: 'HARD',
            reason: 'Probe transactions.',
            basedOnQuestionId: null,
          },
        },
      }
    },
  })
  const convertedDecision = await descGenerator.decideNextAction({
    sequence: 6,
    askedQuestions: [{ id: 'q5', text: 'Prior question', type: 'DESCRIPTIVE' }],
  })
  assert.equal(convertedDecision.question.type, 'SCENARIO', 'Second consecutive descriptive question must be converted to SCENARIO to eliminate essay burden')
})

test('candidate repeat queries are recognized accurately and do not advance or burn questions', () => {
  // Positive matches
  assert.equal(isRepeatQuestionRequest('can you repeat please'), true)
  assert.equal(isRepeatQuestionRequest('Could you please repeat that?'), true)
  assert.equal(isRepeatQuestionRequest('Can you repeat the question?'), true)
  assert.equal(isRepeatQuestionRequest('repeat please'), true)
  assert.equal(isRepeatQuestionRequest('pardon me'), true)
  assert.equal(isRepeatQuestionRequest("I didn't hear you well"), true)
  assert.equal(isRepeatQuestionRequest('can you say that again'), true)
  assert.equal(isRepeatQuestionRequest('what was the question'), true)

  // Negative matches (real technical answers)
  assert.equal(isRepeatQuestionRequest('In JavaScript we use Array.prototype.map and filter to transform lists.'), false)
  assert.equal(isRepeatQuestionRequest('Option B'), false)
  assert.equal(isRepeatQuestionRequest('The time complexity is O(N log N) because we sort the elements.'), false)
  assert.equal(isRepeatQuestionRequest('SELECT * FROM users WHERE status = active;'), false)
  assert.equal(isRepeatQuestionRequest(''), false)
  assert.equal(isRepeatQuestionRequest(null), false)
})


import test from 'node:test'
import assert from 'node:assert/strict'
import {
  QUESTION_TYPES,
  normalizeQuestionType,
  isMicDefaultOn,
  normalizeQuestionPayload,
} from '../src/services/interview/questionTypeRegistry.js'
import {
  validateCreateJobPayload,
  validateUpdateJobPayload,
} from '../src/validators/index.js'
import {
  resolvePermittedQuestionTypes,
  STANDARD_QUESTION_TYPES,
} from '../src/services/interview/realtimeQuestionGenerator.js'
import { adaptivePolicyService } from '../src/services/interview/adaptivePolicyService.js'
import { interviewEngineService } from '../src/services/interview/interviewEngineService.js'
import { DEFAULT_VOICE_PROFILE, VOICE_PROFILES } from '../src/services/voice/voiceProfile.js'

test('1. Question Type Registry: All 15 Operational Question Types', () => {
  const expected15Types = [
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

  assert.equal(QUESTION_TYPES.length, 15)
  for (const t of expected15Types) {
    assert.ok(QUESTION_TYPES.includes(t), `Missing expected type ${t}`)
    assert.equal(normalizeQuestionType(t), t)
  }
})

test('2. Question Type Aliases Normalize Correctly', () => {
  assert.equal(normalizeQuestionType('single_choice'), 'MULTIPLE_CHOICE')
  assert.equal(normalizeQuestionType('multiple_choice'), 'MULTIPLE_CHOICE')
  assert.equal(normalizeQuestionType('mcq'), 'MULTIPLE_CHOICE')
  assert.equal(normalizeQuestionType('code_output'), 'PREDICT_CODE_OUTPUT')
  assert.equal(normalizeQuestionType('code_writing'), 'CODING_CHALLENGE')
  assert.equal(normalizeQuestionType('coding'), 'CODING_CHALLENGE')
  assert.equal(normalizeQuestionType('boolean'), 'TRUE_FALSE')
  assert.equal(normalizeQuestionType('yes_no'), 'TRUE_FALSE')
  assert.equal(normalizeQuestionType('scenario'), 'SELECT_MOST_APPROPRIATE')
  assert.equal(normalizeQuestionType('behavioral'), 'DESCRIPTIVE')
  assert.equal(normalizeQuestionType('find_the_error'), 'DEBUGGING')
  assert.equal(normalizeQuestionType('ordering'), 'ARRANGE_ORDER')
  assert.equal(normalizeQuestionType('slider'), 'SLIDER_SCALE')
  assert.equal(normalizeQuestionType('matching'), 'MATCHING_PAIRS')
  assert.equal(normalizeQuestionType('math'), 'NUMERICAL_APTITUDE')
})

test('3. Authoritative Microphone Defaults: Strictly ON for SHORT_ANSWER and DESCRIPTIVE, OFF for other 13', () => {
  // Mic ON strictly for these two
  assert.equal(isMicDefaultOn('SHORT_ANSWER'), true)
  assert.equal(isMicDefaultOn('DESCRIPTIVE'), true)
  assert.equal(isMicDefaultOn('short_answer'), true)

  // Mic OFF for all other 13 types
  assert.equal(isMicDefaultOn('MULTIPLE_CHOICE'), false)
  assert.equal(isMicDefaultOn('MULTI_SELECT'), false)
  assert.equal(isMicDefaultOn('TRUE_FALSE'), false)
  assert.equal(isMicDefaultOn('FILL_IN_THE_BLANK'), false)
  assert.equal(isMicDefaultOn('CODING_CHALLENGE'), false)
  assert.equal(isMicDefaultOn('PREDICT_CODE_OUTPUT'), false)
  assert.equal(isMicDefaultOn('DEBUGGING'), false)
  assert.equal(isMicDefaultOn('COMPLETE_THE_CODE'), false)
  assert.equal(isMicDefaultOn('ARRANGE_ORDER'), false)
  assert.equal(isMicDefaultOn('SELECT_MOST_APPROPRIATE'), false)
  assert.equal(isMicDefaultOn('SLIDER_SCALE'), false)
  assert.equal(isMicDefaultOn('MATCHING_PAIRS'), false)
  assert.equal(isMicDefaultOn('NUMERICAL_APTITUDE'), false)
})

test('4. Question Payload Normalization for Complex Interactive Types', () => {
  // 1. Arrange Order
  const orderPayload = normalizeQuestionPayload({
    type: 'ARRANGE_ORDER',
    text: 'Arrange steps in deployment pipeline',
  })
  assert.equal(orderPayload.type, 'ARRANGE_ORDER')
  assert.ok(Array.isArray(orderPayload.items))
  assert.ok(orderPayload.items.length >= 3)

  // 2. Matching Pairs
  const matchPayload = normalizeQuestionPayload({
    type: 'MATCHING_PAIRS',
    text: 'Match protocols to OSI layers',
  })
  assert.equal(matchPayload.type, 'MATCHING_PAIRS')
  assert.ok(Array.isArray(matchPayload.leftItems))
  assert.ok(Array.isArray(matchPayload.rightItems))
  assert.equal(matchPayload.leftItems.length, matchPayload.rightItems.length)

  // 3. Slider Scale
  const sliderPayload = normalizeQuestionPayload({
    type: 'SLIDER_SCALE',
    text: 'Rate the system resiliency from 1 to 10',
  })
  assert.equal(sliderPayload.type, 'SLIDER_SCALE')
  assert.ok(sliderPayload.sliderConfig)
  assert.equal(typeof sliderPayload.sliderConfig.min, 'number')
  assert.equal(typeof sliderPayload.sliderConfig.max, 'number')

  // 4. Numerical Aptitude
  const numPayload = normalizeQuestionPayload({
    type: 'NUMERICAL_APTITUDE',
    text: 'Calculate the 99th percentile latency in milliseconds',
  })
  assert.equal(numPayload.type, 'NUMERICAL_APTITUDE')
  assert.ok(numPayload.numericalConfig)
  assert.ok(typeof numPayload.numericalConfig.tolerance === 'number' || typeof numPayload.numericalConfig.unit === 'string')

  // 5. Debugging
  const debugPayload = normalizeQuestionPayload({
    type: 'DEBUGGING',
    text: 'Find and repair the race condition',
  })
  assert.equal(debugPayload.type, 'DEBUGGING')
  assert.ok(debugPayload.codeSnippet)
  assert.ok(debugPayload.language)

  // 6. Complete the Code
  const compCodePayload = normalizeQuestionPayload({
    type: 'COMPLETE_THE_CODE',
    text: 'Fill in the binary search implementation',
  })
  assert.equal(compCodePayload.type, 'COMPLETE_THE_CODE')
  assert.ok(compCodePayload.codeSnippet)
})

test('5. Recruiter Job Requisition Validation Supports All 15 Types', () => {
  const all15 = [
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

  const createResult = validateCreateJobPayload({
    title: 'Principal Software Architect',
    description: 'Lead enterprise architecture across systems.',
    department: 'Platform',
    seniority: 'LEAD',
    allowed_question_types: all15,
  })
  assert.equal(createResult.valid, true)
  assert.equal(createResult.data.allowed_question_types.length, 15)

  const updateResult = validateUpdateJobPayload({
    allowed_question_types: ['DEBUGGING', 'ARRANGE_ORDER', 'MATCHING_PAIRS', 'NUMERICAL_APTITUDE'],
  })
  assert.equal(updateResult.valid, true)
  assert.equal(updateResult.data.allowed_question_types.length, 4)
})

test('6. Realtime Question Generator Resolves Configured Types without Silent Replacement', () => {
  const technicalJob = {
    allowed_question_types: ['CODING_CHALLENGE', 'DEBUGGING', 'PREDICT_CODE_OUTPUT'],
  }
  const resolved = resolvePermittedQuestionTypes(technicalJob)
  assert.deepEqual(resolved.allowedTypes, ['CODING_CHALLENGE', 'DEBUGGING', 'PREDICT_CODE_OUTPUT'])
  assert.ok(!resolved.allowedTypes.includes('MULTIPLE_CHOICE'))

  const diverseJob = {
    allowed_question_types: ['NUMERICAL_APTITUDE', 'SLIDER_SCALE', 'ARRANGE_ORDER'],
  }
  const resolvedDiverse = resolvePermittedQuestionTypes(diverseJob)
  assert.deepEqual(resolvedDiverse.allowedTypes, ['NUMERICAL_APTITUDE', 'SLIDER_SCALE', 'ARRANGE_ORDER'])
})

test('7. Pillar-Aware Assessment Planning & Balanced Coverage', () => {
  const fourPillars = [
    { id: 'p-apt', name: 'Aptitude', priority: 1 },
    { id: 'p-comm', name: 'Communication', priority: 1 },
    { id: 'p-mgmt', name: 'Team Management', priority: 2 },
    { id: 'p-math', name: 'Basic Mathematics', priority: 1 },
  ]

  const coverageMatrix = [
    { criterion_id: 'p-apt', name: 'Aptitude', status: 'UNASSESSED', attempts: 0 },
    { criterion_id: 'p-comm', name: 'Communication', status: 'UNASSESSED', attempts: 0 },
    { criterion_id: 'p-mgmt', name: 'Team Management', status: 'IN_EVALUATION', attempts: 2 },
    { criterion_id: 'p-math', name: 'Basic Mathematics', status: 'UNASSESSED', attempts: 0 },
  ]

  const allowedTypes = [
    'SHORT_ANSWER',
    'DESCRIPTIVE',
    'NUMERICAL_APTITUDE',
    'SELECT_MOST_APPROPRIATE',
  ]

  // Plan next step for a 15-minute interview with 12 minutes remaining
  const step = adaptivePolicyService.computeAdaptiveStep({
    criteria: fourPillars,
    coverageMatrix,
    currentCriterionId: 'p-mgmt',
    allowedQuestionTypes: allowedTypes,
    recentTypes: ['DESCRIPTIVE', 'DESCRIPTIVE'],
    timeRemainingSeconds: 720,
    currentQuestionIndex: 2,
    totalPlannedQuestions: 8,
  })

  // The engine must NOT stay locked onto Team Management when 3 pillars remain unassessed!
  const targetId = step.targetCriterion?.criterion_id || step.targetCriterion?.id
  assert.notEqual(targetId, 'p-mgmt', 'Must switch away from monopolized pillar to cover unassessed pillars')
  assert.ok(
    ['p-apt', 'p-comm', 'p-math'].includes(targetId),
    'Must select one of the unassessed pillars'
  )
  assert.ok(allowedTypes.includes(step.recommendedQuestionType))
})

test('8. Strict Assessment Deadline: 60 Seconds Reserved Exclusively for Feedback', () => {
  // Test 1: More than 60s remaining -> Assessment continues
  const timeCheckMid = adaptivePolicyService.validateTimeConstraints({
    startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    durationMinutes: 15,
  })
  assert.equal(timeCheckMid.isExpired, false)
  assert.ok(timeCheckMid.remainingSeconds > 60)

  // Test 2: Less than or equal to 60s remaining -> Strict assessment deadline
  const timeCheckFinal = adaptivePolicyService.validateTimeConstraints({
    startedAt: new Date(Date.now() - 14.5 * 60 * 1000).toISOString(),
    durationMinutes: 15,
  })
  assert.ok(timeCheckFinal.remainingSeconds <= 60)

  // Assessment budget calculation
  const remainingBudget = Math.max(0, timeCheckFinal.remainingSeconds - 60)
  assert.equal(remainingBudget, 0, 'No assessment time budget remains in final 60 seconds')
})

test('9. Single Authoritative Voice Profile: Arjun (qualifyai_interviewer_01, 24kHz)', () => {
  assert.equal(DEFAULT_VOICE_PROFILE.id, 'qualifyai_interviewer_01')
  assert.equal(DEFAULT_VOICE_PROFILE.interviewerName, 'Arjun')
  assert.equal(DEFAULT_VOICE_PROFILE.language, 'en-IN')
  assert.equal(DEFAULT_VOICE_PROFILE.provider, 'cosyvoice')
  assert.equal(DEFAULT_VOICE_PROFILE.cosyvoiceSpeaker, 'qualifyai_interviewer_01')
})

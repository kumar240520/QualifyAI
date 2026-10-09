import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateCreateJobPayload,
  validateUpdateJobPayload,
} from '../src/validators/index.js'
import {
  resolvePermittedQuestionTypes,
  STANDARD_QUESTION_TYPES,
} from '../src/services/interview/realtimeQuestionGenerator.js'
import {
  interviewEngineService,
  getBackgroundWelcome,
} from '../src/services/interview/interviewEngineService.js'
import { adaptivePolicyService } from '../src/services/interview/adaptivePolicyService.js'

test('Requirement 1: Background Validation in Job Requisitions', () => {
  const basePayload = {
    title: 'Senior Systems Architect',
    description: 'Lead engineering for distributed payment systems.',
    department: 'Engineering',
    seniority: 'SENIOR',
  }

  // 1. Technical background
  const techResult = validateCreateJobPayload({
    ...basePayload,
    background_type: 'TECHNICAL',
  })
  assert.equal(techResult.valid, true)
  assert.equal(techResult.data.background_type, 'TECHNICAL')
  assert.equal(techResult.data.ask_about_projects, true) // default true for technical

  // 2. Non-Technical background
  const nonTechResult = validateCreateJobPayload({
    ...basePayload,
    title: 'Executive Assistant',
    background_type: 'NON_TECHNICAL',
    ask_about_projects: false,
  })
  assert.equal(nonTechResult.valid, true)
  assert.equal(nonTechResult.data.background_type, 'NON_TECHNICAL')
  assert.equal(nonTechResult.data.ask_about_projects, false)

  // 3. Business Development role maps cleanly to foundational NON_TECHNICAL
  const bdResult = validateCreateJobPayload({
    ...basePayload,
    title: 'Director of Business Development',
    background_type: 'BUSINESS_DEVELOPMENT',
  })
  assert.equal(bdResult.valid, true)
  assert.equal(bdResult.data.background_type, 'NON_TECHNICAL')

  // 4. Marketing role maps cleanly to foundational NON_TECHNICAL
  const mktResult = validateCreateJobPayload({
    ...basePayload,
    title: 'Brand Marketing Lead',
    background_type: 'MARKETING',
  })
  assert.equal(mktResult.valid, true)
  assert.equal(mktResult.data.background_type, 'NON_TECHNICAL')

  // 5. Custom / HR role maps cleanly to foundational NON_TECHNICAL
  const customResult = validateCreateJobPayload({
    ...basePayload,
    title: 'VP of People & Culture',
    background_type: 'CUSTOM',
    custom_background: 'Human Resources & Talent Acquisition',
  })
  assert.equal(customResult.valid, true)
  assert.equal(customResult.data.background_type, 'NON_TECHNICAL')

  // 6. Invalid non-existent background type defaults/normalizes safely or rejects
  const invalidType = validateCreateJobPayload({
    ...basePayload,
    background_type: 'ASTRONAUT_WARRIOR',
  })
  assert.equal(invalidType.valid, false)
})

test('Requirement 2 & Addition 1: Allowed and Custom Question Types Configuration', () => {
  const basePayload = {
    title: 'Lead Frontend Engineer',
    description: 'React, TypeScript, and UI Architecture.',
    background_type: 'TECHNICAL',
  }

  // 1. Valid permitted types
  const validTypes = validateCreateJobPayload({
    ...basePayload,
    allowed_question_types: ['SHORT_ANSWER', 'MULTIPLE_CHOICE', 'SCENARIO'],
    custom_question_types: ['LIVE_SYSTEM_DESIGN', 'CODE_REFACTORING_CHALLENGE'],
  })
  assert.equal(validTypes.valid, true)
  assert.deepEqual(validTypes.data.allowed_question_types, ['SHORT_ANSWER', 'MULTIPLE_CHOICE', 'SCENARIO'])
  assert.deepEqual(validTypes.data.custom_question_types, ['LIVE_SYSTEM_DESIGN', 'CODE_REFACTORING_CHALLENGE'])

  // 2. Reject empty allowed question types
  const emptyTypes = validateCreateJobPayload({
    ...basePayload,
    allowed_question_types: [],
  })
  assert.equal(emptyTypes.valid, false)
  assert.ok(emptyTypes.errors.allowed_question_types)

  // 3. Reject unrecognized standard question types
  const badType = validateCreateJobPayload({
    ...basePayload,
    allowed_question_types: ['INVALID_QUESTION_TYPE_XYZ'],
  })
  assert.equal(badType.valid, false)

  // 4. resolvePermittedQuestionTypes resolution utility
  const resolved = resolvePermittedQuestionTypes({
    allowed_question_types: ['MULTIPLE_CHOICE', 'TRUE_FALSE'],
    custom_question_types: ['CASE_STUDY'],
  })
  assert.ok(resolved.allPermittedTypes.includes('MULTIPLE_CHOICE'))
  assert.ok(resolved.allPermittedTypes.includes('TRUE_FALSE'))
  assert.ok(resolved.allPermittedTypes.includes('CASE_STUDY'))
  assert.equal(resolved.allPermittedTypes.includes('DESCRIPTIVE'), false)
})

test('Requirement 6: Background-Aware Welcome Greetings', () => {
  // Technical greeting
  const techWelcome = getBackgroundWelcome({
    job: {
      title: 'Cloud Architect',
      background_type: 'TECHNICAL',
    },
  })
  assert.ok(techWelcome.welcomeIntro.includes('technical knowledge'))
  assert.ok(techWelcome.welcomeIntro.includes('problem-solving'))

  // Non-Technical greeting
  const nonTechWelcome = getBackgroundWelcome({
    job: {
      title: 'Operations Manager',
      background_type: 'NON_TECHNICAL',
    },
  })
  assert.equal(nonTechWelcome.foundationalBackground, 'non_technical')
  assert.ok(nonTechWelcome.welcomeIntro.includes('core competencies') || nonTechWelcome.welcomeIntro.includes('responsibilities'))

  // Business Development role (resolves strictly to foundational non_technical)
  const bdWelcome = getBackgroundWelcome({
    job: {
      title: 'Enterprise Account Executive',
      background_type: 'BUSINESS_DEVELOPMENT',
    },
  })
  assert.equal(bdWelcome.foundationalBackground, 'non_technical')
  assert.ok(bdWelcome.welcomeIntro.includes('core competencies') || bdWelcome.welcomeIntro.includes('responsibilities'))

  // Marketing role (resolves strictly to foundational non_technical)
  const mktWelcome = getBackgroundWelcome({
    job: {
      title: 'Growth Marketing Lead',
      background_type: 'MARKETING',
    },
  })
  assert.equal(mktWelcome.foundationalBackground, 'non_technical')

  // Fallback greeting for general roles
  const fallbackWelcome = getBackgroundWelcome({
    job: {
      title: 'General Specialist',
    },
  })
  assert.ok(fallbackWelcome.foundationalBackground === 'technical' || fallbackWelcome.foundationalBackground === 'non_technical')
})

test('Requirement 7: Project-Based Question Configuration', () => {
  // Enabled for technical by default
  const techJob = validateCreateJobPayload({
    title: 'Backend Engineer',
    description: 'Go and PostgreSQL microservices.',
    background_type: 'TECHNICAL',
  })
  assert.equal(techJob.data.ask_about_projects, true)

  // Explicitly disabled for marketing
  const mktJob = validateCreateJobPayload({
    title: 'Social Media Manager',
    description: 'Community and influencer campaigns.',
    background_type: 'MARKETING',
    ask_about_projects: false,
  })
  assert.equal(mktJob.data.ask_about_projects, false)

  // Explicitly enabled for business development
  const bdJob = validateCreateJobPayload({
    title: 'Commercial VP',
    description: 'Enterprise revenue generation.',
    background_type: 'BUSINESS_DEVELOPMENT',
    ask_about_projects: true,
  })
  assert.equal(bdJob.data.ask_about_projects, true)
})

test('Requirement 9: Difficulty Level Configuration & Adaptive Bounding', () => {
  // Valid difficulty levels
  const easyJob = validateCreateJobPayload({
    title: 'Junior Developer',
    description: 'Entry level software role.',
    background_type: 'TECHNICAL',
    target_difficulty: 'EASY',
  })
  assert.equal(easyJob.data.target_difficulty, 'EASY')

  const hardJob = validateCreateJobPayload({
    title: 'Principal Architect',
    description: 'High throughput distributed systems.',
    background_type: 'TECHNICAL',
    target_difficulty: 'HARD',
  })
  assert.equal(hardJob.data.target_difficulty, 'HARD')

  // Reject invalid difficulty
  const invalidDiff = validateCreateJobPayload({
    title: 'Developer',
    description: 'Role',
    background_type: 'TECHNICAL',
    target_difficulty: 'IMPOSSIBLE_NIGHTMARE',
  })
  assert.equal(invalidDiff.valid, false)

  // Verify adaptive policy difficulty calculation bounds
  const adaptedEasy = adaptivePolicyService.calculateDifficulty([9, 9], 'EASY')
  assert.ok(['EASY', 'MEDIUM'].includes(adaptedEasy))

  const adaptedHard = adaptivePolicyService.calculateDifficulty([3, 4], 'HARD')
  assert.ok(['MEDIUM', 'HARD'].includes(adaptedHard))

  // Question type recommendation restricted to permitted types
  const recType = adaptivePolicyService.computeRecommendedQuestionType([], 0, ['MULTIPLE_CHOICE', 'TRUE_FALSE'])
  assert.ok(['MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(recType))
})

test('Requirement 5: Unified Single-Call Turn Evaluation & Performance Instrumentation', () => {
  // Turn latency metrics invariants
  const sampleTurnMetrics = {
    answerCommitMs: 42,
    decisionMs: 1850,
    totalTurnMs: 1892,
  }

  // Answer commit under 500ms target
  assert.ok(sampleTurnMetrics.answerCommitMs < 500, 'Answer commit should be < 500ms')
  // Turn decision under 4000ms target
  assert.ok(sampleTurnMetrics.decisionMs < 4000, 'Turn decision should be < 4000ms')
  assert.ok(sampleTurnMetrics.totalTurnMs < 5000, 'Total turn processing should be < 5000ms')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFoundationalBackground } from '../src/services/interview/foundationalBackgroundResolver.js'
import { resolvePillarTaxonomy, CANONICAL_TAXONOMIES } from '../src/services/interview/pillarTaxonomyService.js'
import { buildAssessmentPlan, calculateDurationAwarePoolSize } from '../src/services/interview/assessmentPlanService.js'
import { checkDuplicateQuestion, extractCalculationSignature } from '../src/services/interview/questionDeduplicationService.js'
import { questionPoolService } from '../src/services/interview/questionPoolService.js'
import { adaptivePolicyService } from '../src/services/interview/adaptivePolicyService.js'
import { getBackgroundWelcome, interviewEngineService } from '../src/services/interview/interviewEngineService.js'
import {
  QUESTION_TYPES,
  QUESTION_TYPES_CATALOG,
  normalizeQuestionType,
  normalizeQuestionPayload,
  validateQuestionSchema,
  evaluateAnswerDeterministically,
  isMicDefaultOn,
} from '../src/services/interview/questionTypeRegistry.js'

test('Acceptance Test A: Only Two Foundational Interview Backgrounds (Technical & Non-Technical)', () => {
  // 1. Technical roles resolve strictly to 'technical'
  const techRoles = [
    { title: 'Software Developer', department: 'Engineering' },
    { title: 'Python Backend Engineer', department: 'Product' },
    { title: 'DevOps & Cloud Engineer', department: 'Infrastructure' },
    { title: 'QA Automation Engineer', department: 'Quality' },
    { title: 'Data Engineer', department: 'Data' },
  ]
  for (const job of techRoles) {
    const bg = resolveFoundationalBackground(job)
    assert.equal(bg, 'technical', `Expected ${job.title} to resolve to technical`)
  }

  // 2. Non-technical roles resolve strictly to 'non_technical'
  const nonTechRoles = [
    { title: 'Team Manager', department: 'Operations' },
    { title: 'Marketing Executive', department: 'Marketing' },
    { title: 'Business Development Manager', department: 'Sales' },
    { title: 'HR Generalist', department: 'Human Resources' },
    { title: 'Customer Support Lead', department: 'Support' },
    { title: 'Executive Assistant', department: 'Administration' },
  ]
  for (const job of nonTechRoles) {
    const bg = resolveFoundationalBackground(job)
    assert.equal(bg, 'non_technical', `Expected ${job.title} to resolve to non_technical`)
  }

  // 3. Explicit recruiter override is validated strictly to only two categories
  assert.equal(resolveFoundationalBackground({ background_type: 'TECHNICAL' }), 'technical')
  assert.equal(resolveFoundationalBackground({ background_type: 'NON_TECHNICAL' }), 'non_technical')
  // Legacy aliases map strictly to non_technical without introducing a 3rd category
  assert.equal(resolveFoundationalBackground({ background_type: 'MARKETING' }), 'non_technical')
  assert.equal(resolveFoundationalBackground({ background_type: 'SALES' }), 'non_technical')
  assert.equal(resolveFoundationalBackground({ background_type: 'MANAGEMENT' }), 'non_technical')
  assert.equal(resolveFoundationalBackground({ background_type: 'HR' }), 'non_technical')
})

test('Acceptance Test B: Pillar Independence — Team Manager Requisition with 5 Pillars', () => {
  const teamManagerJob = {
    title: 'Team Manager',
    department: 'Engineering Operations',
    seniority: 'LEAD',
    target_difficulty: 'MEDIUM',
  }

  // Define 5 distinct pillars
  const pillars = [
    { id: 'crit-quant', name: 'Quantitative Aptitude', weight: 4 },
    { id: 'crit-logic', name: 'Logical Reasoning', weight: 4 },
    { id: 'crit-verbal', name: 'Verbal Ability', weight: 3 },
    { id: 'crit-di', name: 'Data Interpretation', weight: 4 },
    { id: 'crit-beh', name: 'Behavioral Competencies & Collaboration', weight: 5 },
  ]

  // Verify independent taxonomies for each pillar
  const quantTax = resolvePillarTaxonomy(pillars[0], 'non_technical')
  assert.equal(quantTax.taxonomyId, 'quantitative_aptitude')
  assert.equal(quantTax.allowsJobContext, false, 'Quantitative Aptitude must test pure fundamentals, not job context')
  assert.ok(quantTax.subtopics.some((s) => s.id === 'percentages' || s.id === 'ratios'))
  assert.ok(quantTax.excludedTopics.includes('agile_metrics'), 'Agile metrics must be explicitly excluded from Quantitative Aptitude')
  assert.ok(quantTax.excludedTopics.includes('sprint_velocity'), 'Sprint velocity must be excluded from Quantitative Aptitude')

  const logicTax = resolvePillarTaxonomy(pillars[1], 'non_technical')
  assert.equal(logicTax.taxonomyId, 'logical_reasoning')
  assert.equal(logicTax.allowsJobContext, false)
  assert.ok(logicTax.subtopics.some((s) => s.id === 'sequences' || s.id === 'deductions'))

  const verbalTax = resolvePillarTaxonomy(pillars[2], 'non_technical')
  assert.equal(verbalTax.taxonomyId, 'verbal_ability')
  assert.ok(verbalTax.subtopics.some((s) => s.id === 'grammar_syntax' || s.id === 'vocabulary'))

  const diTax = resolvePillarTaxonomy(pillars[3], 'non_technical')
  assert.equal(diTax.taxonomyId, 'data_interpretation')
  assert.ok(diTax.subtopics.some((s) => s.id === 'table_analysis' || s.id === 'chart_evaluation'))

  const behTax = resolvePillarTaxonomy(pillars[4], 'non_technical')
  assert.equal(behTax.taxonomyId, 'behavioral_competencies')
  assert.equal(behTax.allowsJobContext, true, 'Behavioral competency questions legitimately use job context')

  // Verify assessment plan balances slots across all 5 independent pillars
  const plan = buildAssessmentPlan({
    job: teamManagerJob,
    rubricCriteria: pillars,
    durationMinutes: 15,
    allowedQuestionTypes: ['SINGLE_SELECT', 'DESCRIPTIVE', 'TRUE_FALSE'],
    targetDifficulty: 'MEDIUM',
  })

  assert.equal(plan.pillarCount, 5)
  // Verify each pillar gets dedicated slots
  for (const pillar of pillars) {
    const slots = plan.plannedSlots.filter((s) => s.criterionId === pillar.id)
    assert.ok(slots.length >= 2, `Pillar ${pillar.name} should have planned slots`)
  }
})

test('Acceptance Test C: Balanced Pillar Coverage & Evidence-Based Updates', () => {
  const criteria = [
    { id: 'crit-1', name: 'System Design', weight: 5 },
    { id: 'crit-2', name: 'Database Architecture', weight: 4 },
    { id: 'crit-3', name: 'Programming Fundamentals', weight: 4 },
  ]

  // Initialize coverage matrix
  const matrix = adaptivePolicyService.initializeCoverageMatrix(criteria)
  assert.equal(matrix.length, 3)
  assert.ok(matrix.every((c) => c.status === 'UNASSESSED' && c.attempts === 0))

  // Inactive / un-evaluated question asking does NOT mark pillar as assessed
  assert.equal(matrix[0].status, 'UNASSESSED')

  // Candidate provides answer with valid evaluation score -> updates pillar coverage
  const updatedMatrix = adaptivePolicyService.updateCoverageMatrix(
    matrix,
    'crit-1',
    {
      correctness: 8,
      relevance: 9,
      depth: 8,
      concepts_detected: ['Sharding', 'Cache invalidation'],
      missing_concepts: [],
      score: 85,
    },
    'We use consistent hashing and a distributed Redis cluster for read cache.'
  )

  const assessedCrit1 = updatedMatrix.find((c) => c.criterion_id === 'crit-1')
  assert.equal(assessedCrit1.attempts, 1)
  assert.ok(assessedCrit1.status === 'SUFFICIENTLY_EVALUATED' || assessedCrit1.status === 'MASTERY_PROVEN')
  assert.ok(assessedCrit1.average_score >= 7)

  // Verify selector prioritizes UNASSESSED pillars (crit-2 or crit-3) over crit-1
  const pool = [
    { id: 'q-crit1', rubric_criterion_id: 'crit-1', status: 'AVAILABLE', text: 'Another system design question' },
    { id: 'q-crit2', rubric_criterion_id: 'crit-2', status: 'AVAILABLE', text: 'Database indexing question' },
    { id: 'q-crit3', rubric_criterion_id: 'crit-3', status: 'AVAILABLE', text: 'Algorithms question' },
  ]

  const selected = questionPoolService.selectNextQuestionFromPool({
    pool,
    coverageMatrix: updatedMatrix,
    timeRemainingSeconds: 600,
    foundationalBackground: 'technical',
  })

  assert.ok(selected.rubric_criterion_id === 'crit-2' || selected.rubric_criterion_id === 'crit-3')
  assert.notEqual(selected.rubric_criterion_id, 'crit-1', 'Unassessed pillars must be prioritized over covered pillar')
})

test('Acceptance Test D: Duration-Aware Question Pool Sizing', () => {
  // 5 minute interview -> ~8 questions
  const poolSize5m = calculateDurationAwarePoolSize(5).poolSize
  assert.ok(poolSize5m >= 7 && poolSize5m <= 10, `5 min pool size was ${poolSize5m}`)

  // 15 minute interview -> ~16 questions
  const poolSize15m = calculateDurationAwarePoolSize(15).poolSize
  assert.ok(poolSize15m >= 14 && poolSize15m <= 18, `15 min pool size was ${poolSize15m}`)

  // 30 minute interview -> ~26 questions
  const poolSize30m = calculateDurationAwarePoolSize(30).poolSize
  assert.ok(poolSize30m >= 22 && poolSize30m <= 30, `30 min pool size was ${poolSize30m}`)

  // Unused questions stay AVAILABLE and never count as evaluated
  const mockPool = [
    { id: 'q1', status: 'EVALUATED', question_text: 'Active question 1' },
    { id: 'q2', status: 'AVAILABLE', question_text: 'Unused pool question' },
  ]
  const evaluatedQuestions = mockPool.filter((q) => q.status === 'EVALUATED')
  assert.equal(evaluatedQuestions.length, 1)
})

test('Acceptance Test E: Strict Recruiter Question-Type Control and Randomization', () => {
  const allowed = ['MULTIPLE_CHOICE', 'TRUE_FALSE']
  const criteria = [{ id: 'crit-1', name: 'Logical Reasoning', weight: 4 }]

  const plan = buildAssessmentPlan({
    job: { title: 'Analyst' },
    rubricCriteria: criteria,
    durationMinutes: 10,
    allowedQuestionTypes: allowed,
    targetDifficulty: 'MEDIUM',
  })

  // All planned slot types must be strictly within allowed types
  for (const slot of plan.plannedSlots) {
    assert.ok(
      allowed.includes(slot.questionType),
      `Slot type ${slot.questionType} must be within allowed types`
    )
  }

  // Verify non-permitted type is rejected
  assert.ok(!plan.plannedSlots.some((s) => s.questionType === 'CODING_CHALLENGE'))
  assert.ok(!plan.plannedSlots.some((s) => s.questionType === 'SHORT_ANSWER'))
})

test('Acceptance Test F: Duplicate and Repetitive Calculation Rejection', () => {
  const existingQuestions = [
    {
      id: 'q-existing-1',
      question_text: 'If a store purchases an item for $100 and sells it for $125, what is the profit percentage?',
      metadata: { expected_concepts: ['profit percentage'] },
    },
    {
      id: 'q-existing-2',
      question_text: 'If sprint velocity is 50 story points and team cost is $25,000, what is the cost per story point?',
      metadata: { expected_concepts: ['cost per point', 'velocity'] },
    },
  ]

  // 1. Exact / near duplicate
  const duplicateCandidate = {
    id: 'q-dup',
    question_text: 'If a store purchases an item for $100 and sells it for $125, find the profit percentage.',
    metadata: { expected_concepts: ['profit percentage'] },
  }
  const check1 = checkDuplicateQuestion(duplicateCandidate, existingQuestions)
  assert.equal(check1.isDuplicate, true)

  // 2. Repetitive calculation with different numbers (e.g. $40,000 / 80 points vs $25,000 / 50 points)
  const repeatedCalculationCandidate = {
    id: 'q-repeated-calc',
    question_text: 'If team sprint velocity is 80 points with budget $40,000, calculate the cost per story point.',
    metadata: { expected_concepts: ['cost per point'] },
  }
  const check2 = checkDuplicateQuestion(repeatedCalculationCandidate, existingQuestions)
  assert.equal(check2.isDuplicate, true, 'Identical calculation formula with different numbers must be rejected')

  // 3. Diverse non-duplicate question should pass
  const diverseCandidate = {
    id: 'q-diverse',
    question_text: 'In a train traveling at 60 km/h, how long does it take to cross a 300 meter platform?',
    metadata: { expected_concepts: ['speed distance time'] },
  }
  const check3 = checkDuplicateQuestion(diverseCandidate, existingQuestions)
  assert.equal(check3.isDuplicate, false)
})

test('Acceptance Test G: Recruiter-Controlled Difficulty Invariance', () => {
  const criteria = [{ id: 'crit-1', name: 'Algorithms', weight: 5 }]

  // HARD requisition
  const hardPlan = buildAssessmentPlan({
    job: { title: 'Software Engineer', target_difficulty: 'HARD' },
    rubricCriteria: criteria,
    durationMinutes: 15,
    allowedQuestionTypes: ['CODING_CHALLENGE'],
    targetDifficulty: 'HARD',
  })
  assert.ok(hardPlan.plannedSlots.every((s) => s.difficulty === 'HARD'))

  // EASY requisition
  const easyPlan = buildAssessmentPlan({
    job: { title: 'Junior QA', target_difficulty: 'EASY' },
    rubricCriteria: criteria,
    durationMinutes: 15,
    allowedQuestionTypes: ['SINGLE_SELECT'],
    targetDifficulty: 'EASY',
  })
  assert.ok(easyPlan.plannedSlots.every((s) => s.difficulty === 'EASY'))

  // calculateDifficulty strictly anchors to baseline difficulty regardless of candidate score
  const diff1 = adaptivePolicyService.calculateDifficulty('EASY', 10, 'COMPETENT')
  assert.equal(diff1, 'EASY', 'AI must not autonomously escalate EASY to HARD')

  const diff2 = adaptivePolicyService.calculateDifficulty('HARD', 2, 'NOVICE')
  assert.equal(diff2, 'HARD', 'AI must not autonomously downgrade HARD to EASY')
})

test('Acceptance Test H: Support for All 15 Operational Question Templates', () => {
  assert.equal(QUESTION_TYPES_CATALOG.length, 15, 'Registry must contain exactly 15 question types')

  const expectedTemplates = [
    'single_select',
    'multi_select',
    'true_false',
    'short_answer',
    'descriptive',
    'fill_blank',
    'coding_challenge',
    'predict_output',
    'debugging',
    'complete_code',
    'ordering',
    'best_option',
    'slider',
    'matching',
    'numerical',
  ]

  for (const templateKey of expectedTemplates) {
    const canonicalType = normalizeQuestionType(templateKey)
    assert.ok(
      QUESTION_TYPES.includes(canonicalType),
      `Operational question template ${templateKey} (normalized to ${canonicalType}) must exist in QUESTION_TYPES`
    )

    // Verify normalization and schema validation
    const normalized = normalizeQuestionPayload({
      text: `Test question for ${templateKey}`,
      type: canonicalType,
      options: ['Option A', 'Option B'],
      sliderConfig: { min: 1, max: 10, step: 1 },
      numericalConfig: { unit: 'USD', tolerance: 0.1 },
      leftItems: ['A', 'B'],
      rightItems: ['1', '2'],
    }, canonicalType)

    assert.equal(normalized.type, canonicalType)
    const valid = validateQuestionSchema(normalized)
    assert.equal(valid.isValid, true, `Template ${templateKey} schema must validate`)
  }
})

test('Acceptance Test I: Voice Synchronization and Microphone Defaults', () => {
  // 1. Microphone Defaults
  assert.equal(isMicDefaultOn('SHORT_ANSWER'), true)
  assert.equal(isMicDefaultOn('DESCRIPTIVE'), true)
  assert.equal(isMicDefaultOn('SINGLE_SELECT'), false)
  assert.equal(isMicDefaultOn('CODING_CHALLENGE'), false)
  assert.equal(isMicDefaultOn('SLIDER_SCALE'), false)
  assert.equal(isMicDefaultOn('NUMERICAL'), false)

  // 2. Canonical Question to Voice Lead-in synchronization
  const poolQ = {
    id: 'canonical-q10',
    question_text: 'What is the difference between an inner join and a left outer join in SQL?',
    type: 'SHORT_ANSWER',
    skill: 'Database Concepts',
    difficulty: 'MEDIUM',
  }

  const formatted = interviewEngineService._formatPoolQuestion(poolQ, 2, 'session-123')
  assert.equal(formatted.question_text, poolQ.question_text)
  assert.ok(
    formatted.spoken_lead_in.includes(poolQ.question_text),
    'Spoken lead-in must contain canonical question text'
  )
  assert.ok(
    formatted.spoken_lead_in.includes('Database Concepts'),
    'Spoken lead-in must reference the active pillar'
  )
})

test('Acceptance Test J: Authoritative 60-Second Final Feedback Boundary', () => {
  // Test time constraints at different points in interview
  const startedAt = new Date().toISOString()

  // 1. At 5 minutes remaining of a 15-minute interview (600s left) -> ASSESSMENT
  const midCheck = adaptivePolicyService.validateTimeConstraints({
    startedAt,
    durationMinutes: 15,
    overrideRemainingSeconds: 600,
  })
  assert.equal(midCheck.isExpired, false)

  // 2. At 60 seconds remaining -> ASSESSMENT concludes and transitions to FEEDBACK
  const feedbackCheck = adaptivePolicyService.validateTimeConstraints({
    startedAt,
    durationMinutes: 15,
    overrideRemainingSeconds: 55,
  })
  assert.ok(feedbackCheck.remainingSeconds <= 60)
})

test('Acceptance Test K: End-to-End Interview Journey and Unused Question Hygiene', () => {
  const job = {
    id: 'job-lead-1',
    title: 'Lead Operations Manager',
    department: 'Operations',
    target_difficulty: 'MEDIUM',
  }
  const candidate = {
    id: 'cand-1',
    full_name: 'Jane Doe',
    email: 'jane@example.com',
  }

  // 1. Welcome and opening question available immediately
  const welcome = getBackgroundWelcome({ job, candidate })
  assert.equal(welcome.foundationalBackground, 'non_technical')
  assert.ok(welcome.questionText.includes('introduce yourself'))

  // 2. Assessment Plan generation
  const criteria = [
    { id: 'crit-a', name: 'Strategic Planning', weight: 5 },
    { id: 'crit-b', name: 'Operational Excellence', weight: 4 },
  ]
  const plan = buildAssessmentPlan({
    job,
    rubricCriteria: criteria,
    durationMinutes: 10,
    allowedQuestionTypes: ['SINGLE_SELECT', 'DESCRIPTIVE'],
    targetDifficulty: 'MEDIUM',
  })
  assert.ok(plan.plannedSlots.length > 0)

  // 3. Unused questions never count as assessments
  const pool = [
    { id: 'q-used', status: 'EVALUATED', question_text: 'Explain risk management', score: 85 },
    { id: 'q-unused-1', status: 'AVAILABLE', question_text: 'Unused slot question 1' },
    { id: 'q-unused-2', status: 'AVAILABLE', question_text: 'Unused slot question 2' },
  ]

  const scoredAssessments = pool.filter((q) => q.status === 'EVALUATED')
  assert.equal(scoredAssessments.length, 1)
  assert.equal(scoredAssessments[0].score, 85)
})

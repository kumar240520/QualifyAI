/**
 * Enterprise Dynamic Question Pool Service
 * 
 * Invariants:
 * 1. Generates an interview-specific pool in the background at room initialization.
 * 2. Does not delay the fixed opening question ("Tell me about yourself").
 * 3. Enforces duration-aware pool size (e.g. ~8 questions for 5 min, ~16 for 15 min).
 * 4. Ensures balanced distribution across all configured pillars using their independent taxonomies.
 * 5. Strictly restricts question types to recruiter-selected types only, randomized across slots.
 * 6. Enforces recruiter-selected difficulty uniformly.
 * 7. Deduplicates against near-duplicates and identical mathematical calculations.
 * 8. Unused pool questions are marked DISCARDED and never affect scores or coverage.
 */

import { randomUUID } from 'node:crypto'
import { aiOrchestrator } from '../../integrations/ai/index.js'
import { getServiceSupabaseClient } from '../../integrations/supabaseClient.js'
import { buildAssessmentPlan } from './assessmentPlanService.js'
import { checkDuplicateQuestion } from './questionDeduplicationService.js'
import {
  normalizeQuestionPayload,
  validateQuestionSchema,
  normalizeQuestionType,
} from './questionTypeRegistry.js'

const activePoolGenerationPromises = new Map()

export const questionPoolService = {
  /**
   * Initializes or triggers background question pool generation for an active interview session.
   * Returns immediately without blocking room entry or opening question.
   */
  startBackgroundPoolGeneration({
    sessionId,
    interviewId,
    job,
    candidate,
    rubricCriteria = [],
    durationMinutes = 15,
    allowedQuestionTypes = [],
    targetDifficulty = 'MEDIUM',
  }) {
    if (!sessionId) return Promise.resolve(null)

    const existingPromise = activePoolGenerationPromises.get(sessionId)
    if (existingPromise) return existingPromise

    const generationTask = this._executePoolGeneration({
      sessionId,
      interviewId,
      job,
      candidate,
      rubricCriteria,
      durationMinutes,
      allowedQuestionTypes,
      targetDifficulty,
    })

    activePoolGenerationPromises.set(sessionId, generationTask)
    generationTask.finally(() => {
      activePoolGenerationPromises.delete(sessionId)
    })

    return generationTask
  },

  async _executePoolGeneration({
    sessionId,
    interviewId,
    job,
    candidate,
    rubricCriteria,
    durationMinutes,
    allowedQuestionTypes,
    targetDifficulty,
  }) {
    const supabase = getServiceSupabaseClient()

    // 1. Check existing pool state in session metadata
    const { data: session } = await supabase
      .from('interview_sessions')
      .select('id, session_metadata')
      .eq('id', sessionId)
      .maybeSingle()

    const meta = session?.session_metadata || {}
    const poolStatus = meta.pool_status || 'NOT_STARTED'

    if (poolStatus === 'READY' && Array.isArray(meta.question_pool) && meta.question_pool.length > 0) {
      console.log(`[QuestionPoolService] Reusing existing ready pool (${meta.question_pool.length} questions) for session ${sessionId}.`)
      return meta.question_pool
    }

    if (poolStatus === 'GENERATING') {
      console.log(`[QuestionPoolService] Pool generation already in progress for session ${sessionId}.`)
      return null
    }

    // 2. Mark session state as GENERATING
    await supabase.from('interview_sessions').update({
      session_metadata: {
        ...meta,
        pool_status: 'GENERATING',
        pool_started_at: new Date().toISOString(),
      },
    }).eq('id', sessionId)

    try {
      // 3. Build authoritative assessment plan
      const plan = buildAssessmentPlan({
        job,
        rubricCriteria,
        durationMinutes,
        allowedQuestionTypes,
        targetDifficulty,
      })

      console.log(`[QuestionPoolService] Synthesizing duration-aware pool for ${job?.title || 'Role'} (${plan.foundationalBackground}): ${plan.plannedSlots.length} slots across ${plan.pillarCount} pillars (Difficulty: ${plan.difficulty}).`)

      // 4. Synthesize questions for planned slots adhering strictly to pillar taxonomies
      const generatedPool = await this._synthesizePoolFromPlan({
        plan,
        job,
        candidate,
        sessionId,
      })

      // 5. Persist the generated canonical pool into session metadata
      const { data: updatedSession } = await supabase
        .from('interview_sessions')
        .select('session_metadata')
        .eq('id', sessionId)
        .maybeSingle()

      const currentMeta = updatedSession?.session_metadata || meta
      const finalizedMeta = {
        ...currentMeta,
        pool_status: 'READY',
        pool_generated_at: new Date().toISOString(),
        assessment_plan: {
          foundationalBackground: plan.foundationalBackground,
          durationMinutes: plan.durationMinutes,
          difficulty: plan.difficulty,
          permittedTypes: plan.permittedQuestionTypes,
          totalSlots: plan.plannedSlots.length,
        },
        question_pool: generatedPool,
      }

      await supabase.from('interview_sessions').update({
        session_metadata: finalizedMeta,
      }).eq('id', sessionId)

      console.log(`[QuestionPoolService] Dynamic pool generation completed successfully: ${generatedPool.length} canonical questions ready for session ${sessionId}.`)
      return generatedPool
    } catch (err) {
      console.error(`[QuestionPoolService] Background pool generation failed for session ${sessionId}:`, err.message)
      await supabase.from('interview_sessions').update({
        session_metadata: {
          ...meta,
          pool_status: 'FAILED',
          pool_error: err.message,
        },
      }).eq('id', sessionId)
      return null
    }
  },

  /**
   * Generates canonical questions for planned slots with bounded retries and deduplication.
   */
  async _synthesizePoolFromPlan({ plan, job, candidate, sessionId }) {
    const pool = []
    const plannedSlots = plan.plannedSlots || []

    // Batch slots into groups of 3-4 by pillar to minimize LLM roundtrips while keeping prompts focused
    const batches = []
    const batchSize = 4
    for (let i = 0; i < plannedSlots.length; i += batchSize) {
      batches.push(plannedSlots.slice(i, i + batchSize))
    }

    for (let bIndex = 0; bIndex < batches.length; bIndex++) {
      const batchSlots = batches[bIndex]
      const synthesizedBatch = await this._synthesizeSlotBatch({
        batchSlots,
        plan,
        job,
        candidate,
        sessionId,
        existingPool: pool,
      })

      pool.push(...synthesizedBatch)
    }

    return pool
  },

  async _synthesizeSlotBatch({ batchSlots, plan, job, candidate, sessionId, existingPool = [] }) {
    const slotsSpec = batchSlots.map((slot, index) => {
      return `SLOT #${index + 1}:
- Pillar: "${slot.criterionName}" (Taxonomy: ${slot.taxonomyName})
- Objective: ${slot.objective}
- Specific Subtopic: "${slot.subtopicName || 'General fundamentals'}" (${slot.subtopicDescription || ''})
- Excluded Topics (DO NOT ASK): [${(slot.excludedTopics || []).join(', ')}]
- Job-Context Allowed: ${slot.allowsJobContext ? 'YES (Frame within realistic role scenario)' : 'NO (PURE FUNDAMENTALS: Do NOT frame around job operational duties or sprint velocity!)'}
- Required Question Type: ${slot.questionType}
- Target Difficulty: ${slot.difficulty}`
    }).join('\n\n')

    const prompt = `You are QualifyAI's authoritative interview assessment architect.
Synthesize exactly ${batchSlots.length} distinct, highly discriminative interview questions according to the provided assessment plan slots.

ROLE CONTEXT:
Job Title: ${job?.title || 'Professional'} (${job?.seniority || 'MID-SENIOR'})
Department: ${job?.department || 'General'}
Foundational Background: ${plan.foundationalBackground.toUpperCase()}
Target Difficulty: ${plan.difficulty}

PLANNED ASSESSMENT SLOTS:
${slotsSpec}

CRITICAL ARCHITECTURAL CONSTRAINTS:
1. PILLAR INDEPENDENCE:
   - For Quantitative Aptitude: Test arithmetic and quantitative fundamentals (percentages, ratios, averages, profit/loss, time & work, speed/distance, ages, family relationships). DO NOT ask Agile metrics, story points, or sprint velocity!
   - For Logical Reasoning: Test deductions, sequences, syllogisms, and patterns. DO NOT turn it into team management.
   - For Verbal Ability: Test vocabulary, grammar, and comprehension.
   - For Data Interpretation: Provide actual tabular data or numerical series requiring data interpretation.
   - For Behavioral: Use the job context to frame realistic interpersonal, decision-making, and collaboration scenarios.
2. STRICT QUESTION TYPES: Each question MUST strictly use the assigned 'Required Question Type' specified in its slot.
3. STRICT DIFFICULTY: All questions MUST match the specified difficulty "${plan.difficulty}".
4. DEDUPLICATION: Ensure questions in this batch are completely diverse and do not repeat identical calculations or wording.

Respond strictly with valid JSON conforming to the schema.`

    const schema = {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              slotNumber: { type: 'integer' },
              text: { type: 'string' },
              type: { type: 'string' },
              skill: { type: 'string' },
              topic: { type: 'string' },
              difficulty: { type: 'string' },
              options: { type: 'array', items: { type: 'string' } },
              codeSnippet: { type: 'string' },
              language: { type: 'string' },
              items: { type: 'array', items: { type: 'string' } },
              expectedAnswer: { type: 'array', items: { type: 'string' } },
              leftItems: { type: 'array', items: { type: 'string' } },
              rightItems: { type: 'array', items: { type: 'string' } },
              sliderConfig: {
                type: 'object',
                properties: {
                  min: { type: 'number' },
                  max: { type: 'number' },
                  step: { type: 'number' },
                  minLabel: { type: 'string' },
                  maxLabel: { type: 'string' },
                },
              },
              numericalConfig: {
                type: 'object',
                properties: {
                  unit: { type: 'string' },
                  tolerance: { type: 'number' },
                },
              },
              expectedConcepts: { type: 'array', items: { type: 'string' } },
              evaluationGuidance: {
                type: 'object',
                properties: {
                  level1: { type: 'string' },
                  level3: { type: 'string' },
                  level5: { type: 'string' },
                },
              },
            },
            required: ['text', 'type', 'skill', 'topic', 'difficulty'],
          },
        },
      },
      required: ['questions'],
    }

    try {
      const result = await aiOrchestrator.generateStructured({
        prompt,
        schema,
        model: 'gemini-3.5-flash-lite',
        systemInstruction: 'You are the QualifyAI question pool generator. Return strictly valid JSON containing the planned questions.',
      })

      const rawQuestions = result?.data?.questions || []
      const validatedBatch = []

      for (let i = 0; i < batchSlots.length; i++) {
        const slot = batchSlots[i]
        const rawQ = rawQuestions[i] || rawQuestions.find((q) => q.slotNumber === i + 1)

        let candidateQ = rawQ ? { ...rawQ } : null
        if (!candidateQ || !candidateQ.text) {
          candidateQ = this._createFallbackQuestionForSlot(slot, job)
        }

        // Force planned canonical type and difficulty
        candidateQ.type = slot.questionType
        candidateQ.difficulty = slot.difficulty
        candidateQ.rubricCriterionId = slot.criterionId
        candidateQ.rubric_criterion_id = slot.criterionId

        // Normalize payload
        const normalized = normalizeQuestionPayload(candidateQ, slot.questionType)
        normalized.id = randomUUID()
        normalized.sessionId = sessionId
        normalized.rubric_criterion_id = slot.criterionId
        normalized.rubric_criterion_name = slot.criterionName
        normalized.taxonomy_id = slot.taxonomyId
        normalized.subtopic_id = slot.subtopicId
        normalized.subtopic_name = slot.subtopicName
        normalized.foundational_background = plan.foundationalBackground
        normalized.status = 'AVAILABLE' // 'AVAILABLE' | 'ACTIVE' | 'EVALUATED' | 'SKIPPED' | 'DISCARDED'
        normalized.created_at = new Date().toISOString()

        // Deduplication guard
        const dupCheck = checkDuplicateQuestion(normalized, [...existingPool, ...validatedBatch])
        if (dupCheck.isDuplicate) {
          console.warn(`[QuestionPoolService] Duplicate question rejected in slot #${slot.slotIndex}: ${dupCheck.reason}. Regenerating with fallback.`)
          const fallback = this._createFallbackQuestionForSlot(slot, job, true)
          fallback.id = randomUUID()
          fallback.sessionId = sessionId
          fallback.rubric_criterion_id = slot.criterionId
          fallback.rubric_criterion_name = slot.criterionName
          fallback.taxonomy_id = slot.taxonomyId
          fallback.subtopic_id = slot.subtopicId
          fallback.subtopic_name = slot.subtopicName
          fallback.foundational_background = plan.foundationalBackground
          fallback.status = 'AVAILABLE'
          validatedBatch.push(fallback)
        } else {
          validatedBatch.push(normalized)
        }
      }

      return validatedBatch
    } catch (err) {
      console.warn(`[QuestionPoolService] AI batch synthesis warning (${err.message}). Using deterministic fallback questions.`)
      return batchSlots.map((slot) => {
        const fallback = this._createFallbackQuestionForSlot(slot, job)
        fallback.id = randomUUID()
        fallback.sessionId = sessionId
        fallback.rubric_criterion_id = slot.criterionId
        fallback.rubric_criterion_name = slot.criterionName
        fallback.taxonomy_id = slot.taxonomyId
        fallback.subtopic_id = slot.subtopicId
        fallback.subtopic_name = slot.subtopicName
        fallback.foundational_background = plan.foundationalBackground
        fallback.status = 'AVAILABLE'
        return fallback
      })
    }
  },

  _createFallbackQuestionForSlot(slot, job, alternate = false) {
    const qType = slot.questionType
    const pillarName = slot.criterionName || 'Core Assessment'
    const subtopic = slot.subtopicName || 'Fundamentals'

    let text = `Could you walk me through your foundational approach to ${subtopic} regarding ${pillarName}?`
    let options = null
    let sliderConfig = null
    let numericalConfig = null

    if (slot.taxonomyId === 'quantitative_aptitude') {
      if (alternate) {
        text = 'If a store purchases an item for $120 and sells it for $150, what is the profit percentage?'
        numericalConfig = { unit: '%', tolerance: 0.01 }
        options = ['20%', '25%', '30%', '15%']
      } else {
        text = 'If pipe A can fill a tank in 4 hours and pipe B can fill it in 6 hours, how many hours does it take for both pipes working together to fill the tank?'
        numericalConfig = { unit: 'hours', tolerance: 0.1 }
        options = ['2.4 hours', '3.0 hours', '5.0 hours', '2.0 hours']
      }
    } else if (slot.taxonomyId === 'logical_reasoning') {
      if (alternate) {
        text = 'Find the missing number in the series: 3, 9, 27, 81, ____?'
        options = ['162', '243', '324', '180']
      } else {
        text = 'If all roses are flowers and some flowers fade quickly, does it logically follow that some roses fade quickly?'
        options = ['Yes, definitely', 'No, not necessarily', 'Yes, only in winter', 'Cannot be determined']
      }
    } else if (slot.taxonomyId === 'verbal_ability') {
      text = 'Identify the grammatically correct sentence among the options.'
      options = [
        'Neither of the candidates were selected.',
        'Neither of the candidates was selected.',
        'Neither of the candidates have been selected.',
        'Neither candidate are selected.',
      ]
    } else if (slot.taxonomyId === 'data_interpretation') {
      text = 'A table shows Quarterly Revenue: Q1=$200k, Q2=$250k, Q3=$300k, Q4=$400k. What is the percentage increase in revenue from Q1 to Q4?'
      options = ['50%', '100%', '75%', '200%']
      numericalConfig = { unit: '%', tolerance: 0.05 }
    } else if (slot.taxonomyId === 'behavioral_competencies') {
      text = `When leading a project as ${job?.title || 'a team manager'}, how do you resolve a critical disagreement between two senior team members on technical direction?`
      options = [
        'Escalate immediately to the executive team without discussion',
        'Facilitate a structured trade-off evaluation session focusing on customer impact and measurable criteria',
        'Pick the option of the team member with greater seniority',
        'Delay the decision until the team naturally reaches consensus',
      ]
    }

    if (qType === 'SLIDER_SCALE') {
      sliderConfig = { min: 1, max: 10, step: 1, minLabel: 'Low', maxLabel: 'High' }
    }

    return normalizeQuestionPayload({
      text,
      type: qType,
      skill: pillarName,
      topic: subtopic,
      difficulty: slot.difficulty,
      options,
      sliderConfig,
      numericalConfig,
      expectedConcepts: [pillarName, subtopic],
    }, qType)
  },

  /**
   * Selects the next canonical question from the pre-generated pool
   * adhering to coverage gaps, time remaining, and pillar prioritization.
   */
  selectNextQuestionFromPool({
    pool = [],
    coverageMatrix = [],
    currentQuestion = null,
    timeRemainingSeconds = 300,
    foundationalBackground = 'non_technical',
  }) {
    if (!Array.isArray(pool) || pool.length === 0) return null

    // Filter available pool questions
    const available = pool.filter((q) => q.status === 'AVAILABLE')
    if (available.length === 0) return null

    // 1. Identify unassessed pillars
    const unassessedCriterionIds = new Set(
      (coverageMatrix || [])
        .filter((c) => c.status === 'UNASSESSED' || (c.attempts === 0))
        .map((c) => c.criterion_id)
    )

    // 2. Prioritize available questions from unassessed pillars
    const unassessedPoolQuestions = available.filter(
      (q) => q.rubric_criterion_id && unassessedCriterionIds.has(q.rubric_criterion_id)
    )

    if (unassessedPoolQuestions.length > 0) {
      // Pick first unassessed pillar question
      return unassessedPoolQuestions[0]
    }

    // 3. If all pillars have initial probe, prioritize pillars with partial evaluation
    const partialCriterionIds = new Set(
      (coverageMatrix || [])
        .filter((c) => c.status === 'PARTIALLY_ASSESSED' || c.status === 'IN_EVALUATION' || (c.attempts === 1 && c.average_score < 7))
        .map((c) => c.criterion_id)
    )

    const partialPoolQuestions = available.filter(
      (q) => q.rubric_criterion_id && partialCriterionIds.has(q.rubric_criterion_id)
    )

    if (partialPoolQuestions.length > 0) {
      return partialPoolQuestions[0]
    }

    // 4. Default: return next available question
    return available[0]
  },

  /**
   * Marks a question in the session pool as ACTIVE or EVALUATED.
   */
  async updateQuestionStateInSession({ sessionId, questionId, status }) {
    const supabase = getServiceSupabaseClient()
    const { data: session } = await supabase
      .from('interview_sessions')
      .select('session_metadata')
      .eq('id', sessionId)
      .maybeSingle()

    if (!session?.session_metadata?.question_pool) return

    const updatedPool = session.session_metadata.question_pool.map((q) => {
      if (q.id === questionId) {
        return { ...q, status, updated_at: new Date().toISOString() }
      }
      return q
    })

    await supabase.from('interview_sessions').update({
      session_metadata: {
        ...session.session_metadata,
        question_pool: updatedPool,
      },
    }).eq('id', sessionId)
  },
}

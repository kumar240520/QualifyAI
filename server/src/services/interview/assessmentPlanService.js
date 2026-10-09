/**
 * Enterprise Assessment Plan Builder
 * 
 * Invariant: Assessment plan is built BEFORE pool generation.
 * Distributes time and questions across all required pillars, ensures balanced coverage,
 * respects recruiter-selected difficulty and question types, and calculates pool size from interview duration.
 */

import { resolveFoundationalBackground } from './foundationalBackgroundResolver.js'
import { resolvePillarTaxonomy } from './pillarTaxonomyService.js'
import { normalizeQuestionType, CANONICAL_QUESTION_TYPES } from './questionTypeRegistry.js'

/**
 * Calculates interview-specific pool size based on interview duration.
 * 
 * @param {number} durationMinutes - Configured interview duration in minutes
 * @returns {{ poolSize: number, estimatedQuestionsAsked: number, assessmentSeconds: number }}
 */
export function calculateDurationAwarePoolSize(durationMinutes = 15) {
  const duration = Math.max(5, Number(durationMinutes) || 15)
  // Final 60 seconds are reserved exclusively for candidate feedback
  const assessmentSeconds = Math.max(240, (duration * 60) - 60)
  
  // Average interaction time per question (reading, thinking, answering, evaluation): ~65-75 seconds
  const avgQuestionDurationSeconds = 70
  const estimatedQuestionsAsked = Math.max(4, Math.floor(assessmentSeconds / avgQuestionDurationSeconds))

  // Pool should provide an appropriate buffer for adaptive selection and subtopic options:
  // For 5 minutes (240s assessment): estimated asked = 3-4 -> pool size = 7-8 questions
  // For 15 minutes (840s assessment): estimated asked = 10-12 -> pool size = 15-16 questions
  // For 30 minutes (1740s assessment): estimated asked = 20-24 -> pool size = 26-28 questions
  let poolSize
  if (duration <= 5) {
    poolSize = 8
  } else if (duration <= 10) {
    poolSize = 12
  } else if (duration <= 15) {
    poolSize = 16
  } else if (duration <= 20) {
    poolSize = 20
  } else {
    poolSize = Math.min(30, Math.max(24, Math.round(estimatedQuestionsAsked * 1.35)))
  }

  return {
    poolSize,
    estimatedQuestionsAsked,
    assessmentSeconds,
  }
}

/**
 * Builds an authoritative Assessment Plan for the interview.
 * 
 * @param {Object} options
 * @param {Object} options.job - Requisition object
 * @param {Array} options.rubricCriteria - Configured rubric criteria pillars
 * @param {number} options.durationMinutes - Interview duration in minutes
 * @param {Array<string>} options.allowedQuestionTypes - Recruiter selected question types
 * @param {string} options.targetDifficulty - Recruiter selected difficulty ('EASY' | 'MEDIUM' | 'HARD')
 * @returns {Object} Complete assessment plan
 */
export function buildAssessmentPlan({
  job,
  rubricCriteria = [],
  durationMinutes = 15,
  allowedQuestionTypes = [],
  targetDifficulty = 'MEDIUM',
}) {
  const foundationalBackground = resolveFoundationalBackground(job)
  const duration = Math.max(5, Number(durationMinutes) || 15)
  const { poolSize, estimatedQuestionsAsked, assessmentSeconds } = calculateDurationAwarePoolSize(duration)

  // 1. Authoritative Recruiter Difficulty
  const difficulty = ['EASY', 'MEDIUM', 'HARD'].includes(String(targetDifficulty || '').toUpperCase())
    ? String(targetDifficulty).toUpperCase()
    : (job?.target_difficulty ? String(job.target_difficulty).toUpperCase() : 'MEDIUM')

  // 2. Authoritative Recruiter Permitted Types
  const rawPermitted = Array.isArray(allowedQuestionTypes) && allowedQuestionTypes.length > 0
    ? allowedQuestionTypes
    : (Array.isArray(job?.allowed_question_types) && job.allowed_question_types.length > 0
      ? job.allowed_question_types
      : ['SHORT_ANSWER', 'DESCRIPTIVE', 'MULTIPLE_CHOICE', 'SELECT_MOST_APPROPRIATE'])

  const permittedTypes = [...new Set(rawPermitted.map((t) => normalizeQuestionType(t)))]
  const effectivePermittedTypes = permittedTypes.length > 0 ? permittedTypes : ['SHORT_ANSWER', 'MULTIPLE_CHOICE']

  // 3. Taxonomize Pillars
  const criteriaList = Array.isArray(rubricCriteria) && rubricCriteria.length > 0
    ? rubricCriteria
    : [{ id: 'default_core', name: 'Core Competency', weight: 5, description: 'Core domain evaluation' }]

  const pillarPlans = criteriaList.map((criterion, index) => {
    const taxonomy = resolvePillarTaxonomy(criterion, foundationalBackground)
    return {
      pillarIndex: index,
      criterionId: criterion.id,
      name: criterion.name,
      weight: Number(criterion.weight) || 3,
      taxonomy,
      targetSubtopics: taxonomy.subtopics || [],
      allowsJobContext: taxonomy.allowsJobContext,
      appropriateTypes: taxonomy.appropriateQuestionTypes || CANONICAL_QUESTION_TYPES,
    }
  })

  // 4. Distribute Pool Slots Across Pillars Evenly
  // Balanced coverage by default: every required pillar has a place in the pool
  const pillarCount = pillarPlans.length
  const baseSlotsPerPillar = Math.max(1, Math.floor(poolSize / pillarCount))
  let remainingSlots = poolSize - (baseSlotsPerPillar * pillarCount)

  // Sort by weight descending to assign extra slots to high-weight pillars
  const sortedPillarIndices = [...pillarPlans.keys()].sort((a, b) => pillarPlans[b].weight - pillarPlans[a].weight)

  const plannedSlots = []
  let globalSlotIndex = 0

  pillarPlans.forEach((pillar, pIdx) => {
    const extra = remainingSlots > 0 && sortedPillarIndices.indexOf(pIdx) < remainingSlots ? 1 : 0
    const countForThisPillar = baseSlotsPerPillar + extra

    // Filter permitted types compatible with this pillar
    const compatibleTypes = effectivePermittedTypes.filter((t) =>
      pillar.appropriateTypes.includes(t)
    )
    const typeSelectionPool = compatibleTypes.length > 0 ? compatibleTypes : effectivePermittedTypes

    for (let i = 0; i < countForThisPillar; i++) {
      // Pick randomized permitted question type
      const randomizedType = typeSelectionPool[Math.floor(Math.random() * typeSelectionPool.length)]
      const subtopic = pillar.targetSubtopics[i % pillar.targetSubtopics.length] || null

      plannedSlots.push({
        slotIndex: globalSlotIndex++,
        pillarIndex: pIdx,
        criterionId: pillar.criterionId,
        criterionName: pillar.name,
        taxonomyId: pillar.taxonomy.id,
        taxonomyName: pillar.taxonomy.name,
        objective: pillar.taxonomy.objective,
        subtopicId: subtopic?.id || null,
        subtopicName: subtopic?.name || null,
        subtopicDescription: subtopic?.description || null,
        excludedTopics: pillar.taxonomy.excludedTopics || [],
        allowsJobContext: pillar.allowsJobContext,
        questionType: randomizedType,
        difficulty,
      })
    }
  })

  // Shuffle planned slots lightly across pillars so the pool is interleaved rather than sequential
  const interleavedSlots = interleaveSlotsAcrossPillars(plannedSlots, pillarCount)

  return {
    foundationalBackground,
    durationMinutes: duration,
    assessmentSeconds,
    estimatedQuestionsAsked,
    poolSize: interleavedSlots.length,
    difficulty,
    permittedQuestionTypes: effectivePermittedTypes,
    pillarCount,
    pillarPlans,
    plannedSlots: interleavedSlots,
  }
}

/**
 * Interleaves slots across pillars so no single pillar monopolizes the first questions.
 */
function interleaveSlotsAcrossPillars(slots, pillarCount) {
  if (pillarCount <= 1) return slots
  const byPillar = new Map()
  slots.forEach((s) => {
    if (!byPillar.has(s.pillarIndex)) byPillar.set(s.pillarIndex, [])
    byPillar.get(s.pillarIndex).push(s)
  })

  const interleaved = []
  let maxLen = Math.max(...Array.from(byPillar.values()).map((arr) => arr.length))

  for (let round = 0; round < maxLen; round++) {
    for (const [_, list] of byPillar.entries()) {
      if (list[round]) {
        interleaved.push({
          ...list[round],
          slotIndex: interleaved.length,
        })
      }
    }
  }

  return interleaved
}

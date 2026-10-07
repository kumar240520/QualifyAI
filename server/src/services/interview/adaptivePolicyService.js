/**
 * Enterprise Adaptive Interview Policy & Rubric Constraint Service
 * 
 * ROLE: Policy, Evidence Tracker, and Validation Service.
 * Does NOT generate questions or act as a second interviewer.
 * Tracks candidate competency evidence across rubric criteria, enforces server time constraints,
 * and supplies Gemini with context on coverage gaps.
 */
export const adaptivePolicyService = {
  /**
   * Initialize or sync the skill coverage matrix for all rubric criteria
   */
  initializeCoverageMatrix(rubricCriteria = []) {
    return (rubricCriteria || []).map((c) => ({
      criterion_id: c.id,
      name: c.name,
      description: c.description || '',
      weight: Number(c.weight) || 3,
      attempts: 0,
      scores: [],
      average_score: 0,
      coverage: 0,
      evidence: [],
      missing: [],
      topics: [],
      status: 'UNASSESSED', // 'UNASSESSED' | 'IN_EVALUATION' | 'SUFFICIENTLY_EVALUATED' | 'MASTERY_PROVEN'
    }))
  },

  /**
   * Update coverage matrix with the latest turn analysis
   */
  updateCoverageMatrix(matrix = [], criterionId, analysis = {}) {
    if (!Array.isArray(matrix)) return []

    return matrix.map((item) => {
      if (item.criterion_id !== criterionId) return item

      const newAttempts = (item.attempts || 0) + 1
      const score = Number(analysis.correctness) || Number(analysis.score) || 5
      const newScores = [...(item.scores || []), score]
      const avg = Math.round((newScores.reduce((a, b) => a + b, 0) / newScores.length) * 10) / 10
      const evidence = [...new Set([
        ...(item.evidence || []),
        ...(analysis.concepts_detected || []),
        ...(analysis.strengths || []),
      ])]
      const missing = [...new Set([
        ...(analysis.missing_concepts || []),
        ...(analysis.skills_not_demonstrated || []),
      ])]
      const topics = [...new Set([...(item.topics || []), ...(analysis.topics_mentioned || [])])]

      let status = 'IN_EVALUATION'
      const depth = Number(analysis.depth) || 5
      if (avg >= 8 && depth >= 7) {
        status = 'MASTERY_PROVEN'
      } else if (newAttempts >= 2 || (newAttempts >= 1 && avg >= 6)) {
        status = 'SUFFICIENTLY_EVALUATED'
      }

      return {
        ...item,
        attempts: newAttempts,
        scores: newScores,
        average_score: avg,
        coverage: Math.min(1, Math.round((newAttempts / Math.max(1, newAttempts + missing.length)) * 100) / 100),
        evidence,
        missing,
        topics,
        status,
      }
    })
  },

  /**
   * Summarize current coverage status for Gemini context
   */
  getEvidenceSummary(matrix = []) {
    if (!Array.isArray(matrix) || matrix.length === 0) {
      return 'No rubric criteria initialized yet.'
    }

    const lines = matrix.map((c) => {
      const statusIcon =
        c.status === 'MASTERY_PROVEN'
          ? '✓ [Mastery Proven]'
          : c.status === 'SUFFICIENTLY_EVALUATED'
          ? '✓ [Sufficient Evidence]'
          : c.status === 'IN_EVALUATION'
          ? '~ [In Evaluation - Partial]'
          : '? [Unassessed]'
      const scoreStr = c.attempts > 0 ? `(Avg: ${c.average_score}/10 over ${c.attempts} probe)` : ''
      return `- ${c.name} (Weight: ${c.weight}/5, coverage: ${Math.round((c.coverage || 0) * 100)}%): ${statusIcon} ${scoreStr}\n  Evidence: ${(c.evidence || []).join('; ') || 'none'}\n  Topics: ${(c.topics || []).join('; ') || 'none'}\n  Missing: ${(c.missing || []).join('; ') || 'none'}`
    })

    return lines.join('\n')
  },

  /**
   * Validate session time constraints
   */
  validateTimeConstraints({ startedAt, durationMinutes = 20, endsAt = null }) {
    const startTime = startedAt ? new Date(startedAt).getTime() : Date.now()
    const endTime = endsAt
      ? new Date(endsAt).getTime()
      : startTime + (durationMinutes * 60 * 1000)

    const now = Date.now()
    const elapsedSeconds = Math.max(0, Math.round((now - startTime) / 1000))
    const remainingSeconds = Math.max(0, Math.round((endTime - now) / 1000))

    return {
      startedAt: new Date(startTime).toISOString(),
      endsAt: new Date(endTime).toISOString(),
      durationMinutes,
      elapsedSeconds,
      remainingSeconds,
      isExpired: remainingSeconds <= 0,
      isWarning: remainingSeconds <= 300 && remainingSeconds > 0, // < 5 mins
      isFinalMinute: remainingSeconds <= 60 && remainingSeconds > 0,
    }
  },

  /**
   * Difficulty dynamically scales between EASY, MEDIUM, and HARD based on candidate performance:
   * - Starting difficulty: MEDIUM
   * - If last score >= 8/10 and rolling average >= 7.5/10 -> Escalate to HARD
   * - If last score <= 4/10 and rolling average <= 4.5/10 -> De-escalate to EASY
   * - Otherwise -> Maintain MEDIUM
   */
  calculateDifficulty(scores = []) {
    if (!scores || scores.length === 0) return 'MEDIUM'
    const lastScore = scores[scores.length - 1]
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    if (lastScore >= 8 && avg >= 7.5) return 'HARD'
    if (lastScore <= 4 && avg <= 4.5) return 'EASY'
    return 'MEDIUM'
  },

  /**
   * Dynamically selects a varied, non-monotonous question type.
   * Prevents consecutive DESCRIPTIVE essay questions so candidates do not experience cognitive burden or fatigue.
   */
  computeRecommendedQuestionType(askedQuestions = [], turnSequence = 0) {
    const recent = Array.isArray(askedQuestions) ? askedQuestions.slice(-4) : []
    const lastType = recent.length > 0
      ? String(recent[recent.length - 1]?.type || '').toUpperCase()
      : 'BEHAVIORAL'

    // Interactive, engaging types that reduce cognitive burden
    const interactivePool = [
      'MULTIPLE_CHOICE',
      'SCENARIO',
      'CODE_OUTPUT',
      'SHORT_ANSWER',
      'TRUE_FALSE',
      'CODE_WRITING',
      'SQL',
    ]

    // If previous question was DESCRIPTIVE or BEHAVIORAL, strictly exclude DESCRIPTIVE
    const available = (lastType === 'DESCRIPTIVE' || lastType === 'BEHAVIORAL')
      ? interactivePool
      : [...interactivePool, 'DESCRIPTIVE']

    // Filter out the immediate last type to guarantee non-monotonous variety across turns
    const nonRepeating = available.filter((t) => t !== lastType)
    const selectionPool = nonRepeating.length > 0 ? nonRepeating : interactivePool

    const randomIndex = Math.floor(Math.random() * selectionPool.length)
    return selectionPool[randomIndex]
  },

  /**
   * Adaptive Decision Controller & Active Listening Policy Engine
   * Evaluates evidence, candidate statements, missing concepts, and coverage gaps to determine:
   * 1. FOLLOW_UP: Probe missing concepts, unverified claims, or project details
   * 2. DEEPEN: Escalate technical depth when the candidate demonstrated strong competency
   * 3. SWITCH_TOPIC: Transition to next unassessed rubric pillar once current is sufficiently proven
   */
  computeAdaptiveStep({
    coverageMatrix = [],
    currentCriterionId = null,
    answerAnalysis = {},
    turnSequence = 0,
    candidateAnswer = '',
    jobTitle = '',
    askedQuestions = [],
  }) {
    const updatedMatrix = this.updateCoverageMatrix(
      coverageMatrix,
      currentCriterionId,
      answerAnalysis
    )

    const currentCriterion = updatedMatrix.find((c) => c.criterion_id === currentCriterionId)
    const allScores = updatedMatrix.flatMap((c) => c.scores || [])
    const targetDifficulty = this.calculateDifficulty(allScores)
    const recommendedQuestionType = this.computeRecommendedQuestionType(askedQuestions, turnSequence)

    const unassessed = updatedMatrix.filter((c) => c.status === 'UNASSESSED')
    const inEvaluation = updatedMatrix.filter((c) => c.status === 'IN_EVALUATION')
    const allSufficient = unassessed.length === 0 && inEvaluation.length === 0

    let recommendedAction = 'SWITCH_TOPIC'
    let targetCriterion = null
    let reason = ''
    let activeListeningGuidance = ''

    // Case 1: Turn 0 (Introduction / Project Overview Turn without pre-assigned criterion)
    if (!currentCriterionId || turnSequence === 0) {
      // Connect candidate's stated background/projects directly to the top-priority rubric pillar
      const sortedCriteria = [...updatedMatrix].sort((a, b) => (b.weight || 3) - (a.weight || 3))
      targetCriterion = sortedCriteria[0] || null
      recommendedAction = 'FOLLOW_UP'
      reason = 'Candidate completed introductory turn. Formulate a grounded follow-up exploring their mentioned projects and tie it directly to the primary technical pillar.'
      activeListeningGuidance = 'Acknowledge the specific projects, technologies, or architectures the candidate mentioned in their introduction. Then bridge directly to your first core technical evaluation.'
    }
    // Case 2: Candidate had missing concepts or partial depth on current pillar -> FOLLOW_UP probe
    else if (
      currentCriterion &&
      ((answerAnalysis.missing_concepts && answerAnalysis.missing_concepts.length > 0) ||
       (answerAnalysis.claims_requiring_verification && answerAnalysis.claims_requiring_verification.length > 0) ||
       (Number(answerAnalysis.depth) < 6 && currentCriterion.attempts < 3) ||
       currentCriterion.status === 'IN_EVALUATION')
    ) {
      const isHighDepth = Number(answerAnalysis.depth) >= 7
      recommendedAction = isHighDepth ? 'DEEPEN' : 'FOLLOW_UP'
      targetCriterion = currentCriterion
      reason = `Probing deeper into "${currentCriterion.name}". Candidate demonstrated partial evidence or missed key concepts (${(answerAnalysis.missing_concepts || []).slice(0, 3).join(', ')}).`
      activeListeningGuidance = `Explicitly reference what the candidate said, highlight the specific trade-off or concept that needs deeper justification, and ask them to elaborate on how they handle it in production.`
    }
    // Case 3: Current pillar has sufficient evidence / mastery proven -> SWITCH_TOPIC to next unassessed pillar
    else if (unassessed.length > 0) {
      // Prioritize highest weight unassessed rubric criterion
      const sortedUnassessed = [...unassessed].sort((a, b) => (b.weight || 3) - (a.weight || 3))
      targetCriterion = sortedUnassessed[0]
      recommendedAction = 'SWITCH_TOPIC'
      reason = `Current criterion "${currentCriterion?.name || 'Topic'}" has sufficient evidence. Transitioning to unassessed pillar: "${targetCriterion.name}".`
      activeListeningGuidance = `Briefly validate their answer on the prior topic, then smoothly transition to the new competency area (${targetCriterion.name}).`
    }
    // Case 4: All criteria have at least initial evidence, but some need reinforcement
    else if (inEvaluation.length > 0) {
      targetCriterion = inEvaluation[0]
      recommendedAction = 'SWITCH_TOPIC'
      reason = `Completing evaluation on pillar needing reinforcement: "${targetCriterion.name}".`
      activeListeningGuidance = `Transition to reinforce evidence for ${targetCriterion.name}.`
    }
    // Case 5: All criteria covered
    else {
      targetCriterion = updatedMatrix[0] || null
      recommendedAction = 'DEEPEN'
      reason = 'All criteria sufficiently evaluated. Probing advanced edge cases and systemic trade-offs.'
      activeListeningGuidance = 'Praise their comprehensive grasp, and present a challenging production failure-mode scenario.'
    }

    return {
      updatedMatrix,
      allRubricCriteriaCovered: allSufficient,
      evidenceSummary: this.getEvidenceSummary(updatedMatrix),
      recommendedAction,
      targetCriterion,
      targetDifficulty,
      recommendedQuestionType,
      reason,
      activeListeningGuidance,
    }
  },

  /**
   * Main policy guidance calculation combining evidence tracking, difficulty scaling, and follow-up guidance
   */
  computePolicyGuidance({
    coverageMatrix = [],
    currentCriterionId = null,
    answerAnalysis = {},
    turnSequence = 0,
    candidateAnswer = '',
    jobTitle = '',
    askedQuestions = [],
  }) {
    return this.computeAdaptiveStep({
      coverageMatrix,
      currentCriterionId,
      answerAnalysis,
      turnSequence,
      candidateAnswer,
      jobTitle,
      askedQuestions,
    })
  },
}


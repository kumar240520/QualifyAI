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

    let targetId = criterionId
    let targetAnalysis = analysis

    if (criterionId && typeof criterionId === 'object' && !Array.isArray(criterionId)) {
      targetId = criterionId.criterionId || criterionId.criterion_id || criterionId.criterionName || criterionId.name
      targetAnalysis = criterionId.analysis || criterionId
    }

    const cleanTarget = String(targetId || '').trim().toLowerCase()

    return matrix.map((item) => {
      const cleanItemName = String(item.name || '').trim().toLowerCase()
      const cleanItemId = String(item.criterion_id || item.id || '').trim().toLowerCase()
      const matches = item.criterion_id === targetId ||
                      item.id === targetId ||
                      item.name === targetId ||
                      (cleanTarget && (cleanItemName === cleanTarget || cleanItemId === cleanTarget || cleanItemName.includes(cleanTarget) || cleanTarget.includes(cleanItemName)))

      if (!matches) return item

      const isNoResponse = Boolean(
        targetAnalysis?.noResponse ||
        targetAnalysis?.isNoResponse ||
        targetAnalysis?.skipped ||
        targetAnalysis?.unanswered
      )

      // If turn was empty, silent, or skipped: do NOT increment evaluated attempts or false scores
      if (isNoResponse || !targetAnalysis || Object.keys(targetAnalysis).length === 0) {
        return {
          ...item,
          status: item.attempts > 0 ? (item.status || 'PARTIALLY_ASSESSED') : 'IN_PROGRESS',
        }
      }

      const score = Number(targetAnalysis.correctness) || Number(targetAnalysis.score) || 5
      const newAttempts = (item.attempts || 0) + 1
      const newScores = [...(item.scores || []), score]
      const avg = Math.round((newScores.reduce((a, b) => a + b, 0) / newScores.length) * 10) / 10
      const evidence = [...new Set([
        ...(item.evidence || []),
        ...(targetAnalysis.concepts_detected || []),
        ...(targetAnalysis.strengths || []),
      ])]
      const missing = [...new Set([
        ...(targetAnalysis.missing_concepts || []),
        ...(targetAnalysis.skills_not_demonstrated || []),
      ])]
      const topics = [...new Set([...(item.topics || []), ...(targetAnalysis.topics_mentioned || [])])]

      let status = 'PARTIALLY_ASSESSED'
      const depth = Number(targetAnalysis.depth) || 5
      if (avg >= 8 && depth >= 7) {
        status = 'MASTERY_PROVEN'
      } else if ((avg >= 5 && evidence.length > 0) || (newAttempts >= 2 && avg >= 4.5) || (newAttempts >= 1 && avg >= 5.0)) {
        status = 'SUFFICIENTLY_EVALUATED'
      } else if (newAttempts >= 1) {
        status = 'PARTIALLY_ASSESSED'
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
        assessed: status === 'MASTERY_PROVEN' || status === 'SUFFICIENTLY_EVALUATED' || (newAttempts >= 1 && avg >= 4.0),
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
          : c.status === 'SUFFICIENTLY_EVALUATED' || c.status === 'ASSESSED'
          ? '✓ [Sufficient Evidence / Assessed]'
          : c.status === 'PARTIALLY_ASSESSED' || c.status === 'IN_EVALUATION'
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
  validateTimeConstraints({ startedAt, durationMinutes = 20, endsAt = null, overrideRemainingSeconds }) {
    const startTime = startedAt ? new Date(startedAt).getTime() : Date.now()
    const endTime = endsAt
      ? new Date(endsAt).getTime()
      : startTime + (durationMinutes * 60 * 1000)

    const now = Date.now()
    const elapsedSeconds = Math.max(0, Math.round((now - startTime) / 1000))
    const remainingSeconds = overrideRemainingSeconds !== undefined && overrideRemainingSeconds !== null
      ? Number(overrideRemainingSeconds)
      : Math.max(0, Math.round((endTime - now) / 1000))

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
   * Recruiter-Controlled Difficulty:
   * The recruiter alone decides the interview difficulty.
   * The AI must not autonomously increase or decrease it based on candidate performance.
   */
  calculateDifficulty(scoresOrBaseline = 'MEDIUM', baselineDifficulty = 'MEDIUM') {
    let raw = 'MEDIUM'
    if (typeof scoresOrBaseline === 'string') {
      raw = scoresOrBaseline
    } else if (typeof baselineDifficulty === 'string') {
      raw = baselineDifficulty
    }
    const base = String(raw).toUpperCase()
    return ['EASY', 'MEDIUM', 'HARD'].includes(base) ? base : 'MEDIUM'
  },

  /**
   * Dynamically selects a varied, non-monotonous question type strictly from
   * the recruiter-permitted question types (allowedTypes), tailored to the target pillar competency.
   */
  computeRecommendedQuestionType(askedQuestions = [], turnSequence = 0, allowedTypes = [], targetCriterion = null) {
    const validAllowed = Array.isArray(allowedTypes) && allowedTypes.length > 0
      ? allowedTypes.map((t) => String(t).toUpperCase().replace(/\s+/g, '_'))
      : ['SHORT_ANSWER', 'DESCRIPTIVE', 'MULTIPLE_CHOICE', 'SELECT_MOST_APPROPRIATE']

    if (validAllowed.length === 1) {
      return validAllowed[0]
    }

    const recent = Array.isArray(askedQuestions) ? askedQuestions.slice(-3) : []
    const lastType = recent.length > 0
      ? String(recent[recent.length - 1]?.type || '').toUpperCase()
      : ''

    // Pillar-specific affinity matching
    const criterionText = `${targetCriterion?.name || ''} ${targetCriterion?.description || ''}`.toLowerCase()
    let preferredPool = []

    if (/code|programming|implement|syntax|algorithm|data struct|backend|function/i.test(criterionText)) {
      preferredPool = validAllowed.filter((t) =>
        ['CODING_CHALLENGE', 'CODE_WRITING', 'DEBUGGING', 'COMPLETE_THE_CODE', 'PREDICT_CODE_OUTPUT', 'CODE_OUTPUT'].includes(t)
      )
    } else if (/math|aptitude|quant|calculat|metric|statist|probability|complexity/i.test(criterionText)) {
      preferredPool = validAllowed.filter((t) =>
        ['NUMERICAL_APTITUDE', 'MULTIPLE_CHOICE', 'MULTI_SELECT', 'SLIDER_SCALE'].includes(t)
      )
    } else if (/flow|order|pipeline|deploy|stage|sequence|lifecycle|step/i.test(criterionText)) {
      preferredPool = validAllowed.filter((t) =>
        ['ARRANGE_ORDER', 'SELECT_MOST_APPROPRIATE', 'SCENARIO'].includes(t)
      )
    } else if (/pair|concept|term|protocol|associat|match/i.test(criterionText)) {
      preferredPool = validAllowed.filter((t) =>
        ['MATCHING_PAIRS', 'FILL_IN_THE_BLANK', 'TRUE_FALSE'].includes(t)
      )
    } else if (/trade-off|priority|scale|compromise|incident|management|leadership/i.test(criterionText)) {
      preferredPool = validAllowed.filter((t) =>
        ['SELECT_MOST_APPROPRIATE', 'SCENARIO', 'SLIDER_SCALE', 'DESCRIPTIVE'].includes(t)
      )
    }

    // Filter by affinity pool if matches exist, otherwise use full allowed set
    const candidatePool = preferredPool.length > 0 ? preferredPool : validAllowed

    // Anti-monotony: Filter out the immediately preceding question type if alternatives exist
    const nonRepeating = candidatePool.filter((t) => t !== lastType)
    const selectionPool = nonRepeating.length > 0 ? nonRepeating : (validAllowed.filter((t) => t !== lastType).length > 0 ? validAllowed.filter((t) => t !== lastType) : validAllowed)

    const randomIndex = Math.floor(Math.random() * selectionPool.length)
    return selectionPool[randomIndex]
  },

  /**
   * Adaptive Decision Controller & Pillar-Aware Interview Policy Engine
   * Evaluates evidence, candidate statements, missing concepts, and coverage gaps.
   * Guarantees all configured rubric pillars receive meaningful assessment within the available time.
   */
  computeAdaptiveStep({
    coverageMatrix = [],
    currentCriterionId = null,
    answerAnalysis = {},
    turnSequence = 0,
    candidateAnswer = '',
    jobTitle = '',
    askedQuestions = [],
    baselineDifficulty = 'MEDIUM',
    allowedTypes = [],
    allowedQuestionTypes = [],
    askAboutProjects = true,
    backgroundType = 'TECHNICAL',
    timeRemainingSeconds = 0,
    durationMinutes = 20,
  }) {
    const effectiveAllowedTypes = Array.isArray(allowedTypes) && allowedTypes.length > 0
      ? allowedTypes
      : (Array.isArray(allowedQuestionTypes) && allowedQuestionTypes.length > 0 ? allowedQuestionTypes : [])

    const updatedMatrix = this.updateCoverageMatrix(
      coverageMatrix,
      currentCriterionId,
      answerAnalysis
    )

    const currentCriterion = updatedMatrix.find((c) => c.criterion_id === currentCriterionId)
    const allScores = updatedMatrix.flatMap((c) => c.scores || [])
    const targetDifficulty = this.calculateDifficulty(allScores, baselineDifficulty)

    const unassessed = updatedMatrix.filter((c) => c.status === 'UNASSESSED')
    const inEvaluation = updatedMatrix.filter((c) => c.status === 'IN_EVALUATION' || c.status === 'PARTIALLY_ASSESSED' || c.status === 'IN_PROGRESS')
    const allSufficient = unassessed.length === 0 && inEvaluation.length === 0

    // Time budget calculation: Reserve the final 60 seconds strictly for candidate feedback
    const assessmentRemainingSeconds = Math.max(0, timeRemainingSeconds - 60)
    const estimatedTurnsRemaining = Math.max(1, Math.floor(assessmentRemainingSeconds / 75))

    let recommendedAction = 'SWITCH_TOPIC'
    let targetCriterion = null
    let reason = ''
    let activeListeningGuidance = ''

    // Case 1: Turn 0 (Introductory Turn without pre-assigned criterion)
    if (!currentCriterionId || turnSequence === 0) {
      const sortedCriteria = [...updatedMatrix].sort((a, b) => (b.weight || 3) - (a.weight || 3))
      targetCriterion = sortedCriteria[0] || null
      recommendedAction = 'FOLLOW_UP'
      if (askAboutProjects) {
        reason = 'Candidate completed introductory turn. Formulate a grounded follow-up exploring their mentioned projects and experience, tying it to the primary competency pillar.'
        activeListeningGuidance = 'Acknowledge specific projects and technologies mentioned, then bridge directly to evaluating core competencies.'
      } else {
        reason = 'Candidate completed introductory turn. Formulate a grounded follow-up connecting their domain experience directly to the primary competency pillar.'
        activeListeningGuidance = 'Acknowledge professional background, then bridge directly to assessing core competencies.'
      }
    }
    // Case 2: Unassessed pillars remain and time is constrained OR current pillar already had a probe
    else if (unassessed.length > 0 && (currentCriterion?.attempts >= 2 || unassessed.length >= estimatedTurnsRemaining || (currentCriterion?.attempts >= 1 && (Number(answerAnalysis.depth) >= 5 || !answerAnalysis.missing_concepts?.length)))) {
      // Prioritize highest weight unassessed pillar to ensure complete multi-pillar coverage
      const sortedUnassessed = [...unassessed].sort((a, b) => (b.weight || 3) - (a.weight || 3))
      targetCriterion = sortedUnassessed[0]
      recommendedAction = 'SWITCH_TOPIC'
      reason = `Balanced Pillar Coverage Policy: transitioning from "${currentCriterion?.name || 'Previous Topic'}" to unassessed pillar "${targetCriterion.name}" to guarantee comprehensive rubric assessment.`
      activeListeningGuidance = `Briefly acknowledge their answer on the previous topic, then smoothly transition to assess ${targetCriterion.name}.`
    }
    // Case 3: Current pillar has missing concepts and we have enough time budget for one targeted follow-up probe
    else if (
      currentCriterion &&
      currentCriterion.attempts < 2 &&
      ((answerAnalysis.missing_concepts && answerAnalysis.missing_concepts.length > 0) ||
       (answerAnalysis.claims_requiring_verification && answerAnalysis.claims_requiring_verification.length > 0) ||
       (Number(answerAnalysis.depth) < 6) ||
       currentCriterion.status === 'IN_EVALUATION')
    ) {
      const isHighDepth = Number(answerAnalysis.depth) >= 7
      recommendedAction = isHighDepth ? 'DEEPEN' : 'FOLLOW_UP'
      targetCriterion = currentCriterion
      reason = `Probing deeper into "${currentCriterion.name}". Candidate demonstrated partial evidence or missed key concepts (${(answerAnalysis.missing_concepts || []).slice(0, 3).join(', ')}).`
      activeListeningGuidance = `Explicitly reference what the candidate said, highlight the specific trade-off or concept that needs deeper justification, and ask them to elaborate on how they handle it in production.`
    }
    // Case 4: Transition to any remaining unassessed pillar
    else if (unassessed.length > 0) {
      const sortedUnassessed = [...unassessed].sort((a, b) => (b.weight || 3) - (a.weight || 3))
      targetCriterion = sortedUnassessed[0]
      recommendedAction = 'SWITCH_TOPIC'
      reason = `Current criterion "${currentCriterion?.name || 'Topic'}" has sufficient evidence. Transitioning to unassessed pillar: "${targetCriterion.name}".`
      activeListeningGuidance = `Briefly validate their answer on the prior topic, then smoothly transition to the new competency area (${targetCriterion.name}).`
    }
    // Case 5: All criteria have at least initial evidence, but some need reinforcement
    else if (inEvaluation.length > 0) {
      targetCriterion = inEvaluation[0]
      recommendedAction = 'SWITCH_TOPIC'
      reason = `Reinforcing evidence on pillar: "${targetCriterion.name}".`
      activeListeningGuidance = `Transition to reinforce evidence for ${targetCriterion.name}.`
    }
    // Case 6: All criteria covered
    else {
      targetCriterion = updatedMatrix[0] || null
      recommendedAction = 'DEEPEN'
      reason = 'All criteria sufficiently evaluated. Probing advanced edge cases and systemic trade-offs.'
      activeListeningGuidance = 'Praise their comprehensive grasp, and present a challenging scenario.'
    }

    const recommendedQuestionType = this.computeRecommendedQuestionType(askedQuestions, turnSequence, effectiveAllowedTypes, targetCriterion)

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
    baselineDifficulty = 'MEDIUM',
    allowedTypes = [],
    askAboutProjects = true,
    backgroundType = 'TECHNICAL',
    timeRemainingSeconds = 0,
    durationMinutes = 20,
  }) {
    return this.computeAdaptiveStep({
      coverageMatrix,
      currentCriterionId,
      answerAnalysis,
      turnSequence,
      candidateAnswer,
      jobTitle,
      askedQuestions,
      baselineDifficulty,
      allowedTypes,
      askAboutProjects,
      backgroundType,
      timeRemainingSeconds,
      durationMinutes,
    })
  },
}


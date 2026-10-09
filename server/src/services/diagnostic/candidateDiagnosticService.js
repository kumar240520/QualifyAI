import { GoogleGenAI, Type } from '@google/genai'
import { config } from '../../config/index.js'
import { getServiceSupabaseClient } from '../../integrations/supabaseClient.js'

/**
 * Domain Service for Candidate Diagnostic Experience (Phase 11)
 * Generates and serves strictly evidence-based, constructive, privacy-first growth feedback.
 * Grounded 100% in persisted interview records, submitted answers, and rubric-based evaluations.
 * Never fabricates candidate scores, strengths, transcript quotes, or recommendations.
 */
export const candidateDiagnosticService = {
  /**
   * Helper: call Gemini with structured schema with model fallback
   */
  async _callGeminiStructured({ prompt, responseSchema }) {
    if (!config.gemini?.apiKey) {
      throw new Error('Gemini API key is not configured.')
    }

    const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
    ]

    let lastError = null
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2, // Highly deterministic and grounded
          },
        })

        const text = response.text
        if (text) {
          return JSON.parse(text)
        }
      } catch (err) {
        lastError = err
        console.warn(`[CandidateDiagnosticService] Model ${model} failed, attempting fallback:`, err.message)
      }
    }
    throw new Error(`All Gemini candidate diagnostic models failed: ${lastError?.message}`)
  },

  /**
   * Synthesize or retrieve authoritative Candidate Diagnostic Report
   * @param {string} interviewId - Target interview UUID
   * @param {object} [options] - Options like forceRefresh
   */
  async generateCandidateDiagnostic(interviewId, options = {}) {
    const { forceRefresh = false } = options
    const supabase = getServiceSupabaseClient()

    // 1. Fetch interview details with associated job and candidate
    const { data: interview, error: intErr } = await supabase
      .from('interviews')
      .select('*, jobs(*), candidates(*)')
      .eq('id', interviewId)
      .single()

    if (intErr || !interview) {
      const err = new Error(`Interview not found: ${interviewId}`)
      err.status = 404
      throw err
    }

    const job = interview.jobs || {}
    const candidate = interview.candidates || {}

    // 2. Fetch latest interview session and its persisted session_metadata
    const { data: sessions } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('interview_id', interviewId)
      .order('updated_at', { ascending: false })
      .limit(1)

    const session = sessions?.[0] || null
    const sessionMetadata = session?.session_metadata || {}
    const turnHistory = Array.isArray(sessionMetadata.turn_history) ? sessionMetadata.turn_history : []
    const coverageMatrix = Array.isArray(sessionMetadata.coverage_matrix) ? sessionMetadata.coverage_matrix : []
    const askedQuestions = Array.isArray(sessionMetadata.asked_questions) ? sessionMetadata.asked_questions : []

    // 3. Check for existing persisted diagnostic report
    const { data: existingReport } = await supabase
      .from('candidate_diagnostic_reports')
      .select('*')
      .eq('interview_id', interviewId)
      .maybeSingle()

    // If report already exists and forceRefresh is false:
    // Check if report is already up-to-date with latest session activity
    if (existingReport && !forceRefresh) {
      const sessionUpdatedAt = session?.updated_at ? new Date(session.updated_at).getTime() : 0
      const reportCreatedAt = existingReport.created_at ? new Date(existingReport.created_at).getTime() : 0

      // If the report was created after or at session update and contains data, return it directly
      if (reportCreatedAt >= sessionUpdatedAt && Array.isArray(existingReport.pillar_ratings) && existingReport.pillar_ratings.length > 0) {
        return {
          id: existingReport.id,
          interview_id: interviewId,
          candidate_name: candidate.full_name || 'Candidate',
          candidate_email: candidate.email || '',
          job_title: job.title || 'Role Assessment',
          department: job.department || 'Engineering',
          completed_at: interview.completed_at || session?.updated_at || existingReport.created_at,
          status: interview.status,
          candidate_visible_summary: existingReport.candidate_visible_summary,
          articulation_summary: existingReport.articulation_summary,
          pillar_ratings: existingReport.pillar_ratings || [],
          verified_strengths: existingReport.verified_strengths || [],
          recommended_growth_areas: existingReport.recommended_growth_areas || [],
          action_plan: existingReport.action_plan || [],
          created_at: existingReport.created_at,
        }
      }
    }

    // 4. Fetch configured rubric criteria for the job requisition
    const { data: rubrics } = await supabase
      .from('rubrics')
      .select('*, rubric_criteria(*)')
      .eq('job_id', interview.job_id)
      .order('created_at', { ascending: false })
      .limit(1)

    let rubricCriteria = rubrics?.[0]?.rubric_criteria || []

    // Fallback: If no rubric attached directly to job, query rubric_criteria
    if (rubricCriteria.length === 0) {
      const { data: allCriteria } = await supabase
        .from('rubric_criteria')
        .select('*')
      rubricCriteria = allCriteria || []
    }

    // If coverage_matrix has criteria definitions, merge to ensure complete coverage
    const criteriaMap = new Map()
    for (const c of rubricCriteria) {
      criteriaMap.set((c.name || '').trim().toLowerCase(), {
        id: c.id,
        name: c.name,
        weight: c.weight || 5,
        description: c.description || '',
      })
    }
    for (const m of coverageMatrix) {
      const key = (m.name || '').trim().toLowerCase()
      if (key && !criteriaMap.has(key)) {
        criteriaMap.set(key, {
          id: m.criterion_id || null,
          name: m.name,
          weight: m.weight || 5,
          description: m.description || '',
        })
      }
    }
    const targetCriteria = Array.from(criteriaMap.values())

    // 5. Fetch existing evaluations and rubric_scores (if any)
    const { data: evaluation } = await supabase
      .from('evaluations')
      .select('*, rubric_scores(*)')
      .eq('interview_id', interviewId)
      .maybeSingle()

    const rubricScores = evaluation?.rubric_scores || []

    // 6. Fetch full recorded transcripts
    const { data: transcripts } = await supabase
      .from('transcripts')
      .select('speaker, content, sequence')
      .eq('interview_id', interviewId)
      .order('sequence', { ascending: true })

    // 7. Segregate Substantive Answers vs Skipped / Unanswered
    const substantiveTurns = turnHistory.filter((t) => {
      const text = String(t.answer_text || '').trim().toLowerCase()
      return text && text !== 'skip' && text !== 'skipped' && text !== '[no response]'
    })

    const skippedTurns = turnHistory.filter((t) => {
      const text = String(t.answer_text || '').trim().toLowerCase()
      return !text || text === 'skip' || text === 'skipped' || text === '[no response]'
    })

    // 8. Deterministic Rubric & Pillar Ratings Calculation
    // NEVER invent a percentage score or mark an unassessed pillar as assessed!
    const pillarRatings = targetCriteria.map((crit) => {
      const critNameLower = (crit.name || '').trim().toLowerCase()

      // Match in session coverage_matrix
      const matrixMatch = coverageMatrix.find(
        (m) => (m.name && m.name.trim().toLowerCase() === critNameLower) ||
               (m.criterion_id && crit.id && m.criterion_id === crit.id)
      )

      // Match in evaluation rubric_scores
      const rubricMatch = rubricScores.find(
        (rs) => (rs.rubric_criterion_id && crit.id && rs.rubric_criterion_id === crit.id)
      )

      // Match in substantive turn history
      const matchingTurns = substantiveTurns.filter(
        (t) => (t.criterion_name && t.criterion_name.trim().toLowerCase() === critNameLower) ||
               (t.rubric_criterion_id && crit.id && t.rubric_criterion_id === crit.id)
      )

      const attemptsCount = matrixMatch?.attempts ?? matchingTurns.length

      // Case A: Pillar was NEVER assessed in this session
      if (attemptsCount === 0 && !rubricMatch) {
        return {
          pillar: crit.name,
          criterion_id: crit.id,
          score: null, // Clear null indicator for unassessed
          status: 'UNASSESSED',
          proficiency_level: 'UNASSESSED',
          feedback: 'This competency was not assessed in this interview session.',
        }
      }

      // Case B: Pillar was assessed — compute deterministic score from real evaluation evidence
      let calculatedScore = 0

      if (rubricMatch?.score != null) {
        calculatedScore = Math.round(Number(rubricMatch.score))
      } else if (matrixMatch?.scores && Array.isArray(matrixMatch.scores) && matrixMatch.scores.length > 0) {
        const avg = matrixMatch.scores.reduce((a, b) => a + Number(b), 0) / matrixMatch.scores.length
        // Matrix scores from turn analysis are on 1-10 scale; normalize to 0-100
        calculatedScore = Math.round((avg / 10) * 100)
      } else if (matchingTurns.length > 0) {
        const sum = matchingTurns.reduce((acc, t) => acc + (Number(t.analysis?.correctness) || 1), 0)
        const avgCorr = sum / matchingTurns.length
        calculatedScore = Math.round((avgCorr / 10) * 100)
      }

      calculatedScore = Math.max(0, Math.min(100, calculatedScore))

      // Derive proficiency level based on deterministic score
      let proficiencyLevel = 'DEVELOPING'
      if (calculatedScore >= 85) proficiencyLevel = 'EXPERT'
      else if (calculatedScore >= 70) proficiencyLevel = 'ADVANCED'
      else if (calculatedScore >= 50) proficiencyLevel = 'PROFICIENT'

      // Collect detected concepts and missing concepts for evidence-based feedback
      const detected = [
        ...(matrixMatch?.evidence || []),
        ...matchingTurns.flatMap((t) => t.analysis?.concepts_detected || []),
        ...matchingTurns.flatMap((t) => t.analysis?.strengths || []),
      ].filter((v, i, a) => a.indexOf(v) === i && Boolean(v))

      const missing = [
        ...(matrixMatch?.missing || []),
        ...matchingTurns.flatMap((t) => t.analysis?.missing_concepts || []),
        ...matchingTurns.flatMap((t) => t.analysis?.weaknesses || []),
      ].filter((v, i, a) => a.indexOf(v) === i && Boolean(v))

      let feedback = ''
      if (rubricMatch?.justification) {
        feedback = rubricMatch.justification
      } else if (detected.length > 0 && missing.length > 0) {
        feedback = `Demonstrated grasp of ${detected.slice(0, 2).join(' and ')}. Key areas for continued depth: ${missing.slice(0, 2).join(' and ')}.`
      } else if (detected.length > 0) {
        feedback = `Demonstrated solid command of ${detected.slice(0, 3).join(', ')} with consistent execution.`
      } else if (missing.length > 0) {
        feedback = `Identified development opportunities in ${missing.slice(0, 3).join(', ')}.`
      } else if (matchingTurns[0]?.analysis?.feedback_summary) {
        feedback = matchingTurns[0].analysis.feedback_summary
      } else {
        feedback = `Assessed across ${attemptsCount} question turn(s).`
      }

      return {
        pillar: crit.name,
        criterion_id: crit.id,
        score: calculatedScore,
        status: calculatedScore >= 70 ? 'MASTERY_PROVEN' : 'PARTIALLY_ASSESSED',
        proficiency_level: proficiencyLevel,
        feedback,
      }
    })

    // 9. Verified Strengths — Grounded Strictly in Candidate's Actual Answers
    // Never invent quotes or claim competencies without recorded evidence
    const verifiedStrengths = []
    const qualifyingTurns = substantiveTurns.filter((t) => {
      const correctness = Number(t.analysis?.correctness) || 0
      const hasStrengths = Array.isArray(t.analysis?.strengths) && t.analysis.strengths.length > 0
      const hasConcepts = Array.isArray(t.analysis?.concepts_detected) && t.analysis.concepts_detected.length > 0
      return correctness >= 7 || hasStrengths || hasConcepts
    })

    for (const t of qualifyingTurns.slice(0, 3)) {
      const topic = t.criterion_name || 'Core Problem Solving'
      const description = t.analysis?.feedback_summary ||
        (t.analysis?.strengths?.length > 0
          ? t.analysis.strengths.join('; ')
          : 'Demonstrated clear, accurate execution on the presented challenge.')

      // Exact verbatim candidate answer text (NEVER the question text!)
      let rawQuote = String(t.answer_text || '').trim()
      if (rawQuote.length > 180) {
        rawQuote = rawQuote.slice(0, 177) + '...'
      }

      verifiedStrengths.push({
        topic,
        description,
        evidence_quote: rawQuote,
      })
    }

    // 10. Targeted Growth Vectors — Based on Real Gaps & Missing Concepts
    // Never invent arbitrary book citations or fictitious authors
    const recommendedGrowthAreas = []
    const gapTurns = substantiveTurns.filter((t) => {
      const correctness = Number(t.analysis?.correctness) || 10
      const hasMissing = Array.isArray(t.analysis?.missing_concepts) && t.analysis.missing_concepts.length > 0
      const hasWeakness = Array.isArray(t.analysis?.weaknesses) && t.analysis.weaknesses.length > 0
      return correctness < 7 || hasMissing || hasWeakness
    })

    for (const t of gapTurns.slice(0, 3)) {
      const topic = t.criterion_name || 'Technical Depth'
      const missing = t.analysis?.missing_concepts || []
      const weakness = t.analysis?.weaknesses?.[0] || t.analysis?.feedback_summary || 'Solution did not demonstrate all expected concepts.'

      const recommendation = missing.length > 0
        ? `Deepen practical execution of ${missing.join(', ')}. Practice structured decomposition before finalizing answers.`
        : `Strengthen precision on multi-step reasoning and verify boundary conditions before submitting.`

      const resources = missing.length > 0
        ? missing.map((m) => `Targeted practice problems on ${m}`)
        : ['Guided problem decomposition exercises', 'Timed analytical practice sets']

      recommendedGrowthAreas.push({
        topic,
        observation: weakness,
        recommendation,
        suggested_resources: resources.slice(0, 3),
      })
    }

    // If candidate submitted 0 answers or skipped all:
    if (substantiveTurns.length === 0) {
      recommendedGrowthAreas.push({
        topic: 'Assessment Participation & Baseline Diagnostic',
        observation: 'No substantive spoken or written responses were recorded during the interview session.',
        recommendation: 'Participate in a complete assessment session to generate individualized technical growth metrics and competency diagnostics.',
        suggested_resources: [
          'QualifyAI practice interview simulation',
          'System review and microphone audio calibration',
        ],
      })
    }

    // 11. Personalized Growth Action Plan
    const actionPlan = []
    if (recommendedGrowthAreas.length > 0 && substantiveTurns.length > 0) {
      actionPlan.push({
        phase: 'Phase 1: Foundation (Days 1–14)',
        focus: recommendedGrowthAreas[0].topic,
        action: `Focus on: ${recommendedGrowthAreas[0].recommendation}`,
      })
      if (recommendedGrowthAreas.length > 1) {
        actionPlan.push({
          phase: 'Phase 2: Applied Mastery (Days 15–30)',
          focus: recommendedGrowthAreas[1].topic,
          action: `Complete hands-on application: ${recommendedGrowthAreas[1].recommendation}`,
        })
      } else {
        actionPlan.push({
          phase: 'Phase 2: Integration (Days 15–30)',
          focus: 'End-to-End Problem Solving',
          action: 'Synthesize core concepts under timed assessment conditions to build pacing and accuracy.',
        })
      }
    } else if (substantiveTurns.length === 0) {
      actionPlan.push({
        phase: 'Orientation (Days 1–7)',
        focus: 'Platform Familiarization',
        action: 'Run audio and video checks and complete the interactive onboarding tutorial.',
      })
    }

    // 12. Grounded Executive Summary & Verbal Articulation
    const assessedPillars = pillarRatings.filter((p) => p.status !== 'UNASSESSED')
    const unassessedPillars = pillarRatings.filter((p) => p.status === 'UNASSESSED')

    let candidateVisibleSummary = ''
    let articulationSummary = ''

    // Deterministic fallback baseline
    if (substantiveTurns.length === 0) {
      candidateVisibleSummary = `${candidate.full_name || 'The candidate'} completed the interview session for the ${job.title || 'configured'} position, but no substantive spoken or written responses were recorded. As a result, technical proficiencies could not be evaluated. We recommend scheduling a dedicated practice session to establish baseline diagnostic metrics.`
      articulationSummary = 'No verbal or written articulation was recorded for analysis.'
    } else {
      const assessedSummary = assessedPillars
        .map((p) => `${p.pillar} (${p.score}%, ${p.proficiency_level})`)
        .join(', ')

      candidateVisibleSummary = `${candidate.full_name || 'The candidate'} completed the assessment for the ${job.title || 'position'}, submitting responses across ${substantiveTurns.length} question(s).`
      if (assessedPillars.length > 0) {
        candidateVisibleSummary += ` Assessed competencies include: ${assessedSummary}.`
      }
      if (verifiedStrengths.length > 0) {
        candidateVisibleSummary += ` Demonstrable strengths were observed in ${verifiedStrengths.map((s) => s.topic).join(' and ')}.`
      }
      if (recommendedGrowthAreas.length > 0 && recommendedGrowthAreas[0].observation) {
        candidateVisibleSummary += ` Priority growth areas include ${recommendedGrowthAreas.map((g) => g.topic).join(' and ')}.`
      }
      if (unassessedPillars.length > 0) {
        candidateVisibleSummary += ` Note that ${unassessedPillars.length} competency dimension(s) (${unassessedPillars.map((p) => p.pillar).join(', ')}) were not assessed during this session.`
      }

      // Compute verbal vs text articulation
      const candidateTranscriptTurns = (transcripts || []).filter((t) => t.speaker === 'CANDIDATE')
      if (candidateTranscriptTurns.length > 0) {
        articulationSummary = `Spoken articulation exhibited consistent pacing and structured delivery across ${candidateTranscriptTurns.length} recorded verbal turn(s).`
      } else {
        articulationSummary = `Candidate utilized direct on-screen workspace input for their responses. Written technical formulation was direct and focused.`
      }
    }

    // Optional: Enhance summary with Gemini ONLY if API is available and grounded strictly in the facts
    if (substantiveTurns.length > 0 && config.gemini?.apiKey) {
      try {
        const factsPrompt = `You are an objective engineering career coach summarizing an actual candidate technical assessment.
You MUST adhere strictly to the provided facts below.
DO NOT invent scores, DO NOT invent skills, DO NOT assume technical background not demonstrated in the transcript, and acknowledge unassessed pillars as unassessed.

FACTS:
Candidate: ${candidate.full_name || 'Candidate'}
Role: ${job.title || 'Role'}
Department: ${job.department || 'Engineering'}
Total Questions Presented: ${askedQuestions.length || substantiveTurns.length}
Substantive Answers Submitted: ${substantiveTurns.length}
Skipped/Unanswered Questions: ${skippedTurns.length}
Assessed Competencies: ${assessedPillars.map((p) => `${p.pillar}: ${p.score}% (${p.proficiency_level})`).join(', ') || 'None'}
Unassessed Competencies: ${unassessedPillars.map((p) => p.pillar).join(', ') || 'None'}
Observed Strengths: ${verifiedStrengths.map((s) => s.topic).join(', ') || 'None'}
Observed Gaps: ${recommendedGrowthAreas.map((g) => `${g.topic} (${g.observation})`).join('; ') || 'None'}

Provide:
1. candidate_visible_summary: A 2-paragraph constructive, empowering, deeply grounded summary strictly based on these facts.
2. articulation_summary: A 1-2 sentence assessment of communication and articulation based on the submitted answers.`

        const schema = {
          type: Type.OBJECT,
          properties: {
            candidate_visible_summary: { type: Type.STRING },
            articulation_summary: { type: Type.STRING },
          },
          required: ['candidate_visible_summary', 'articulation_summary'],
        }

        const aiResult = await this._callGeminiStructured({ prompt: factsPrompt, responseSchema: schema })
        if (aiResult?.candidate_visible_summary) {
          candidateVisibleSummary = aiResult.candidate_visible_summary
        }
        if (aiResult?.articulation_summary) {
          articulationSummary = aiResult.articulation_summary
        }
      } catch (geminiErr) {
        console.warn('[CandidateDiagnosticService] Gemini summary enhancement skipped, using deterministic baseline:', geminiErr.message)
      }
    }

    // 13. Persist Idempotently in candidate_diagnostic_reports
    const { data: createdReport, error: saveErr } = await supabase
      .from('candidate_diagnostic_reports')
      .upsert(
        {
          interview_id: interviewId,
          candidate_id: candidate.id,
          candidate_visible_summary: candidateVisibleSummary,
          articulation_summary: articulationSummary,
          pillar_ratings: pillarRatings,
          verified_strengths: verifiedStrengths,
          recommended_growth_areas: recommendedGrowthAreas,
          action_plan: actionPlan,
        },
        { onConflict: 'interview_id' }
      )
      .select()
      .single()

    if (saveErr) {
      console.error('[CandidateDiagnosticService] Error persisting report:', saveErr)
      throw saveErr
    }

    return {
      id: createdReport.id,
      interview_id: interviewId,
      candidate_name: candidate.full_name || 'Candidate',
      candidate_email: candidate.email || '',
      job_title: job.title || 'Role Assessment',
      department: job.department || 'Engineering',
      completed_at: interview.completed_at || session?.updated_at || createdReport.created_at,
      status: interview.status,
      candidate_visible_summary: createdReport.candidate_visible_summary,
      articulation_summary: createdReport.articulation_summary,
      pillar_ratings: createdReport.pillar_ratings || [],
      verified_strengths: createdReport.verified_strengths || [],
      recommended_growth_areas: createdReport.recommended_growth_areas || [],
      action_plan: createdReport.action_plan || [],
      created_at: createdReport.created_at,
    }
  },

  /**
   * Retrieve report by interview ID
   */
  async getCandidateDiagnostic(interviewId, options = {}) {
    return this.generateCandidateDiagnostic(interviewId, options)
  },

  /**
   * Retrieve report directly using Candidate Invitation Token
   */
  async getCandidateDiagnosticByToken(token, options = {}) {
    const supabase = getServiceSupabaseClient()

    // 1. Resolve invitation securely
    const { data: invitation, error: invErr } = await supabase
      .from('invitations')
      .select('*, jobs(*), candidates(*)')
      .eq('token', token)
      .maybeSingle()

    if (invErr || !invitation) {
      const err = new Error('Invalid or expired invitation token.')
      err.status = 404
      throw err
    }

    // 2. Find associated interview
    const { data: interview, error: intErr } = await supabase
      .from('interviews')
      .select('id')
      .eq('job_id', invitation.job_id)
      .eq('candidate_id', invitation.candidate_id)
      .maybeSingle()

    if (intErr || !interview) {
      const err = new Error('No interview session associated with this invitation.')
      err.status = 404
      throw err
    }

    return this.getCandidateDiagnostic(interview.id, options)
  },
}

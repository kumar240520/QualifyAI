import { getServiceSupabaseClient } from '../../integrations/supabaseClient.js'
import { evaluationEngineService } from '../evaluation/evaluationEngineService.js'
import { proctoringEngineService } from '../proctoring/proctoringEngineService.js'

/**
 * Enterprise Reporting, Cohort Leaderboards & Recruiter Analytics Service
 */
export const reportAnalyticsService = {
  /**
   * Synthesize or retrieve executive recruiter report for an interview
   */
  async generateExecutiveReport(interviewId, organizationId = null) {
    const supabase = getServiceSupabaseClient()

    // 1. Fetch interview with job and candidate context
    const { data: interview, error: intErr } = await supabase
      .from('interviews')
      .select('*, jobs(*), candidates(*)')
      .eq('id', interviewId)
      .single()

    if (intErr || !interview) {
      const err = new Error('Interview not found.')
      err.status = 404
      throw err
    }

    if (organizationId && interview.organization_id !== organizationId) {
      const err = new Error('Forbidden: Unauthorized access to interview report outside your organization.')
      err.status = 403
      throw err
    }

    // 2. Fetch evaluation (generate if not yet synthesized)
    let evaluationData
    try {
      evaluationData = await evaluationEngineService.getEvaluationByInterviewId({
        interviewId,
        organizationId: interview.organization_id,
      })
    } catch (e) {
      evaluationData = await evaluationEngineService.generateEvaluation({
        interviewId,
        organizationId: interview.organization_id,
      })
    }

    const evaluation = evaluationData.evaluation
    const rubricScores = evaluationData.rubricScores || []
    const commMetrics = evaluationData.communicationMetrics || {}

    // 3. Fetch proctoring integrity summary
    const proctoringSummary = await proctoringEngineService.getProctoringSummary(interviewId)

    // 4. Derive Strengths and Improvement Areas from rubric scores
    const sortedCriteria = [...rubricScores].sort((a, b) => b.score - a.score)
    const strengths = sortedCriteria
      .filter((c) => c.score >= 50)
      .slice(0, 3)
      .map((c) => ({
        dimension: c.criterion_name,
        score: c.score,
        evidence: c.evidence_quotes?.[0] || c.justification,
      }))

    const improvementAreas = sortedCriteria
      .filter((c) => c.score < 60)
      .slice(-3)
      .map((c) => ({
        dimension: c.criterion_name,
        score: c.score,
        gap: c.justification,
      }))

    // 5. Structure Technical, Communication, and Integrity Details
    const technicalDetails = {
      overall_score: evaluation.overall_score,
      technical_score: evaluation.technical_score,
      problem_solving_score: evaluation.problem_solving_score,
      criteria_breakdown: rubricScores.map((r) => ({
        name: r.criterion_name,
        weight: r.weight,
        score: r.score,
        justification: r.justification,
      })),
    }

    const communicationDetails = {
      communication_score: evaluation.communication_score,
      wpm: commMetrics.wpm || 130,
      filler_word_density: commMetrics.filler_word_density || 1.2,
      clarity_score: commMetrics.clarity_score || 85,
      pauses_count: commMetrics.pauses_count || 0,
    }

    const integrityDetails = {
      risk_score: proctoringSummary.risk_score || 0,
      trust_level: proctoringSummary.trust_level || 'HIGH',
      total_anomalies: proctoringSummary.total_anomalies || 0,
      flags_summary: proctoringSummary.flags_summary || {},
    }

    // 6. Check existing report
    const { data: existingReport } = await supabase
      .from('reports')
      .select('id')
      .eq('interview_id', interviewId)
      .maybeSingle()

    let reportRecord

    if (existingReport?.id) {
      const { data: updated, error: upErr } = await supabase
        .from('reports')
        .update({
          overall_summary: evaluation.summary,
          strengths,
          improvement_areas: improvementAreas,
          technical_details: technicalDetails,
          communication_details: communicationDetails,
          integrity_summary: integrityDetails,
        })
        .eq('id', existingReport.id)
        .select()
        .single()

      if (upErr) throw upErr
      reportRecord = updated
    } else {
      const { data: created, error: crErr } = await supabase
        .from('reports')
        .insert({
          interview_id: interviewId,
          candidate_id: interview.candidate_id,
          overall_summary: evaluation.summary,
          strengths,
          improvement_areas: improvementAreas,
          technical_details: technicalDetails,
          communication_details: communicationDetails,
          integrity_summary: integrityDetails,
        })
        .select()
        .single()

      if (crErr) throw crErr
      reportRecord = created
    }

    const { data: sessionData } = await supabase
      .from('interview_sessions')
      .select('session_metadata')
      .eq('interview_id', interviewId)
      .maybeSingle()
    const sessionMeta = sessionData?.session_metadata || {}
    const candidateFeedback = {
      feedback: sessionMeta.candidate_feedback || null,
      rating: sessionMeta.candidate_ai_rating || null,
      submittedAt: sessionMeta.feedback_submitted_at || null,
    }
    const pillarCoverage = sessionMeta.coverage_matrix || []

    return {
      ...reportRecord,
      interview,
      candidate: interview.candidates,
      job: interview.jobs,
      evaluation,
      candidate_feedback: candidateFeedback,
      candidateFeedback,
      pillar_coverage: pillarCoverage,
      coverageMatrix: pillarCoverage,
    }
  },

  /**
   * Retrieve executive report by interview ID
   */
  async getExecutiveReport(interviewId, organizationId = null) {
    const supabase = getServiceSupabaseClient()

    const { data: report } = await supabase
      .from('reports')
      .select('*, interviews(*, jobs(*), candidates(*))')
      .eq('interview_id', interviewId)
      .maybeSingle()

    if (!report) {
      return this.generateExecutiveReport(interviewId, organizationId)
    }

    if (organizationId && report.interviews?.organization_id !== organizationId) {
      const err = new Error('Forbidden: Unauthorized access to report outside your organization.')
      err.status = 403
      throw err
    }

    const { data: sessionData } = await supabase
      .from('interview_sessions')
      .select('session_metadata')
      .eq('interview_id', interviewId)
      .maybeSingle()
    const sessionMeta = sessionData?.session_metadata || {}
    const candidateFeedback = {
      feedback: sessionMeta.candidate_feedback || null,
      rating: sessionMeta.candidate_ai_rating || null,
      submittedAt: sessionMeta.feedback_submitted_at || null,
    }
    const pillarCoverage = sessionMeta.coverage_matrix || []

    return {
      ...report,
      interview: report.interviews,
      candidate: report.interviews?.candidates,
      job: report.interviews?.jobs,
      candidate_feedback: candidateFeedback,
      candidateFeedback,
      pillar_coverage: pillarCoverage,
      coverageMatrix: pillarCoverage,
    }
  },

  /**
   * Compute ranked cohort leaderboard and requisition-level comparative analytics
   */
  async getJobCohortAnalytics(jobId, organizationId = null) {
    const supabase = getServiceSupabaseClient()

    // 1. Fetch job requisition details
    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobErr || !job) {
      const err = new Error('Job requisition not found.')
      err.status = 404
      throw err
    }

    if (organizationId && job.organization_id !== organizationId) {
      const err = new Error('Forbidden: Unauthorized access to job cohort outside your organization.')
      err.status = 403
      throw err
    }

    // 2. Fetch all candidates and applications for this job
    const { data: applications } = await supabase
      .from('applications')
      .select(`
        id,
        status,
        applied_at,
        candidates (
          id,
          email,
          full_name,
          phone,
          resume_url,
          created_at
        )
      `)
      .eq('job_id', jobId)

    const candidateIds = (applications || []).map((a) => a.candidates?.id).filter(Boolean)

    // 3. Fetch interviews for these candidates
    const { data: interviews } =
      candidateIds.length > 0
        ? await supabase
            .from('interviews')
            .select('id, candidate_id, status, started_at, completed_at')
            .eq('job_id', jobId)
            .in('candidate_id', candidateIds)
        : { data: [] }

    const interviewIds = (interviews || []).map((i) => i.id)

    // 4. Fetch evaluations and proctoring summaries
    const { data: evaluations } =
      interviewIds.length > 0
        ? await supabase
            .from('evaluations')
            .select('*')
            .in('interview_id', interviewIds)
        : { data: [] }

    const { data: proctoringSummaries } =
      interviewIds.length > 0
        ? await supabase
            .from('proctoring_summaries')
            .select('*')
            .in('interview_id', interviewIds)
        : { data: [] }

    const evalMap = new Map()
    ;(evaluations || []).forEach((ev) => {
      evalMap.set(ev.interview_id, ev)
    })

    const procMap = new Map()
    ;(proctoringSummaries || []).forEach((ps) => {
      procMap.set(ps.interview_id, ps)
    })

    const interviewMap = new Map()
    ;(interviews || []).forEach((inv) => {
      interviewMap.set(inv.candidate_id, inv)
    })

    // 5. Build Candidate Cohort Rankings
    const cohortItems = (applications || []).map((app) => {
      const candidate = app.candidates
      const interview = candidate ? interviewMap.get(candidate.id) : null
      const evaluation = interview ? evalMap.get(interview.id) : null
      const proctoring = interview ? procMap.get(interview.id) : null

      const overallScore = evaluation ? Number(evaluation.overall_score) : null
      const technicalScore = evaluation ? Number(evaluation.technical_score) : null
      const problemScore = evaluation ? Number(evaluation.problem_solving_score) : null
      const commScore = evaluation ? Number(evaluation.communication_score) : null

      // Recommendation derived from composite score
      let recommendation = 'PENDING'
      if (overallScore !== null) {
        if (overallScore >= 80) recommendation = 'STRONG_HIRE'
        else if (overallScore >= 65) recommendation = 'HIRE'
        else if (overallScore >= 50) recommendation = 'LEANING_HIRE'
        else recommendation = 'NO_HIRE'
      }

      return {
        candidate_id: candidate?.id,
        full_name: candidate?.full_name || 'Candidate',
        email: candidate?.email || '',
        application_status: app.status,
        applied_at: app.applied_at,
        interview_id: interview?.id || null,
        interview_status: interview?.status || 'NOT_STARTED',
        overall_score: overallScore,
        technical_score: technicalScore,
        problem_solving_score: problemScore,
        communication_score: commScore,
        recommendation,
        trust_level: proctoring?.trust_level || 'HIGH',
        risk_score: proctoring ? Number(proctoring.risk_score) : 0,
      }
    })

    // Sort cohort: evaluated candidates with highest scores first, followed by pending
    const rankedCohort = cohortItems
      .sort((a, b) => {
        if (a.overall_score !== null && b.overall_score !== null) {
          return b.overall_score - a.overall_score
        }
        if (a.overall_score !== null) return -1
        if (b.overall_score !== null) return 1
        return new Date(b.applied_at) - new Date(a.applied_at)
      })
      .map((item, idx) => ({
        rank: item.overall_score !== null ? idx + 1 : null,
        ...item,
      }))

    // 6. Compute Cohort Summary Metrics
    const evaluatedCandidates = rankedCohort.filter((c) => c.overall_score !== null)
    const totalAssessed = evaluatedCandidates.length
    const scoreSum = evaluatedCandidates.reduce((acc, c) => acc + c.overall_score, 0)
    const averageScore = totalAssessed > 0 ? Math.round((scoreSum / totalAssessed) * 10) / 10 : 0
    const topScore = totalAssessed > 0 ? Math.max(...evaluatedCandidates.map((c) => c.overall_score)) : 0
    const hiresCount = evaluatedCandidates.filter((c) => ['STRONG_HIRE', 'HIRE'].includes(c.recommendation)).length
    const hireRate = totalAssessed > 0 ? Math.round((hiresCount / totalAssessed) * 100) : 0

    return {
      job: {
        id: job.id,
        title: job.title,
        department: job.department,
        seniority: job.seniority,
      },
      metrics: {
        total_candidates: rankedCohort.length,
        total_assessed: totalAssessed,
        average_score: averageScore,
        top_score: topScore,
        hire_rate_percentage: hireRate,
      },
      leaderboard: rankedCohort,
    }
  },
}

import crypto from 'crypto'
import { getSupabaseClient, getServiceSupabaseClient } from '../integrations/supabaseClient.js'
import { NotFoundError, ForbiddenError, ValidationError, DuplicateResourceError } from '../utils/errors.js'

/**
 * Enterprise Candidate & Invitation Management Domain Service
 */
export const candidateService = {
  /**
   * Helper: verify job exists and belongs to organization
   */
  async _verifyJobBelongsToOrg(jobId, organizationId, supabase) {
    const { data: job, error } = await supabase
      .from('jobs')
      .select('id, title, department, seniority, organization_id')
      .eq('id', jobId)
      .eq('organization_id', organizationId)
      .single()

    if (error || !job) {
      throw new NotFoundError('Job requisition not found or unauthorized.')
    }
    return job
  },

  /**
   * List candidates for a specific job requisition
   */
  async listCandidatesByJob({ jobId, organizationId, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()

    // 1. Parallelize job organization validation and applications fetch
    const [_, appResult] = await Promise.all([
      this._verifyJobBelongsToOrg(jobId, organizationId, supabase),
      supabase
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
            metadata,
            created_at
          )
        `)
        .eq('job_id', jobId)
        .order('applied_at', { ascending: false }),
    ])

    if (appResult.error) {
      console.error('[CandidateService.listCandidatesByJob] Error:', appResult.error.message)
      throw new Error(`Failed to list candidates: ${appResult.error.message}`)
    }

    const applications = appResult.data
    if (!applications || applications.length === 0) {
      return []
    }

    // 2. Fetch active invitations and interviews concurrently
    const candidateIds = applications.map((a) => a.candidates?.id).filter(Boolean)
    if (candidateIds.length === 0) {
      return []
    }

    const serviceSupabase = getServiceSupabaseClient()
    const [invResult, intResult] = await Promise.all([
      (supabase || serviceSupabase)
        .from('invitations')
        .select('*')
        .eq('job_id', jobId)
        .in('candidate_id', candidateIds)
        .order('created_at', { ascending: false }),
      (supabase || serviceSupabase)
        .from('interviews')
        .select('id, candidate_id, status, started_at, completed_at')
        .eq('job_id', jobId)
        .in('candidate_id', candidateIds)
        .order('created_at', { ascending: false }),
    ])

    let invitations = invResult.data || []
    if (invResult.error || (!invResult.data && candidateIds.length > 0)) {
      console.warn('[listCandidatesByJob] Fallback to service client for invitations:', invResult.error?.message)
      const fallbackInv = await serviceSupabase
        .from('invitations')
        .select('*')
        .eq('job_id', jobId)
        .in('candidate_id', candidateIds)
        .order('created_at', { ascending: false })
      invitations = fallbackInv.data || []
    }

    let interviews = intResult.data || []
    if (intResult.error || (!intResult.data && candidateIds.length > 0)) {
      console.warn('[listCandidatesByJob] Fallback to service client for interviews:', intResult.error?.message)
      const fallbackInt = await serviceSupabase
        .from('interviews')
        .select('id, candidate_id, status, started_at, completed_at')
        .eq('job_id', jobId)
        .in('candidate_id', candidateIds)
        .order('created_at', { ascending: false })
      interviews = fallbackInt.data || []
    }

    const invitationMap = new Map()
    invitations.forEach((inv) => {
      if (!invitationMap.has(inv.candidate_id)) {
        invitationMap.set(inv.candidate_id, inv)
      } else {
        const existing = invitationMap.get(inv.candidate_id)
        // Prioritize ACCEPTED or COMPLETED status over SENT / CREATED
        if (
          (existing.status === 'SENT' || existing.status === 'CREATED' || existing.status === 'OPENED') &&
          (inv.status === 'ACCEPTED' || inv.status === 'COMPLETED' || inv.accepted_at)
        ) {
          invitationMap.set(inv.candidate_id, inv)
        }
      }
    })

    const interviewIds = interviews.map((i) => i.id).filter(Boolean)
    const { data: evals } =
      interviewIds.length > 0
        ? await (supabase || serviceSupabase)
            .from('evaluations')
            .select(
              'id, interview_id, overall_score, summary, technical_score, problem_solving_score, communication_score, created_at'
            )
            .in('interview_id', interviewIds)
        : { data: [] }

    const evalMap = new Map()
    if (evals) {
      evals.forEach((ev) => {
        evalMap.set(ev.interview_id, [ev])
      })
    }

    const interviewMap = new Map()
    if (interviews) {
      interviews.forEach((interview) => {
        if (!interviewMap.has(interview.candidate_id)) {
          interviewMap.set(interview.candidate_id, {
            ...interview,
            evaluations: evalMap.get(interview.id) || [],
          })
        } else {
          const existing = interviewMap.get(interview.candidate_id)
          // Prioritize COMPLETED interview over IN_PROGRESS / SCHEDULED
          if (existing.status !== 'COMPLETED' && interview.status === 'COMPLETED') {
            interviewMap.set(interview.candidate_id, {
              ...interview,
              evaluations: evalMap.get(interview.id) || [],
            })
          }
        }
      })
    }

    // Return combined items
    return applications.map((app) => ({
      application_id: app.id,
      application_status: app.status,
      applied_at: app.applied_at,
      id: app.candidates?.id,
      email: app.candidates?.email,
      full_name: app.candidates?.full_name,
      phone: app.candidates?.phone,
      resume_url: app.candidates?.resume_url,
      metadata: app.candidates?.metadata,
      invitation: invitationMap.get(app.candidates?.id) || null,
      interview: interviewMap.get(app.candidates?.id) || null,
    }))
  },

  /**
   * Register candidate in organization talent pool and create application for job
   */
  async addCandidate({ jobId, organizationId, candidateData, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    const { email, fullName, phone, resumeUrl } = candidateData || {}
    if (!email || !email.includes('@')) {
      throw new ValidationError({ email: 'Valid candidate email is required.' }, 'Valid candidate email is required.')
    }
    if (!fullName || fullName.trim().length < 2) {
      throw new ValidationError({ fullName: 'Candidate full name is required.' }, 'Candidate full name is required.')
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanName = fullName.trim()

    // 1. Check if candidate with this email is already registered in the organization
    const { data: existingCandidates } = await supabase
      .from('candidates')
      .select('id, email, full_name, phone')
      .eq('organization_id', organizationId)
      .eq('email', cleanEmail)

    const existingCandidate = existingCandidates?.[0] || null

    if (existingCandidate) {
      // Check if candidate is already associated with this job requisition
      const { data: existingApp } = await supabase
        .from('applications')
        .select('id, status')
        .eq('job_id', jobId)
        .eq('candidate_id', existingCandidate.id)
        .maybeSingle()

      if (existingApp) {
        throw new DuplicateResourceError(
          'email',
          'This candidate email is already registered for this job requisition.'
        )
      }
    }

    // 2. Insert or retrieve candidate profile
    let candidate = existingCandidate
    if (!candidate) {
      const { data: created, error: candidateError } = await supabase
        .from('candidates')
        .insert({
          organization_id: organizationId,
          email: cleanEmail,
          full_name: cleanName,
          phone: phone?.trim() || null,
          resume_url: resumeUrl?.trim() || null,
        })
        .select()
        .single()

      if (candidateError || !created) {
        if (/duplicate|uq_org_candidate_email|23505/i.test(candidateError?.message)) {
          throw new DuplicateResourceError('email', 'This candidate email is already registered in your organization talent pool.')
        }
        throw new Error(`Failed to save candidate: ${candidateError?.message}`)
      }
      candidate = created
    } else {
      // Keep candidate name / contact updated if amended
      await supabase
        .from('candidates')
        .update({
          full_name: cleanName,
          phone: phone?.trim() || candidate.phone || null,
        })
        .eq('id', candidate.id)
    }

    // 3. Link candidate to job via applications table
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        job_id: jobId,
        candidate_id: candidate.id,
        status: 'APPLIED',
      })
      .select()
      .single()

    if (appError) {
      if (/duplicate|uq_job_candidate|23505/i.test(appError.message)) {
        throw new DuplicateResourceError('email', 'This candidate email is already registered for this job requisition.')
      }
      throw new Error(`Failed to associate candidate with job: ${appError.message}`)
    }

    return {
      ...candidate,
      application_id: application.id,
      application_status: application.status,
    }
  },

  /**
   * Generate secure cryptographic invitation link
   */
  async createInvitation({ jobId, organizationId, candidateId, expiresInDays = 7, interviewDurationMinutes = 30, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    // Generate secure random token (64 hex characters)
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + (Number(expiresInDays) || 7) * 24 * 60 * 60 * 1000).toISOString()
    const durationMinutes = Math.min(180, Math.max(5, Number(interviewDurationMinutes) || 30))

    // Check existing invitation status
    const { data: existing } = await supabase
      .from('invitations')
      .select('id, status, token')
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)
      .maybeSingle()

    if (existing?.status === 'COMPLETED') {
      throw new DuplicateResourceError('email', 'This candidate has already completed their assessment for this requisition.')
    }

    let invitation
    if (existing?.id) {
      const { data: updated, error } = await supabase
        .from('invitations')
        .update({
          token,
          status: 'SENT',
          expires_at: expiresAt,
          interview_duration_minutes: durationMinutes,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw new Error(`Failed to update invitation: ${error.message}`)
      invitation = updated
    } else {
      const { data: inserted, error } = await supabase
        .from('invitations')
        .insert({
          job_id: jobId,
          candidate_id: candidateId,
          token,
          status: 'SENT',
          expires_at: expiresAt,
          interview_duration_minutes: durationMinutes,
        })
        .select()
        .single()

      if (error) throw new Error(`Failed to create invitation: ${error.message}`)
      invitation = inserted
    }

    // Update application status to INVITED
    await supabase
      .from('applications')
      .update({ status: 'INVITED' })
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)

    return invitation
  },

  /**
   * Public: Retrieve and verify invitation by cryptographic token
   */
  async getInvitationByToken(token) {
    if (!token || token.length < 8) {
      throw new ValidationError({ token: 'Invalid invitation token.' }, 'Invalid invitation token.')
    }

    const supabase = getServiceSupabaseClient()

    const { data: invitation, error } = await supabase
      .from('invitations')
      .select(`
        id,
        token,
        status,
        expires_at,
        interview_duration_minutes,
        created_at,
        jobs (
          id,
          title,
          department,
          seniority,
          organization_id,
          organizations (
            id,
            name
          )
        ),
        candidates (
          id,
          full_name,
          email,
          phone,
          experience_years,
          specialization,
          recent_company,
          onboarding_completed,
          onboarding_data
        )
      `)
      .eq('token', token)
      .maybeSingle()

    if (error || !invitation) {
      throw new NotFoundError('Invitation not found or has expired.')
    }

    if (invitation.status === 'COMPLETED' || invitation.status === 'CANCELLED' || invitation.status === 'TERMINATED') {
      throw new ForbiddenError('This single-use assessment session has already been completed and concluded. Re-access is terminated.')
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      await supabase.from('invitations').update({ status: 'EXPIRED' }).eq('id', invitation.id)
      throw new ForbiddenError('This invitation link has expired. Please contact the recruiting team.')
    }

    // Update status to OPENED if newly received
    if (invitation.status === 'SENT' || invitation.status === 'CREATED') {
      await supabase.from('invitations').update({ status: 'OPENED' }).eq('id', invitation.id)
      invitation.status = 'OPENED'
    }

    return {
      invitation: {
        id: invitation.id,
        token: invitation.token,
        status: invitation.status,
        expires_at: invitation.expires_at,
        interview_duration_minutes: invitation.interview_duration_minutes,
      },
      job: {
        id: invitation.jobs?.id,
        title: invitation.jobs?.title,
        department: invitation.jobs?.department,
        seniority: invitation.jobs?.seniority,
      },
      organization: {
        id: invitation.jobs?.organizations?.id,
        name: invitation.jobs?.organizations?.name,
      },
      candidate: {
        id: invitation.candidates?.id,
        full_name: invitation.candidates?.full_name,
        email: invitation.candidates?.email,
        phone: invitation.candidates?.phone,
        experience_years: invitation.candidates?.experience_years,
        specialization: invitation.candidates?.specialization,
        recent_company: invitation.candidates?.recent_company,
        onboarding_completed: invitation.candidates?.onboarding_completed,
        onboarding_data: invitation.candidates?.onboarding_data,
      },
    }
  },

  /**
   * Public: Candidate confirms readiness and accepts invitation
   */
  async acceptInvitation(token, candidateData = {}) {
    if (!token) throw new ValidationError({ token: 'Token is required.' }, 'Token is required.')

    const supabase = getServiceSupabaseClient()

    const { data: invitation, error } = await supabase
      .from('invitations')
      .select('id, expires_at, status, candidate_id, job_id')
      .eq('token', token)
      .maybeSingle()

    if (error || !invitation) {
      throw new NotFoundError('Invitation not found.')
    }

    if (new Date(invitation.expires_at) < new Date()) {
      throw new ForbiddenError('Invitation link has expired.')
    }

    const { data: updated, error: updateError } = await supabase
      .from('invitations')
      .update({
        status: 'ACCEPTED',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Failed to accept invitation: ${updateError.message}`)
    }

    // Persist verified candidate onboarding fields into candidates table
    if (invitation.candidate_id && candidateData && typeof candidateData === 'object') {
      const candidateUpdates = {
        onboarding_completed: true,
        onboarding_data: candidateData,
      }
      if (candidateData.fullName?.trim()) candidateUpdates.full_name = candidateData.fullName.trim()
      if (candidateData.phone?.trim()) candidateUpdates.phone = candidateData.phone.trim()
      if (candidateData.experienceYears?.trim()) candidateUpdates.experience_years = candidateData.experienceYears.trim()
      if (candidateData.specialization?.trim()) candidateUpdates.specialization = candidateData.specialization.trim()
      if (candidateData.recentCompany?.trim()) candidateUpdates.recent_company = candidateData.recentCompany.trim()

      const { error: candErr } = await supabase
        .from('candidates')
        .update(candidateUpdates)
        .eq('id', invitation.candidate_id)

      if (candErr) {
        console.warn('[acceptInvitation] Candidate profile update warning:', candErr.message)
      }
    }

    return {
      success: true,
      message: 'Invitation successfully accepted and candidate details registered.',
      invitation: updated,
    }
  },

  /**
   * Delete / remove candidate from job requisition cohort safely
   */
  async deleteCandidate({ jobId, candidateId, organizationId, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    // Verify candidate belongs to the active organization
    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .select('id, full_name, email, organization_id')
      .eq('id', candidateId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (candError || !candidate) {
      throw new NotFoundError('Candidate not found or unauthorized.')
    }

    // 1. Remove or cancel non-completed invitations for this job
    await supabase
      .from('invitations')
      .delete()
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)
      .neq('status', 'COMPLETED')

    // 2. Remove non-completed interviews for this job
    await supabase
      .from('interviews')
      .delete()
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)
      .neq('status', 'COMPLETED')

    // 3. Remove application association for this job
    const { error: appDeleteErr } = await supabase
      .from('applications')
      .delete()
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)

    if (appDeleteErr) {
      console.error('[deleteCandidate] Application delete error:', appDeleteErr.message)
      throw new Error(`Failed to remove candidate application: ${appDeleteErr.message}`)
    }

    // 4. Check if candidate has applications in other jobs of this organization
    const { data: otherApps } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', candidateId)

    if (!otherApps || otherApps.length === 0) {
      // Mark candidate soft-deleted so historical interview records are preserved
      await supabase
        .from('candidates')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', candidateId)
    }

    return {
      success: true,
      id: candidateId,
      message: `Candidate ${candidate.full_name} successfully removed from requisition.`,
    }
  },
}

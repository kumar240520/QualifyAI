import { getServiceSupabaseClient } from '../../integrations/supabaseClient.js'
import { randomUUID } from 'node:crypto'

const EVENT_TYPES = new Set([
  'FOCUS_LOSS', 'TAB_SWITCH', 'VISIBILITY_CHANGE', 'ACOUSTIC_ANOMALY',
  'FULLSCREEN_EXIT', 'CLIPBOARD_ATTEMPT', 'RIGHT_CLICK', 'SCREENSHOT_ATTEMPT', 'DEVTOOLS_ATTEMPT',
  'FACE_ABSENT', 'MULTIPLE_FACES', 'CAMERA_LOST', 'FACE_ORIENTATION',
])

/**
 * Enterprise Assessment Integrity & Telemetry Engine
 * Privacy-preserving integrity analysis: monitors window focus, tab transitions,
 * and ambient acoustic anomalies without intrusive facial or emotional surveillance.
 */
export const proctoringEngineService = {
  /**
   * Ingest a batch of proctoring telemetry events from candidate assessment room
   */
  async recordEvents({ interviewId, token, events }) {
    if (!interviewId) {
      throw new Error('Interview ID is required.')
    }
    if (!Array.isArray(events) || events.length === 0) {
      return { insertedCount: 0, warningCount: 0, terminated: false }
    }
    if (!token || token.length > 512) {
      const err = new Error('A valid interview invitation token is required.')
      err.status = 401
      throw err
    }
    if (events.length > 50) {
      const err = new Error('A proctoring batch cannot exceed 50 events.')
      err.status = 400
      throw err
    }

    const supabase = getServiceSupabaseClient()
    const outcomes = []
    for (const evt of events) {
      const eventType = String(evt?.event_type || '')
      if (!EVENT_TYPES.has(eventType)) {
        const err = new Error(`Unsupported proctoring event type: ${eventType || '(missing)'}`)
        err.status = 400
        throw err
      }
      const severity = ['LOW', 'MEDIUM', 'HIGH'].includes(evt.severity) ? evt.severity : 'LOW'
      const metadata = typeof evt.metadata === 'object' && evt.metadata !== null ? evt.metadata : {}
      const { data, error } = await supabase.rpc('record_proctoring_event', {
        p_interview_id: interviewId,
        p_invitation_token: token,
        p_event_id: evt.event_id || randomUUID(),
        p_event_type: eventType,
        p_severity: severity,
        p_metadata: metadata,
        p_timestamp_ms: Number(evt.timestamp_ms) || Date.now(),
        p_is_warning: evt.is_warning !== false,
      })
      if (error) {
        if (error.code === '42501') {
          const err = new Error('The invitation is not authorized for this active interview.')
          err.status = 403
          throw err
        }
        console.error('[ProctoringEngine.recordEvents] Atomic event write failed:', error.message)
        throw new Error('Unable to persist proctoring event. Apply the serverless proctoring migration before enabling production interviews.')
      }
      outcomes.push({ ...data, eventType, metadata, severity, isWarning: evt.is_warning !== false })
    }

    const warnings = outcomes.filter((item) => item.isWarning && item.warningCount !== undefined && !item.duplicate)
    const lastOutcome = outcomes[outcomes.length - 1]
    const summary = await this.calculateIntegritySummary(interviewId)

    return {
      insertedCount: outcomes.filter((item) => !item.duplicate).length,
      warningCount: lastOutcome?.warningCount ?? null,
      terminated: outcomes.some((item) => item.terminated),
      warnings: warnings.map((item) => ({
        count: item.warningCount,
        type: item.eventType,
        reason: item.metadata?.reason || `Proctoring event: ${item.eventType}`,
        severity: item.severity,
        eventId: item.eventId,
      })),
      summary,
    }
  },

  /**
   * Synthesize derived integrity risk score, camera metrics, and trust level from telemetry trail
   */
  async calculateIntegritySummary(interviewId) {
    const supabase = getServiceSupabaseClient()

    // 1. Fetch all raw proctoring events for this interview
    const { data: events, error: evErr } = await supabase
      .from('proctoring_events')
      .select('*')
      .eq('interview_id', interviewId)
      .order('timestamp_ms', { ascending: true })

    if (evErr) {
      console.error('[ProctoringEngine.calculateSummary] Fetch error:', evErr.message)
      throw new Error(`Failed to fetch proctoring events: ${evErr.message}`)
    }

    const { data: interview } = await supabase
      .from('interviews')
      .select('status, warning_count')
      .eq('id', interviewId)
      .maybeSingle()

    const { data: session } = await supabase
      .from('interview_sessions')
      .select('session_metadata')
      .eq('interview_id', interviewId)
      .maybeSingle()

    const eventList = events || []
    const totalAnomalies = eventList.length

    // Categorized counters across all security dimensions
    let focusLossCount = 0
    let tabSwitchCount = 0
    let visibilityChangeCount = 0
    let acousticAnomalyCount = 0
    let faceAbsentCount = 0
    let multipleFacesCount = 0
    let cameraLostCount = 0
    let fullscreenExitCount = 0
    let devtoolsCount = 0
    let screenshotCount = 0
    let clipboardCount = 0
    let totalPenalty = 0

    eventList.forEach((evt) => {
      const severityMultiplier = evt.severity === 'HIGH' ? 2.5 : evt.severity === 'MEDIUM' ? 1.5 : 1.0

      switch (evt.event_type) {
        case 'FACE_ABSENT':
          faceAbsentCount++
          totalPenalty += 20.0 * severityMultiplier
          break
        case 'MULTIPLE_FACES':
          multipleFacesCount++
          totalPenalty += 25.0 * severityMultiplier
          break
        case 'CAMERA_LOST':
          cameraLostCount++
          totalPenalty += 20.0 * severityMultiplier
          break
        case 'FULLSCREEN_EXIT':
          fullscreenExitCount++
          totalPenalty += 18.0 * severityMultiplier
          break
        case 'TAB_SWITCH':
          tabSwitchCount++
          totalPenalty += 15.0 * severityMultiplier
          break
        case 'FOCUS_LOSS':
          focusLossCount++
          totalPenalty += 8.0 * severityMultiplier
          break
        case 'VISIBILITY_CHANGE':
          visibilityChangeCount++
          totalPenalty += 3.0 * severityMultiplier
          break
        case 'ACOUSTIC_ANOMALY':
          acousticAnomalyCount++
          totalPenalty += 6.0 * severityMultiplier
          break
        case 'DEVTOOLS_ATTEMPT':
        case 'SCREENSHOT_ATTEMPT':
          devtoolsCount++
          screenshotCount++
          totalPenalty += 25.0 * severityMultiplier
          break
        case 'CLIPBOARD_ATTEMPT':
          clipboardCount++
          totalPenalty += 10.0 * severityMultiplier
          break
        default:
          totalPenalty += 5.0 * severityMultiplier
      }
    })

    const sessionMeta = session?.session_metadata || {}
    const warningCount = Math.max(
      Number(interview?.warning_count) || 0,
      eventList.filter((e) => e.metadata?.is_warning || e.is_warning !== false).length
    )
    const isTerminated =
      warningCount >= 3 ||
      Boolean(sessionMeta.terminated_for_violations) ||
      interview?.status === 'TERMINATED' ||
      eventList.some((e) => e.metadata?.terminated || e.metadata?.is_terminal)

    // Calculate Camera Score (Visual Integrity Presence rate 0-100%)
    let cameraScore = 100
    if (faceAbsentCount > 0 || multipleFacesCount > 0 || cameraLostCount > 0) {
      cameraScore = Math.max(0, Math.round(100 - (faceAbsentCount * 20 + multipleFacesCount * 25 + cameraLostCount * 30)))
    }

    // Determine termination reason
    let terminationReason = sessionMeta.termination_reason || null
    if (isTerminated && !terminationReason) {
      if (faceAbsentCount >= 2) {
        terminationReason = 'Assessment automatically terminated: Exceeded 3-warning security limit due to repeated camera face absences.'
      } else if (tabSwitchCount >= 2) {
        terminationReason = 'Assessment automatically terminated: Exceeded 3-warning security limit due to repeated unauthorized window/tab switching.'
      } else if (fullscreenExitCount >= 2) {
        terminationReason = 'Assessment automatically terminated: Exceeded 3-warning security limit due to unauthorized fullscreen exits.'
      } else {
        terminationReason = 'Assessment automatically terminated: Exceeded 3-warning security limit due to sustained integrity violations.'
      }
    }

    // Risk Score: 0 (Flawless integrity) to 100 (Extremely suspicious)
    let riskScore = Math.min(100, Math.round(totalPenalty * 10) / 10)
    if (isTerminated) {
      riskScore = Math.max(88, riskScore)
    }

    // Trust Level determination: terminated assessments must NEVER be labeled 'HIGH' (High Trust Verified)!
    let trustLevel = 'HIGH'
    if (isTerminated || riskScore >= 50 || tabSwitchCount >= 3 || faceAbsentCount >= 3) {
      trustLevel = 'SUSPICIOUS' // Elevated Risk Flagged / Security Violation
    } else if (riskScore >= 20 || tabSwitchCount >= 1 || faceAbsentCount >= 1 || focusLossCount >= 3) {
      trustLevel = 'MODERATE' // Moderate Risk Review
    }

    const incidentTimeline = eventList.map((e, idx) => {
      const ts = Number(e.timestamp_ms) || (e.created_at ? new Date(e.created_at).getTime() : Date.now())
      const formattedTime = new Date(ts).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      let title = 'Security Warning'
      if (e.event_type === 'FACE_ABSENT') title = 'No Face Detected'
      else if (e.event_type === 'MULTIPLE_FACES') title = 'Multiple Faces in Frame'
      else if (e.event_type === 'CAMERA_LOST') title = 'Camera Signal Lost'
      else if (e.event_type === 'TAB_SWITCH') title = 'Tab / Window Switch'
      else if (e.event_type === 'FOCUS_LOSS') title = 'Window Focus Lost'
      else if (e.event_type === 'FULLSCREEN_EXIT') title = 'Fullscreen Mode Exited'
      else if (e.event_type === 'ACOUSTIC_ANOMALY') title = 'Audio Anomaly'

      return {
        id: e.id || e.event_id || `evt-${idx}`,
        warningNumber: idx + 1,
        type: e.event_type,
        title,
        severity: e.severity || 'MEDIUM',
        reason: e.metadata?.reason || `Integrity violation: ${title.toLowerCase()}`,
        metadata: e.metadata || {},
        timestamp_ms: ts,
        formatted_time: formattedTime,
      }
    })

    const flagsSummary = {
      focus_loss_count: focusLossCount,
      tab_switch_count: tabSwitchCount,
      visibility_change_count: visibilityChangeCount,
      acoustic_anomaly_count: acousticAnomalyCount,
      face_absent_count: faceAbsentCount,
      multiple_faces_count: multipleFacesCount,
      camera_lost_count: cameraLostCount,
      fullscreen_exit_count: fullscreenExitCount,
      devtools_count: devtoolsCount,
      screenshot_count: screenshotCount,
      clipboard_count: clipboardCount,
      security_warnings_count: warningCount,
      max_warnings: 3,
      is_terminated: isTerminated,
      termination_reason: terminationReason,
      camera_score: cameraScore,
      last_event_timestamp: eventList.length > 0 ? eventList[eventList.length - 1].timestamp_ms : null,
      incident_timeline: incidentTimeline,
    }

    // Upsert into proctoring_summaries
    const { data: existingSummary } = await supabase
      .from('proctoring_summaries')
      .select('id')
      .eq('interview_id', interviewId)
      .maybeSingle()

    let summaryRecord

    if (existingSummary?.id) {
      const { data: updated, error: upErr } = await supabase
        .from('proctoring_summaries')
        .update({
          risk_score: riskScore,
          trust_level: trustLevel,
          total_anomalies: totalAnomalies,
          flags_summary: flagsSummary,
        })
        .eq('id', existingSummary.id)
        .select()
        .single()

      if (upErr) throw upErr
      summaryRecord = updated
    } else {
      const { data: created, error: crErr } = await supabase
        .from('proctoring_summaries')
        .insert({
          interview_id: interviewId,
          risk_score: riskScore,
          trust_level: trustLevel,
          total_anomalies: totalAnomalies,
          flags_summary: flagsSummary,
        })
        .select()
        .single()

      if (crErr) throw crErr
      summaryRecord = created
    }

    return {
      interview_id: interviewId,
      risk_score: Number(summaryRecord.risk_score),
      trust_level: summaryRecord.trust_level,
      total_anomalies: summaryRecord.total_anomalies,
      flags_summary: summaryRecord.flags_summary,
      created_at: summaryRecord.created_at,
    }
  },

  /**
   * Retrieve full proctoring summary & event telemetry trail
   */
  async getProctoringSummary(interviewId, organizationId = null) {
    const supabase = getServiceSupabaseClient()

    if (organizationId) {
      const { data: interview } = await supabase
        .from('interviews')
        .select('organization_id')
        .eq('id', interviewId)
        .maybeSingle()

      if (interview && interview.organization_id !== organizationId) {
        const err = new Error('Forbidden: Unauthorized access to proctoring telemetry outside your organization.')
        err.status = 403
        throw err
      }
    }

    // Always recompute or synchronize with the latest raw events so termination and new warnings are immediately reflected
    return this.calculateIntegritySummary(interviewId)
  },
}

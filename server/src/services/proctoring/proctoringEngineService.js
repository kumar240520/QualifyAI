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
   * Synthesize derived integrity risk score and trust level from telemetry trail
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

    const eventList = events || []
    const totalAnomalies = eventList.length

    // Categorized counters
    let focusLossCount = 0
    let tabSwitchCount = 0
    let visibilityChangeCount = 0
    let acousticAnomalyCount = 0
    let totalPenalty = 0

    eventList.forEach((evt) => {
      const severityMultiplier = evt.severity === 'HIGH' ? 2.5 : evt.severity === 'MEDIUM' ? 1.5 : 1.0

      switch (evt.event_type) {
        case 'FOCUS_LOSS':
          focusLossCount++
          totalPenalty += 3.0 * severityMultiplier
          break
        case 'TAB_SWITCH':
          tabSwitchCount++
          totalPenalty += 6.0 * severityMultiplier
          break
        case 'VISIBILITY_CHANGE':
          visibilityChangeCount++
          totalPenalty += 4.0 * severityMultiplier
          break
        case 'ACOUSTIC_ANOMALY':
          acousticAnomalyCount++
          totalPenalty += 5.0 * severityMultiplier
          break
        default:
          totalPenalty += 2.0 * severityMultiplier
      }
    })

    // Risk Score: 0 (Flawless integrity) to 100 (Extremely suspicious)
    const riskScore = Math.min(100, Math.round(totalPenalty * 10) / 10)

    // Trust Level determination
    let trustLevel = 'HIGH'
    if (riskScore >= 50 || tabSwitchCount >= 4) {
      trustLevel = 'SUSPICIOUS'
    } else if (riskScore >= 20 || tabSwitchCount >= 2 || focusLossCount >= 4) {
      trustLevel = 'MODERATE'
    }

    const flagsSummary = {
      focus_loss_count: focusLossCount,
      tab_switch_count: tabSwitchCount,
      visibility_change_count: visibilityChangeCount,
      acoustic_anomaly_count: acousticAnomalyCount,
      last_event_timestamp: eventList.length > 0 ? eventList[eventList.length - 1].timestamp_ms : null,
      incident_timeline: eventList.slice(-15).map((e) => ({
        id: e.id,
        type: e.event_type,
        severity: e.severity,
        metadata: e.metadata,
        timestamp_ms: e.timestamp_ms,
      })),
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

    // 1. Fetch summary record
    const { data: summary } = await supabase
      .from('proctoring_summaries')
      .select('*')
      .eq('interview_id', interviewId)
      .maybeSingle()

    // 2. If no summary yet exists, calculate default
    if (!summary) {
      return this.calculateIntegritySummary(interviewId)
    }

    return {
      interview_id: summary.interview_id,
      risk_score: Number(summary.risk_score),
      trust_level: summary.trust_level,
      total_anomalies: summary.total_anomalies,
      flags_summary: summary.flags_summary,
      created_at: summary.created_at,
    }
  },
}

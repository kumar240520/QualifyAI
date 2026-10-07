import { getServiceSupabaseClient } from '../../integrations/supabaseClient.js'

/**
 * Enterprise Assessment Integrity & Telemetry Engine
 * Privacy-preserving integrity analysis: monitors window focus, tab transitions,
 * and ambient acoustic anomalies without intrusive facial or emotional surveillance.
 */
export const proctoringEngineService = {
  /**
   * Ingest a batch of proctoring telemetry events from candidate assessment room
   */
  async recordEvents({ interviewId, events }) {
    if (!interviewId) {
      throw new Error('Interview ID is required.')
    }
    if (!Array.isArray(events) || events.length === 0) {
      return { insertedCount: 0 }
    }

    const supabase = getServiceSupabaseClient()

    // 1. Verify interview exists
    const { data: interview, error: intErr } = await supabase
      .from('interviews')
      .select('id, status')
      .eq('id', interviewId)
      .single()

    if (intErr || !interview) {
      const err = new Error('Interview not found.')
      err.status = 404
      throw err
    }

    // 2. Format event records
    const validEventTypes = ['FOCUS_LOSS', 'TAB_SWITCH', 'VISIBILITY_CHANGE', 'ACOUSTIC_ANOMALY']
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH']

    const recordsToInsert = events.map((evt) => {
      const eventType = validEventTypes.includes(evt.event_type) ? evt.event_type : 'FOCUS_LOSS'
      const severity = validSeverities.includes(evt.severity) ? evt.severity : 'LOW'
      const timestampMs = Number(evt.timestamp_ms) || Date.now()

      return {
        interview_id: interviewId,
        event_type: eventType,
        severity,
        metadata: typeof evt.metadata === 'object' && evt.metadata !== null ? evt.metadata : {},
        timestamp_ms: timestampMs,
      }
    })

    // 3. Batch insert into proctoring_events
    const { error: insErr } = await supabase.from('proctoring_events').insert(recordsToInsert)

    if (insErr) {
      console.error('[ProctoringEngine.recordEvents] Insert error:', insErr.message)
      throw new Error(`Failed to record proctoring events: ${insErr.message}`)
    }

    // 4. Update synthesized proctoring summary in background
    const summary = await this.calculateIntegritySummary(interviewId)

    return {
      insertedCount: recordsToInsert.length,
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

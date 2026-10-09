/**
 * Client Service for Candidate Diagnostic Experience (Phase 11)
 * Decoupled from internal recruiter hiring decisions and proctoring telemetry.
 */

const API_BASE = '/api'

export const diagnosticService = {
  /**
   * Fetch candidate diagnostic report by invitation token
   */
  async getDiagnosticByToken(token, refresh = false) {
    const query = refresh ? '?refresh=true' : ''
    const res = await fetch(`${API_BASE}/interviews/token/${token}/diagnostic${query}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to retrieve candidate diagnostic report.')
    }
    return data.data
  },

  /**
   * Fetch candidate diagnostic report by interview ID
   */
  async getDiagnosticByInterviewId(interviewId, authToken = null, refresh = false) {
    const headers = { 'Content-Type': 'application/json' }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const query = refresh ? '?refresh=true' : ''
    const res = await fetch(`${API_BASE}/interviews/${interviewId}/diagnostic${query}`, {
      method: 'GET',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to retrieve candidate diagnostic report.')
    }
    return data.data
  },

  /**
   * Explicitly trigger candidate diagnostic synthesis
   */
  async generateDiagnostic(interviewId, authToken = null) {
    const headers = { 'Content-Type': 'application/json' }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const res = await fetch(`${API_BASE}/interviews/${interviewId}/diagnostic/generate`, {
      method: 'POST',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to synthesize candidate diagnostic report.')
    }
    return data.data
  },
}

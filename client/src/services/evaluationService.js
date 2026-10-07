import { supabase } from '../lib/supabase.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

async function getAuthHeaders() {
  let token = localStorage.getItem('qualifyai_token')
  if (!token) {
    try {
      const stored = localStorage.getItem('qualifyai_auth_session')
      if (stored) {
        token = JSON.parse(stored)?.token
      }
    } catch (e) {}
  }

  if (!token) {
    try {
      const { data } = await supabase.auth.getSession()
      token = data?.session?.access_token
    } catch (e) {}
  }

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const evaluationService = {
  /**
   * Fetch evaluation scorecard, criteria breakdowns, and communication metrics
   */
  async getEvaluation(interviewId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/interviews/${interviewId}/evaluation`, {
      method: 'GET',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch interview evaluation.')
    }
    return data.data
  },

  /**
   * Trigger AI post-interview evaluation grounded in rubric & dialogue transcript
   */
  async triggerEvaluation(interviewId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/interviews/${interviewId}/evaluate`, {
      method: 'POST',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to trigger interview evaluation.')
    }
    return data.data
  },
}

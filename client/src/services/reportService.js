import { supabase } from '../lib/supabase.js'
import { API_BASE_URL } from './apiConfig.js'

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

export const reportService = {
  /**
   * Fetch ranked cohort leaderboard and requisition-level analytics
   */
  async getCohortAnalytics(jobId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/analytics/cohort`, {
      method: 'GET',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch cohort analytics.')
    }
    return data.data
  },

  /**
   * Fetch executive recruiter report for an interview
   */
  async getExecutiveReport(interviewId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/interviews/${interviewId}/report`, {
      method: 'GET',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch executive report.')
    }
    return data.data
  },

  /**
   * Trigger synthesis of executive report
   */
  async generateExecutiveReport(interviewId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/interviews/${interviewId}/report/generate`, {
      method: 'POST',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to generate executive report.')
    }
    return data.data
  },
}

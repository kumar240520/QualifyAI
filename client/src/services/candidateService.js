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

export const candidateService = {
  /**
   * Fetch candidates and their application/invitation status for a job
   */
  async listCandidates(jobId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/candidates`, {
      method: 'GET',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch candidate cohort.')
    }
    return data.data || []
  },

  /**
   * Add a new candidate and assign to a job
   */
  async addCandidate(jobId, candidateData) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/candidates`, {
      method: 'POST',
      headers,
      body: JSON.stringify(candidateData),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to register candidate.')
    }
    return data.data
  },

  /**
   * Generate a secure, tokenized invitation link for a candidate
   */
  async createInvitation(jobId, candidateId, expiresInDays = 7, interviewDurationMinutes = 30) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/invitations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ candidateId, expiresInDays, interviewDurationMinutes }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to generate invitation link.')
    }
    return data.data
  },

  /**
   * Public: verify invitation token and retrieve role & candidate context
   */
  async getInvitationByToken(token) {
    const res = await fetch(`${API_BASE_URL}/invitations/${token}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Invalid or expired invitation token.')
    }
    return data.data
  },

  /**
   * Public: candidate accepts the invitation
   */
  async acceptInvitation(token, candidateData = {}) {
    const res = await fetch(`${API_BASE_URL}/invitations/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateData }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to accept invitation.')
    }
    return data.data
  },
}

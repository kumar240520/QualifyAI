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

function parseServiceError(data, res, fallbackMessage) {
  const errObj = data?.error
  const message =
    typeof errObj === 'string'
      ? errObj
      : errObj?.message || fallbackMessage || `Request failed (${res?.status || 500})`
  const error = new Error(message)
  if (errObj && typeof errObj === 'object') {
    error.code = errObj.code
    error.field = errObj.field
    error.fields = errObj.fields || (errObj.field ? { [errObj.field]: message } : {})
    error.requestId = errObj.requestId
  }
  error.status = res?.status
  error.data = data
  return error
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
      throw parseServiceError(data, res, 'Failed to fetch candidate cohort.')
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
      throw parseServiceError(data, res, 'Failed to register candidate.')
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
      throw parseServiceError(data, res, 'Failed to generate invitation link.')
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
      throw parseServiceError(data, res, 'Invalid or expired invitation token.')
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
      throw parseServiceError(data, res, 'Failed to accept invitation.')
    }
    return data.data
  },

  /**
   * Delete / remove candidate from job requisition (Requirement 4)
   */
  async deleteCandidate(jobId, candidateId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/candidates/${candidateId}`, {
      method: 'DELETE',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw parseServiceError(data, res, 'Failed to delete candidate.')
    }
    return data.data || data
  },
}

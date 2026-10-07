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

export const jobService = {
  /**
   * Fetch all jobs for the recruiter's active organization
   */
  async listJobs() {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs`, {
      method: 'GET',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch job requisitions.')
    }
    return data.data || []
  },

  /**
   * Fetch a single job by ID with its structured requirements
   */
  async getJob(id) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${id}`, {
      method: 'GET',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch job details.')
    }
    return data.data
  },

  /**
   * Create a new job requisition
   */
  async createJob({ title, description, department = 'Engineering', seniority = 'SENIOR' }) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, description, department, seniority }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create job requisition.')
    }
    return data.data
  },

  /**
   * Trigger AI parsing of raw JD text using Gemini Orchestrator
   */
  async parseJobDescription(jobId, descriptionText) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/parse-jd`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ description: descriptionText }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to parse job description with AI.')
    }
    return data.data
  },

  /**
   * Update / customize extracted job requirements
   */
  async updateRequirements(jobId, requirements) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/requirements`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(requirements),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update job requirements.')
    }
    return data.data
  },
}

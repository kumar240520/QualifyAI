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

function extractErrorMessage(data, fallback) {
  if (!data) return fallback
  if (typeof data.error === 'string') return data.error
  if (data.error && typeof data.error.message === 'string') return data.error.message
  if (typeof data.message === 'string') return data.message
  return fallback
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
      throw new Error(extractErrorMessage(data, 'Failed to fetch job requisitions.'))
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
      throw new Error(extractErrorMessage(data, 'Failed to fetch job details.'))
    }
    return data.data
  },

  /**
   * Create a new job requisition with background, question types, projects toggle, and difficulty
   */
  async createJob(payload) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(extractErrorMessage(data, 'Failed to create job requisition.'))
    }
    return data.data
  },

  /**
   * Update an existing job requisition
   */
  async updateJob(id, payload) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(extractErrorMessage(data, 'Failed to update job requisition.'))
    }
    return data.data
  },

  /**
   * Delete / archive a job requisition (Requirement 3)
   */
  async deleteJob(id) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${id}`, {
      method: 'DELETE',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(extractErrorMessage(data, 'Failed to delete job requisition.'))
    }
    return data.data || data
  },

  /**
   * Update opening question for a job requisition (Requirement 8)
   */
  async updateOpeningQuestion(id, openingQuestion) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${id}/opening-question`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ opening_question: openingQuestion }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(extractErrorMessage(data, 'Failed to update opening question.'))
    }
    return data.data
  },

  /**
   * Update target difficulty for a job requisition (Requirement 9)
   */
  async updateDifficulty(id, difficulty) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${id}/difficulty`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ target_difficulty: difficulty }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(extractErrorMessage(data, 'Failed to update target difficulty.'))
    }
    return data.data
  },

  /**
   * Update a specific question in the pool
   */
  async updateQuestion(jobId, questionId, questionData) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/questions/${questionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(questionData),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(extractErrorMessage(data, 'Failed to update question.'))
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
      throw new Error(extractErrorMessage(data, 'Failed to parse job description with AI.'))
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
      throw new Error(extractErrorMessage(data, 'Failed to update job requirements.'))
    }
    return data.data
  },
}

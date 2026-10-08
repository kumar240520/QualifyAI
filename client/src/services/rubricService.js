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

export const rubricService = {
  /**
   * Fetch rubric and criteria for a specific job
   */
  async getRubric(jobId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/rubric`, {
      method: 'GET',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch rubric.')
    }
    return data.data
  },

  /**
   * AI-synthesize a dynamic 5-pillar rubric grounded in job requirements
   */
  async generateRubric(jobId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/rubric/generate`, {
      method: 'POST',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to generate rubric with AI.')
    }
    return data.data
  },

  /**
   * Update rubric criteria weights and benchmarks
   */
  async updateRubric(jobId, criteria) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/rubric`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ criteria }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update rubric.')
    }
    return data.data
  },

  /**
   * Fetch question pool for a specific job
   */
  async getQuestions(jobId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/questions`, {
      method: 'GET',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch questions.')
    }
    return data.data || []
  },

  /**
   * AI-synthesize targeted interview questions mapped to rubric criteria
   */
  async generateQuestions(jobId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/questions/generate`, {
      method: 'POST',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to generate questions with AI.')
    }
    return data.data || []
  },

  /**
   * Create a custom question
   */
  async createQuestion(jobId, questionData) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/questions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(questionData),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create question.')
    }
    return data.data
  },

  /**
   * Delete a question
   */
  async deleteQuestion(jobId, questionId) {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/questions/${questionId}`, {
      method: 'DELETE',
      headers,
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete question.')
    }
    return data.data
  },
}

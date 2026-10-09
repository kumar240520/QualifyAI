import { API_BASE_URL } from './apiConfig.js'

export const interviewService = {
  /**
   * Start or resume an interview using the candidate's invitation token
   */
  async startInterview(token) {
    const res = await fetch(`${API_BASE_URL}/interviews/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to start interview session.')
    }
    return data.data
  },

  /**
   * Submit candidate's answer for the current question
   */
  async submitAnswer(interviewId, token, answerText, questionSequence, questionId, inputMethod = 'VOICE', structuredAnswer = null) {
    const res = await fetch(`${API_BASE_URL}/interviews/${interviewId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, answerText, questionSequence, questionId, inputMethod, structuredAnswer }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to submit answer.')
    }
    return data.data
  },

  async advanceAfterSilence(interviewId, token) {
    const res = await fetch(`${API_BASE_URL}/interviews/${interviewId}/silence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to continue interview.')
    return data.data
  },

  async startWrapUp(interviewId, token) {
    const res = await fetch(`${API_BASE_URL}/interviews/${interviewId}/wrap-up`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to start interview wrap-up.')
    return data.data
  },

  /**
   * Retrieve current interview state and transcript
   */
  async getInterviewState(interviewId, token) {
    const res = await fetch(`${API_BASE_URL}/interviews/${interviewId}?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to retrieve interview state.')
    }
    return data.data
  },

  /**
   * Candidate explicitly completes or wraps up interview
   */
  async completeInterview(interviewId, token, feedback = '', feedbackRating = null, terminationMetadata = null) {
    const res = await fetch(`${API_BASE_URL}/interviews/${interviewId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, feedback, feedbackRating, terminationMetadata }),
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to complete interview.')
    }
    return data.data
  },
}

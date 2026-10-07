import { interviewEngineService } from '../services/interview/interviewEngineService.js'

/**
 * Controller for Candidate Interview Sessions and Live Dialogue Turns
 */
export const interviewController = {
  /**
   * POST /api/interviews/start
   */
  async startInterview(req, res, next) {
    try {
      const { token } = req.body
      if (!token) {
        return res.status(400).json({ success: false, error: 'Invitation token is required.' })
      }

      const result = await interviewEngineService.startOrResumeSession({ token })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      return res.status(err.status || 400).json({
        success: false,
        error: err.message || 'Failed to start interview session.',
      })
    }
  },

  /**
   * POST /api/interviews/:id/answer
   */
  async submitAnswer(req, res, next) {
    try {
      const interviewId = req.params.id
      const { token, answerText, questionSequence, questionId, inputMethod } = req.body

      if (!token || !answerText) {
        return res
          .status(400)
          .json({ success: false, error: 'Token and candidate answerText are required.' })
      }

      const result = await interviewEngineService.processCandidateTurn({
        interviewId,
        token,
        answerText,
        questionSequence: typeof questionSequence === 'number' ? questionSequence : undefined,
        questionId,
        inputMethod,
      })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      return res.status(err.status || 400).json({
        success: false,
        error: err.message || 'Failed to evaluate candidate response.',
      })
    }
  },

  async advanceAfterSilence(req, res) {
    try {
      const { token, feedback, feedbackRating } = req.body
      if (!token) return res.status(400).json({ success: false, error: 'Token is required.' })
      const result = await interviewEngineService.advanceAfterSilence({ interviewId: req.params.id, token })
      return res.status(200).json({ success: true, data: result })
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, error: err.message || 'Unable to continue the interview.' })
    }
  },

  async startWrapUp(req, res) {
    try {
      const { token } = req.body
      if (!token) return res.status(400).json({ success: false, error: 'Token is required.' })
      const result = await interviewEngineService.startWrapUp({ interviewId: req.params.id, token })
      return res.status(200).json({ success: true, data: result })
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, error: err.message || 'Unable to start interview wrap-up.' })
    }
  },

  /**
   * GET /api/interviews/:id
   */
  async getInterviewState(req, res, next) {
    try {
      const interviewId = req.params.id
      const token = req.query.token

      if (!token) {
        return res.status(400).json({ success: false, error: 'Token is required.' })
      }

      const result = await interviewEngineService.getInterviewState({ interviewId, token })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      return res.status(err.status || 400).json({
        success: false,
        error: err.message || 'Failed to retrieve interview state.',
      })
    }
  },

  /**
   * POST /api/interviews/:id/complete
   */
  async completeInterview(req, res, next) {
    try {
      const interviewId = req.params.id
      const { token, feedback, feedbackRating } = req.body

      if (!token) {
        return res.status(400).json({ success: false, error: 'Token is required.' })
      }

      const result = await interviewEngineService.completeInterview({ interviewId, token, feedback, feedbackRating })

      return res.status(200).json({
        success: true,
        message: 'Interview successfully finalized.',
        data: result,
      })
    } catch (err) {
      return res.status(err.status || 400).json({
        success: false,
        error: err.message || 'Failed to complete interview.',
      })
    }
  },
}

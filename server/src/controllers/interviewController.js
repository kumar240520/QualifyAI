import { interviewEngineService } from '../services/interview/interviewEngineService.js'
import { assertValid, validateAnswerSubmissionPayload, validateText } from '../validators/index.js'

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
      assertValid(validateText(token, 'Invitation token', { min: 8, max: 255, required: true }))

      const result = await interviewEngineService.startOrResumeSession({ token })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /api/interviews/:id/answer
   */
  async submitAnswer(req, res, next) {
    try {
      const interviewId = req.params.id
      const validated = assertValid(validateAnswerSubmissionPayload(req.body))

      const result = await interviewEngineService.processCandidateTurn({
        interviewId,
        token: validated.token,
        answerText: validated.answerText,
        questionSequence: validated.questionSequence,
        questionId: validated.questionId,
        inputMethod: validated.inputMethod,
      })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },

  async advanceAfterSilence(req, res, next) {
    try {
      const { token } = req.body
      assertValid(validateText(token, 'Invitation token', { min: 8, max: 255, required: true }))

      const result = await interviewEngineService.advanceAfterSilence({
        interviewId: req.params.id,
        token,
      })

      return res.status(200).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  },

  async startWrapUp(req, res, next) {
    try {
      const { token } = req.body
      assertValid(validateText(token, 'Invitation token', { min: 8, max: 255, required: true }))

      const result = await interviewEngineService.startWrapUp({
        interviewId: req.params.id,
        token,
      })

      return res.status(200).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /api/interviews/:id
   */
  async getInterviewState(req, res, next) {
    try {
      const interviewId = req.params.id
      const token = req.query.token
      assertValid(validateText(token, 'Invitation token', { min: 8, max: 255, required: true }))

      const result = await interviewEngineService.getInterviewState({ interviewId, token })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /api/interviews/:id/complete
   */
  async completeInterview(req, res, next) {
    try {
      const interviewId = req.params.id
      const { token, feedback, feedbackRating, terminationMetadata } = req.body
      assertValid(validateText(token, 'Invitation token', { min: 8, max: 255, required: true }))

      const result = await interviewEngineService.completeInterview({
        interviewId,
        token,
        feedback,
        feedbackRating,
        terminationMetadata,
      })

      return res.status(200).json({
        success: true,
        message: 'Interview successfully finalized.',
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },
}

import { evaluationEngineService } from '../services/evaluation/evaluationEngineService.js'

/**
 * Controller for Candidate Evaluation & Scoring
 */
export const evaluationController = {
  /**
   * POST /api/interviews/:id/evaluate
   * Trigger post-interview AI evaluation grounded in rubric and transcripts
   */
  async triggerEvaluation(req, res) {
    try {
      const interviewId = req.params.id
      const organizationId = req.organizationId || req.tenant?.organizationId || req.user?.organizationId

      const result = await evaluationEngineService.generateEvaluation({
        interviewId,
        organizationId,
      })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      console.error('[EvaluationController.triggerEvaluation]', err)
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Failed to generate interview evaluation.',
      })
    }
  },

  /**
   * GET /api/interviews/:id/evaluation
   * Retrieve evaluation scorecard, criteria scores, and evidence quotes
   */
  async getEvaluation(req, res) {
    try {
      const interviewId = req.params.id
      const organizationId = req.organizationId || req.tenant?.organizationId || req.user?.organizationId

      const result = await evaluationEngineService.getEvaluationByInterviewId({
        interviewId,
        organizationId,
      })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      console.error('[EvaluationController.getEvaluation]', err)
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Failed to retrieve interview evaluation.',
      })
    }
  },
}

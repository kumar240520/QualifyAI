import { rubricService } from '../services/rubricService.js'
import { assertValid, validateCreateQuestionPayload } from '../validators/index.js'
import { ValidationError } from '../utils/errors.js'

/**
 * Controller for Rubric Matrix and Question Intelligence APIs
 */
export const rubricController = {
  /**
   * GET /api/jobs/:id/rubric
   */
  async getRubric(req, res, next) {
    try {
      const jobId = req.params.id
      const organizationId = req.organizationId
      const userToken = req.token || req.accessToken

      const rubric = await rubricService.getRubricByJob({
        jobId,
        organizationId,
        userToken,
      })

      return res.status(200).json({
        success: true,
        data: rubric,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /api/jobs/:id/rubric/generate
   */
  async generateRubric(req, res, next) {
    try {
      const jobId = req.params.id
      const organizationId = req.organizationId
      const userToken = req.token || req.accessToken

      const rubric = await rubricService.generateRubric({
        jobId,
        organizationId,
        userToken,
      })

      return res.status(200).json({
        success: true,
        message: 'Rubric successfully calibrated with Google Gemini.',
        data: rubric,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * PUT /api/jobs/:id/rubric
   */
  async updateRubric(req, res, next) {
    try {
      const jobId = req.params.id
      const organizationId = req.organizationId
      const userToken = req.token || req.accessToken
      const { criteria } = req.body

      if (!criteria || (!Array.isArray(criteria) && typeof criteria !== 'object')) {
        throw new ValidationError({ criteria: 'Valid criteria array or map is required.' })
      }

      const updated = await rubricService.updateRubric({
        jobId,
        organizationId,
        criteria,
        userToken,
      })

      return res.status(200).json({
        success: true,
        message: 'Rubric weights and criteria updated.',
        data: updated,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /api/jobs/:id/questions
   */
  async getQuestions(req, res, next) {
    try {
      const jobId = req.params.id
      const organizationId = req.organizationId
      const userToken = req.token || req.accessToken

      const questions = await rubricService.getQuestionsByJob({
        jobId,
        organizationId,
        userToken,
      })

      return res.status(200).json({
        success: true,
        data: questions,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /api/jobs/:id/questions/generate
   */
  async generateQuestions(req, res, next) {
    try {
      const jobId = req.params.id
      const organizationId = req.organizationId
      const userToken = req.token || req.accessToken

      const questions = await rubricService.generateQuestions({
        jobId,
        organizationId,
        userToken,
      })

      return res.status(200).json({
        success: true,
        message: 'Question pool successfully synthesized with Google Gemini.',
        data: questions,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /api/jobs/:id/questions
   */
  async createQuestion(req, res, next) {
    try {
      const jobId = req.params.id
      const organizationId = req.organizationId
      const userToken = req.token || req.accessToken

      const validated = assertValid(validateCreateQuestionPayload(req.body))

      const question = await rubricService.createQuestion({
        jobId,
        organizationId,
        questionData: validated,
        userToken,
      })

      return res.status(201).json({
        success: true,
        message: 'Question created.',
        data: question,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * DELETE /api/jobs/:id/questions/:questionId
   */
  async deleteQuestion(req, res, next) {
    try {
      const jobId = req.params.id
      const questionId = req.params.questionId
      const organizationId = req.organizationId
      const userToken = req.token || req.accessToken

      const result = await rubricService.deleteQuestion({
        jobId,
        organizationId,
        questionId,
        userToken,
      })

      return res.status(200).json({
        success: true,
        message: 'Question removed.',
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },
}

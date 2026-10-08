import { candidateService } from '../services/candidateService.js'
import {
  assertValid,
  validateAddCandidatePayload,
  validateCreateInvitationPayload,
  validateText,
} from '../validators/index.js'
import { ForbiddenError } from '../utils/errors.js'

/**
 * Controller for Candidate Pipeline and Tokenized Invitation APIs
 */
export const candidateController = {
  /**
   * GET /api/jobs/:id/candidates
   */
  async listCandidates(req, res, next) {
    try {
      const jobId = req.params.id
      const organizationId = req.organizationId || req.tenant?.organizationId
      const userToken = req.token || req.accessToken

      if (!organizationId) {
        throw new ForbiddenError('Tenant organization context is missing.')
      }

      const candidates = await candidateService.listCandidatesByJob({
        jobId,
        organizationId,
        userToken,
      })

      return res.status(200).json({
        success: true,
        data: candidates,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /api/jobs/:id/candidates
   */
  async addCandidate(req, res, next) {
    try {
      const jobId = req.params.id
      const organizationId = req.organizationId || req.tenant?.organizationId
      const userToken = req.token || req.accessToken

      if (!organizationId) {
        throw new ForbiddenError('Tenant organization context is missing.')
      }

      const validated = assertValid(validateAddCandidatePayload(req.body))

      const candidate = await candidateService.addCandidate({
        jobId,
        organizationId,
        candidateData: validated,
        userToken,
      })

      return res.status(201).json({
        success: true,
        message: 'Candidate successfully added to cohort.',
        data: candidate,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /api/jobs/:id/invitations
   */
  async createInvitation(req, res, next) {
    try {
      const jobId = req.params.id
      const organizationId = req.organizationId || req.tenant?.organizationId
      const userToken = req.token || req.accessToken

      if (!organizationId) {
        throw new ForbiddenError('Tenant organization context is missing.')
      }

      const validated = assertValid(validateCreateInvitationPayload(req.body))

      const invitation = await candidateService.createInvitation({
        jobId,
        organizationId,
        candidateId: validated.candidateId,
        expiresInDays: validated.expiresInDays,
        interviewDurationMinutes: validated.interviewDurationMinutes,
        userToken,
      })

      return res.status(201).json({
        success: true,
        message: 'Invitation link successfully created.',
        data: invitation,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /api/invitations/:token (Public)
   */
  async getInvitationByToken(req, res, next) {
    try {
      const token = req.params.token
      assertValid(validateText(token, 'Invitation token', { min: 8, max: 255, required: true }))

      const data = await candidateService.getInvitationByToken(token)

      return res.status(200).json({
        success: true,
        data,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * POST /api/invitations/:token/accept (Public)
   */
  async acceptInvitation(req, res, next) {
    try {
      const token = req.params.token
      assertValid(validateText(token, 'Invitation token', { min: 8, max: 255, required: true }))

      const candidateData = req.body?.candidateData || req.body || {}
      const result = await candidateService.acceptInvitation(token, candidateData)

      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.invitation,
      })
    } catch (err) {
      next(err)
    }
  },
}

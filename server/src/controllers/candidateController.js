import { candidateService } from '../services/candidateService.js'

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
      const candidateData = req.body

      const candidate = await candidateService.addCandidate({
        jobId,
        organizationId,
        candidateData,
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
      const { candidateId, expiresInDays, interviewDurationMinutes } = req.body

      if (!candidateId) {
        return res.status(400).json({ success: false, error: 'candidateId is required.' })
      }

      const invitation = await candidateService.createInvitation({
        jobId,
        organizationId,
        candidateId,
        expiresInDays,
        interviewDurationMinutes,
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
      const data = await candidateService.getInvitationByToken(token)

      return res.status(200).json({
        success: true,
        data,
      })
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: err.message || 'Invitation not found or expired.',
      })
    }
  },

  /**
   * POST /api/invitations/:token/accept (Public)
   */
  async acceptInvitation(req, res, next) {
    try {
      const token = req.params.token
      const candidateData = req.body?.candidateData || req.body || {}
      const result = await candidateService.acceptInvitation(token, candidateData)

      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.invitation,
      })
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to accept invitation.',
      })
    }
  },
}

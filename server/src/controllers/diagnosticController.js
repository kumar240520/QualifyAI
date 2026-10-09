import { candidateDiagnosticService } from '../services/diagnostic/candidateDiagnosticService.js'

/**
 * Controller for Candidate-Facing Diagnostic Experience APIs (Phase 11)
 */
export const diagnosticController = {
  /**
   * GET /api/interviews/:id/diagnostic
   */
  async getDiagnosticReport(req, res) {
    try {
      const interviewId = req.params.id
      const forceRefresh = req.query.refresh === 'true'
      const report = await candidateDiagnosticService.getCandidateDiagnostic(interviewId, { forceRefresh })

      return res.status(200).json({
        success: true,
        data: report,
      })
    } catch (err) {
      console.error('[DiagnosticController.getDiagnosticReport]', err)
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Failed to retrieve diagnostic report.',
      })
    }
  },

  /**
   * GET /api/interviews/token/:token/diagnostic
   * Public tokenized access for candidates
   */
  async getDiagnosticByToken(req, res) {
    try {
      const token = req.params.token
      const forceRefresh = req.query.refresh === 'true'
      const report = await candidateDiagnosticService.getCandidateDiagnosticByToken(token, { forceRefresh })

      return res.status(200).json({
        success: true,
        data: report,
      })
    } catch (err) {
      console.error('[DiagnosticController.getDiagnosticByToken]', err)
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Failed to retrieve candidate diagnostic report.',
      })
    }
  },

  /**
   * POST /api/interviews/:id/diagnostic/generate
   */
  async generateDiagnosticReport(req, res) {
    try {
      const interviewId = req.params.id
      const report = await candidateDiagnosticService.generateCandidateDiagnostic(interviewId, { forceRefresh: true })

      return res.status(200).json({
        success: true,
        data: report,
      })
    } catch (err) {
      console.error('[DiagnosticController.generateDiagnosticReport]', err)
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Failed to synthesize candidate diagnostic report.',
      })
    }
  },
}

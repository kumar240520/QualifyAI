import { reportAnalyticsService } from '../services/reports/reportAnalyticsService.js'

/**
 * Controller for Reporting, Executive PDF Summaries & Cohort Analytics APIs
 */
export const reportController = {
  /**
   * GET /api/jobs/:id/analytics/cohort
   * Retrieve ranked candidate leaderboard & requisition analytics
   */
  async getCohortAnalytics(req, res) {
    try {
      const jobId = req.params.id
      const organizationId = req.organizationId || req.tenant?.organizationId

      const result = await reportAnalyticsService.getJobCohortAnalytics(jobId, organizationId)

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      console.error('[ReportController.getCohortAnalytics]', err)
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Failed to retrieve cohort analytics.',
      })
    }
  },

  /**
   * GET /api/interviews/:id/report
   * Retrieve executive recruiter report for interview
   */
  async getExecutiveReport(req, res) {
    try {
      const interviewId = req.params.id
      const organizationId = req.organizationId || req.tenant?.organizationId || req.user?.organizationId

      const result = await reportAnalyticsService.getExecutiveReport(interviewId, organizationId)

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      console.error('[ReportController.getExecutiveReport]', err)
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Failed to retrieve executive report.',
      })
    }
  },

  /**
   * POST /api/interviews/:id/report/generate
   * Trigger executive report synthesis
   */
  async generateReport(req, res) {
    try {
      const interviewId = req.params.id
      const organizationId = req.organizationId || req.tenant?.organizationId || req.user?.organizationId

      const result = await reportAnalyticsService.generateExecutiveReport(interviewId, organizationId)

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      console.error('[ReportController.generateReport]', err)
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Failed to generate executive report.',
      })
    }
  },
}

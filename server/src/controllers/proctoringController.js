import { proctoringEngineService } from '../services/proctoring/proctoringEngineService.js'

/**
 * Controller for Proctoring & Assessment Integrity Telemetry APIs
 */
export const proctoringController = {
  /**
   * POST /api/interviews/:id/proctoring/events
   * Batch ingest proctoring events from active candidate session
   */
  async recordEvents(req, res) {
    try {
      const interviewId = req.params.id
      const { events } = req.body

      if (!events || !Array.isArray(events)) {
        return res.status(400).json({
          success: false,
          error: 'An array of proctoring events is required.',
        })
      }

      const result = await proctoringEngineService.recordEvents({
        interviewId,
        events,
      })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      console.error('[ProctoringController.recordEvents]', err)
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Failed to record proctoring telemetry.',
      })
    }
  },

  /**
   * GET /api/interviews/:id/proctoring/summary
   * Retrieve derived integrity summary, risk score, and incident timeline
   */
  async getSummary(req, res) {
    try {
      const interviewId = req.params.id
      const organizationId = req.organizationId || req.tenant?.organizationId || req.user?.organizationId

      const result = await proctoringEngineService.getProctoringSummary(interviewId, organizationId)

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      console.error('[ProctoringController.getSummary]', err)
      return res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Failed to retrieve proctoring summary.',
      })
    }
  },
}

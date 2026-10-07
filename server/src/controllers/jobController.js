import { jobService } from '../services/jobService.js'

export const jobController = {
  /**
   * List jobs for current tenant organization
   */
  async listJobs(req, res) {
    try {
      const organizationId = req.tenant?.organizationId
      if (!organizationId) {
        return res.status(400).json({ success: false, error: 'Tenant context is missing.' })
      }

      const jobs = await jobService.listJobs({
        organizationId,
        userToken: req.token,
      })

      return res.status(200).json({ success: true, data: jobs })
    } catch (err) {
      console.error('[JobController.listJobs] Error:', err.message)
      return res.status(500).json({ success: false, error: err.message })
    }
  },

  /**
   * Get job by ID
   */
  async getJob(req, res) {
    try {
      const organizationId = req.tenant?.organizationId
      const jobId = req.params.id

      const job = await jobService.getJobById({
        jobId,
        organizationId,
        userToken: req.token,
      })

      return res.status(200).json({ success: true, data: job })
    } catch (err) {
      console.error('[JobController.getJob] Error:', err.message)
      return res.status(404).json({ success: false, error: err.message })
    }
  },

  /**
   * Create new job requisition
   */
  async createJob(req, res) {
    try {
      const organizationId = req.tenant?.organizationId
      const userId = req.user?.id
      const { title, description, department, seniority } = req.body

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          error: 'Title and description are required fields.',
        })
      }

      const job = await jobService.createJob({
        organizationId,
        userId,
        title,
        description,
        department,
        seniority,
        userToken: req.token,
      })

      return res.status(201).json({ success: true, data: job })
    } catch (err) {
      console.error('[JobController.createJob] Error:', err.message)
      return res.status(500).json({ success: false, error: err.message })
    }
  },

  /**
   * Trigger AI parsing of raw JD
   */
  async parseJobDescription(req, res) {
    try {
      const organizationId = req.tenant?.organizationId
      const jobId = req.params.id
      const { description } = req.body

      const requirements = await jobService.parseJobDescription({
        jobId,
        organizationId,
        descriptionText: description,
        userToken: req.token,
      })

      return res.status(200).json({ success: true, data: requirements })
    } catch (err) {
      console.error('[JobController.parseJobDescription] Error:', err.message)
      return res.status(500).json({ success: false, error: err.message })
    }
  },

  /**
   * Update / calibrate requirements
   */
  async updateRequirements(req, res) {
    try {
      const organizationId = req.tenant?.organizationId
      const jobId = req.params.id
      const requirementsData = req.body

      const updated = await jobService.updateRequirements({
        jobId,
        organizationId,
        requirementsData,
        userToken: req.token,
      })

      return res.status(200).json({ success: true, data: updated })
    } catch (err) {
      console.error('[JobController.updateRequirements] Error:', err.message)
      return res.status(500).json({ success: false, error: err.message })
    }
  },
}

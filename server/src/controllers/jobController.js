import { jobService } from '../services/jobService.js'
import {
  assertValid,
  validateCreateJobPayload,
  validateText,
  validateUUID,
} from '../validators/index.js'
import { ForbiddenError, NotFoundError } from '../utils/errors.js'

export const jobController = {
  /**
   * List jobs for current tenant organization
   */
  async listJobs(req, res, next) {
    try {
      const organizationId = req.tenant?.organizationId || req.organizationId
      if (!organizationId) {
        throw new ForbiddenError('Tenant organization context is missing.')
      }

      const jobs = await jobService.listJobs({
        organizationId,
        userToken: req.token,
      })

      return res.status(200).json({ success: true, data: jobs })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Get job by ID
   */
  async getJob(req, res, next) {
    try {
      const organizationId = req.tenant?.organizationId || req.organizationId
      const jobId = req.params.id

      const job = await jobService.getJobById({
        jobId,
        organizationId,
        userToken: req.token,
      })

      if (!job) {
        throw new NotFoundError('Job requisition not found.')
      }

      return res.status(200).json({ success: true, data: job })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Create new job requisition
   */
  async createJob(req, res, next) {
    try {
      const organizationId = req.tenant?.organizationId || req.organizationId
      const userId = req.user?.id

      if (!organizationId) {
        throw new ForbiddenError('Tenant organization context is missing.')
      }

      const validated = assertValid(validateCreateJobPayload(req.body))

      const job = await jobService.createJob({
        organizationId,
        userId,
        title: validated.title,
        description: validated.description,
        department: validated.department,
        seniority: validated.seniority,
        userToken: req.token,
      })

      return res.status(201).json({ success: true, data: job })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Trigger AI parsing of raw JD
   */
  async parseJobDescription(req, res, next) {
    try {
      const organizationId = req.tenant?.organizationId || req.organizationId
      const jobId = req.params.id

      const descRes = validateText(req.body?.description, 'Job description', {
        min: 20,
        max: 50000,
        required: true,
      })
      if (!descRes.valid) {
        assertValid(descRes, 'Please provide the job description content to parse.')
      }

      const requirements = await jobService.parseJobDescription({
        jobId,
        organizationId,
        descriptionText: descRes.value,
        userToken: req.token,
      })

      return res.status(200).json({ success: true, data: requirements })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Update / calibrate requirements
   */
  async updateRequirements(req, res, next) {
    try {
      const organizationId = req.tenant?.organizationId || req.organizationId
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
      next(err)
    }
  },
}

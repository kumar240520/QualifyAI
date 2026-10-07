import { trainingDatasetService } from '../services/training/trainingDatasetService.js'

/**
 * Controller for AI Training Dataset Infrastructure APIs (Phase 13)
 */
export const datasetController = {
  /**
   * POST /api/datasets/generate
   */
  async generateDataset(req, res, next) {
    try {
      const organizationId = req.organizationId || req.tenant?.organizationId
      const userId = req.user?.id
      const { name, description, datasetType, format, filterConfig } = req.body

      const dataset = await trainingDatasetService.generateDataset({
        organizationId,
        userId,
        name,
        description,
        datasetType,
        format,
        filterConfig,
      })

      return res.status(201).json({
        success: true,
        message: 'AI Training dataset successfully synthesized and anonymized.',
        data: dataset,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /api/datasets
   */
  async listDatasets(req, res, next) {
    try {
      const organizationId = req.organizationId || req.tenant?.organizationId
      const limit = parseInt(req.query.limit || '50', 10)
      const offset = parseInt(req.query.offset || '0', 10)

      const result = await trainingDatasetService.listDatasets({
        organizationId,
        limit,
        offset,
      })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /api/datasets/:id
   */
  async getDataset(req, res, next) {
    try {
      const organizationId = req.organizationId || req.tenant?.organizationId
      const datasetId = req.params.id

      const dataset = await trainingDatasetService.getDatasetById({
        datasetId,
        organizationId,
      })

      return res.status(200).json({
        success: true,
        data: dataset,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /api/datasets/:id/samples
   */
  async getDatasetSamples(req, res, next) {
    try {
      const organizationId = req.organizationId || req.tenant?.organizationId
      const datasetId = req.params.id
      const limit = parseInt(req.query.limit || '50', 10)
      const offset = parseInt(req.query.offset || '0', 10)

      const result = await trainingDatasetService.getDatasetSamples({
        datasetId,
        organizationId,
        limit,
        offset,
      })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /api/datasets/:id/download
   */
  async downloadDataset(req, res, next) {
    try {
      const organizationId = req.organizationId || req.tenant?.organizationId
      const datasetId = req.params.id

      const { filename, contentType, content } = await trainingDatasetService.exportDatasetContent({
        datasetId,
        organizationId,
      })

      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      return res.status(200).send(content)
    } catch (err) {
      next(err)
    }
  },

  /**
   * DELETE /api/datasets/:id
   */
  async deleteDataset(req, res, next) {
    try {
      const organizationId = req.organizationId || req.tenant?.organizationId
      const datasetId = req.params.id

      const result = await trainingDatasetService.deleteDataset({
        datasetId,
        organizationId,
      })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },
}

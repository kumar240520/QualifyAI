import { modelEvaluationService } from '../services/evaluation/modelEvaluationService.js'

/**
 * Controller for AI Model Evaluation & Benchmarking APIs (Phase 14)
 */
export const modelEvaluationController = {
  /**
   * POST /api/model-benchmarks/run
   */
  async runBenchmark(req, res, next) {
    try {
      const organizationId = req.organizationId || req.tenant?.organizationId
      const userId = req.user?.id
      const { name, datasetId, modelName, baselineModel } = req.body

      const result = await modelEvaluationService.runBenchmark({
        organizationId,
        userId,
        name,
        datasetId,
        modelName,
        baselineModel,
      })

      return res.status(201).json({
        success: true,
        message: 'Model benchmark evaluation run completed successfully.',
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * GET /api/model-benchmarks
   */
  async listBenchmarks(req, res, next) {
    try {
      const organizationId = req.organizationId || req.tenant?.organizationId
      const limit = parseInt(req.query.limit || '50', 10)
      const offset = parseInt(req.query.offset || '0', 10)

      const result = await modelEvaluationService.listBenchmarks({
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
   * GET /api/model-benchmarks/:id
   */
  async getBenchmark(req, res, next) {
    try {
      const organizationId = req.organizationId || req.tenant?.organizationId
      const benchmarkId = req.params.id

      const benchmark = await modelEvaluationService.getBenchmarkById({
        benchmarkId,
        organizationId,
      })

      return res.status(200).json({
        success: true,
        data: benchmark,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * DELETE /api/model-benchmarks/:id
   */
  async deleteBenchmark(req, res, next) {
    try {
      const organizationId = req.organizationId || req.tenant?.organizationId
      const benchmarkId = req.params.id

      const result = await modelEvaluationService.deleteBenchmark({
        benchmarkId,
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

import { Router } from 'express'
import { modelEvaluationController } from '../controllers/modelEvaluationController.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { requireTenantContext } from '../middleware/tenantMiddleware.js'

const router = Router()

// All benchmark routes require authenticated recruiter/admin session and active tenant context
router.use(requireAuth)
router.use(requireTenantContext)
router.use(requireRole(['ORG_ADMIN', 'RECRUITER']))

router.post('/run', modelEvaluationController.runBenchmark)
router.get('/', modelEvaluationController.listBenchmarks)
router.get('/:id', modelEvaluationController.getBenchmark)
router.delete('/:id', modelEvaluationController.deleteBenchmark)

export default router

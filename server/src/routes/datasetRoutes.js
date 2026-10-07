import { Router } from 'express'
import { datasetController } from '../controllers/datasetController.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { requireTenantContext } from '../middleware/tenantMiddleware.js'

const router = Router()

// All dataset management routes require authenticated recruiter/admin session and active tenant context
router.use(requireAuth)
router.use(requireTenantContext)
router.use(requireRole(['ORG_ADMIN', 'RECRUITER']))

router.post('/generate', datasetController.generateDataset)
router.get('/', datasetController.listDatasets)
router.get('/:id', datasetController.getDataset)
router.get('/:id/samples', datasetController.getDatasetSamples)
router.get('/:id/download', datasetController.downloadDataset)
router.delete('/:id', datasetController.deleteDataset)

export default router

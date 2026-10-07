import { Router } from 'express'
import { aiController } from '../controllers/aiController.js'

const router = Router()

// Public test & health check endpoints for AI integration
router.get('/status', aiController.getStatus)
router.post('/test', aiController.test)
router.post('/generate', aiController.generate)

export default router

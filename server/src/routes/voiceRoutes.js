import { Router } from 'express'
import { voiceController } from '../controllers/voiceController.js'

const router = Router()
router.post('/synthesize', voiceController.synthesize)

export default router

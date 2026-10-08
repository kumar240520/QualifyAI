import { Router } from 'express'
import { geminiController } from '../controllers/geminiController.js'

const router = Router()
router.post('/live-token', geminiController.createLiveToken)

export default router

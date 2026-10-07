import { Router } from 'express'
import { candidateController } from '../controllers/candidateController.js'

const router = Router()

// Public candidate verification & acceptance endpoints (Token-Guarded)
router.get('/:token', candidateController.getInvitationByToken)
router.post('/:token/accept', candidateController.acceptInvitation)

export default router

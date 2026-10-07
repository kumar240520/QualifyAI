import { Router } from 'express'
import { authController } from '../controllers/authController.js'
import { requireAuth } from '../middleware/authMiddleware.js'
import { authRateLimiter } from '../middleware/securityMiddleware.js'

const router = Router()

// Public authentication endpoints (Protected with sliding rate limiter)
router.post('/signup', authRateLimiter, authController.signup)
router.post('/login', authRateLimiter, authController.login)
router.post('/forgot-password', authRateLimiter, authController.forgotPassword)
router.post('/reset-password', authRateLimiter, authController.resetPassword)

// Protected user profile & session endpoints
router.get('/me', requireAuth, authController.getMe)
router.post('/onboarding', requireAuth, authController.completeOnboarding)
router.post('/logout', requireAuth, authController.logout)

export default router

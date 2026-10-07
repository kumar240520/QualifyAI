import { Router } from 'express'
import { interviewController } from '../controllers/interviewController.js'
import { evaluationController } from '../controllers/evaluationController.js'
import { proctoringController } from '../controllers/proctoringController.js'
import { reportController } from '../controllers/reportController.js'
import { diagnosticController } from '../controllers/diagnosticController.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { requireTenantContext } from '../middleware/tenantMiddleware.js'
import {
  candidateAnswerRateLimiter,
  sanitizeCandidateInput,
  aiSynthesisRateLimiter,
} from '../middleware/securityMiddleware.js'

const router = Router()

// Public Token-Guarded Candidate Interview Routes
router.post('/start', interviewController.startInterview)
router.post(
  '/:id/answer',
  candidateAnswerRateLimiter,
  sanitizeCandidateInput,
  interviewController.submitAnswer
)
router.post('/:id/silence', interviewController.advanceAfterSilence)
router.post('/:id/wrap-up', interviewController.startWrapUp)
router.get('/token/:token/diagnostic', diagnosticController.getDiagnosticByToken)
router.get('/:id', interviewController.getInterviewState)
router.post('/:id/complete', interviewController.completeInterview)

// Assessment Telemetry Routes (Ingested during active candidate assessment)
router.post('/:id/proctoring/events', proctoringController.recordEvents)

// Protected Recruiter Evaluation & Audit Routes (Guarded by Auth & Tenant Isolation)
router.post(
  '/:id/evaluate',
  requireAuth,
  requireTenantContext,
  requireRole(['ORG_ADMIN', 'RECRUITER']),
  aiSynthesisRateLimiter,
  evaluationController.triggerEvaluation
)
router.get(
  '/:id/evaluation',
  requireAuth,
  requireTenantContext,
  requireRole(['ORG_ADMIN', 'RECRUITER']),
  evaluationController.getEvaluation
)
router.get(
  '/:id/proctoring/summary',
  requireAuth,
  requireTenantContext,
  requireRole(['ORG_ADMIN', 'RECRUITER']),
  proctoringController.getSummary
)

// Protected Executive Recruiter Report Routes
router.get(
  '/:id/report',
  requireAuth,
  requireTenantContext,
  requireRole(['ORG_ADMIN', 'RECRUITER']),
  reportController.getExecutiveReport
)
router.post(
  '/:id/report/generate',
  requireAuth,
  requireTenantContext,
  requireRole(['ORG_ADMIN', 'RECRUITER']),
  aiSynthesisRateLimiter,
  reportController.generateReport
)

// Candidate-Facing Diagnostic Experience Routes (Phase 11)
router.get('/:id/diagnostic', diagnosticController.getDiagnosticReport)
router.post('/:id/diagnostic/generate', diagnosticController.generateDiagnosticReport)

export default router


import { Router } from 'express'
import { jobController } from '../controllers/jobController.js'
import { rubricController } from '../controllers/rubricController.js'
import { candidateController } from '../controllers/candidateController.js'
import { reportController } from '../controllers/reportController.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'
import { requireTenantContext } from '../middleware/tenantMiddleware.js'

const router = Router()

// All job routes require authenticated recruiter/admin session and active tenant context
router.use(requireAuth)
router.use(requireTenantContext)
router.use(requireRole(['ORG_ADMIN', 'RECRUITER']))

// Core Requisition routes
router.get('/', jobController.listJobs)
router.post('/', jobController.createJob)
router.get('/:id', jobController.getJob)
router.post('/:id/parse-jd', jobController.parseJobDescription)
router.put('/:id/requirements', jobController.updateRequirements)

// Rubric Matrix routes
router.get('/:id/rubric', rubricController.getRubric)
router.post('/:id/rubric/generate', rubricController.generateRubric)
router.put('/:id/rubric', rubricController.updateRubric)

// Targeted Question Pool routes
router.get('/:id/questions', rubricController.getQuestions)
router.post('/:id/questions/generate', rubricController.generateQuestions)
router.post('/:id/questions', rubricController.createQuestion)
router.delete('/:id/questions/:questionId', rubricController.deleteQuestion)

// Candidate & Invitation routes
router.get('/:id/candidates', candidateController.listCandidates)
router.post('/:id/candidates', candidateController.addCandidate)
router.post('/:id/invitations', candidateController.createInvitation)

// Cohort Analytics & Leaderboard routes
router.get('/:id/analytics/cohort', reportController.getCohortAnalytics)

export default router




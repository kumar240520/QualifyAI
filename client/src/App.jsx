import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Plus,
  LogOut,
} from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './components/auth/ProtectedRoute.jsx'
import PublicOnlyRoute from './components/auth/PublicOnlyRoute.jsx'
import LandingPage from './pages/LandingPage.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import AuthPage from './pages/AuthPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import RequisitionsManager from './components/dashboard/RequisitionsManager.jsx'
import RubricMatrixView from './components/dashboard/RubricMatrixView.jsx'
import CandidateCohortManager from './components/dashboard/CandidateCohortManager.jsx'
import CohortLeaderboardView from './components/dashboard/CohortLeaderboardView.jsx'
import InvitationAcceptancePage from './pages/InvitationAcceptancePage.jsx'
import InterviewRoomPage from './pages/InterviewRoomPage.jsx'
import CandidateDiagnosticPage from './pages/CandidateDiagnosticPage.jsx'
import DatasetManagementView from './components/datasets/DatasetManagementView.jsx'
import ModelEvaluationBenchmarkView from './components/benchmarks/ModelEvaluationBenchmarkView.jsx'
import RecruiterOnboardingPage from './pages/RecruiterOnboardingPage.jsx'

// Candidate Pipeline Screened List
const SAMPLE_CANDIDATES = [
  {
    id: 'c1',
    name: 'Alex Rivera',
    role: 'Senior Systems Engineer',
    overallScore: 92,
    techDepth: 95,
    problemSolving: 90,
    commScore: 92,
    status: 'Recommended',
    proctoring: 'Clean (100%)',
    tags: ['Go', 'Distributed Systems', 'PostgreSQL', 'Raft'],
  },
  {
    id: 'c2',
    name: 'Sarah Chen',
    role: 'Senior Systems Engineer',
    overallScore: 88,
    techDepth: 91,
    problemSolving: 86,
    commScore: 89,
    status: 'Strong Hire',
    proctoring: 'Clean (98%)',
    tags: ['Kubernetes', 'gRPC', 'Distributed Storage', 'Rust'],
  },
  {
    id: 'c3',
    name: 'Marcus Brody',
    role: 'Senior Systems Engineer',
    overallScore: 74,
    techDepth: 72,
    problemSolving: 75,
    commScore: 80,
    status: 'Review Needed',
    proctoring: '1 Tab Switch',
    tags: ['Go', 'Redis', 'Docker'],
  },
  {
    id: 'c4',
    name: 'Elena Rostova',
    role: 'Senior Systems Engineer',
    overallScore: 94,
    techDepth: 96,
    problemSolving: 92,
    commScore: 94,
    status: 'Recommended',
    proctoring: 'Clean (100%)',
    tags: ['Distributed Systems', 'PostgreSQL', 'Kafka', 'Rust'],
  },
]

/**
 * Protected Recruiter Dashboard Workspace View
 * Enforces authenticated recruiter identity via useAuth()
 */
function RecruiterDashboardView() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('/dashboard')
  const [workspaceView, setWorkspaceView] = useState('requisitions') // 'requisitions' | 'candidates' | 'leaderboard'
  const [activeRubricJob, setActiveRubricJob] = useState(null)
  const [selectedCohortJob, setSelectedCohortJob] = useState(null)

  const handleTabNavigate = (path) => {
    setActiveTab(path)
    if (path === '/jobs' || path === '/jobs/create' || path === '/dashboard') {
      setActiveRubricJob(null)
      setWorkspaceView('requisitions')
    } else if (path === '/candidates') {
      setActiveRubricJob(null)
      setWorkspaceView('candidates')
    } else if (path === '/analytics') {
      setActiveRubricJob(null)
      setWorkspaceView('leaderboard')
    } else if (path === '/datasets' || path === '/ai-training') {
      setActiveRubricJob(null)
      setWorkspaceView('datasets')
    } else if (path === '/benchmarks' || path === '/evaluations/benchmarks') {
      setActiveRubricJob(null)
      setWorkspaceView('benchmarks')
    }
  }

  return (
    <DashboardLayout
      activePath={activeTab}
      onNavigate={handleTabNavigate}
      onLogout={async () => {
        await logout()
        navigate('/auth')
      }}
      workspaceTitle={user?.organizationName || 'QualifyAI Requisitions'}
      activeContext={
        workspaceView === 'requisitions'
          ? 'Active Requisition • Senior Distributed Systems Engineer'
          : workspaceView === 'candidates'
          ? 'Live Candidate Pipeline & Cohort'
          : workspaceView === 'leaderboard'
          ? 'Leaderboard & Analytics'
          : workspaceView === 'datasets'
          ? 'AI Training & Datasets'
          : 'Model Evaluation Benchmarks'
      }
      userProfile={{
        fullName: user?.fullName || 'Recruiter Admin',
        role: user?.role || 'ORG_ADMIN',
        email: user?.email || 'recruiter@qualifyai.com',
        avatarInitials: (user?.fullName || 'RA')
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase(),
      }}
    >
      <div className="space-y-6">
        {/* Clean Context Header (Replaced duplicate pill buttons) */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
              {workspaceView === 'requisitions'
                ? 'Job Requisitions & Intelligence'
                : workspaceView === 'candidates'
                ? 'Candidate Pipeline & Cohort'
                : workspaceView === 'leaderboard'
                ? 'Ranked Leaderboard & Analytics'
                : workspaceView === 'datasets'
                ? 'AI Training Datasets'
                : 'Model Benchmarks'}
            </span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              Controlled via Navigation Sidebar
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-xs cursor-pointer"
            >
              ← Landing
            </button>
            <button
              onClick={async () => {
                await logout()
                navigate('/auth')
              }}
              className="px-4 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-xs font-semibold text-rose-600 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Active Rubric Matrix View */}
        {activeRubricJob ? (
          <RubricMatrixView
            job={activeRubricJob}
            onBack={() => setActiveRubricJob(null)}
            onProceedToInvitations={() => {
              setActiveRubricJob(null)
              setSelectedCohortJob(activeRubricJob)
              setWorkspaceView('candidates')
              setActiveTab('/candidates')
            }}
          />
        ) : (
          <>
            {/* View 1: Requisitions & JD Intelligence */}
            {workspaceView === 'requisitions' && (
              <RequisitionsManager
                onSelectJob={(job, mode) => {
                  if (mode === 'rubric') {
                    setActiveRubricJob(job)
                  } else {
                    setSelectedCohortJob(job)
                    setWorkspaceView('candidates')
                    setActiveTab('/candidates')
                  }
                }}
              />
            )}

            {/* View 2: Candidate Cohort Pipeline */}
            {workspaceView === 'candidates' && (
              <CandidateCohortManager selectedJob={selectedCohortJob} />
            )}

            {/* View 3: Ranked Cohort Leaderboard & Executive Analytics */}
            {workspaceView === 'leaderboard' && (
              <CohortLeaderboardView
                selectedJob={selectedCohortJob}
                onSelectJob={(job) => setActiveRubricJob(job)}
              />
            )}

            {/* View 4: AI Training & Fine-Tuning Datasets (Phase 13) */}
            {workspaceView === 'datasets' && <DatasetManagementView />}

            {/* View 5: AI Model Evaluation & Benchmarking (Phase 14) */}
            {workspaceView === 'benchmarks' && <ModelEvaluationBenchmarkView />}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

/**
 * Application Routes Map
 * Implements strict Protected & Public Guarding:
 * - Public routes: / (Landing Page)
 * - Legacy demo route: /demo (Redirects directly to /auth)
 * - Public-only route: /auth (Login, Sign Up & Forgot Password - redirects authenticated users to /dashboard)
 * - Unskippable Onboarding: /onboarding (Guarded by ProtectedRoute with ORG_ADMIN / RECRUITER authorization)
 * - Protected routes: /dashboard, /dashboard/* (Guarded by ProtectedRoute with ORG_ADMIN / RECRUITER authorization)
 * - Catch-all 404: * (NotFoundPage)
 */
function AppRoutes() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* 1. Public Landing Page */}
      <Route
        path="/"
        element={
          <LandingPage
            onOpenAuth={(mode) =>
              navigate(isAuthenticated ? '/dashboard' : `/auth${mode ? `?mode=${mode}` : ''}`)
            }
          />
        }
      />

      {/* 2. Legacy /demo route: Redirect to real authentication flow */}
      <Route path="/demo" element={<Navigate to="/auth" replace />} />

      {/* 3. Public-Only Authentication (Login & Sign Up) */}
      <Route
        path="/auth"
        element={
          <PublicOnlyRoute>
            <AuthPage onBackToHome={() => navigate('/')} />
          </PublicOnlyRoute>
        }
      />

      {/* 4. Unskippable Recruiter Onboarding Wizard Route */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute requiredRoles={['ORG_ADMIN', 'RECRUITER']}>
            <RecruiterOnboardingPage />
          </ProtectedRoute>
        }
      />

      {/* 5. Protected Recruiter Dashboard Workspace */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredRoles={['ORG_ADMIN', 'RECRUITER']}>
            <RecruiterDashboardView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute requiredRoles={['ORG_ADMIN', 'RECRUITER']}>
            <RecruiterDashboardView />
          </ProtectedRoute>
        }
      />

      {/* 5. Candidate Tokenized Assessment Invitation Staging */}
      <Route path="/invite/:token" element={<InvitationAcceptancePage />} />

      {/* 6. Candidate Live Interview Workspace */}
      <Route path="/interview/:token" element={<InterviewRoomPage />} />

      {/* 7. Candidate Personalized Growth Diagnostic Report */}
      <Route path="/diagnostic/:token" element={<CandidateDiagnosticPage />} />

      {/* 8. 404 Not Found Page */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

/**
 * Root Application Entrypoint
 * Wraps entire application in BrowserRouter and AuthProvider
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

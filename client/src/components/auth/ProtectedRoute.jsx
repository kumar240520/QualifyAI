import React from 'react'
import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { ShieldAlert, Sparkles, Loader2, ArrowLeft, LogIn } from 'lucide-react'

/**
 * Enterprise Protected Route Guard
 * Enforces:
 * 1. Authentication Check: Unauthenticated visitors redirected to /auth with redirect query
 * 2. Role-Based Authorization Check: Unauthorized roles intercepted with 403 Access Denied
 */
export default function ProtectedRoute({ children, requiredRoles = [] }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const location = useLocation()

  // 1. Initial Auth Hydration Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/25 animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold tracking-wide">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Verifying session credentials...</span>
          </div>
        </div>
      </div>
    )
  }

  // 2. Unauthenticated Interception: Redirect to /auth preserving intended destination
  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/auth?redirect=${returnUrl}`} replace state={{ from: location }} />
  }

  // 3. Unskippable Onboarding Guard: Recruiter must complete onboarding before dashboard access
  const isCompleted = Boolean(user?.isSubmitted || user?.onboardingCompleted)
  if (
    user &&
    user.role !== 'CANDIDATE' &&
    !isCompleted &&
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />
  }

  // 4. Role-Based Authorization Guard: Check user's assigned role
  if (requiredRoles.length > 0 && (!user?.role || !requiredRoles.includes(user.role))) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col items-center justify-center p-6 select-none">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl shadow-slate-900/5 border border-slate-200/80 text-center space-y-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold uppercase tracking-wider">
              403 • Access Restricted
            </span>
            <h1 className="text-xl font-bold font-heading text-slate-900 tracking-tight">
              Authorization Required
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your current account (<strong className="text-slate-700">{user?.email}</strong>) has the role{' '}
              <span className="font-mono text-indigo-600 font-semibold">{user?.role || 'UNKNOWN'}</span>, which is not authorized to access this workspace.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={logout}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In with Different Role</span>
            </button>
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 4. Authenticated & Authorized: Render Protected Content
  return children
}

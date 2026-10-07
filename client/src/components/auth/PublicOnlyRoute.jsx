import React from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { Loader2, Sparkles } from 'lucide-react'

/**
 * Public Only Route Guard
 * Used for /auth (Login & Sign Up)
 * If user is already authenticated, redirects them to /dashboard or their intended returnUrl
 */
export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  const [searchParams] = useSearchParams()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/25 animate-pulse">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold tracking-wide">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Checking authentication session...</span>
          </div>
        </div>
      </div>
    )
  }

  const isRecoveryMode =
    searchParams.get('mode') === 'reset-password' ||
    (typeof window !== 'undefined' && window.location.hash.includes('type=recovery'))

  if (isAuthenticated && !isRecoveryMode) {
    const redirectUrl = searchParams.get('redirect') || '/dashboard'
    return <Navigate to={redirectUrl} replace />
  }

  return children
}

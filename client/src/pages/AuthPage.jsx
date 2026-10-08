import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Eye,
  EyeOff,
  Sparkles,
  ArrowLeft,
  Check,
  AlertCircle,
  Loader2,
  Mail,
  KeyRound,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import authBgImage from '../assets/auth-atmospheric-bg.jpg'
import { normalizeApiError, getFieldError } from '../utils/errorNormalizer.js'
import { validateLogin, validateSignup, validateEmail, validatePassword } from '../utils/validators.js'

// Social Authentication Google Brand Icon
const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.42 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.27 2.58 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
)

// Hook to track responsive viewport accurately for sliding transitions
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return isDesktop
}

/**
 * Production Authentication Page (Login, Sign Up, Forgot Password, Reset Password)
 * Features:
 * - Supabase Authentication integration (Email/Password & Google OAuth ready)
 * - Removed Facebook and other third-party providers (Google kept per requirement)
 * - Split-panel sliding interaction pattern (Login <-> Sign Up)
 * - Dedicated Forgot Password ("forward password") flow with email instructions
 * - Interactive Reset Password view when recovering password
 * - Soft off-white page background (#F5F5F3) and atmospheric mountain visual
 */
export default function AuthPage({ onBackToHome, onAuthSuccess }) {
  const { login, signup, forgotPassword, resetPassword, signInWithGoogle, isPasswordRecovery } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const redirectTarget = searchParams.get('redirect') || '/dashboard'

  const isDesktop = useIsDesktop()

  // Primary active mode: 'login' | 'signup' | 'forgot' | 'reset'
  const initialMode = searchParams.get('mode') === 'reset-password' ||
    (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) ||
    isPasswordRecovery
      ? 'reset'
      : searchParams.get('mode') === 'signup'
      ? 'signup'
      : 'login'

  const [authMode, setAuthMode] = useState(initialMode)
  const isSignUp = authMode === 'signup'

  // Input States
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [resetSentEmail, setResetSentEmail] = useState('')

  // Form Fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupRole, setSignupRole] = useState('RECRUITER') // 'RECRUITER' | 'CANDIDATE'

  const [forgotEmail, setForgotEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Sync mode changes with recovery state
  useEffect(() => {
    if (isPasswordRecovery || (typeof window !== 'undefined' && window.location.hash.includes('type=recovery'))) {
      setAuthMode('reset')
    }
  }, [isPasswordRecovery])

  const handleBack = () => {
    if (onBackToHome) {
      onBackToHome()
    } else {
      navigate('/')
    }
  }

  const switchMode = (mode) => {
    setErrorMessage('')
    setSuccessMessage('')
    setFieldErrors({})
    setAuthMode(mode)
  }

  // 1. LOGIN SUBMISSION
  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setFieldErrors({})

    const val = validateLogin({ email: loginEmail, password: loginPassword })
    if (!val.isValid) {
      setFieldErrors(val.errors)
      setErrorMessage('Please fill in the required fields correctly.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await login({ email: loginEmail.trim().toLowerCase(), password: loginPassword })
      if (res.success) {
        setSuccessMessage('Login successful! Redirecting to workspace...')
        setTimeout(() => {
          onAuthSuccess?.(res.user)
          // If recruiter has not completed onboarding, send to /onboarding
          if (res.user?.role !== 'CANDIDATE' && !res.user?.onboardingCompleted) {
            navigate('/onboarding', { replace: true })
          } else {
            navigate(redirectTarget, { replace: true })
          }
        }, 500)
      } else {
        const norm = normalizeApiError(res.error, 'Invalid email or password.')
        setErrorMessage(norm.message)
        setFieldErrors(norm.fields || {})
      }
    } catch (err) {
      const norm = normalizeApiError(err, 'An unexpected error occurred during login.')
      setErrorMessage(norm.message)
      setFieldErrors(norm.fields || {})
    } finally {
      setIsSubmitting(false)
    }
  }

  // 2. SIGNUP SUBMISSION
  const handleSignupSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setFieldErrors({})

    const val = validateSignup({ fullName: signupName, email: signupEmail, password: signupPassword })
    if (!val.isValid) {
      setFieldErrors(val.errors)
      setErrorMessage('Please fill in the required fields correctly.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await signup({
        name: signupName.trim(),
        email: signupEmail.trim().toLowerCase(),
        password: signupPassword,
        role: signupRole,
      })
      if (res.success) {
        if (signupRole === 'RECRUITER') {
          setSuccessMessage('Account created! Please complete onboarding to activate your recruiter account...')
          setTimeout(() => {
            onAuthSuccess?.(res.user)
            navigate('/onboarding', { replace: true })
          }, 600)
        } else {
          setSuccessMessage('Candidate account created! You can now participate in invited assessments.')
          setTimeout(() => {
            onAuthSuccess?.(res.user)
            navigate('/', { replace: true })
          }, 1200)
        }
      } else {
        const norm = normalizeApiError(res.error, 'Account creation failed.')
        setErrorMessage(norm.message)
        setFieldErrors(norm.fields || {})
      }
    } catch (err) {
      const norm = normalizeApiError(err, 'An unexpected error occurred during signup.')
      setErrorMessage(norm.message)
      setFieldErrors(norm.fields || {})
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. FORGOT PASSWORD SUBMISSION
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setFieldErrors({})

    const val = validateEmail(forgotEmail)
    if (!val.valid) {
      setFieldErrors({ email: val.error })
      setErrorMessage(val.error)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await forgotPassword(val.value)
      if (res.success) {
        setResetSentEmail(val.value)
        setSuccessMessage('Password reset link sent! Please check your email inbox.')
      } else {
        const norm = normalizeApiError(res.error, 'Could not send reset email. Please try again.')
        setErrorMessage(norm.message)
        setFieldErrors(norm.fields || {})
      }
    } catch (err) {
      const norm = normalizeApiError(err, 'Failed to request password reset.')
      setErrorMessage(norm.message)
      setFieldErrors(norm.fields || {})
    } finally {
      setIsSubmitting(false)
    }
  }

  // 4. RESET PASSWORD SUBMISSION (New Password)
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setFieldErrors({})

    const passVal = validatePassword(newPassword)
    if (!passVal.valid) {
      setFieldErrors({ password: passVal.error })
      setErrorMessage(passVal.error)
      return
    }
    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match. Please re-enter.' })
      setErrorMessage('Passwords do not match. Please re-enter.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await resetPassword(newPassword)
      if (res.success) {
        setSuccessMessage('Password successfully updated! Redirecting to login...')
        setTimeout(() => {
          switchMode('login')
          setLoginEmail('')
          setLoginPassword('')
          setSuccessMessage('Password updated! You can now log in with your new password.')
        }, 1200)
      } else {
        const norm = normalizeApiError(res.error, 'Failed to update password.')
        setErrorMessage(norm.message)
        setFieldErrors(norm.fields || {})
      }
    } catch (err) {
      const norm = normalizeApiError(err, 'An unexpected error occurred during password update.')
      setErrorMessage(norm.message)
      setFieldErrors(norm.fields || {})
    } finally {
      setIsSubmitting(false)
    }
  }

  // 5. GOOGLE OAUTH HANDLER (Single social option per user requirement)
  const handleGoogleAuth = async () => {
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      const res = await signInWithGoogle()
      if (!res.success) {
        // If Google credentials are not yet configured in Supabase, provide clear feedback
        setErrorMessage(res.error || 'Google Authentication is ready for credentials.')
      }
    } catch (err) {
      setErrorMessage(err.message || 'Google authentication could not be initiated.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F3] text-slate-900 font-sans flex flex-col justify-between p-4 sm:p-6 lg:p-10 select-none relative overflow-x-hidden">
      {/* Top Header / Back Navigation */}
      <div className="w-full max-w-[900px] mx-auto flex items-center justify-between z-30 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>Back to Home</span>
          </button>
        </div>

        {/* QualifyAI Brand Badge */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-heading font-extrabold text-sm tracking-tight text-slate-900">
            Qualify<span className="text-blue-600">AI</span>
          </span>
        </div>
      </div>

      {/* Main Centered Authentication Card */}
      <div className="w-full max-w-[880px] mx-auto my-auto relative">
        <div className="w-full min-h-[550px] sm:min-h-[570px] bg-white rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] border border-slate-200/70 overflow-hidden relative flex flex-col md:flex-row">
          {/* ======================================================== */}
          {/* 1. FORM CONTAINER (Slides between left & right on desktop) */}
          {/* ======================================================== */}
          <motion.div
            animate={{
              x: isDesktop ? (authMode === 'signup' ? '100%' : '0%') : '0%',
            }}
            transition={{
              duration: 0.65,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="w-full md:w-1/2 min-h-[460px] sm:min-h-[550px] p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white z-10 relative"
          >
            {/* Inline Feedback Alerts */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="leading-snug">{errorMessage}</span>
              </motion.div>
            )}

            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5"
              >
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="leading-snug">{successMessage}</span>
              </motion.div>
            )}

            {/* Animate Form Cross-Fade */}
            <AnimatePresence mode="wait">
              {authMode === 'login' && (
                /* ======================== */
                /* LOGIN FORM               */
                /* ======================== */
                <motion.div
                  key="login-form"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25 }}
                  className="w-full max-w-[320px] mx-auto space-y-5"
                >
                  <div className="text-center space-y-1">
                    <h1 className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight">
                      Login
                    </h1>
                    <p className="text-xs text-slate-500">Sign in to your QualifyAI workspace</p>
                  </div>

                  <form onSubmit={handleLoginSubmit} className="space-y-4">
                    {/* Email Input */}
                    <div className="space-y-1">
                      <label
                        htmlFor="login-email"
                        className="block text-[11px] sm:text-xs font-medium text-slate-700"
                      >
                        Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(e) => {
                          setLoginEmail(e.target.value)
                          if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: null }))
                        }}
                        placeholder="hello@example.com"
                        className={`w-full h-10 sm:h-11 px-3.5 bg-[#F1F1F6] border ${
                          fieldErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-transparent focus:border-slate-300'
                        } focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs sm:text-[13px] text-slate-900 placeholder:text-slate-400 transition-all outline-none`}
                      />
                      {fieldErrors.email && (
                        <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.email}</p>
                      )}
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1">
                      <label
                        htmlFor="login-password"
                        className="block text-[11px] sm:text-xs font-medium text-slate-700"
                      >
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={loginPassword}
                          onChange={(e) => {
                            setLoginPassword(e.target.value)
                            if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null }))
                          }}
                          placeholder="••••••••"
                          className={`w-full h-10 sm:h-11 pl-3.5 pr-10 bg-[#F1F1F6] border ${
                            fieldErrors.password ? 'border-rose-400 bg-rose-50/20' : 'border-transparent focus:border-slate-300'
                          } focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs sm:text-[13px] text-slate-900 placeholder:text-slate-400 transition-all outline-none`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.password}</p>
                      )}
                    </div>

                    {/* Remember Me & Forgot Password Row */}
                    <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-0 cursor-pointer"
                        />
                        <span>Remember me</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-blue-600 hover:text-blue-700 font-medium transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>

                    {/* Primary Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-10 sm:h-11 rounded-lg bg-[#050505] hover:bg-black active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Signing In...</span>
                        </>
                      ) : (
                        <span>Login</span>
                      )}
                    </button>
                  </form>

                  {/* Single Social Authentication Option: Google Only */}
                  <div className="pt-2 text-center space-y-3">
                    <div className="relative flex items-center justify-center">
                      <div className="border-t border-slate-200 w-full" />
                      <span className="bg-white px-2.5 text-[11px] text-slate-400 uppercase tracking-wider shrink-0 font-medium">
                        Or continue with
                      </span>
                      <div className="border-t border-slate-200 w-full" />
                    </div>

                    <button
                      type="button"
                      aria-label="Sign in with Google"
                      onClick={handleGoogleAuth}
                      disabled={isSubmitting}
                      className="w-full h-10 sm:h-11 rounded-lg bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 active:scale-[0.98] text-xs font-semibold transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-2xs"
                    >
                      <GoogleIcon />
                      <span>Continue with Google</span>
                    </button>
                  </div>

                  {/* Mobile Quick-Toggle */}
                  <div className="md:hidden text-center pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="text-xs text-blue-600 font-semibold"
                    >
                      Don't have an account? Sign Up
                    </button>
                  </div>
                </motion.div>
              )}

              {authMode === 'signup' && (
                /* ======================== */
                /* SIGN UP FORM             */
                /* ======================== */
                <motion.div
                  key="signup-form"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                  className="w-full max-w-[320px] mx-auto space-y-4"
                >
                  <div className="text-center space-y-1">
                    <h1 className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight">
                      Sign Up
                    </h1>
                    <p className="text-xs text-slate-500">Create your recruiter or enterprise account</p>
                  </div>

                  <form onSubmit={handleSignupSubmit} className="space-y-3.5">
                    {/* Role Selection: Recruiter vs Candidate */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] sm:text-xs font-semibold text-slate-700">
                        Select Account Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSignupRole('RECRUITER')}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                            signupRole === 'RECRUITER'
                              ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs ring-1 ring-blue-600/30'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">Recruiter</span>
                            {signupRole === 'RECRUITER' && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          </div>
                          <span className="text-[10px] text-slate-500 leading-tight">
                            Hire & interview talent
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSignupRole('CANDIDATE')}
                          className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                            signupRole === 'CANDIDATE'
                              ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs ring-1 ring-blue-600/30'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">Candidate</span>
                            {signupRole === 'CANDIDATE' && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          </div>
                          <span className="text-[10px] text-slate-500 leading-tight">
                            Take AI skills tests
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Name Input */}
                    <div className="space-y-1">
                      <label
                        htmlFor="signup-name"
                        className="block text-[11px] sm:text-xs font-medium text-slate-700"
                      >
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="signup-name"
                        type="text"
                        autoComplete="name"
                        value={signupName}
                        onChange={(e) => {
                          setSignupName(e.target.value)
                          if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: null }))
                        }}
                        placeholder="Alex Rivera"
                        className={`w-full h-10 sm:h-11 px-3.5 bg-[#F1F1F6] border ${
                          fieldErrors.fullName ? 'border-rose-400 bg-rose-50/20' : 'border-transparent focus:border-slate-300'
                        } focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs sm:text-[13px] text-slate-900 placeholder:text-slate-400 transition-all outline-none`}
                      />
                      {fieldErrors.fullName && (
                        <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.fullName}</p>
                      )}
                    </div>

                    {/* Email Input */}
                    <div className="space-y-1">
                      <label
                        htmlFor="signup-email"
                        className="block text-[11px] sm:text-xs font-medium text-slate-700"
                      >
                        Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        value={signupEmail}
                        onChange={(e) => {
                          setSignupEmail(e.target.value)
                          if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: null }))
                        }}
                        placeholder="hello@example.com"
                        className={`w-full h-10 sm:h-11 px-3.5 bg-[#F1F1F6] border ${
                          fieldErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-transparent focus:border-slate-300'
                        } focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs sm:text-[13px] text-slate-900 placeholder:text-slate-400 transition-all outline-none`}
                      />
                      {fieldErrors.email && (
                        <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.email}</p>
                      )}
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1">
                      <label
                        htmlFor="signup-password"
                        className="block text-[11px] sm:text-xs font-medium text-slate-700"
                      >
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id="signup-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={signupPassword}
                          onChange={(e) => {
                            setSignupPassword(e.target.value)
                            if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null }))
                          }}
                          placeholder="••••••••"
                          className={`w-full h-10 sm:h-11 pl-3.5 pr-10 bg-[#F1F1F6] border ${
                            fieldErrors.password ? 'border-rose-400 bg-rose-50/20' : 'border-transparent focus:border-slate-300'
                          } focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs sm:text-[13px] text-slate-900 placeholder:text-slate-400 transition-all outline-none`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.password}</p>
                      )}
                    </div>

                    {/* Primary Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-10 sm:h-11 rounded-lg bg-[#050505] hover:bg-black active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-1"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Creating Account...</span>
                        </>
                      ) : (
                        <span>Create Account</span>
                      )}
                    </button>
                  </form>

                  {/* Single Social Authentication Option: Google Only */}
                  <div className="pt-2 text-center space-y-2.5">
                    <div className="relative flex items-center justify-center">
                      <div className="border-t border-slate-200 w-full" />
                      <span className="bg-white px-2.5 text-[11px] text-slate-400 uppercase tracking-wider shrink-0 font-medium">
                        Or continue with
                      </span>
                      <div className="border-t border-slate-200 w-full" />
                    </div>

                    <button
                      type="button"
                      aria-label="Sign up with Google"
                      onClick={handleGoogleAuth}
                      disabled={isSubmitting}
                      className="w-full h-10 sm:h-11 rounded-lg bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 active:scale-[0.98] text-xs font-semibold transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-2xs"
                    >
                      <GoogleIcon />
                      <span>Continue with Google</span>
                    </button>
                  </div>

                  {/* Mobile Quick-Toggle */}
                  <div className="md:hidden text-center pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-xs text-blue-600 font-semibold"
                    >
                      Already have an account? Login
                    </button>
                  </div>
                </motion.div>
              )}

              {authMode === 'forgot' && (
                /* ======================== */
                /* FORGOT PASSWORD FORM     */
                /* ======================== */
                <motion.div
                  key="forgot-form"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="w-full max-w-[320px] mx-auto space-y-5"
                >
                  <div className="text-center space-y-1">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-2">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <h1 className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight">
                      Forgot Password
                    </h1>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Enter your account email to receive a password reset link.
                    </p>
                  </div>

                  {resetSentEmail ? (
                    <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-center space-y-3">
                      <div className="w-8 h-8 mx-auto rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-800">Check Your Inbox</p>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          We sent password reset instructions to{' '}
                          <span className="font-semibold text-slate-900">{resetSentEmail}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setResetSentEmail('')
                          switchMode('login')
                        }}
                        className="w-full py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        Return to Login
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                      {/* Email Input */}
                      <div className="space-y-1">
                        <label
                          htmlFor="forgot-email"
                          className="block text-[11px] sm:text-xs font-medium text-slate-700"
                        >
                          Email Address <span className="text-rose-500">*</span>
                        </label>
                        <input
                          id="forgot-email"
                          type="email"
                          autoComplete="email"
                          value={forgotEmail}
                          onChange={(e) => {
                            setForgotEmail(e.target.value)
                            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: null }))
                          }}
                          placeholder="hello@example.com"
                          className={`w-full h-10 sm:h-11 px-3.5 bg-[#F1F1F6] border ${
                            fieldErrors.email ? 'border-rose-400 bg-rose-50/20' : 'border-transparent focus:border-slate-300'
                          } focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs sm:text-[13px] text-slate-900 placeholder:text-slate-400 transition-all outline-none`}
                        />
                        {fieldErrors.email && (
                          <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.email}</p>
                        )}
                      </div>

                      {/* Primary Button */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full h-10 sm:h-11 rounded-lg bg-[#050505] hover:bg-black active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Sending Instructions...</span>
                          </>
                        ) : (
                          <span>Send Reset Link</span>
                        )}
                      </button>

                      {/* Back Link */}
                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => switchMode('login')}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back to Login</span>
                        </button>
                      </div>
                    </form>
                  )}
                </motion.div>
              )}

              {authMode === 'reset' && (
                /* ======================== */
                /* RESET PASSWORD FORM      */
                /* ======================== */
                <motion.div
                  key="reset-form"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="w-full max-w-[320px] mx-auto space-y-4"
                >
                  <div className="text-center space-y-1">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h1 className="text-xl sm:text-[22px] font-bold text-slate-900 tracking-tight">
                      Set New Password
                    </h1>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Choose a new secure password for your QualifyAI account.
                    </p>
                  </div>

                  <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                    {/* New Password */}
                    <div className="space-y-1">
                      <label
                        htmlFor="new-password"
                        className="block text-[11px] sm:text-xs font-medium text-slate-700"
                      >
                        New Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id="new-password"
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value)
                            if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null }))
                          }}
                          placeholder="••••••••"
                          className={`w-full h-10 sm:h-11 pl-3.5 pr-10 bg-[#F1F1F6] border ${
                            fieldErrors.password ? 'border-rose-400 bg-rose-50/20' : 'border-transparent focus:border-slate-300'
                          } focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs sm:text-[13px] text-slate-900 placeholder:text-slate-400 transition-all outline-none`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.password}</p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1">
                      <label
                        htmlFor="confirm-password"
                        className="block text-[11px] sm:text-xs font-medium text-slate-700"
                      >
                        Confirm Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <input
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value)
                            if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: null }))
                          }}
                          placeholder="••••••••"
                          className={`w-full h-10 sm:h-11 pl-3.5 pr-10 bg-[#F1F1F6] border ${
                            fieldErrors.confirmPassword ? 'border-rose-400 bg-rose-50/20' : 'border-transparent focus:border-slate-300'
                          } focus:bg-white focus:ring-1 focus:ring-slate-400 rounded-lg text-xs sm:text-[13px] text-slate-900 placeholder:text-slate-400 transition-all outline-none`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fieldErrors.confirmPassword && (
                        <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.confirmPassword}</p>
                      )}
                    </div>

                    {/* Primary Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-10 sm:h-11 rounded-lg bg-[#050505] hover:bg-black active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-1"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <span>Update Password</span>
                      )}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Cancel and Login</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ======================================================== */}
          {/* 2. VISUAL PANEL (Slides between right & left on desktop) */}
          {/* ======================================================== */}
          <motion.div
            animate={{
              x: isDesktop ? (authMode === 'signup' ? '-100%' : '0%') : '0%',
            }}
            transition={{
              duration: 0.65,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="w-full md:w-1/2 h-[220px] md:h-auto min-h-[220px] md:min-h-[550px] relative overflow-hidden z-20 order-first md:order-none"
          >
            {/* Dark Atmospheric Background Image */}
            <motion.img
              src={authBgImage}
              alt="Atmospheric Landscape"
              animate={{ scale: authMode === 'signup' ? 1.06 : 1 }}
              transition={{ duration: 0.75, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
            />

            {/* Dark Gradient Overlay for Maximum Text Contrast */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/75 backdrop-blur-[1px]" />

            {/* Overlay Content */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center text-center p-6 sm:p-10 text-white">
              <AnimatePresence mode="wait">
                {authMode === 'signup' ? (
                  /* Overlay Content when in Sign Up State */
                  <motion.div
                    key="visual-signup"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="max-w-[280px] space-y-3 sm:space-y-4"
                  >
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-heading">
                      Welcome back
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed font-normal">
                      Login to review your latest interview evaluations and candidate pools.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="px-7 py-2.5 rounded-full border border-white/70 hover:border-white hover:bg-white/15 text-white text-xs sm:text-sm font-semibold tracking-wide backdrop-blur-xs transition-all active:scale-95 cursor-pointer shadow-sm hover:scale-105"
                      >
                        Login
                      </button>
                    </div>
                  </motion.div>
                ) : authMode === 'forgot' || authMode === 'reset' ? (
                  /* Overlay Content when in Recovery State */
                  <motion.div
                    key="visual-recovery"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="max-w-[280px] space-y-3 sm:space-y-4"
                  >
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-heading">
                      Account Recovery
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed font-normal">
                      Secure authentication with encrypted credential recovery and tenant isolation.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => switchMode('login')}
                        className="px-7 py-2.5 rounded-full border border-white/70 hover:border-white hover:bg-white/15 text-white text-xs sm:text-sm font-semibold tracking-wide backdrop-blur-xs transition-all active:scale-95 cursor-pointer shadow-sm hover:scale-105"
                      >
                        Back to Login
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  /* Overlay Content when in Login State */
                  <motion.div
                    key="visual-login"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="max-w-[280px] space-y-3 sm:space-y-4"
                  >
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-heading">
                      Hello there
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed font-normal">
                      Begin your journey with AI-powered candidate assessments and technical rubrics.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => switchMode('signup')}
                        className="px-7 py-2.5 rounded-full border border-white/70 hover:border-white hover:bg-white/15 text-white text-xs sm:text-sm font-semibold tracking-wide backdrop-blur-xs transition-all active:scale-95 cursor-pointer shadow-sm hover:scale-105"
                      >
                        Sign Up
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer / Trust Guarantee */}
      <div className="w-full max-w-[880px] mx-auto text-center z-10 pt-4 pb-12 sm:pb-6">
        <p className="text-[11px] text-slate-400 font-mono">
          Protected by Enterprise-Grade SOC2 Security • Single Sign-On • Multi-Tenant Isolation
        </p>
      </div>
    </div>
  )
}

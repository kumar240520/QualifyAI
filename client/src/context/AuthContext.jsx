import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { authService } from '../services/authService.js'
import { API_BASE_URL } from '../services/apiConfig.js'

const AuthContext = createContext(null)

const AUTH_STORAGE_KEY = 'qualifyai_auth_session'

// Fallback demo user for local UI evaluation
const DEFAULT_ORG_ADMIN = {
  id: 'usr_admin_demo',
  email: 'recruiter@qualifyai.com',
  fullName: 'Sarah Jenkins',
  role: 'ORG_ADMIN',
  organizationId: 'org_acme_systems',
  organizationName: 'Acme Systems Infrastructure',
  avatarUrl: null,
  token: 'mock_jwt_token_qualifyai_enterprise',
  onboardingCompleted: true,
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  /**
   * Hydrate user profile and organization membership from database
   */
  const hydrateUserData = async (activeSession) => {
    if (!activeSession?.user) {
      setUser(null)
      setOrganization(null)
      return
    }

    const authUser = activeSession.user
    try {
      // Fetch profile and organization from Supabase public tables
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle()

      const { data: memberships } = await supabase
        .from('organization_memberships')
        .select('id, role, organization_id, organizations ( id, name, slug )')
        .eq('user_id', authUser.id)
        .limit(1)

      const activeMembership = memberships?.[0]
      const org = activeMembership?.organizations

      const isSubmitted =
        Boolean(profile?.is_submitted) ||
        Boolean(profile?.onboarding_completed) ||
        Boolean(authUser.user_metadata?.is_submitted) ||
        Boolean(authUser.user_metadata?.onboarding_completed) ||
        localStorage.getItem(`qualifyai_onboarding_${authUser.id}`) === 'true'

      const isOnboarded = isSubmitted

      const fullUser = {
        id: authUser.id,
        email: authUser.email,
        fullName:
          profile?.full_name ||
          authUser.user_metadata?.full_name ||
          authUser.email?.split('@')[0],
        role: profile?.role || activeMembership?.role || authUser.user_metadata?.role || 'ORG_ADMIN',
        organizationId: org?.id || 'org_default',
        organizationName: org?.name || `${authUser.user_metadata?.full_name || 'My'}'s Organization`,
        token: activeSession.access_token,
        isSubmitted: Boolean(isSubmitted),
        onboardingCompleted: Boolean(isOnboarded),
      }

      const activeOrg = org
        ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
            role: activeMembership?.role || 'ORG_ADMIN',
          }
        : {
            id: 'org_default',
            name: fullUser.organizationName,
            slug: 'workspace',
            role: 'ORG_ADMIN',
          }

      setUser(fullUser)
      setOrganization(activeOrg)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fullUser))
      if (activeSession.access_token) {
        localStorage.setItem('qualifyai_token', activeSession.access_token)
      }
    } catch (err) {
      console.warn('[AuthProvider] Hydration error, using session metadata:', err.message)
      const isSubmitted =
        Boolean(authUser.user_metadata?.is_submitted) ||
        Boolean(authUser.user_metadata?.onboarding_completed) ||
        localStorage.getItem(`qualifyai_onboarding_${authUser.id}`) === 'true'
      const isOnboarded = isSubmitted

      const fallbackUser = {
        id: authUser.id,
        email: authUser.email,
        fullName: authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
        role: authUser.user_metadata?.role || 'ORG_ADMIN',
        organizationId: 'org_default',
        organizationName: 'Primary Workspace',
        token: activeSession.access_token,
        isSubmitted: Boolean(isSubmitted),
        onboardingCompleted: Boolean(isOnboarded),
      }
      setUser(fallbackUser)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(fallbackUser))
      if (activeSession.access_token) {
        localStorage.setItem('qualifyai_token', activeSession.access_token)
      }
    }
  }

  // Initialize session and subscribe to Supabase Auth state changes
  useEffect(() => {
    let mounted = true

    async function initSession() {
      try {
        const currentSession = await authService.getSession()
        if (mounted && currentSession) {
          setSession(currentSession)
          await hydrateUserData(currentSession)
        } else if (mounted) {
          // Check if demo user stored locally
          const stored = localStorage.getItem(AUTH_STORAGE_KEY)
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.email) setUser(parsed)
          }
        }
      } catch (err) {
        console.error('Session initialization error:', err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    initSession()

    // Listen to real-time auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(newSession)
        await hydrateUserData(newSession)
      } else if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setOrganization(null)
        setIsPasswordRecovery(false)
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  /**
   * Log in user with credentials
   */
  const login = async ({ email, password }) => {
    setIsLoading(true)
    try {
      const res = await authService.login({ email, password })
      if (res.success) {
        setSession(res.session)
        setUser(res.user)
        if (res.user.organization) setOrganization(res.user.organization)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.user))
        return { success: true, user: res.user }
      }
      return { success: false, error: res.error }
    } catch (err) {
      return { success: false, error: err.message || 'Login failed' }
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Sign up new user and organization
   */
  const signup = async ({ name, email, password, organizationName = '', role = 'ORG_ADMIN' }) => {
    setIsLoading(true)
    try {
      const res = await authService.signup({ name, email, password, organizationName, role })
      if (res.success) {
        if (res.session) {
          setSession(res.session)
          setUser(res.user)
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.user))
        }
        return { success: true, user: res.user, message: res.message }
      }
      return { success: false, error: res.error }
    } catch (err) {
      return { success: false, error: err.message || 'Signup failed' }
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Forgot password request
   */
  const forgotPassword = async (email) => {
    return await authService.forgotPassword(email)
  }

  /**
   * Update password in recovery flow
   */
  const resetPassword = async (newPassword) => {
    const res = await authService.resetPassword(newPassword)
    if (res.success) {
      setIsPasswordRecovery(false)
    }
    return res
  }

  /**
   * Initiate Google OAuth
   */
  const signInWithGoogle = async () => {
    return await authService.signInWithGoogle()
  }

  /**
   * Log out and clear session state
   */
  const logout = async () => {
    await authService.logout()
    setUser(null)
    setSession(null)
    setOrganization(null)
    setIsPasswordRecovery(false)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem('qualifyai_token')
  }

  /**
   * Quick-switch demo recruiter for evaluation
   */
  const loginAsDemoRecruiter = () => {
    setUser(DEFAULT_ORG_ADMIN)
    setOrganization({
      id: DEFAULT_ORG_ADMIN.organizationId,
      name: DEFAULT_ORG_ADMIN.organizationName,
      role: DEFAULT_ORG_ADMIN.role,
    })
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(DEFAULT_ORG_ADMIN))
  }

  /**
   * Complete recruiter onboarding and activate account
   */
  const completeOnboarding = async (onboardingData = {}) => {
    if (!user) return false
    const updatedUser = {
      ...user,
      isSubmitted: true,
      onboardingCompleted: true,
      organizationName: onboardingData.companyName || user.organizationName,
      onboardingData,
    }
    setUser(updatedUser)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser))
    if (user.id) {
      localStorage.setItem(`qualifyai_onboarding_${user.id}`, 'true')
    }

    try {
      // 1. Update Supabase Auth user metadata
      await supabase.auth.updateUser({
        data: {
          onboarding_completed: true,
          is_submitted: true,
          onboarding_data: onboardingData,
        },
      })

      // 2. Persist to backend /api/auth/onboarding
      const token = user.token || session?.access_token || localStorage.getItem('qualifyai_token')
      if (token) {
        await fetch(`${API_BASE_URL}/auth/onboarding`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(onboardingData),
        })
      }

      // 3. Update Supabase profiles table directly as well
      if (user.id && user.id !== 'usr_admin_demo') {
        const profileUpdates = {
          onboarding_completed: true,
          is_submitted: true,
          phone: onboardingData.phone || null,
          location: onboardingData.location || null,
          recruiter_role: onboardingData.recruiterRole || null,
          onboarding_data: onboardingData,
        }
        if (onboardingData.fullName) {
          profileUpdates.full_name = onboardingData.fullName
        }

        await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', user.id)
      }
    } catch (e) {
      console.warn('[completeOnboarding] DB update deferred, persisted locally:', e.message)
    }
    return true
  }

  const value = {
    user,
    session,
    organization,
    isAuthenticated: Boolean(user && (user.token || session?.access_token || user.id)),
    isLoading,
    role: user?.role || null,
    isPasswordRecovery,
    setIsPasswordRecovery,
    login,
    signup,
    logout,
    forgotPassword,
    resetPassword,
    signInWithGoogle,
    loginAsDemoRecruiter,
    completeOnboarding,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

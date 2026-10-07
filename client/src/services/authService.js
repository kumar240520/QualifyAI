import { supabase } from '../lib/supabase.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

/**
 * Client Authentication Service
 * Communicates with QualifyAI Backend API Gateway with Supabase Auth integration.
 */
export const authService = {
  /**
   * Register a new user account with email and password
   */
  async signup({ name, email, password, organizationName = '', role = 'ORG_ADMIN' }) {
    try {
      // 1. Attempt signup through Backend API Gateway
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          fullName: name.trim(),
          organizationName: organizationName.trim(),
          role,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create account.')
      }

      // If backend returned a session with tokens, sync with Supabase client
      if (data.data?.session?.accessToken && data.data?.session?.refreshToken) {
        await supabase.auth.setSession({
          access_token: data.data.session.accessToken,
          refresh_token: data.data.session.refreshToken,
        })
      }

      return {
        success: true,
        user: data.data.user,
        session: data.data.session,
        message: data.data.message,
      }
    } catch (apiErr) {
      // Fallback directly to Supabase client if backend gateway is unavailable
      console.warn('[authService.signup] Backend API unreachable, falling back to direct Supabase auth:', apiErr.message)

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            role,
            organization_name: organizationName.trim(),
          },
        },
      })

      if (error) {
        return { success: false, error: error.message }
      }

      const authUser = data.user
      return {
        success: true,
        user: {
          id: authUser?.id,
          email: authUser?.email,
          fullName: name.trim(),
          role,
        },
        session: data.session,
        message: data.session ? 'Account created successfully.' : 'Please check your email to verify your account.',
      }
    }
  },

  /**
   * Sign in an existing user with email and password
   */
  async login({ email, password }) {
    try {
      // 1. First authenticate with Supabase Auth to establish client-side persistent session
      const { data: supaData, error: supaError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (supaError) {
        throw new Error(supaError.message)
      }

      const session = supaData.session
      const authUser = supaData.user

      // 2. Fetch full profile and tenant data from Backend API Gateway
      let profileData = null
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })
        if (res.ok) {
          const json = await res.json()
          profileData = json.data
        }
      } catch (profileErr) {
        console.warn('[authService.login] Could not reach /api/auth/me:', profileErr.message)
      }

      const user = {
        id: authUser.id,
        email: authUser.email,
        fullName:
          profileData?.fullName ||
          authUser.user_metadata?.full_name ||
          authUser.email?.split('@')[0],
        role: profileData?.role || authUser.user_metadata?.role || 'ORG_ADMIN',
        organization: profileData?.organization || {
          id: 'org_primary',
          name: `${authUser.user_metadata?.full_name || 'My'}'s Organization`,
        },
        profile: profileData?.profile || null,
        token: session.access_token,
      }

      return {
        success: true,
        user,
        session,
      }
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Invalid email or password.',
      }
    }
  },

  /**
   * Request password reset email
   */
  async forgotPassword(email) {
    try {
      const cleanEmail = email.trim().toLowerCase()

      // Primary: Call Backend API
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          redirectTo: `${window.location.origin}/auth?mode=reset-password`,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        return { success: true, message: data.message }
      }

      // Fallback: Direct Supabase client
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth?mode=reset-password`,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return {
        success: true,
        message: 'Password reset link sent! Please check your email inbox.',
      }
    } catch (err) {
      // Fallback
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth?mode=reset-password`,
      })
      if (error) return { success: false, error: error.message }
      return {
        success: true,
        message: 'Password reset link sent! Please check your email inbox.',
      }
    }
  },

  /**
   * Update password (called during password recovery)
   */
  async resetPassword(newPassword) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return {
        success: true,
        user: data.user,
        message: 'Your password has been successfully updated. You can now sign in.',
      }
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to update password.',
      }
    }
  },

  /**
   * Initiate Google OAuth sign in (ready for Google credentials)
   */
  async signInWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (error) throw error
      return { success: true, data }
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Google OAuth failed to initialize.',
      }
    }
  },

  /**
   * Sign out current user
   */
  async logout() {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('Supabase sign out error:', err)
    }
    return { success: true }
  },

  /**
   * Get currently active session from Supabase
   */
  async getSession() {
    const { data } = await supabase.auth.getSession()
    return data.session
  },
}

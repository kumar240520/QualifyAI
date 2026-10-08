import { supabase, createUserScopedClient, getServiceSupabaseClient } from '../integrations/supabaseClient.js'
import { config } from '../config/env.js'

/**
 * Auth Domain Service
 * Encapsulates all identity, organization provisioning, and session resolution.
 */
class AuthService {
  /**
   * Register a new user with Supabase Auth and provision their profile + organization.
   */
  async signUpUser({ email, password, fullName, organizationName = '', role = 'ORG_ADMIN' }) {
    const cleanEmail = email.trim().toLowerCase()
    const cleanName = (fullName || cleanEmail.split('@')[0]).trim()
    const cleanOrgName = (organizationName || `${cleanName}'s Organization`).trim()

    // 1. Sign up user via Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          role,
          organization_name: cleanOrgName,
        },
      },
    })

    if (error) {
      throw new Error(error.message)
    }

    const authUser = data.user
    const session = data.session

    // If session is returned (email confirm disabled), resolve profile and organization
    let userDetails = null
    if (session?.access_token) {
      userDetails = await this.getUserProfileAndOrg(authUser.id, session.access_token)
    }

    return {
      user: {
        id: authUser.id,
        email: authUser.email,
        fullName: cleanName,
        role,
        isConfirmed: Boolean(authUser.confirmed_at || authUser.email_confirmed_at),
        ...userDetails,
      },
      session: session
        ? {
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at,
          }
        : null,
      message: session
        ? 'Account successfully created and session established.'
        : 'Account created! Please check your email to confirm your registration if required.',
    }
  }

  /**
   * Authenticate existing user with email and password.
   */
  async signInUser({ email, password }) {
    const cleanEmail = email.trim().toLowerCase()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    const { user: authUser, session } = data
    if (!session) {
      throw new Error('No session returned. Please verify your credentials or email confirmation.')
    }

    // Retrieve profile and organization membership
    const userDetails = await this.getUserProfileAndOrg(authUser.id, session.access_token)

    return {
      user: {
        id: authUser.id,
        email: authUser.email,
        fullName: userDetails?.profile?.full_name || authUser.user_metadata?.full_name || cleanEmail.split('@')[0],
        role: userDetails?.profile?.role || authUser.user_metadata?.role || 'RECRUITER',
        organization: userDetails?.organization || null,
        profile: userDetails?.profile || null,
      },
      session: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at,
      },
    }
  }

  /**
   * Request password reset instructions via email.
   */
  async requestPasswordReset({ email, redirectTo }) {
    const cleanEmail = email.trim().toLowerCase()

    const { data, error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectTo || `${config.clientUrl}/auth?mode=reset-password`,
    })

    if (error) {
      throw new Error(error.message)
    }

    return {
      success: true,
      message: 'Password reset instructions have been sent to your email address.',
    }
  }

  /**
   * Update password for an authenticated session or recovery token.
   */
  async resetPassword({ accessToken, newPassword }) {
    if (!accessToken) {
      throw new Error('Session token or recovery token is required.')
    }

    const userClient = createUserScopedClient(accessToken)
    const { data, error } = await userClient.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      throw new Error(error.message)
    }

    return {
      success: true,
      user: data.user,
      message: 'Password successfully updated. You may now sign in with your new password.',
    }
  }

  /**
   * Retrieve user profile and associated organization from PostgreSQL.
   */
  async getUserProfileAndOrg(userId, accessToken) {
    const client = accessToken ? createUserScopedClient(accessToken) : getServiceSupabaseClient()

    // 1. Fetch Profile
    const { data: profile } = await client
      .from('profiles')
      .select('id, email, full_name, role, created_at, phone, location, recruiter_role, onboarding_completed, is_submitted, onboarding_data')
      .eq('id', userId)
      .maybeSingle()

    // 2. Fetch Organization Membership
    const { data: memberships } = await client
      .from('organization_memberships')
      .select('id, role, organization_id, organizations ( id, name, slug, industry, company_size, website, target_roles, assessment_settings )')
      .eq('user_id', userId)
      .limit(1)

    const activeMembership = memberships?.[0]
    const org = activeMembership?.organizations

    return {
      profile: profile || null,
      isSubmitted: Boolean(profile?.is_submitted || profile?.onboarding_completed),
      onboardingCompleted: Boolean(profile?.onboarding_completed || profile?.is_submitted),
      organization: org
        ? {
            id: org.id,
            name: org.name,
            slug: org.slug,
            industry: org.industry,
            companySize: org.company_size,
            website: org.website,
            targetRoles: org.target_roles,
            assessmentSettings: org.assessment_settings,
            role: activeMembership.role,
          }
        : null,
    }
  }

  /**
   * Persist recruiter onboarding data to profiles and organizations
   */
  async updateOnboarding(userId, onboardingData = {}, userToken = null) {
    const client = userToken ? createUserScopedClient(userToken) : getServiceSupabaseClient()

    // 1. Update Profile
    const profileUpdates = {
      phone: onboardingData.phone || null,
      location: onboardingData.location || null,
      recruiter_role: onboardingData.recruiterRole || null,
      onboarding_completed: true,
      is_submitted: true,
      onboarding_data: onboardingData,
    }
    if (onboardingData.fullName) {
      profileUpdates.full_name = onboardingData.fullName
    }

    const { data: updatedProfile, error: profErr } = await client
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId)
      .select()
      .maybeSingle()

    if (profErr) {
      console.error('[updateOnboarding] Profile update error:', profErr.message)
      throw new Error(`Failed to update profile: ${profErr.message}`)
    }

    // 2. Update Organization if companyName or org fields provided
    const { data: membership } = await client
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (membership?.organization_id) {
      const orgUpdates = {
        name: onboardingData.companyName,
        industry: onboardingData.industry || null,
        company_size: onboardingData.companySize || null,
        website: onboardingData.website || null,
        target_roles: onboardingData.selectedRoles || [],
        assessment_settings: {
          rigorLevel: onboardingData.rigorLevel,
          proctoringLevel: onboardingData.proctoringLevel,
          interviewDuration: onboardingData.interviewDuration,
        },
      }

      const { error: orgErr } = await client
        .from('organizations')
        .update(orgUpdates)
        .eq('id', membership.organization_id)

      if (orgErr) {
        console.warn('[updateOnboarding] Organization update warning:', orgErr.message)
      }
    }

    return {
      profile: updatedProfile,
      isSubmitted: true,
      onboardingCompleted: true,
    }
  }
}

export const authService = new AuthService()

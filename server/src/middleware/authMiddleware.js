import { createUserScopedClient, supabase } from '../integrations/supabaseClient.js'
import { AuthenticationError, ForbiddenError } from '../utils/errors.js'

/**
 * Authentication Middleware:
 * 1. Extracts the Bearer token from the Authorization header.
 * 2. Validates the JWT with Supabase Auth (`getUser`).
 * 3. Retrieves the user's application profile from `public.profiles`.
 * 4. Binds `req.user`, `req.token`, and user-scoped Supabase client to `req.db`.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AuthenticationError('Authentication required. Missing or invalid Authorization header.'))
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      return next(new AuthenticationError('Authentication token missing.'))
    }

    // Verify token with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authData?.user) {
      return next(new AuthenticationError(authError?.message || 'Invalid or expired session token.'))
    }

    const authUser = authData.user
    const userClient = createUserScopedClient(token)

    // Retrieve profile from public.profiles
    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('id, email, full_name, role, is_submitted, onboarding_completed, created_at, updated_at')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileError) {
      console.error('[AuthMiddleware] Error fetching profile:', profileError)
    }

    // Attach user context to request
    req.token = token
    req.db = userClient
    req.user = {
      id: authUser.id,
      email: authUser.email,
      fullName: profile?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0],
      role: profile?.role || authUser.user_metadata?.role || 'ORG_ADMIN',
      isSubmitted: Boolean(profile?.is_submitted || profile?.onboarding_completed),
      onboardingCompleted: Boolean(profile?.onboarding_completed || profile?.is_submitted),
      profile: profile || null,
      metadata: authUser.user_metadata || {},
    }

    next()
  } catch (err) {
    console.error('[AuthMiddleware] Unexpected exception:', err)
    return next(err)
  }
}

/**
 * Role-Based Authorization Guard Middleware
 * @param {string[]} allowedRoles
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required.'))
    }

    const role = req.user.role || 'CANDIDATE'
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return next(
        new ForbiddenError(
          `Access restricted. Required role: ${allowedRoles.join(' or ')}. Your role: ${role}`
        )
      )
    }

    next()
  }
}

import { AuthenticationError, ForbiddenError } from '../utils/errors.js'

/**
 * Tenant Binding Middleware:
 * Inspects user's organization memberships and binds the active tenant context.
 * Strictly adheres to Rule 3 (Strict Multi-Tenant Isolation) and Document 5.
 */
export async function requireTenant(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return next(new AuthenticationError('User authentication required before tenant evaluation.'))
    }

    const db = req.db
    const requestedOrgId = req.headers['x-organization-id'] || req.query.organizationId

    // Query organization memberships for this user
    let query = db
      .from('organization_memberships')
      .select('id, organization_id, role, organizations ( id, name, slug )')
      .eq('user_id', req.user.id)

    if (requestedOrgId) {
      query = query.eq('organization_id', requestedOrgId)
    }

    const { data: memberships, error } = await query

    if (error) {
      console.error('[TenantMiddleware] Query error:', error)
      return next(new Error('Failed to verify organization context.'))
    }

    if (!memberships || memberships.length === 0) {
      return next(new ForbiddenError('User does not belong to any authorized organization.'))
    }

    const activeMembership = memberships[0]
    const org = activeMembership.organizations

    req.organizationId = activeMembership.organization_id
    req.membershipRole = activeMembership.role
    req.tenant = {
      organizationId: activeMembership.organization_id,
      name: org?.name || 'My Organization',
      slug: org?.slug || '',
      role: activeMembership.role,
    }
    req.organization = req.tenant

    next()
  } catch (err) {
    console.error('[TenantMiddleware] Unexpected exception:', err)
    return next(err)
  }
}

export const requireTenantContext = requireTenant

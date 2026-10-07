import { createClient } from '@supabase/supabase-js'
import { config } from '../config/env.js'

/**
 * Standard Supabase client (operates with Anon Key)
 * Persisting session is disabled for stateless API operations.
 */
export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

/**
 * Creates a tenant/user-scoped Supabase client that carries the caller's JWT token.
 * This guarantees that Supabase Row Level Security (RLS) policies evaluate auth.uid()
 * and tenant checks accurately.
 *
 * @param {string} accessToken - Bearer JWT from client request
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createUserScopedClient(accessToken) {
  if (!accessToken) return supabase

  return createClient(config.supabase.url, config.supabase.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

/**
 * Convenience alias for getting a user-scoped or anon client
 */
export function getSupabaseClient(accessToken) {
  return createUserScopedClient(accessToken)
}

/**
 * Returns service role client if configured, otherwise falls back to standard client
 */
export function getServiceSupabaseClient() {
  if (config.supabase.serviceRoleKey) {
    return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return supabase
}

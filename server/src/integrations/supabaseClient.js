import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import { config } from '../config/env.js'

const baseClientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  ...(typeof globalThis.WebSocket === 'undefined' ? { realtime: { transport: WebSocket } } : {}),
}

/**
 * Standard Supabase client (operates with Anon Key)
 * Persisting session is disabled for stateless API operations.
 */
export const supabase = createClient(config.supabase.url, config.supabase.anonKey, baseClientOptions)

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
    ...baseClientOptions,
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

let _serviceSupabaseClient = null

/**
 * Returns service role client if configured, otherwise falls back to standard client
 */
export function getServiceSupabaseClient() {
  if (_serviceSupabaseClient) return _serviceSupabaseClient

  if (config.supabase.serviceRoleKey) {
    _serviceSupabaseClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, baseClientOptions)
    return _serviceSupabaseClient
  }
  console.warn('[Supabase Warning] SUPABASE_SERVICE_ROLE_KEY is not configured; using standard client.')
  return supabase
}

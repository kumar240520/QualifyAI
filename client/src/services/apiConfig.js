/**
 * Canonical API Base URL resolver.
 * Handles trailing slashes, missing /api paths, and relative paths gracefully.
 */
export function getApiBaseUrl() {
  const raw = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '')
  // If the user specified a full domain without /api (e.g. https://server.vercel.app or https://server.vercel.app/),
  // automatically append /api so endpoints resolve correctly.
  if (raw.startsWith('http') && !raw.endsWith('/api')) {
    return `${raw}/api`
  }
  return raw || '/api'
}

export const API_BASE_URL = getApiBaseUrl()

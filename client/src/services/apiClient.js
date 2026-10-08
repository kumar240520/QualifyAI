import { supabase } from '../lib/supabase.js'
import { API_BASE_URL } from './apiConfig.js'

export async function getAuthHeaders() {
  let token = localStorage.getItem('qualifyai_token')
  if (!token) {
    try {
      const stored = localStorage.getItem('qualifyai_auth_session')
      if (stored) {
        token = JSON.parse(stored)?.token
      }
    } catch (e) {}
  }

  if (!token) {
    try {
      const { data } = await supabase.auth.getSession()
      token = data?.session?.access_token
    } catch (e) {}
  }

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function apiFetch(path, options = {}) {
  const authHeaders = await getAuthHeaders()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const targetPath = cleanPath.startsWith('/api') ? cleanPath.slice(4) : cleanPath
  const url = path.startsWith('http')
    ? path
    : `${API_BASE_URL}${targetPath}`

  const headers = {
    ...authHeaders,
    ...(options.headers || {}),
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

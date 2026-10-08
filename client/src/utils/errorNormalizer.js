/**
 * QualifyAI Enterprise Client Error Normalizer
 * 
 * Rules:
 * 1. Zero raw errors visible in the UI (no TypeError, 500, Postgres codes, Axios errors, stack traces).
 * 2. Convert all API and runtime exceptions into concise, human-readable, actionable feedback.
 * 3. Extract field-level errors dictionary for direct mapping to form input components.
 * 4. Never crash React components when error is an object (guarantee string message).
 */

const KNOWN_ERROR_MAPPINGS = [
  {
    pattern: /failed to fetch|networkerror|err_connection_refused|err_network|network error/i,
    code: 'NETWORK_ERROR',
    message: "We couldn't connect to the server. Please check your internet connection and try again.",
  },
  {
    pattern: /user already registered|already exists|duplicate key|23505/i,
    code: 'DUPLICATE_RESOURCE',
    message: 'An account or record with this information already exists.',
  },
  {
    pattern: /invalid login credentials|invalid email or password/i,
    code: 'AUTHENTICATION_ERROR',
    message: 'Email or password is incorrect.',
  },
  {
    pattern: /session.*expired|jwt expired|token.*expired|unauthorized|401/i,
    code: 'AUTHENTICATION_ERROR',
    message: 'Your session has expired. Please sign in again.',
  },
  {
    pattern: /permission denied|forbidden|not allowed|403/i,
    code: 'FORBIDDEN',
    message: "You don't have permission to perform this action.",
  },
  {
    pattern: /not found|404/i,
    code: 'NOT_FOUND',
    message: 'The requested resource was not found or is no longer available.',
  },
  {
    pattern: /rate limit|too many requests|429/i,
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please wait a moment before trying again.',
  },
  {
    pattern: /notallowederror|permission_denied.*audio|microphone/i,
    code: 'PERMISSION_DENIED',
    message: 'Microphone access is required. Please allow microphone access in your browser settings.',
  },
  {
    pattern: /websocket.*closed|1006|connection refused/i,
    code: 'WEBSOCKET_ERROR',
    message: 'Connection was interrupted. Attempting to restore connection...',
  },
  {
    pattern: /resource_exhausted|quota exceeded|gemini.*busy/i,
    code: 'AI_SERVICE_BUSY',
    message: 'The AI service is temporarily busy. Please try again shortly.',
  },
]

/**
 * Normalizes any error (Axios, Fetch, Supabase, Error instance, string, or object)
 * into a safe, structured, user-facing error contract.
 * 
 * @param {any} rawError
 * @param {string} [fallbackMessage]
 * @returns {{
 *   message: string,
 *   code: string,
 *   fields: Record<string, string>,
 *   isValidation: boolean,
 *   isDuplicate: boolean,
 *   isAuth: boolean,
 *   isNetwork: boolean,
 *   requestId: string | null
 * }}
 */
export function normalizeApiError(rawError, fallbackMessage = 'Something went wrong. Please try again.') {
  if (!rawError) {
    return {
      message: fallbackMessage,
      code: 'UNKNOWN_ERROR',
      fields: {},
      isValidation: false,
      isDuplicate: false,
      isAuth: false,
      isNetwork: false,
      requestId: null,
    }
  }

  // If already normalized
  if (rawError.__normalized) {
    return rawError
  }

  let code = 'UNKNOWN_ERROR'
  let message = ''
  let fields = {}
  let requestId = null

  // 1. Structured backend response: { success: false, error: { code, message, fields, requestId } }
  // or Axios/Fetch error wrapper: { data: { error: { ... } } } or { response: { data: { error: { ... } } } }
  const structuredError =
    rawError?.error ||
    rawError?.data?.error ||
    rawError?.response?.data?.error ||
    null

  if (structuredError && typeof structuredError === 'object') {
    code = structuredError.code || rawError.code || code
    message = structuredError.message || (typeof rawError.message === 'string' && rawError.message !== '[object Object]' ? rawError.message : '')
    fields = structuredError.fields && typeof structuredError.fields === 'object' ? { ...structuredError.fields } : {}
    requestId = structuredError.requestId || rawError.requestId || null
    if (structuredError.field && !fields[structuredError.field] && message) {
      fields[structuredError.field] = message
    }
  }
  // 2. Direct error object: { code, message, fields }
  else if (typeof rawError === 'object' && (rawError.code || rawError.fields || rawError.message)) {
    code = rawError.code || code
    message = typeof rawError.message === 'string' ? rawError.message : ''
    fields = rawError.fields && typeof rawError.fields === 'object' ? { ...rawError.fields } : {}
    requestId = rawError.requestId || null
    if (rawError.field && !fields[rawError.field] && message && message !== '[object Object]') {
      fields[rawError.field] = message
    }
  }
  // 3. Simple error string
  else if (typeof rawError === 'string') {
    message = rawError
  }
  // 4. Standard JS Error
  else if (rawError instanceof Error) {
    message = rawError.message || ''
  }

  // Recover message from fields if message was stringified to [object Object] or empty
  if ((!message || message === '[object Object]') && Object.keys(fields).length > 0) {
    message = Object.values(fields)[0]
  }

  // Check known patterns if message matches technical patterns or is missing
  for (const mapping of KNOWN_ERROR_MAPPINGS) {
    if (mapping.pattern.test(message) || mapping.pattern.test(code)) {
      code = mapping.code
      // Only replace if message looks like a raw technical error
      if (
        !message ||
        /TypeError|ReferenceError|500|Postgres|Supabase|AxiosError|constraint|foreign key|syntax/i.test(message)
      ) {
        message = mapping.message
      }
      break
    }
  }

  // Recognize duplicate candidate / email patterns
  if (
    code === 'DUPLICATE_RESOURCE' ||
    /already (registered|associated|invited|exists)|duplicate/i.test(message)
  ) {
    code = 'DUPLICATE_RESOURCE'
    if (!fields.email && /candidate|email|requisition|cohort|talent pool/i.test(message)) {
      fields.email = message
    }
  }

  // Mask remaining raw technical exceptions
  if (
    !message ||
    /TypeError|ReferenceError|SyntaxError|\[object Object\]|null pointer|undefined is not|internal server error|failed to fetch/i.test(
      message
    )
  ) {
    if (Object.keys(fields).length > 0) {
      message = Object.values(fields)[0]
    } else {
      message = fallbackMessage
    }
  }

  return {
    __normalized: true,
    message: String(message).trim(),
    code,
    fields,
    isValidation: code === 'VALIDATION_ERROR' || Object.keys(fields).length > 0,
    isDuplicate: code === 'DUPLICATE_RESOURCE',
    isAuth: code === 'AUTHENTICATION_ERROR',
    isNetwork: code === 'NETWORK_ERROR',
    requestId,
  }
}

/**
 * Safely extracts a field error message for a given field name
 * @param {any} normalizedError 
 * @param {string} fieldName 
 * @returns {string | null}
 */
export function getFieldError(normalizedError, fieldName) {
  if (!normalizedError || typeof normalizedError !== 'object') return null
  const fields = normalizedError.fields || {}
  return fields[fieldName] || null
}

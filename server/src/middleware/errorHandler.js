import crypto from 'crypto'
import { AppError } from '../utils/errors.js'

/**
 * Production-Grade Centralized Backend Error Handler Middleware
 * 
 * Enforces:
 * 1. Zero raw database or runtime exceptions leak to users.
 * 2. Request correlation ID propagation via X-Request-ID.
 * 3. Structured error taxonomy and standardized API response shape.
 * 4. Automatic translation of PostgreSQL (23505, 23503, 23514, 22P02) & Supabase Auth errors.
 */
export function errorHandler(err, req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID()
  res.setHeader('X-Request-ID', requestId)

  // Ensure CORS headers are preserved on all error responses
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  }

  // 1. Structured internal logging (Developers get detailed technical telemetry)
  const logPayload = {
    timestamp: new Date().toISOString(),
    requestId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id || null,
    ip: req.ip || req.headers['x-forwarded-for'] || null,
    errorName: err.name,
    errorCode: err.code,
    errorMessage: err.message,
    stack: err.stack ? err.stack.split('\n').slice(0, 5).join('\n') : undefined,
  }

  if (err.statusCode && err.statusCode < 500) {
    console.warn('[HTTP Client Error]', JSON.stringify(logPayload))
  } else {
    console.error('[HTTP Server Error]', JSON.stringify(logPayload))
  }

  // 2. Already formatted AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        fields: Object.keys(err.fields || {}).length > 0 ? err.fields : undefined,
        requestId,
      },
    })
  }

  // 3. PostgreSQL / Supabase Database Constraint Translations
  const rawMsg = String(err.message || '')
  const pgCode = err.code || err.sqlState || ''

  // 3a. Unique Constraint Violation (Code 23505)
  if (pgCode === '23505' || /duplicate key value violates unique constraint/i.test(rawMsg)) {
    let field = 'email'
    let message = 'A record with this information already exists.'

    if (/users_email_key|profiles_email_key|candidates.*email/i.test(rawMsg)) {
      field = 'email'
      message = 'An account with this email address already exists.'
    } else if (/uq_org_candidate_email/i.test(rawMsg)) {
      field = 'email'
      message = 'This candidate email is already registered in your organization talent pool.'
    } else if (/uq_job_candidate/i.test(rawMsg)) {
      field = 'email'
      message = 'This candidate email is already associated with this job requisition.'
    } else if (/organizations_slug_key|slug/i.test(rawMsg)) {
      field = 'organization'
      message = 'An organization with a similar name already exists.'
    } else if (/invitations.*token/i.test(rawMsg)) {
      field = 'token'
      message = 'An invitation with this token already exists.'
    }

    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_RESOURCE',
        message,
        field,
        fields: { [field]: message },
        requestId,
      },
    })
  }

  // 3b. Foreign Key Violation (Code 23503)
  if (pgCode === '23503' || /violates foreign key constraint/i.test(rawMsg)) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The selected requisition, candidate, or organization was not found or is no longer available.',
        requestId,
      },
    })
  }

  // 3c. Check Constraint Violation (Code 23514)
  if (pgCode === '23514' || /violates check constraint/i.test(rawMsg)) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted data contains values outside permissible ranges.',
        requestId,
      },
    })
  }

  // 3d. Invalid Data Type / UUID Syntax (Code 22P02)
  if (pgCode === '22P02' || /invalid input syntax for type uuid/i.test(rawMsg)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid resource identifier format.',
        requestId,
      },
    })
  }

  // 4. Supabase Auth Error Translations
  if (/User already registered/i.test(rawMsg)) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: 'An account with this email address already exists. Please sign in instead.',
        field: 'email',
        fields: { email: 'An account with this email address already exists.' },
        requestId,
      },
    })
  }

  if (/Invalid login credentials/i.test(rawMsg)) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Email or password is incorrect.',
        requestId,
      },
    })
  }

  if (/Email not confirmed/i.test(rawMsg)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'UNCONFIRMED_EMAIL',
        message: 'Please confirm your email address before signing in.',
        requestId,
      },
    })
  }

  if (/Password should be at least/i.test(rawMsg)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Password must be at least 6 characters long.',
        fields: { password: 'Password must be at least 6 characters long.' },
        requestId,
      },
    })
  }

  // 5. Malformed JSON Request Syntax
  if (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400) && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON request body.',
        requestId,
      },
    })
  }

  // 6. Generic/Fallback Unhandled Exception
  // If an error indicates a resource is not found or has status < 500
  let status = err.statusCode || err.status
  if (!status) {
    if (/not found|does not exist/i.test(rawMsg)) {
      status = 404
    } else if (/unauthorized|authentication required|invalid or expired session/i.test(rawMsg)) {
      status = 401
    } else if (/permission|forbidden|access restricted/i.test(rawMsg)) {
      status = 403
    } else {
      status = 500
    }
  }

  const safeMessage = status < 500
    ? err.message || 'The request could not be processed.'
    : 'Something went wrong on our side. Please try again.'

  let errorCode = err.code || 'INTERNAL_ERROR'
  if (status === 404) errorCode = 'NOT_FOUND'
  else if (status === 401) errorCode = 'AUTHENTICATION_ERROR'
  else if (status === 403) errorCode = 'FORBIDDEN'
  else if (status === 422) errorCode = 'VALIDATION_ERROR'
  else if (status === 400) errorCode = 'BAD_REQUEST'

  return res.status(status).json({
    success: false,
    error: {
      code: errorCode,
      message: safeMessage,
      requestId,
    },
  })
}

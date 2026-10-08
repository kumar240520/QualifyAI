/**
 * Standardized Application Error Hierarchy
 * Provides typed domain errors with error codes, HTTP status codes,
 * and structured field-level validation errors.
 */

export class AppError extends Error {
  constructor(message, {
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    fields = {},
    details = null,
  } = {}) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.fields = fields
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(fields = {}, message = 'Please correct the highlighted fields.') {
    super(message, {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      fields,
    })
  }
}

export class DuplicateResourceError extends AppError {
  constructor(field = null, message = 'A record with this information already exists.') {
    super(message, {
      statusCode: 409,
      code: 'DUPLICATE_RESOURCE',
      fields: field ? { [field]: message } : {},
    })
    this.field = field
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Email or password is incorrect.') {
    super(message, {
      statusCode: 401,
      code: 'AUTHENTICATION_ERROR',
    })
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to perform this action.") {
    super(message, {
      statusCode: 403,
      code: 'FORBIDDEN',
    })
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.') {
    super(message, {
      statusCode: 404,
      code: 'NOT_FOUND',
    })
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again shortly.', retryAfterSeconds = 60) {
    super(message, {
      statusCode: 429,
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds },
    })
    this.retryAfterSeconds = retryAfterSeconds
  }
}

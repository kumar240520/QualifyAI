import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateEmail,
  validatePassword,
  validateName,
  validateText,
  validateUUID,
  validateInteger,
  validateEnum,
  validateUrl,
  validateSignupPayload,
  validateLoginPayload,
  validateOnboardingPayload,
  validateCreateJobPayload,
  validateAddCandidatePayload,
  validateCreateInvitationPayload,
  validateAnswerSubmissionPayload,
  assertValid,
} from '../src/validators/index.js'
import {
  AppError,
  ValidationError,
  DuplicateResourceError,
  AuthenticationError,
  NotFoundError,
  ForbiddenError,
} from '../src/utils/errors.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

test('Validator Primitives: Email validation and normalization', () => {
  // Empty & whitespace
  assert.equal(validateEmail('').valid, false)
  assert.equal(validateEmail('   ').valid, false)
  assert.equal(validateEmail(null).valid, false)
  assert.equal(validateEmail(undefined).valid, false)

  // Invalid formats
  assert.equal(validateEmail('notanemail').valid, false)
  assert.equal(validateEmail('@domain.com').valid, false)
  assert.equal(validateEmail('test@').valid, false)
  assert.equal(validateEmail('test @domain.com').valid, false)

  // Valid formats and normalization
  assert.equal(validateEmail('TEST@Example.COM').value, 'test@example.com')
  assert.equal(validateEmail('   recruiter@qualifyai.com   ').value, 'recruiter@qualifyai.com')
})

test('Validator Primitives: Password rules', () => {
  assert.equal(validatePassword('').valid, false)
  assert.equal(validatePassword('   ').valid, false)
  assert.equal(validatePassword('12345').valid, false) // Under 6 characters
  assert.equal(validatePassword('validPassword123').valid, true)
})

test('Validator Primitives: Name and Text with whitespace rejection', () => {
  assert.equal(validateName('').valid, false)
  assert.equal(validateName('   ').valid, false)
  assert.equal(validateName('A').valid, false) // Under 2 chars
  assert.equal(validateName('  John   Doe  ').value, 'John Doe')

  assert.equal(validateText('   ', 'description', { min: 5 }).valid, false)
  assert.equal(validateText('Valid text content', 'description', { min: 5 }).value, 'Valid text content')
})

test('Validator Primitives: UUID and Integer bounds', () => {
  assert.equal(validateUUID('invalid-uuid').valid, false)
  assert.equal(validateUUID('123e4567-e89b-12d3-a456-426614174000').value, '123e4567-e89b-12d3-a456-426614174000')

  assert.equal(validateInteger('abc', 'duration').valid, false)
  assert.equal(validateInteger(-1, 'duration', { min: 1, max: 120 }).valid, false)
  assert.equal(validateInteger(150, 'duration', { min: 1, max: 120 }).valid, false)
  assert.equal(validateInteger(45, 'duration', { min: 1, max: 120 }).value, 45)
})

test('Domain Schema: validateSignupPayload authoritative rejection', () => {
  // Empty payload
  const emptyRes = validateSignupPayload({})
  assert.equal(emptyRes.valid, false)
  assert.ok(emptyRes.errors.email)
  assert.ok(emptyRes.errors.password)
  assert.ok(emptyRes.errors.fullName)

  // Whitespace-only fields
  const whitespaceRes = validateSignupPayload({
    fullName: '   ',
    email: '   ',
    password: '      ',
    confirmPassword: '      ',
  })
  assert.equal(whitespaceRes.valid, false)
  assert.ok(whitespaceRes.errors.email)
  assert.ok(whitespaceRes.errors.password)

  // Password mismatch
  const mismatchRes = validateSignupPayload({
    fullName: 'Valid Name',
    email: 'valid@example.com',
    password: 'password123',
    confirmPassword: 'different123',
  })
  assert.equal(mismatchRes.valid, false)
  assert.ok(mismatchRes.errors.confirmPassword)

  // Valid payload
  const validRes = validateSignupPayload({
    fullName: 'Jane Doe',
    email: 'Jane.Doe@QualifyAI.com',
    password: 'securePassword123',
    confirmPassword: 'securePassword123',
  })
  assert.equal(validRes.valid, true)
  assert.equal(validRes.data.email, 'jane.doe@qualifyai.com')
})

test('Domain Schema: validateCreateJobPayload', () => {
  // Missing required fields
  const invalidRes = validateCreateJobPayload({
    title: '  ',
    description: 'short',
  })
  assert.equal(invalidRes.valid, false)
  assert.ok(invalidRes.errors.title)
  assert.ok(invalidRes.errors.description)

  // Valid requisition
  const validRes = validateCreateJobPayload({
    title: 'Senior Distributed Systems Engineer',
    description: 'We are seeking a senior systems engineer to design high-throughput consensus protocols and distributed storage microservices.',
    department: 'Infrastructure',
    seniority: 'SENIOR',
  })
  assert.equal(validRes.valid, true)
  assert.equal(validRes.data.seniority, 'SENIOR')
})

test('Domain Schema: validateAddCandidatePayload', () => {
  const invalidRes = validateAddCandidatePayload({
    fullName: '   ',
    email: 'bad-email',
  })
  assert.equal(invalidRes.valid, false)
  assert.ok(invalidRes.errors.fullName)
  assert.ok(invalidRes.errors.email)

  const validRes = validateAddCandidatePayload({
    fullName: 'Sarah Connor',
    email: 'Sarah@Cyberdyne.com',
    phone: '+1 555-0199',
  })
  assert.equal(validRes.valid, true)
  assert.equal(validRes.data.email, 'sarah@cyberdyne.com')
})

test('assertValid helper throws typed ValidationError (422)', () => {
  assert.throws(
    () => {
      assertValid(validateLoginPayload({ email: 'invalid', password: '' }))
    },
    (err) => {
      assert.ok(err instanceof ValidationError)
      assert.equal(err.statusCode, 422)
      assert.equal(err.code, 'VALIDATION_ERROR')
      assert.ok(err.fields.email)
      assert.ok(err.fields.password)
      return true
    }
  )
})

test('Production Error Handler: Masks technical errors and translates Postgres constraints', () => {
  let responseStatus = 0
  let responseBody = null
  let headersSet = {}

  const mockReq = {
    method: 'POST',
    originalUrl: '/api/auth/signup',
    headers: { 'x-request-id': 'req-test-123' },
  }

  const mockRes = {
    setHeader: (k, v) => {
      headersSet[k] = v
    },
    status: (code) => {
      responseStatus = code
      return {
        json: (body) => {
          responseBody = body
        },
      }
    },
  }

  // 1. Postgres 23505 Duplicate Key Translation
  const pgDuplicateError = new Error('duplicate key value violates unique constraint "users_email_key"')
  pgDuplicateError.code = '23505'
  pgDuplicateError.detail = 'Key (email)=(recruiter@example.com) already exists.'

  errorHandler(pgDuplicateError, mockReq, mockRes, () => {})

  assert.equal(responseStatus, 409)
  assert.equal(responseBody.success, false)
  assert.equal(responseBody.error.code, 'DUPLICATE_RESOURCE')
  assert.equal(responseBody.error.message, 'An account with this email address already exists.')
  assert.equal(headersSet['X-Request-ID'], 'req-test-123')

  // 1b. Postgres 23505 uq_job_candidate Duplicate Key Translation
  const pgJobCandidateError = new Error('duplicate key value violates unique constraint "uq_job_candidate"')
  pgJobCandidateError.code = '23505'
  errorHandler(pgJobCandidateError, mockReq, mockRes, () => {})

  assert.equal(responseStatus, 409)
  assert.equal(responseBody.success, false)
  assert.equal(responseBody.error.code, 'DUPLICATE_RESOURCE')
  assert.equal(responseBody.error.field, 'email')
  assert.equal(responseBody.error.fields.email, 'This candidate email is already associated with this job requisition.')

  // 1c. Postgres 23505 uq_org_candidate_email Duplicate Key Translation
  const pgOrgCandidateError = new Error('duplicate key value violates unique constraint "uq_org_candidate_email"')
  pgOrgCandidateError.code = '23505'
  errorHandler(pgOrgCandidateError, mockReq, mockRes, () => {})

  assert.equal(responseStatus, 409)
  assert.equal(responseBody.success, false)
  assert.equal(responseBody.error.code, 'DUPLICATE_RESOURCE')
  assert.equal(responseBody.error.field, 'email')
  assert.equal(responseBody.error.fields.email, 'This candidate email is already registered in your organization talent pool.')

  // 2. Unhandled Internal Technical Error (500)
  const internalTypeError = new TypeError("Cannot read properties of undefined (reading 'token')")
  errorHandler(internalTypeError, mockReq, mockRes, () => {})

  assert.equal(responseStatus, 500)
  assert.equal(responseBody.success, false)
  assert.equal(responseBody.error.code, 'INTERNAL_ERROR')
  // CRITICAL: Raw stack trace or TypeError must NEVER leak to client!
  assert.equal(responseBody.error.message, 'Something went wrong on our side. Please try again.')
  assert.equal(responseBody.error.stack, undefined)
  assert.equal(responseBody.error.details, undefined)
})

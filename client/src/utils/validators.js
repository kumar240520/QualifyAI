/**
 * QualifyAI Enterprise Client Validation Rules
 * 
 * Guarantees:
 * 1. Single source of truth mirroring backend validation rules.
 * 2. Instant client-side feedback before network dispatch.
 * 3. Rejects empty, whitespace-only, and malformed inputs.
 * 4. Normalizes emails to lowercase and trims text.
 */

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,25}$/
const URL_REGEX = /^(https?:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i

export function validateEmail(email, fieldName = 'Email') {
  if (typeof email !== 'string' || !email.trim()) {
    return { valid: false, error: `${fieldName} is required.` }
  }
  const clean = email.trim().toLowerCase()
  if (clean.length > 255) {
    return { valid: false, error: `${fieldName} cannot exceed 255 characters.` }
  }
  if (!EMAIL_REGEX.test(clean)) {
    return { valid: false, error: `Please enter a valid email address.` }
  }
  return { valid: true, value: clean }
}

export function validatePassword(password, { min = 6, max = 128 } = {}) {
  if (typeof password !== 'string' || !password) {
    return { valid: false, error: 'Password is required.' }
  }
  if (password.length < min) {
    return { valid: false, error: `Password must be at least ${min} characters long.` }
  }
  if (password.length > max) {
    return { valid: false, error: `Password cannot exceed ${max} characters.` }
  }
  if (password.trim().length === 0) {
    return { valid: false, error: 'Password cannot consist solely of whitespace.' }
  }
  return { valid: true, value: password }
}

export function validateName(name, fieldName = 'Full name', { min = 2, max = 100 } = {}) {
  if (typeof name !== 'string' || !name.trim()) {
    return { valid: false, error: `${fieldName} is required.` }
  }
  const clean = name.trim().replace(/\s+/g, ' ')
  if (clean.length < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} characters long.` }
  }
  if (clean.length > max) {
    return { valid: false, error: `${fieldName} cannot exceed ${max} characters.` }
  }
  return { valid: true, value: clean }
}

export function validatePhone(phone, { required = false } = {}) {
  if (!phone || (typeof phone === 'string' && !phone.trim())) {
    if (required) return { valid: false, error: 'Phone number is required.' }
    return { valid: true, value: null }
  }
  const clean = String(phone).trim()
  const digits = (clean.match(/\d/g) || []).length
  if (digits < 7 || digits > 16 || !PHONE_REGEX.test(clean)) {
    return { valid: false, error: 'Please enter a valid phone number (e.g. +1 555-0199).' }
  }
  return { valid: true, value: clean }
}

export function validateUrl(url, fieldName = 'Website URL', { required = true } = {}) {
  if (!url || (typeof url === 'string' && !url.trim())) {
    if (required) return { valid: false, error: `${fieldName} is required.` }
    return { valid: true, value: null }
  }
  const clean = String(url).trim()
  if (!URL_REGEX.test(clean)) {
    return { valid: false, error: `Please enter a valid URL (e.g. https://company.com).` }
  }
  return { valid: true, value: clean }
}

export function validateText(text, fieldName, { min = 1, max = 5000, required = true } = {}) {
  if (!text || (typeof text === 'string' && !text.trim())) {
    if (required) return { valid: false, error: `${fieldName} is required.` }
    return { valid: true, value: '' }
  }
  const clean = String(text).trim()
  if (clean.length < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} characters long.` }
  }
  if (clean.length > max) {
    return { valid: false, error: `${fieldName} cannot exceed ${max} characters.` }
  }
  return { valid: true, value: clean }
}

/**
 * Validate Signup Form
 */
export function validateSignup({ fullName, email, password, confirmPassword, agreeToTerms = true }) {
  const errors = {}

  const nameRes = validateName(fullName, 'Full name', { min: 2, max: 100 })
  if (!nameRes.valid) errors.fullName = nameRes.error

  const emailRes = validateEmail(email)
  if (!emailRes.valid) errors.email = emailRes.error

  const passRes = validatePassword(password, { min: 6 })
  if (!passRes.valid) errors.password = passRes.error

  if (confirmPassword !== undefined) {
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.'
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.'
    }
  }

  if (agreeToTerms === false) {
    errors.terms = 'You must agree to the Terms of Service to continue.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validate Login Form
 */
export function validateLogin({ email, password }) {
  const errors = {}

  const emailRes = validateEmail(email)
  if (!emailRes.valid) errors.email = emailRes.error

  if (!password || typeof password !== 'string' || !password.trim()) {
    errors.password = 'Password is required.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validate Recruiter Onboarding Form
 */
export function validateRecruiterOnboarding({ fullName, companyName, website, selectedRoles, phone }) {
  const errors = {}

  const nameRes = validateName(fullName, 'Full name', { min: 2, max: 100 })
  if (!nameRes.valid) errors.fullName = nameRes.error

  const compRes = validateText(companyName, 'Company name', { min: 2, max: 150, required: true })
  if (!compRes.valid) errors.companyName = compRes.error

  const webRes = validateUrl(website, 'Company website', { required: true })
  if (!webRes.valid) errors.website = webRes.error

  if (!Array.isArray(selectedRoles) || selectedRoles.length === 0) {
    errors.selectedRoles = 'Please select at least one target role.'
  }

  if (phone) {
    const phoneRes = validatePhone(phone, { required: false })
    if (!phoneRes.valid) errors.phone = phoneRes.error
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validate Job Requisition Form
 */
export function validateJobCreation({ title, description, department, seniority }) {
  const errors = {}

  const titleRes = validateText(title, 'Job title', { min: 3, max: 200, required: true })
  if (!titleRes.valid) errors.title = titleRes.error

  const descRes = validateText(description, 'Job description', { min: 20, max: 50000, required: true })
  if (!descRes.valid) errors.description = descRes.error

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

/**
 * Validate Add Candidate Form
 */
export function validateAddCandidate({ fullName, email, phone }) {
  const errors = {}

  const nameRes = validateName(fullName, 'Candidate full name', { min: 2, max: 100 })
  if (!nameRes.valid) errors.fullName = nameRes.error

  const emailRes = validateEmail(email, 'Candidate email')
  if (!emailRes.valid) errors.email = emailRes.error

  if (phone) {
    const phoneRes = validatePhone(phone, { required: false })
    if (!phoneRes.valid) errors.phone = phoneRes.error
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

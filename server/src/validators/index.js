import { ValidationError } from '../utils/errors.js'

/**
 * Enterprise Single Source of Truth for Validation Rules & Sanitization
 * Enforces strict typing, length boundaries, format regexes, and normalization.
 */

// RFC 5322 Compliant Email Regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

// UUID v4 Regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Permissible phone format: optional leading '+', digits, spaces, hyphens, parens. Min 7 digits, max 25 chars.
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,25}$/

// Standard Web URL or Domain pattern
const URL_REGEX = /^(https?:\/\/)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i

// Allowed Seniority Levels
export const SENIORITY_LEVELS = ['JUNIOR', 'MID', 'SENIOR', 'STAFF', 'LEAD']

// Allowed Foundational Background Types (Strictly Two: TECHNICAL and NON_TECHNICAL)
export const BACKGROUND_TYPES = [
  'TECHNICAL',
  'NON_TECHNICAL',
]

// Allowed Question Types (15 Canonical Enterprise Formats + Specification Identifiers + Legacy Aliases)
export const QUESTION_TYPES = [
  'MULTIPLE_CHOICE',
  'MULTI_SELECT',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'DESCRIPTIVE',
  'FILL_IN_THE_BLANK',
  'CODING_CHALLENGE',
  'PREDICT_CODE_OUTPUT',
  'DEBUGGING',
  'COMPLETE_THE_CODE',
  'ARRANGE_ORDER',
  'SELECT_MOST_APPROPRIATE',
  'SLIDER_SCALE',
  'MATCHING_PAIRS',
  'NUMERICAL_APTITUDE',
  // Canonical Specification Key Aliases (lowercase & uppercase)
  'single_select',
  'multi_select',
  'true_false',
  'short_answer',
  'descriptive',
  'fill_blank',
  'coding_challenge',
  'predict_output',
  'debugging',
  'complete_code',
  'ordering',
  'best_option',
  'slider',
  'matching',
  'numerical',
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'FILL_BLANK',
  'PREDICT_OUTPUT',
  'COMPLETE_CODE',
  'ORDERING',
  'BEST_OPTION',
  'SLIDER',
  'MATCHING',
  'NUMERICAL',
  // Legacy & Compatibility Aliases
  'TECHNICAL',
  'SYSTEM_DESIGN',
  'PROBLEM_SOLVING',
  'BEHAVIORAL',
  'CODE_OUTPUT',
  'CODE_WRITING',
  'SQL',
  'SCENARIO',
  'SINGLE_CHOICE',
  'YES_NO',
]

// Allowed Difficulties
export const DIFFICULTY_LEVELS = ['EASY', 'MEDIUM', 'HARD']

// Allowed User Roles
export const USER_ROLES = ['ORG_ADMIN', 'RECRUITER', 'REVIEWER', 'CANDIDATE']

// ==============================================================================
// 1. Primitive Field Validators & Normalizers
// ==============================================================================

export function validateEmail(email, fieldName = 'email') {
  if (typeof email !== 'string' || !email.trim()) {
    return { valid: false, error: 'Email address is required.' }
  }
  const normalized = email.trim().toLowerCase()
  if (normalized.length > 255) {
    return { valid: false, error: 'Email address cannot exceed 255 characters.' }
  }
  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, error: 'Please enter a valid email address.' }
  }
  return { valid: true, value: normalized }
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

export function validateName(name, fieldName = 'fullName', { min = 2, max = 100 } = {}) {
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
  const digitCount = (clean.match(/\d/g) || []).length
  if (digitCount < 7 || digitCount > 16 || !PHONE_REGEX.test(clean)) {
    return { valid: false, error: 'Please enter a valid phone number (e.g. +1 555-0199).' }
  }
  return { valid: true, value: clean }
}

export function validateUrl(url, fieldName = 'website', { required = false } = {}) {
  if (!url || (typeof url === 'string' && !url.trim())) {
    if (required) return { valid: false, error: `${fieldName} is required.` }
    return { valid: true, value: null }
  }
  let clean = String(url).trim()
  if (!URL_REGEX.test(clean)) {
    return { valid: false, error: `Please enter a valid URL or domain (e.g. https://company.com).` }
  }
  if (!/^https?:\/\//i.test(clean)) {
    clean = `https://${clean}`
  }
  return { valid: true, value: clean }
}

export function validateUUID(id, fieldName = 'id') {
  if (typeof id !== 'string' || !id.trim()) {
    return { valid: false, error: `${fieldName} is required.` }
  }
  const clean = id.trim()
  if (!UUID_REGEX.test(clean)) {
    return { valid: false, error: `${fieldName} must be a valid UUID.` }
  }
  return { valid: true, value: clean }
}

export function validateText(text, fieldName, { min = 1, max = 10000, required = true } = {}) {
  if (text == null || (typeof text === 'string' && !text.trim())) {
    if (required) return { valid: false, error: `${fieldName} is required.` }
    return { valid: true, value: '' }
  }
  if (typeof text !== 'string') {
    return { valid: false, error: `${fieldName} must be text.` }
  }
  const clean = text.trim()
  if (clean.length < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} characters.` }
  }
  if (clean.length > max) {
    return { valid: false, error: `${fieldName} cannot exceed ${max} characters.` }
  }
  return { valid: true, value: clean }
}

export function validateInteger(val, fieldName, { min = 0, max = Number.MAX_SAFE_INTEGER, required = true, defaultValue = undefined } = {}) {
  if (val == null || val === '') {
    if (required) return { valid: false, error: `${fieldName} is required.` }
    return { valid: true, value: defaultValue }
  }
  const num = Number(val)
  if (!Number.isInteger(num)) {
    return { valid: false, error: `${fieldName} must be an integer.` }
  }
  if (num < min || num > max) {
    return { valid: false, error: `${fieldName} must be between ${min} and ${max}.` }
  }
  return { valid: true, value: num }
}

export function validateEnum(val, allowedValues, fieldName, { defaultValue = undefined } = {}) {
  if (!val) {
    if (defaultValue !== undefined) return { valid: true, value: defaultValue }
    return { valid: false, error: `${fieldName} is required.` }
  }
  const upper = String(val).trim().toUpperCase()
  if (!allowedValues.includes(upper)) {
    return { valid: false, error: `${fieldName} must be one of: ${allowedValues.join(', ')}.` }
  }
  return { valid: true, value: upper }
}

// ==============================================================================
// 2. Composite Domain Schemas
// ==============================================================================

/**
 * Validate Signup Request
 */
export function validateSignupPayload(body) {
  const errors = {}
  const data = {}

  const emailRes = validateEmail(body?.email)
  if (!emailRes.valid) errors.email = emailRes.error
  else data.email = emailRes.value

  const passRes = validatePassword(body?.password, { min: 6 })
  if (!passRes.valid) errors.password = passRes.error
  else data.password = passRes.value

  const nameRes = validateName(body?.fullName || body?.name, 'Full name', { min: 2, max: 100 })
  if (!nameRes.valid) errors.fullName = nameRes.error
  else data.fullName = nameRes.value

  const roleRes = validateEnum(body?.role || 'ORG_ADMIN', USER_ROLES, 'Role', { defaultValue: 'ORG_ADMIN' })
  if (!roleRes.valid) errors.role = roleRes.error
  else data.role = roleRes.value

  if (body?.organizationName) {
    const orgRes = validateText(body.organizationName, 'Organization name', { min: 2, max: 150, required: false })
    data.organizationName = orgRes.value || ''
  } else {
    data.organizationName = ''
  }

  if (body?.confirmPassword !== undefined && body.confirmPassword !== body.password) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  }
}

/**
 * Validate Login Request
 */
export function validateLoginPayload(body) {
  const errors = {}
  const data = {}

  const emailRes = validateEmail(body?.email)
  if (!emailRes.valid) errors.email = emailRes.error
  else data.email = emailRes.value

  if (!body?.password || typeof body.password !== 'string' || !body.password) {
    errors.password = 'Password is required.'
  } else {
    data.password = body.password
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  }
}

/**
 * Validate Recruiter Onboarding Payload
 */
export function validateOnboardingPayload(body) {
  const errors = {}
  const data = {}

  // Full name
  const rawName = body?.fullName || body?.name || 'Recruiter'
  const nameRes = validateName(rawName, 'Full name', { min: 2, max: 100 })
  if (!nameRes.valid) errors.fullName = nameRes.error
  else data.fullName = nameRes.value

  // Company Name
  const rawCompany = body?.companyName || body?.organizationName || `${data.fullName || 'Recruiter'}'s Organization`
  const compRes = validateText(rawCompany, 'Company name', { min: 2, max: 150, required: true })
  if (!compRes.valid) errors.companyName = compRes.error
  else data.companyName = compRes.value

  // Website / Domain
  const cleanCompanySlug = String(data.companyName || 'company').toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'
  const rawWebsite = body?.website || `https://${cleanCompanySlug}.com`
  const webRes = validateUrl(rawWebsite, 'Company website', { required: false })
  if (!webRes.valid) errors.website = webRes.error
  else data.website = webRes.value || `https://${cleanCompanySlug}.com`

  // Selected Roles (at least 1 required)
  if (!Array.isArray(body?.selectedRoles) || body.selectedRoles.length === 0) {
    data.selectedRoles = ['Software Engineer']
  } else {
    data.selectedRoles = body.selectedRoles.map((r) => String(r).trim()).filter(Boolean)
  }

  // Recruiter Role / Title
  const roleRes = validateText(body?.recruiterRole, 'Recruiter role', { min: 2, max: 100, required: false })
  data.recruiterRole = roleRes.value || 'Technical Talent Acquisition Lead'

  // Phone (optional)
  const phoneRes = validatePhone(body?.phone, { required: false })
  if (!phoneRes.valid) errors.phone = phoneRes.error
  else data.phone = phoneRes.value

  // Location (optional)
  const locRes = validateText(body?.location, 'Location', { min: 2, max: 150, required: false })
  data.location = locRes.value || null

  // Industry & Company Size
  data.industry = body?.industry ? String(body.industry).trim() : null
  data.companySize = body?.companySize ? String(body.companySize).trim() : null

  // Rigor & Proctoring Settings
  data.rigorLevel = body?.rigorLevel || 'Rigorous Senior Probing'
  data.proctoringLevel = body?.proctoringLevel || 'High Rigor (Tab Switch + Real-Time Telemetry)'
  data.interviewDuration = body?.interviewDuration || '20 Minutes'

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  }
}

/**
 * Validate Job Requisition Creation Payload
 */
export function validateCreateJobPayload(body) {
  const errors = {}
  const data = {}

  // Job Title
  const titleRes = validateText(body?.title, 'Job title', { min: 3, max: 200, required: true })
  if (!titleRes.valid) errors.title = titleRes.error
  else data.title = titleRes.value

  // Description (JD)
  const descRes = validateText(body?.description, 'Job description', { min: 20, max: 50000, required: true })
  if (!descRes.valid) errors.description = descRes.error
  else data.description = descRes.value

  // Department
  const deptRes = validateText(body?.department, 'Department', { min: 2, max: 100, required: false })
  data.department = deptRes.value || 'Engineering'

  // Seniority
  const senRes = validateEnum(body?.seniority || 'MID', SENIORITY_LEVELS, 'Seniority level', { defaultValue: 'MID' })
  if (!senRes.valid) errors.seniority = senRes.error
  else data.seniority = senRes.value

  // Foundational Background Type (strictly TECHNICAL or NON_TECHNICAL)
  const rawBg = body?.background_type || body?.backgroundType || 'TECHNICAL'
  const normalizedBg = String(rawBg).trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (['NON_TECHNICAL', 'NONTECHNICAL', 'BUSINESS_DEVELOPMENT', 'MARKETING', 'CUSTOM'].includes(normalizedBg)) {
    data.background_type = 'NON_TECHNICAL'
  } else if (normalizedBg === 'TECHNICAL') {
    data.background_type = 'TECHNICAL'
  } else {
    const bgRes = validateEnum(rawBg, BACKGROUND_TYPES, 'Background type', { defaultValue: 'TECHNICAL' })
    if (!bgRes.valid) {
      errors.background_type = bgRes.error
    } else {
      data.background_type = bgRes.value
    }
  }
  data.custom_background = null

  // Allowed Question Types
  const rawAllowedTypes = body?.allowed_question_types || body?.allowedQuestionTypes
  if (rawAllowedTypes !== undefined) {
    if (!Array.isArray(rawAllowedTypes) || rawAllowedTypes.length === 0) {
      errors.allowed_question_types = 'At least one allowed question type must be selected.'
    } else {
      const sanitized = rawAllowedTypes
        .map((t) => String(t).trim())
        .filter((t) => QUESTION_TYPES.includes(t) || QUESTION_TYPES.includes(t.toUpperCase()) || QUESTION_TYPES.includes(t.toLowerCase()))
      if (sanitized.length === 0) {
        errors.allowed_question_types = 'At least one valid question type must be selected.'
      } else {
        data.allowed_question_types = [...new Set(sanitized)]
      }
    }
  } else {
    data.allowed_question_types = ['SHORT_ANSWER', 'DESCRIPTIVE', 'MULTIPLE_CHOICE', 'SCENARIO']
  }

  // Custom Question Options / Types (Addition 1)
  const rawCustomTypes = body?.custom_question_types || body?.customQuestionTypes
  if (Array.isArray(rawCustomTypes)) {
    const validCustom = rawCustomTypes
      .map((t) => String(t).trim())
      .filter((t) => t.length >= 2 && t.length <= 60)
    data.custom_question_types = [...new Set(validCustom)]
  } else {
    data.custom_question_types = []
  }

  // Ask About Projects / Relevant Experience
  const rawProjects = body?.ask_about_projects ?? body?.askAboutProjects
  if (rawProjects !== undefined) {
    data.ask_about_projects = Boolean(rawProjects)
  } else {
    data.ask_about_projects = data.background_type === 'TECHNICAL'
  }

  // Opening Question (Optional customizable first question)
  const rawOpening = body?.opening_question || body?.openingQuestion
  if (rawOpening) {
    const openingRes = validateText(rawOpening, 'Opening question', { min: 5, max: 2000, required: false })
    if (!openingRes.valid) errors.opening_question = openingRes.error
    else data.opening_question = openingRes.value
  } else {
    data.opening_question = null
  }

  // Target Difficulty
  const diffRes = validateEnum(body?.target_difficulty || body?.targetDifficulty || 'MEDIUM', DIFFICULTY_LEVELS, 'Target difficulty', { defaultValue: 'MEDIUM' })
  if (!diffRes.valid) errors.target_difficulty = diffRes.error
  else data.target_difficulty = diffRes.value

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  }
}

/**
 * Validate Job Requisition Update Payload
 */
export function validateUpdateJobPayload(body) {
  const errors = {}
  const data = {}

  if (body?.title !== undefined) {
    const titleRes = validateText(body.title, 'Job title', { min: 3, max: 200, required: true })
    if (!titleRes.valid) errors.title = titleRes.error
    else data.title = titleRes.value
  }

  if (body?.description !== undefined) {
    const descRes = validateText(body.description, 'Job description', { min: 20, max: 50000, required: true })
    if (!descRes.valid) errors.description = descRes.error
    else data.description = descRes.value
  }

  if (body?.department !== undefined) {
    const deptRes = validateText(body.department, 'Department', { min: 2, max: 100, required: false })
    data.department = deptRes.value || 'Engineering'
  }

  if (body?.seniority !== undefined) {
    const senRes = validateEnum(body.seniority, SENIORITY_LEVELS, 'Seniority level', { defaultValue: 'MID' })
    if (!senRes.valid) errors.seniority = senRes.error
    else data.seniority = senRes.value
  }

  if (body?.background_type !== undefined || body?.backgroundType !== undefined) {
    const rawBg = body.background_type || body.backgroundType
    const normalizedBg = String(rawBg).trim().toUpperCase().replace(/[\s-]+/g, '_')
    if (['NON_TECHNICAL', 'NONTECHNICAL', 'BUSINESS_DEVELOPMENT', 'MARKETING', 'CUSTOM'].includes(normalizedBg)) {
      data.background_type = 'NON_TECHNICAL'
    } else if (normalizedBg === 'TECHNICAL') {
      data.background_type = 'TECHNICAL'
    } else {
      const bgRes = validateEnum(rawBg, BACKGROUND_TYPES, 'Background type')
      if (!bgRes.valid) errors.background_type = bgRes.error
      else data.background_type = bgRes.value
    }
    data.custom_background = null
  }

  const rawAllowed = body?.allowed_question_types ?? body?.allowedQuestionTypes
  if (rawAllowed !== undefined) {
    if (!Array.isArray(rawAllowed) || rawAllowed.length === 0) {
      errors.allowed_question_types = 'At least one allowed question type must be selected.'
    } else {
      const sanitized = rawAllowed
        .map((t) => String(t).trim())
        .filter((t) => QUESTION_TYPES.includes(t) || QUESTION_TYPES.includes(t.toUpperCase()) || QUESTION_TYPES.includes(t.toLowerCase()))
      if (sanitized.length === 0) {
        errors.allowed_question_types = 'At least one valid question type must be selected.'
      } else {
        data.allowed_question_types = [...new Set(sanitized)]
      }
    }
  }

  const rawCustomQ = body?.custom_question_types ?? body?.customQuestionTypes
  if (rawCustomQ !== undefined) {
    if (Array.isArray(rawCustomQ)) {
      const validCustom = rawCustomQ
        .map((t) => String(t).trim())
        .filter((t) => t.length >= 2 && t.length <= 60)
      data.custom_question_types = [...new Set(validCustom)]
    } else {
      data.custom_question_types = []
    }
  }

  const rawProjects = body?.ask_about_projects ?? body?.askAboutProjects
  if (rawProjects !== undefined) {
    data.ask_about_projects = Boolean(rawProjects)
  }

  const rawOpening = body?.opening_question ?? body?.openingQuestion
  if (rawOpening !== undefined) {
    if (rawOpening === null || rawOpening === '') {
      data.opening_question = null
    } else {
      const openRes = validateText(rawOpening, 'Opening question', { min: 5, max: 2000, required: false })
      if (!openRes.valid) errors.opening_question = openRes.error
      else data.opening_question = openRes.value
    }
  }

  const rawDiff = body?.target_difficulty ?? body?.targetDifficulty
  if (rawDiff !== undefined) {
    const diffRes = validateEnum(rawDiff, DIFFICULTY_LEVELS, 'Target difficulty')
    if (!diffRes.valid) errors.target_difficulty = diffRes.error
    else data.target_difficulty = diffRes.value
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  }
}

/**
 * Validate Add Candidate to Cohort Payload
 */
export function validateAddCandidatePayload(body) {
  const errors = {}
  const data = {}

  // Full Name
  const nameRes = validateName(body?.fullName, 'Candidate full name', { min: 2, max: 100 })
  if (!nameRes.valid) errors.fullName = nameRes.error
  else data.fullName = nameRes.value

  // Email
  const emailRes = validateEmail(body?.email, 'Candidate email')
  if (!emailRes.valid) errors.email = emailRes.error
  else data.email = emailRes.value

  // Phone (optional)
  const phoneRes = validatePhone(body?.phone, { required: false })
  if (!phoneRes.valid) errors.phone = phoneRes.error
  else data.phone = phoneRes.value

  // Resume URL (optional)
  if (body?.resumeUrl) {
    const urlRes = validateUrl(body.resumeUrl, 'Resume URL', { required: false })
    if (!urlRes.valid) errors.resumeUrl = urlRes.error
    else data.resumeUrl = urlRes.value
  } else {
    data.resumeUrl = null
  }

  data.experienceYears = body?.experienceYears ? String(body.experienceYears).trim() : null
  data.specialization = body?.specialization ? String(body.specialization).trim() : null
  data.recentCompany = body?.recentCompany ? String(body.recentCompany).trim() : null

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  }
}

/**
 * Validate Create Invitation Link Payload
 */
export function validateCreateInvitationPayload(body) {
  const errors = {}
  const data = {}

  // Candidate ID UUID
  const candRes = validateUUID(body?.candidateId, 'Candidate ID')
  if (!candRes.valid) errors.candidateId = candRes.error
  else data.candidateId = candRes.value

  // Duration: 5 to 180 minutes
  const durRes = validateInteger(body?.interviewDurationMinutes, 'Interview duration', {
    min: 5,
    max: 180,
    required: false,
    defaultValue: 30,
  })
  if (!durRes.valid) errors.interviewDurationMinutes = durRes.error
  else data.interviewDurationMinutes = durRes.value

  // Expiration: 1 to 90 days
  const expRes = validateInteger(body?.expiresInDays, 'Expiration days', {
    min: 1,
    max: 90,
    required: false,
    defaultValue: 7,
  })
  if (!expRes.valid) errors.expiresInDays = expRes.error
  else data.expiresInDays = expRes.value

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  }
}

/**
 * Validate Custom Question Creation Payload
 */
export function validateCreateQuestionPayload(body) {
  const errors = {}
  const data = {}

  const textRes = validateText(body?.question_text || body?.questionText, 'Question text', {
    min: 10,
    max: 2000,
    required: true,
  })
  if (!textRes.valid) errors.question_text = textRes.error
  else data.question_text = textRes.value

  const typeRes = validateEnum(body?.type || 'TECHNICAL', QUESTION_TYPES, 'Question type', { defaultValue: 'TECHNICAL' })
  if (!typeRes.valid) errors.type = typeRes.error
  else data.type = typeRes.value

  const diffRes = validateEnum(body?.difficulty || 'MEDIUM', DIFFICULTY_LEVELS, 'Difficulty', { defaultValue: 'MEDIUM' })
  if (!diffRes.valid) errors.difficulty = diffRes.error
  else data.difficulty = diffRes.value

  data.metadata = (body?.metadata && typeof body.metadata === 'object') ? body.metadata : {}

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  }
}

/**
 * Validate Candidate Answer Submission Payload
 */
export function validateAnswerSubmissionPayload(body) {
  const errors = {}
  const data = {}

  const tokenRes = validateText(body?.token, 'Invitation token', { min: 10, max: 255, required: true })
  if (!tokenRes.valid) errors.token = tokenRes.error
  else data.token = tokenRes.value

  const structuredAnswer = body?.structuredAnswer || body?.payload || null
  let rawAnswer = body?.answerText

  if ((rawAnswer == null || String(rawAnswer).trim() === '') && structuredAnswer) {
    if (typeof structuredAnswer === 'string') {
      rawAnswer = structuredAnswer
    } else if (typeof structuredAnswer === 'object') {
      rawAnswer = structuredAnswer.text || structuredAnswer.label || (typeof structuredAnswer.numericValue === 'number' ? String(structuredAnswer.numericValue) : '') || JSON.stringify(structuredAnswer)
    }
  }

  const ansRes = validateText(rawAnswer, 'Candidate response', { min: 1, max: 12000, required: true })
  if (!ansRes.valid) errors.answerText = 'Please provide an answer before submitting.'
  else data.answerText = ansRes.value

  data.structuredAnswer = structuredAnswer
  data.questionId = body?.questionId ? String(body.questionId).trim() : null
  data.questionSequence = typeof body?.questionSequence === 'number' ? body.questionSequence : undefined
  data.inputMethod = body?.inputMethod ? String(body.inputMethod).trim() : 'text'

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data,
  }
}

/**
 * Throws a ValidationError if the validation result is invalid
 */
export function assertValid(validationResult, defaultMessage = 'Please correct the highlighted fields.') {
  if (!validationResult || !validationResult.valid) {
    const fields = validationResult?.errors || (validationResult?.error ? { input: validationResult.error } : {})
    const msg = validationResult?.error || defaultMessage
    throw new ValidationError(fields, msg)
  }
  return validationResult.data !== undefined ? validationResult.data : validationResult.value
}

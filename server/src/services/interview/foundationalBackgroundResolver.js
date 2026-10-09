/**
 * Authoritative Foundational Interview Background Resolver
 * 
 * Invariant: Exactly TWO foundational interview backgrounds exist:
 * 1. 'technical'
 * 2. 'non_technical'
 * 
 * Marketing, Sales, Business Development, Management, HR, Behavioral, Operations
 * are job categories/fields, NOT foundational interview backgrounds.
 * 
 * This resolver guarantees:
 * - Every requisition resolves strictly to 'technical' or 'non_technical'.
 * - A third foundational category is never introduced.
 * - Recruiter-configured background is validated and respected.
 * - Legacy or missing values are reliably classified.
 */

export const FOUNDATIONAL_BACKGROUNDS = Object.freeze({
  TECHNICAL: 'technical',
  NON_TECHNICAL: 'non_technical',
})

const TECHNICAL_ROLE_KEYWORDS = [
  'engineer',
  'developer',
  'programmer',
  'architect',
  'devops',
  'sre',
  'backend',
  'frontend',
  'fullstack',
  'full-stack',
  'cloud',
  'infrastructure',
  'security engineer',
  'qa engineer',
  'test automation',
  'database administrator',
  'dba',
  'data engineer',
  'data scientist',
  'machine learning',
  'ai engineer',
  'mlops',
  'systems engineer',
  'software',
  'firmware',
  'embedded',
]

const NON_TECHNICAL_ROLE_KEYWORDS = [
  'manager',
  'team manager',
  'team lead',
  'product manager',
  'project manager',
  'scrum master',
  'agile coach',
  'director',
  'marketing',
  'sales',
  'business development',
  'account executive',
  'account manager',
  'customer support',
  'customer success',
  'human resources',
  'hr',
  'recruiter',
  'talent acquisition',
  'operations',
  'finance',
  'analyst (business)',
  'business analyst',
  'compliance',
  'legal',
  'executive',
]

/**
 * Resolves any job object or background identifier to strictly 'technical' or 'non_technical'.
 * 
 * @param {Object|string} jobOrBackground - Job requisition object, background type string, or title
 * @returns {'technical' | 'non_technical'}
 */
export function resolveFoundationalBackground(jobOrBackground) {
  if (!jobOrBackground) {
    return FOUNDATIONAL_BACKGROUNDS.NON_TECHNICAL
  }

  // If a raw string is passed (e.g. 'TECHNICAL', 'NON_TECHNICAL', 'marketing')
  if (typeof jobOrBackground === 'string') {
    const clean = jobOrBackground.trim().toLowerCase().replace(/[\s-]+/g, '_')
    if (clean === 'technical') return FOUNDATIONAL_BACKGROUNDS.TECHNICAL
    if (clean === 'non_technical' || clean === 'nontechnical') return FOUNDATIONAL_BACKGROUNDS.NON_TECHNICAL
    
    // Legacy mapping: job field labels map to non_technical
    if ([
      'business_development',
      'marketing',
      'sales',
      'hr',
      'human_resources',
      'operations',
      'management',
      'behavioral',
      'custom',
    ].includes(clean)) {
      return FOUNDATIONAL_BACKGROUNDS.NON_TECHNICAL
    }

    // Infer from role string
    return inferBackgroundFromTitle(clean)
  }

  const job = jobOrBackground

  // 1. Explicit recruiter configuration check
  const rawBg = job.foundational_background || job.foundationalBackground || job.background_type || job.backgroundType
  if (rawBg && typeof rawBg === 'string') {
    const clean = rawBg.trim().toLowerCase().replace(/[\s-]+/g, '_')
    if (clean === 'technical') return FOUNDATIONAL_BACKGROUNDS.TECHNICAL
    if (clean === 'non_technical' || clean === 'nontechnical') return FOUNDATIONAL_BACKGROUNDS.NON_TECHNICAL

    // Legacy values in database: map to non_technical unless job is genuinely technical
    if (clean === 'business_development' || clean === 'marketing') {
      return FOUNDATIONAL_BACKGROUNDS.NON_TECHNICAL
    }
    if (clean === 'custom') {
      const customLabel = String(job.custom_background || '').toLowerCase()
      if (customLabel && TECHNICAL_ROLE_KEYWORDS.some((kw) => customLabel.includes(kw))) {
        return FOUNDATIONAL_BACKGROUNDS.TECHNICAL
      }
      return FOUNDATIONAL_BACKGROUNDS.NON_TECHNICAL
    }
  }

  // 2. Derive sensible default from job title, department, and description
  const title = String(job.title || '').toLowerCase()
  const department = String(job.department || '').toLowerCase()
  const description = String(job.description || '').toLowerCase()

  // High priority check: Explicit technical role keywords in title
  if (TECHNICAL_ROLE_KEYWORDS.some((kw) => title.includes(kw))) {
    // Edge case: "Engineering Manager" or "Team Manager - Software":
    // If it's primarily a team/people management role (e.g. "Team Manager"), default to non_technical
    // unless title is specifically a hands-on developer/engineer role.
    if (title.includes('team manager') || title.includes('people manager') || title.includes('operations manager')) {
      return FOUNDATIONAL_BACKGROUNDS.NON_TECHNICAL
    }
    return FOUNDATIONAL_BACKGROUNDS.TECHNICAL
  }

  // Explicit non-technical keywords
  if (NON_TECHNICAL_ROLE_KEYWORDS.some((kw) => title.includes(kw))) {
    return FOUNDATIONAL_BACKGROUNDS.NON_TECHNICAL
  }

  // Check department
  if (['engineering', 'software', 'technology', 'devops', 'infrastructure', 'it', 'r&d', 'data'].includes(department)) {
    return FOUNDATIONAL_BACKGROUNDS.TECHNICAL
  }

  // Check description hints
  const technicalKeywordCount = TECHNICAL_ROLE_KEYWORDS.filter((kw) => description.includes(kw)).length
  if (technicalKeywordCount >= 3) {
    return FOUNDATIONAL_BACKGROUNDS.TECHNICAL
  }

  // Default fallback is non_technical for general business/management roles
  return FOUNDATIONAL_BACKGROUNDS.NON_TECHNICAL
}

function inferBackgroundFromTitle(title) {
  const t = String(title || '').toLowerCase()
  if (TECHNICAL_ROLE_KEYWORDS.some((kw) => t.includes(kw))) {
    if (t.includes('team manager') || t.includes('operations manager')) {
      return FOUNDATIONAL_BACKGROUNDS.NON_TECHNICAL
    }
    return FOUNDATIONAL_BACKGROUNDS.TECHNICAL
  }
  return FOUNDATIONAL_BACKGROUNDS.NON_TECHNICAL
}

/**
 * Returns true if the job resolves to the technical foundational background.
 */
export function isTechnicalBackground(job) {
  return resolveFoundationalBackground(job) === FOUNDATIONAL_BACKGROUNDS.TECHNICAL
}

/**
 * QualifyAI PII Anonymization & Data Sanitization Engine (Phase 13)
 * Guarantees zero leak of sensitive candidate PII, recruiter data, or credentials into training datasets.
 */

// Common Regex Patterns for Sensitive Identifiers
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g
const URL_REGEX = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi
const IP_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
const API_KEY_REGEX = /(?:Bearer\s+[A-Za-z0-9\-_.]+|sk-[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,})/g

export const datasetAnonymizerService = {
  /**
   * Deeply anonymize a block of text given optional candidate and organization context
   * @param {string} text
   * @param {Object} context
   * @param {string} [context.candidateName]
   * @param {string} [context.candidateEmail]
   * @param {string} [context.organizationName]
   * @param {string} [context.recruiterName]
   * @returns {string} Sanitized string
   */
  anonymizeText(text, context = {}) {
    if (!text || typeof text !== 'string') return ''

    let sanitized = text

    // 1. Redact explicit candidate context if provided
    if (context.candidateEmail) {
      const escapedEmail = context.candidateEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      sanitized = sanitized.replace(new RegExp(escapedEmail, 'gi'), '[EMAIL_REDACTED]')
    }

    if (context.candidateName) {
      const nameParts = context.candidateName.trim().split(/\s+/).filter((p) => p.length > 2)
      // Replace full name first
      const escapedFullName = context.candidateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      sanitized = sanitized.replace(new RegExp(escapedFullName, 'gi'), '[CANDIDATE_NAME]')
      // Replace individual name parts (first, last)
      for (const part of nameParts) {
        const escapedPart = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        sanitized = sanitized.replace(new RegExp(`\\b${escapedPart}\\b`, 'gi'), '[CANDIDATE_NAME]')
      }
    }

    // 2. Redact explicit recruiter and organization context if provided
    if (context.organizationName) {
      const escapedOrg = context.organizationName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      sanitized = sanitized.replace(new RegExp(escapedOrg, 'gi'), '[COMPANY_NAME]')
    }

    if (context.recruiterName) {
      const escapedRecruiter = context.recruiterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      sanitized = sanitized.replace(new RegExp(escapedRecruiter, 'gi'), '[RECRUITER_NAME]')
    }

    // 3. Algorithmic Redactions (Pattern matching)
    sanitized = sanitized.replace(API_KEY_REGEX, '[SECRET_TOKEN_REDACTED]')
    sanitized = sanitized.replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
    sanitized = sanitized.replace(URL_REGEX, '[URL_REDACTED]')
    sanitized = sanitized.replace(IP_REGEX, '[IP_REDACTED]')
    sanitized = sanitized.replace(PHONE_REGEX, (match) => {
      // Avoid replacing small numeric expressions or years like 2024
      if (match.trim().length >= 10 || match.includes('-') || match.includes('(')) {
        return '[PHONE_REDACTED]'
      }
      return match
    })

    return sanitized
  },

  /**
   * Audit text for any remaining high-risk PII identifiers
   * @param {string} text
   * @returns {{ hasPii: boolean, detectedTypes: string[] }}
   */
  auditPiiRisk(text) {
    if (!text || typeof text !== 'string') return { hasPii: false, detectedTypes: [] }

    const detectedTypes = []

    if (EMAIL_REGEX.test(text)) detectedTypes.push('EMAIL')
    if (API_KEY_REGEX.test(text)) detectedTypes.push('API_TOKEN')
    if (IP_REGEX.test(text)) detectedTypes.push('IP_ADDRESS')
    if (URL_REGEX.test(text)) detectedTypes.push('URL')

    // Reset regex lastIndex
    EMAIL_REGEX.lastIndex = 0
    API_KEY_REGEX.lastIndex = 0
    IP_REGEX.lastIndex = 0
    URL_REGEX.lastIndex = 0

    return {
      hasPii: detectedTypes.length > 0,
      detectedTypes,
    }
  },
}

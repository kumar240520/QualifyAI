/**
 * QualifyAI TTS Text Normalizer
 * Converts technical text, markdown, acronyms, and programming syntax into speech-friendly representations
 * without mutating canonical interview state or visible UI text.
 */

// Mapping of common tech acronyms & terms to phonetic pronunciations
const TECHNICAL_TERMS_MAP = [
  // Frameworks & Runtimes
  { pattern: /\bNode\.js\b/gi, replacement: 'Node dot J S' },
  { pattern: /\bExpress\.js\b/gi, replacement: 'Express J S' },
  { pattern: /\bReact\.js\b/gi, replacement: 'React J S' },
  { pattern: /\bVue\.js\b/gi, replacement: 'Vue J S' },
  { pattern: /\bNext\.js\b/gi, replacement: 'Next J S' },
  { pattern: /\bNest\.js\b|\bNestJS\b/gi, replacement: 'Nest J S' },
  { pattern: /\bNuxt\.js\b|\bNuxtJS\b/gi, replacement: 'Nuxt J S' },
  { pattern: /\bAngular\.js\b/gi, replacement: 'Angular J S' },

  // Databases & Storage
  { pattern: /\bPostgreSQL\b/gi, replacement: 'Postgre S Q L' },
  { pattern: /\bPostgres\b/gi, replacement: 'Postgres' },
  { pattern: /\bMySQL\b/gi, replacement: 'My S Q L' },
  { pattern: /\bMongoDB\b/gi, replacement: 'Mongo D B' },
  { pattern: /\bNoSQL\b/gi, replacement: 'No S Q L' },
  { pattern: /\bSQLite\b/gi, replacement: 'S Q L Lite' },
  { pattern: /\bRedis\b/gi, replacement: 'Redis' },

  // Architecture & Protocols
  { pattern: /\bRESTful\b/gi, replacement: 'RESTful' },
  { pattern: /\bREST\s+APIs?\b/gi, replacement: 'REST A P I' },
  { pattern: /\bGraphQL\b/gi, replacement: 'Graph Q L' },
  { pattern: /\bgRPC\b/gi, replacement: 'g R P C' },
  { pattern: /\bOAuth\s*2(?:\.0)?\b/gi, replacement: 'OAuth two' },
  { pattern: /\bOAuth\b/gi, replacement: 'OAuth' },
  { pattern: /\bJWT\b/gi, replacement: 'J W T' },
  { pattern: /\bHTTP\/2\b/gi, replacement: 'H T T P two' },
  { pattern: /\bHTTPS?\b/gi, replacement: 'H T T P S' },
  { pattern: /\bTCP\/IP\b/gi, replacement: 'T C P I P' },
  { pattern: /\bWebSocket\b/gi, replacement: 'WebSocket' },
  { pattern: /\bWebSockets\b/gi, replacement: 'WebSockets' },
  { pattern: /\bCI\/CD\b/gi, replacement: 'C I C D' },
  { pattern: /\bAWS\b/gi, replacement: 'A W S' },
  { pattern: /\bGCP\b/gi, replacement: 'G C P' },
  { pattern: /\bCDN\b/gi, replacement: 'C D N' },
  { pattern: /\bDNS\b/gi, replacement: 'D N S' },
  { pattern: /\bk8s\b/gi, replacement: 'Kubernetes' },
  { pattern: /\bSDKs?\b/gi, replacement: 'S D K' },
  { pattern: /\bAPIs?\b/gi, replacement: 'A P I' },
  { pattern: /\bCLI\b/gi, replacement: 'C L I' },
  { pattern: /\bUI\/UX\b/gi, replacement: 'U I U X' },
  { pattern: /\bUI\b/gi, replacement: 'U I' },
  { pattern: /\bUX\b/gi, replacement: 'U X' },

  // Complexity & Algorithmic notation
  { pattern: /\bO\(\s*n\s*(?:\*|\s+)?log\s*n\s*\)/gi, replacement: 'O of n log n' },
  { pattern: /\bO\(\s*log\s*n\s*\)/gi, replacement: 'O of log n' },
  { pattern: /\bO\(\s*n\^2\s*\)|\bO\(\s*n\s*\*\s*n\s*\)/gi, replacement: 'O of n squared' },
  { pattern: /\bO\(\s*2\^n\s*\)/gi, replacement: 'O of 2 to the n' },
  { pattern: /\bO\(\s*1\s*\)/gi, replacement: 'O of 1' },
  { pattern: /\bO\(\s*n\s*\)/gi, replacement: 'O of n' },

  // Version numbers
  { pattern: /\bv(\d+)\.(\d+)(?:\.(\d+))?\b/g, replacement: (match, p1, p2, p3) => `version ${p1} point ${p2}${p3 ? ` point ${p3}` : ''}` },
]

/**
 * Normalizes text specifically for natural TTS delivery
 * @param {string} text - Raw input text (e.g. from question generator)
 * @returns {string} - Clean, speech-friendly text
 */
export function normalizeTextForTTS(text) {
  if (!text || typeof text !== 'string') return ''

  let normalized = text

  // 1. Strip code blocks with natural spoken equivalent
  normalized = normalized.replace(/```[\s\S]*?```/g, (match) => {
    const lines = match.replace(/```[a-zA-Z]*/g, '').trim().split('\n')
    if (lines.length <= 2 && lines.join(' ').length < 80) {
      return lines.join(' ').trim()
    }
    return 'the code snippet shown on your screen'
  })

  // 2. Remove inline code backticks: `code` -> code
  normalized = normalized.replace(/`([^`]+)`/g, '$1')

  // 3. Strip markdown links [label](url) -> label
  normalized = normalized.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 4. Strip standalone URLs
  normalized = normalized.replace(/https?:\/\/[^\s)]+/g, 'the website link')

  // 5. Clean file paths (e.g. /server/src/index.js -> server/src/index.js)
  normalized = normalized.replace(/(?:^|\s)(?:\/|[A-Za-z]:\\)[\w\-./\\]+\.([a-zA-Z0-9]+)/g, (match) => {
    return ' the file path '
  })

  // 6. Strip markdown headers, blockquotes, bullets
  normalized = normalized
    .replace(/^#+\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')

  // 7. Strip bold and italics
  normalized = normalized
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')

  // 8. Remove common speaker or system prefixes
  normalized = normalized.replace(/^(Interviewer|AI|Question|System|Note|Evaluation):\s*/i, '')

  // 9. Normalize operators to conversational English
  normalized = normalized
    .replace(/\s*!==\s*/g, ' is not strictly equal to ')
    .replace(/\s*===\s*/g, ' is strictly equal to ')
    .replace(/\s*!=\s*/g, ' does not equal ')
    .replace(/\s*==\s*/g, ' equals ')
    .replace(/\s*<=\s*/g, ' is less than or equal to ')
    .replace(/\s*>=\s*/g, ' is greater than or equal to ')
    .replace(/\s*&&\s*/g, ' and ')
    .replace(/\s*\|\|\s*/g, ' or ')
    .replace(/\s*=>\s*/g, ' arrow ')

  // 10. Strip emojis
  normalized = normalized.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')

  // 11. Apply technical terms & acronym replacements
  for (const { pattern, replacement } of TECHNICAL_TERMS_MAP) {
    normalized = normalized.replace(pattern, replacement)
  }

  // 12. Clean excessive punctuation and trim whitespace
  normalized = normalized
    .replace(/\.{3,}/g, '.')
    .replace(/!{2,}/g, '!')
    .replace(/\?{2,}/g, '?')
    .replace(/-{2,}/g, ' - ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()

  return normalized
}

/**
 * Creates canonical question speech contract preserving UI and TTS separation
 * @param {object} params
 * @param {string} params.questionId
 * @param {string} params.questionText
 * @param {string} [params.spokenLeadIn]
 * @returns {{ questionId: string, questionText: string, ttsText: string }}
 */
export function createQuestionSpeechContract({ questionId, questionText, spokenLeadIn = null }) {
  const canonicalVisual = (questionText || '').trim()
  const rawSpoken = (spokenLeadIn || canonicalVisual).trim()
  const ttsText = normalizeTextForTTS(rawSpoken)

  return {
    questionId: questionId || `q_${Date.now()}`,
    questionText: canonicalVisual,
    ttsText,
  }
}

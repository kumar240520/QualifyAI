/**
 * QualifyAI Speech Segmenter
 * Prepares text for human-like speech synthesis:
 * - Cleans markdown, formatting artifacts, and code blocks
 * - Segments long text into natural prosodic sentences / clauses
 * - Protects technical abbreviations, version numbers, and method chains from premature splitting
 */

// Common abbreviations and technical tokens that contain periods but should NOT split sentences
const PROTECTED_ABBREVIATIONS = [
  'e.g.',
  'i.e.',
  'etc.',
  'vs.',
  'mr.',
  'mrs.',
  'ms.',
  'dr.',
  'prof.',
  'inc.',
  'ltd.',
  'co.',
  'dept.',
  'est.',
  'approx.',
  'min.',
  'max.',
  'fig.',
  'no.',
  'jan.',
  'feb.',
  'mar.',
  'apr.',
  'jun.',
  'jul.',
  'aug.',
  'sep.',
  'sept.',
  'oct.',
  'nov.',
  'dec.',
]

/**
 * Clean markdown and technical syntax for clear, natural spoken delivery
 */
export function cleanTextForSpeech(text) {
  if (!text || typeof text !== 'string') return ''

  let cleaned = text
    // Remove markdown code fences: ```javascript ... ``` -> [code explanation]
    .replace(/```[\s\S]*?```/g, (match) => {
      // Extract first line or summary if short, or describe as code snippet
      const lines = match.replace(/```[a-zA-Z]*/g, '').trim().split('\n')
      if (lines.length <= 2) {
        return lines.join(' ').trim()
      }
      return 'the code snippet shown on your screen'
    })
    // Remove inline backticks: `const x = 5` -> const x = 5
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold and italics: **text** or *text*
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove headers: # Header
    .replace(/^#+\s+/gm, '')
    // Remove blockquotes: > quote
    .replace(/^>\s+/gm, '')
    // Remove bullet points / lists: - item or 1. item
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove common meta labels like "Interviewer:", "Question:", "Note:"
    .replace(/^(Interviewer|AI|Question|System|Note|Evaluation):\s*/i, '')
    // Normalize technical symbols to conversational words
    .replace(/\s*!==\s*/g, ' is not strictly equal to ')
    .replace(/\s*===\s*/g, ' is strictly equal to ')
    .replace(/\s*!=\s*/g, ' does not equal ')
    .replace(/\s*==\s*/g, ' equals ')
    .replace(/\s*<=\s*/g, ' is less than or equal to ')
    .replace(/\s*>=\s*/g, ' is greater than or equal to ')
    .replace(/\s*&&\s*/g, ' and ')
    .replace(/\s*\|\|\s*/g, ' or ')
    .replace(/\s*=>\s*/g, ' arrow ')
    // Collapse multiple whitespaces and trim
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()

  return cleaned
}

/**
 * Segments text into natural sentence / clause units for TTS engines.
 * Avoids splitting on abbreviations, decimals, domain names, or code dots.
 * 
 * @param {string} text - Raw or cleaned text
 * @param {object} options - Options { maxClauseLength: 180, minClauseLength: 20 }
 * @returns {string[]} Array of spoken sentence clauses
 */
export function segmentSpeech(text, options = {}) {
  const { maxClauseLength = 200, minClauseLength = 15 } = options
  const cleaned = cleanTextForSpeech(text)
  if (!cleaned) return []

  // Tokenize while protecting dots inside known abbreviations, decimals, and URLs
  // Step 1: Temporarily replace safe periods with a placeholder
  const placeholder = '___DOT___'
  let safeText = cleaned

  // 1. Protect known abbreviations first (case-insensitive while preserving casing)
  for (const abbr of PROTECTED_ABBREVIATIONS) {
    const escaped = abbr.replace(/\./g, '\\.')
    const regex = new RegExp(`(^|[^a-zA-Z0-9])(${escaped})`, 'gi')
    safeText = safeText.replace(regex, (match, prefix, token) => `${prefix}${token.replace(/\./g, placeholder)}`)
  }

  // 2. Protect decimals like 3.14 or 2.5
  safeText = safeText.replace(/(\d+)\.(\d+)/g, `$1${placeholder}$2`)

  // 3. Protect technical domains / packages like node.js, express.js, api.v1
  safeText = safeText.replace(/([a-zA-Z0-9]+)\.([a-zA-Z0-9]+)/g, (match, p1, p2) => {
    return `${p1}${placeholder}${p2}`
  })

  // Step 2: Split on sentence boundaries (. ? ! followed by whitespace or end of string)
  const rawSegments = safeText.split(/(?<=[.?!])\s+/).filter(Boolean)

  const result = []

  for (let segment of rawSegments) {
    // Restore protected dots
    let restored = segment.replace(new RegExp(placeholder, 'g'), '.').trim()
    if (!restored) continue

    // If segment is excessively long, split on intermediate clause punctuation (, ; :)
    if (restored.length > maxClauseLength) {
      const clauseParts = restored.split(/(?<=[,;:])\s+/).filter(Boolean)
      let currentCombined = ''

      for (const clause of clauseParts) {
        if (!currentCombined) {
          currentCombined = clause
        } else if ((currentCombined + ' ' + clause).length <= maxClauseLength) {
          currentCombined += ' ' + clause
        } else {
          result.push(currentCombined.trim())
          currentCombined = clause
        }
      }
      if (currentCombined.trim()) {
        result.push(currentCombined.trim())
      }
    } else {
      result.push(restored)
    }
  }

  // Merge any segments that are unnaturally short with the next or previous segment
  const merged = []
  for (let i = 0; i < result.length; i++) {
    const curr = result[i]
    if (merged.length > 0 && curr.length < minClauseLength && !curr.endsWith('?')) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${curr}`
    } else {
      merged.push(curr)
    }
  }

  return merged.length > 0 ? merged : [cleaned]
}

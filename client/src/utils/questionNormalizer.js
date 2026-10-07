/**
 * QualifyAI Question Normalizer & Type Intelligence Engine
 * Extracts clean technical question prompts, removes conversational greetings and meta-monologues,
 * and normalizes questions into a typed model with options, code snippets, and metadata.
 */

/**
 * Filter out AI internal thoughts, meta-planning, and evaluator labels
 */
export function isThoughtOrMetaPlanning(text) {
  if (!text || typeof text !== 'string') return false
  const t = text.trim()
  if (!t) return false
  const patterns = [
    /^(I'm|I am) ready to (begin|start)/i,
    /^(I|I've|I have) (finalized|decided|planned|prepared|settled on)/i,
    /^I plan to (extend|transition|ask|start|begin|warmly)/i,
    /^The focus is on a (system design|scenario|warm welcome)/i,
    /^The goal is to set a solid foundation/i,
    /^I aim for a (professional|conversational)/i,
    /^I will (now )?(extend|begin|transition|start|provide|deliver a warm)/i,
    /^Let's (begin|start) with an introductory question\./i,
    /in a professional tone\. The goal is to/i,
    /conversational delivery\./i,
    /set a solid foundation for a detailed discussion/i,
    /^Thinking:/i,
    /^Thought:/i,
    /^Planning:/i,
    /^\*thinking\*/i,
    /^\[Thinking\]/i,
    /^\[System Note/i,
    /^Evaluator Note:/i,
  ]
  return patterns.some((p) => p.test(t))
}

/**
 * Extract clean question prompt from AI speech or raw question text
 * Removes conversational introductions, feedback greetings, and trailing conversational fluff
 */
export function extractCleanQuestionPrompt(rawText) {
  if (!rawText || typeof rawText !== 'string') return ''
  let clean = rawText
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*.*?\*\*/g, (m) => m.replace(/\*\*/g, ''))
    .replace(/^[A-Z\s]+:\s*/, '')
    .trim()

  if (!clean || isThoughtOrMetaPlanning(clean)) return ''

  // Split into sentences using punctuation boundaries
  const sentences = clean.split(/(?<=[.?!])\s+/).filter(Boolean)

  // Look for interrogative or direct technical prompts
  const questionSentences = sentences.filter((s) => {
    const st = s.trim()
    return (
      st.endsWith('?') ||
      /^(Could you|Can you|How would you|How do you|What is|What are|Why would|Which of|Please explain|Walk me through|Tell me about|Describe|Implement|Write a|Given that)/i.test(
        st
      )
    )
  })

  if (questionSentences.length > 0) {
    // Return all questions found or the last 1-2 focused questions
    return questionSentences.join(' ').trim()
  }

  // If no explicit question mark, return last sentence or cleaned text
  return sentences.length > 1 ? sentences[sentences.length - 1].trim() : clean
}

/**
 * Parses embedded option lists (e.g., "A) ... B) ..." or "1. ... 2. ...")
 */
function parseEmbeddedOptions(text) {
  if (!text) return []

  // Pattern A: "A) Option 1 \n B) Option 2" or "A. Option 1 \n B. Option 2"
  const letterMatches = Array.from(
    text.matchAll(/(?:^|\n|\s+)([A-D])[\)\.][\s]+([^\n\rA-D\).]+)/gi)
  )
  if (letterMatches.length >= 2) {
    const keys = letterMatches.map((m) => m[1].toUpperCase())
    // Ensure options start with A and have at least B
    if (keys.includes('A') && keys.includes('B')) {
      return letterMatches.map((m) => ({
        id: m[1].toLowerCase(),
        key: m[1].toUpperCase(),
        label: m[2].trim().replace(/[;,]$/, ''),
      }))
    }
  }

  // Pattern B: "1. Option 1 \n 2. Option 2" or "1) Option 1 \n 2) Option 2"
  const numberMatches = Array.from(
    text.matchAll(/(?:^|\n|\s+)(\d)[\)\.][\s]+([^\n\r\d\).]+)/gi)
  )
  if (numberMatches.length >= 2) {
    const keys = numberMatches.map((m) => m[1])
    if (keys.includes('1') && keys.includes('2')) {
      return numberMatches.map((m) => ({
        id: `opt-${m[1]}`,
        key: m[1],
        label: m[2].trim().replace(/[;,]$/, ''),
      }))
    }
  }

  return []
}

/**
 * Extracts code block or snippet if present
 */
function extractCodeSnippet(text) {
  if (!text) return null
  // Match markdown code block ```lang ... ```
  const blockMatch = text.match(/```([a-zA-Z0-9_-]*)\s*([\s\S]*?)```/)
  if (blockMatch) {
    return {
      language: blockMatch[1] || 'javascript',
      code: blockMatch[2].trim(),
    }
  }

  // Match inline multi-line code indicators (e.g. const ... console.log)
  if (/(\bconst\b|\blet\b|\bfunction\b|\bdef\b|\bclass\b|console\.log)/.test(text) && text.includes(';')) {
    const lines = text.split('\n').filter((l) => /(=|=>|function|return|console\.log|;|{|})/.test(l))
    if (lines.length >= 2) {
      return {
        language: 'javascript',
        code: lines.join('\n').trim(),
      }
    }
  }

  return null
}

/**
 * Detect question type based on metadata, question attributes, and linguistic analysis
 */
export function detectQuestionType(questionData, cleanPrompt, rawText = '') {
  const meta = questionData?.metadata || {}
  const rawType = (questionData?.type || meta.type || '').toUpperCase()

  // 1. Explicit database / metadata match
  if (['MULTIPLE_CHOICE', 'SINGLE_CHOICE', 'MCQ'].includes(rawType)) return 'MULTIPLE_CHOICE'
  if (rawType === 'MULTI_SELECT') return 'MULTI_SELECT'
  if (['FILL_IN_THE_BLANK', 'FILL_BLANK'].includes(rawType)) return 'FILL_IN_THE_BLANK'
  if (['CODE_OUTPUT', 'OUTPUT_PREDICTION'].includes(rawType)) return 'CODE_OUTPUT'
  if (['CODE_WRITING', 'CODING', 'CODE'].includes(rawType)) return 'CODE_WRITING'
  if (['SQL', 'DATABASE_QUERY'].includes(rawType)) return 'SQL'
  if (['TRUE_FALSE', 'YES_NO', 'BOOLEAN'].includes(rawType)) return 'TRUE_FALSE'
  if (['SYSTEM_DESIGN', 'SCENARIO'].includes(rawType)) return 'SCENARIO'
  if (rawType === 'BEHAVIORAL') return 'BEHAVIORAL'

  const prompt = rawText || cleanPrompt || questionData?.question_text || ''
  const lower = prompt.toLowerCase()

  // 2. Options check
  const embeddedOpts = parseEmbeddedOptions(prompt)
  if (Array.isArray(meta.options) && meta.options.length >= 2) {
    return meta.multi_select ? 'MULTI_SELECT' : 'MULTIPLE_CHOICE'
  }
  if (embeddedOpts.length >= 2) {
    return 'MULTIPLE_CHOICE'
  }

  // 3. Fill-in-the-blank check
  if (prompt.includes('____') || lower.includes('fill in the blank') || lower.includes('is ______')) {
    return 'FILL_IN_THE_BLANK'
  }

  // 4. Code output prediction check
  if (
    (lower.includes('output') || lower.includes('what will this code print') || lower.includes('what will be logged')) &&
    (extractCodeSnippet(prompt) || lower.includes('console.log') || lower.includes('print('))
  ) {
    return 'CODE_OUTPUT'
  }

  // 5. Code writing check
  if (
    (lower.includes('implement a function') ||
      lower.includes('write a function') ||
      lower.includes('write code to') ||
      lower.includes('create a class')) &&
    !lower.includes('explain how you would')
  ) {
    return 'CODE_WRITING'
  }

  // 6. SQL check
  if (
    lower.includes('write a sql query') ||
    lower.includes('write an sql query') ||
    lower.includes('select query') ||
    lower.includes('write a query to') ||
    /select\s+.*?\s+from/i.test(prompt)
  ) {
    return 'SQL'
  }

  // 7. True/False or Yes/No check
  if (
    /^(can postgresql|is it true that|does |is javascript|are indexes|true or false)/i.test(prompt) &&
    prompt.split(' ').length < 22 &&
    !lower.includes('explain') &&
    !lower.includes('how')
  ) {
    return 'TRUE_FALSE'
  }

  // 8. Scenario check
  if (
    lower.includes('production outage') ||
    lower.includes('traffic spike') ||
    lower.includes('high latency') ||
    lower.includes('suppose your api') ||
    lower.includes('you notice that cpu') ||
    lower.includes('pool exhaustion') ||
    lower.includes('incident')
  ) {
    return 'SCENARIO'
  }

  // 9. Behavioral check
  if (
    lower.includes('tell me about a time') ||
    lower.includes('describe a situation') ||
    lower.includes('have you ever disagreed')
  ) {
    return 'BEHAVIORAL'
  }

  // Default to DESCRIPTIVE
  return 'DESCRIPTIVE'
}

/**
 * Main Normalizer: Takes raw question data + live speech question and returns a structured question model
 */
export function normalizeQuestion(questionData, liveQuestionText, turnIndex = 0) {
  const rawText = liveQuestionText || questionData?.question_text || ''
  const cleanText = extractCleanQuestionPrompt(rawText) || questionData?.question_text || rawText
  const detectedType = detectQuestionType(questionData, cleanText, rawText)
  const meta = questionData?.metadata || {}

  // Parse options for MCQ / Multi-select
  let options = []
  {
    const rawOptionsList = (Array.isArray(questionData?.options) && questionData.options.length >= 2)
      ? questionData.options
      : (Array.isArray(meta.options) && meta.options.length >= 2)
      ? meta.options
      : null

    if (rawOptionsList) {
      options = rawOptionsList.map((opt, i) => {
        if (typeof opt === 'string') {
          const letter = String.fromCharCode(65 + i)
          const cleanLabel = opt.replace(/^[A-D1-4][\)\.:]\s*/i, '').trim()
          return { id: `opt-${letter.toLowerCase()}`, key: letter, label: cleanLabel || opt }
        }
        return {
          id: opt.id || `opt-${opt.key ? opt.key.toLowerCase() : String.fromCharCode(97 + i)}`,
          key: opt.key || String.fromCharCode(65 + i),
          label: (opt.label || opt.text || String(opt)).replace(/^[A-D1-4][\)\.:]\s*/i, '').trim(),
        }
      })
    } else {
      const rawOpts = parseEmbeddedOptions(rawText)
      options = rawOpts.length >= 2 ? rawOpts : parseEmbeddedOptions(cleanText)
    }
  }

  // Strip parsed options from display prompt if detected in text
  let displayPrompt = cleanText
  if (options.length >= 2) {
    displayPrompt = cleanText.split(/(?:^|\n|\s+)[A-D1-4][\).\s]+/i)[0].trim() || cleanText
  }

  // Extract code snippet for code-related types
  const extractedCode = extractCodeSnippet(cleanText) || extractCodeSnippet(rawText)
  const codeSnippet = questionData?.code_snippet || meta.code_snippet || meta.code || extractedCode?.code || null
  const language = questionData?.language || meta.language || extractedCode?.language || (detectedType === 'SQL' ? 'sql' : 'javascript')

  return {
    id: questionData?.id || `turn-q-${turnIndex}`,
    sequence: typeof turnIndex === 'number' ? turnIndex : 0,
    text: displayPrompt,
    rawText,
    type: detectedType,
    difficulty: questionData?.difficulty || meta.difficulty || 'MEDIUM',
    turnIndex,
    options,
    language,
    codeSnippet,
    expectedConcepts: meta.expected_concepts || [],
    sampleFollowUps: meta.sample_follow_ups || [],
    metadata: meta,
  }
}

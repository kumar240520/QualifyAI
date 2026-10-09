/**
 * QualifyAI Question Normalizer & Type Intelligence Engine
 * Extracts clean technical question prompts, removes conversational greetings and meta-monologues,
 * and normalizes questions into a typed model with options, code snippets, and metadata.
 */

import { normalizeQuestionType } from './questionTypeRegistry.js'

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
  if (sentences.length <= 1) return clean

  // Introductory conversational greetings, feedback, or transitions to strip from AI speech
  const introPatterns = [
    /^(hello|hi|hey|welcome|good (morning|afternoon|evening))/i,
    /^(great|awesome|perfect|excellent|good) (job|answer|response|work)/i,
    /^(that's|that was|this is|it's) (a )?(very )?(solid|good|great|awesome|perfect|excellent|nice)/i,
    /^(thank you|thanks)( for (your answer|that|clarifying))?/i,
    /^(let's|let us) (begin|start|move on|continue|transition|explore|now look at|discuss)/i,
    /^now (let's|we will|i'd like to|i will)/i,
    /^for this (role|position|next|interview)/i,
    /^(take a moment to|feel free to)/i,
    /^(alright|all right|okay|ok)[,.]?/i,
  ]

  let firstContentIndex = 0
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i].trim()
    if (introPatterns.some((p) => p.test(s)) || isThoughtOrMetaPlanning(s)) {
      firstContentIndex = i + 1
    } else {
      break
    }
  }

  const contentSentences = sentences.slice(firstContentIndex)
  if (contentSentences.length > 0) {
    return contentSentences.join(' ').trim()
  }

  return clean
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
  const rawType = questionData?.type || meta.type || ''

  // 1. Authoritative Question Type Registry check
  if (rawType) {
    const canonical = normalizeQuestionType(rawType)
    if (canonical && canonical !== 'DESCRIPTIVE') return canonical
    if (['DESCRIPTIVE', 'ESSAY', 'OPEN_ENDED', 'BEHAVIORAL'].includes(String(rawType).toUpperCase())) {
      return String(rawType).toUpperCase() === 'BEHAVIORAL' ? 'BEHAVIORAL' : 'DESCRIPTIVE'
    }
  }

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
  // CRITICAL ARCHITECTURAL SEPARATION:
  // The authoritative canonical question text comes strictly from the backend question record.
  // We NEVER derive the main question title from streaming AI speech transcripts.
  const canonicalText = (questionData?.question_text || questionData?.text || '').trim()
  const rawText = canonicalText || (typeof liveQuestionText === 'string' ? liveQuestionText.trim() : '')

  // Clean question prompt:
  // If canonicalText exists, clean only outer markdown formatting while preserving
  // all setup sentences, premises, numeric constraints, punctuation, and instructions.
  // If only raw speech is present, strip leading conversational intro greetings.
  let cleanText = ''
  if (canonicalText) {
    cleanText = canonicalText
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*.*?\*\*/g, (m) => m.replace(/\*\*/g, ''))
      .replace(/^[A-Z\s]+:\s*/, '')
      .trim()
  } else if (rawText) {
    cleanText = extractCleanQuestionPrompt(rawText) || rawText
  }

  // Turn 0 fallback if prompt is empty
  if (!cleanText && turnIndex === 0) {
    cleanText = 'Could you please introduce yourself and share your background?'
  }

  const detectedType = detectQuestionType(questionData, cleanText, rawText)
  const meta = questionData?.metadata || {}

  // Parse options for MCQ / Multi-select
  let options = []
  const rawOptionsList =
    Array.isArray(questionData?.options) && questionData.options.length >= 2
      ? questionData.options
      : Array.isArray(meta.options) && meta.options.length >= 2
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

  // Display prompt for the main question title:
  // Must NEVER split on ordinary words like " a " (which previously corrupted "If a store..." or "receives a 20%..." to "If").
  // Only strip embedded multiline options if options were NOT already provided as structured list.
  let displayPrompt = cleanText
  if (!rawOptionsList && options.length >= 2) {
    displayPrompt = cleanText.split(/(?:\r?\n\s*)[A-D1-4][\)\.]\s+/i)[0].trim() || cleanText
  }

  // Absolute fallback: ensure displayPrompt is never empty if canonical text was supplied
  if (!displayPrompt && canonicalText) {
    displayPrompt = canonicalText
  }

  // Extract code snippet for code-related types
  const extractedCode = extractCodeSnippet(cleanText) || extractCodeSnippet(rawText)
  const codeSnippet =
    questionData?.code_snippet ||
    meta.code_snippet ||
    meta.code ||
    extractedCode?.code ||
    null
  const language =
    questionData?.language ||
    meta.language ||
    extractedCode?.language ||
    (detectedType === 'SQL' ? 'sql' : 'javascript')

  // Extract items for ARRANGE_ORDER / ordering questions
  const rawItemsList =
    Array.isArray(questionData?.items) && questionData.items.length > 0
      ? questionData.items
      : Array.isArray(meta?.items) && meta.items.length > 0
      ? meta.items
      : (detectedType === 'ARRANGE_ORDER' && Array.isArray(questionData?.options) && questionData.options.length > 0)
      ? questionData.options
      : (detectedType === 'ARRANGE_ORDER' && Array.isArray(meta?.options) && meta.options.length > 0)
      ? meta.options
      : []

  const items = rawItemsList.map((item, idx) => {
    if (typeof item === 'string') {
      return { id: `item-${idx + 1}`, label: item.trim() }
    }
    return {
      id: item?.id || `item-${idx + 1}`,
      label: String(item?.label || item?.text || item || '').trim(),
    }
  })

  // Extract pairs for MATCHING_PAIRS
  const leftItems = Array.isArray(questionData?.leftItems) ? questionData.leftItems : (Array.isArray(questionData?.left_items) ? questionData.left_items : (Array.isArray(meta?.leftItems) ? meta.leftItems : (Array.isArray(meta?.left_items) ? meta.left_items : [])))
  const rightItems = Array.isArray(questionData?.rightItems) ? questionData.rightItems : (Array.isArray(questionData?.right_items) ? questionData.right_items : (Array.isArray(meta?.rightItems) ? meta.rightItems : (Array.isArray(meta?.right_items) ? meta.right_items : [])))

  // Extract configs for slider & numerical questions
  const sliderConfig = questionData?.sliderConfig || questionData?.slider_config || meta?.sliderConfig || meta?.slider_config || null
  const numericalConfig = questionData?.numericalConfig || questionData?.numerical_config || meta?.numericalConfig || meta?.numerical_config || null

  return {
    id: questionData?.id || `turn-q-${turnIndex}`,
    sequence: typeof turnIndex === 'number' ? turnIndex : 0,
    text: displayPrompt,
    rawText,
    type: detectedType,
    difficulty: questionData?.difficulty || meta.difficulty || 'MEDIUM',
    turnIndex,
    options,
    items,
    leftItems,
    rightItems,
    sliderConfig,
    numericalConfig,
    language,
    codeSnippet,
    expectedConcepts: meta.expected_concepts || [],
    sampleFollowUps: meta.sample_follow_ups || [],
    metadata: meta,
  }
}

/**
 * Centralized Enterprise Question-Type Registry
 * Canonical definitions, schemas, metadata, and validation rules for all 15 supported question types.
 */

export const QUESTION_TYPES_CATALOG = [
  {
    id: 'MULTIPLE_CHOICE',
    canonicalKey: 'single_select',
    label: 'Multiple Choice (Single Select)',
    desc: 'Candidate selects exactly one option from several distinct choices.',
    micDefault: false,
    category: 'KNOWLEDGE_EVALUATION',
    aliases: ['SINGLE_CHOICE', 'MCQ', 'SINGLE_SELECT'],
    evaluationStrategy: 'deterministic_or_rubric',
  },
  {
    id: 'MULTI_SELECT',
    canonicalKey: 'multi_select',
    label: 'Multiple Select',
    desc: 'Candidate selects one or more valid options with partial credit support.',
    micDefault: false,
    category: 'KNOWLEDGE_EVALUATION',
    aliases: ['MULTIPLE_SELECT'],
    evaluationStrategy: 'deterministic_or_rubric',
  },
  {
    id: 'TRUE_FALSE',
    canonicalKey: 'true_false',
    label: 'True / False',
    desc: 'Binary choice assertion validating nuanced conceptual and domain precision.',
    micDefault: false,
    category: 'KNOWLEDGE_EVALUATION',
    aliases: ['YES_NO', 'BOOLEAN'],
    evaluationStrategy: 'deterministic_or_rubric',
  },
  {
    id: 'SHORT_ANSWER',
    canonicalKey: 'short_answer',
    label: 'Short Answer',
    desc: 'Direct, brief textual or spoken answer (1-2 sentences) testing concise articulation.',
    micDefault: true,
    category: 'VERBAL_ARTICULATION',
    aliases: [],
    evaluationStrategy: 'semantic_rubric',
  },
  {
    id: 'DESCRIPTIVE',
    canonicalKey: 'descriptive',
    label: 'Descriptive / Open-Ended',
    desc: 'In-depth architectural, strategic, or trade-off reasoning with adaptive follow-ups.',
    micDefault: true,
    category: 'VERBAL_ARTICULATION',
    aliases: ['ESSAY', 'OPEN_ENDED', 'BEHAVIORAL'],
    evaluationStrategy: 'semantic_rubric',
  },
  {
    id: 'FILL_IN_THE_BLANK',
    canonicalKey: 'fill_blank',
    label: 'Fill in the Blank',
    desc: 'Statement, syntax, or expression with missing keyword or value to complete.',
    micDefault: false,
    category: 'TECHNICAL_PRECISION',
    aliases: ['FILL_BLANK'],
    evaluationStrategy: 'deterministic_or_rubric',
  },
  {
    id: 'CODING_CHALLENGE',
    canonicalKey: 'coding_challenge',
    label: 'Coding Challenge',
    desc: 'Programming problem with description, constraints, and starter code editor.',
    micDefault: false,
    category: 'SOFTWARE_ENGINEERING',
    aliases: ['CODE_WRITING', 'SQL', 'CODING'],
    evaluationStrategy: 'code_and_rubric',
  },
  {
    id: 'PREDICT_CODE_OUTPUT',
    canonicalKey: 'predict_output',
    label: 'Predict the Code Output',
    desc: 'Read-only code snippet; candidate analyzes execution and predicts output state.',
    micDefault: false,
    category: 'CODE_ANALYSIS',
    aliases: ['CODE_OUTPUT', 'PREDICT_OUTPUT'],
    evaluationStrategy: 'deterministic_or_rubric',
  },
  {
    id: 'DEBUGGING',
    canonicalKey: 'debugging',
    label: 'Debugging / Find the Error',
    desc: 'Code snippet or scenario containing a defect; candidate pinpoints and corrects it.',
    micDefault: false,
    category: 'CODE_ANALYSIS',
    aliases: ['FIND_THE_ERROR', 'BUG_HUNT'],
    evaluationStrategy: 'hybrid_rubric',
  },
  {
    id: 'COMPLETE_THE_CODE',
    canonicalKey: 'complete_code',
    label: 'Complete the Code',
    desc: 'Incomplete code with missing statements; candidate writes the missing implementation.',
    micDefault: false,
    category: 'SOFTWARE_ENGINEERING',
    aliases: ['CODE_COMPLETION', 'COMPLETE_CODE'],
    evaluationStrategy: 'code_and_rubric',
  },
  {
    id: 'ARRANGE_ORDER',
    canonicalKey: 'ordering',
    label: 'Arrange in the Correct Order',
    desc: 'Interactive reorderable sequence of workflow stages, algorithm steps, or layers.',
    micDefault: false,
    category: 'LOGICAL_REASONING',
    aliases: ['ORDERING', 'SEQUENCE', 'ARRANGE_IN_ORDER', 'ARRANGE_IN_THE_CORRECT_ORDER'],
    evaluationStrategy: 'deterministic_or_rubric',
  },
  {
    id: 'SELECT_MOST_APPROPRIATE',
    canonicalKey: 'best_option',
    label: 'Select the Most Appropriate Option',
    desc: 'Real-world situational judgment, incident response, and trade-off decision making.',
    micDefault: false,
    category: 'SITUATIONAL_JUDGMENT',
    aliases: ['SCENARIO', 'SITUATIONAL', 'BEST_OPTION'],
    evaluationStrategy: 'hybrid_rubric',
  },
  {
    id: 'SLIDER_SCALE',
    canonicalKey: 'slider',
    label: 'Slider / Numeric Scale',
    desc: 'Continuous or stepped scale assessing architectural priority, trade-off, or rating.',
    micDefault: false,
    category: 'QUANTITATIVE_RATING',
    aliases: ['SLIDER', 'NUMERIC_SCALE'],
    evaluationStrategy: 'deterministic_or_rubric',
  },
  {
    id: 'MATCHING_PAIRS',
    canonicalKey: 'matching',
    label: 'Matching / Pairing',
    desc: 'Two sets of related terms or concepts to associate into correct pairs.',
    micDefault: false,
    category: 'LOGICAL_REASONING',
    aliases: ['MATCHING', 'PAIRING'],
    evaluationStrategy: 'deterministic_or_rubric',
  },
  {
    id: 'NUMERICAL_APTITUDE',
    canonicalKey: 'numerical',
    label: 'Numerical / Aptitude Problem',
    desc: 'Quantitative reasoning, calculation, math problem, or complexity estimation.',
    micDefault: false,
    category: 'QUANTITATIVE_RATING',
    aliases: ['APTITUDE', 'MATH_CALCULATION', 'NUMERICAL', 'MATH'],
    evaluationStrategy: 'deterministic_or_rubric',
  },
]

export const CANONICAL_QUESTION_TYPES = QUESTION_TYPES_CATALOG.map((q) => q.id)
export const QUESTION_TYPES = CANONICAL_QUESTION_TYPES

export const QUESTION_TYPE_ALIASES = QUESTION_TYPES_CATALOG.reduce((acc, q) => {
  acc[q.id] = q.id
  acc[q.id.toLowerCase()] = q.id
  if (q.canonicalKey) {
    acc[q.canonicalKey] = q.id
    acc[q.canonicalKey.toUpperCase()] = q.id
  }
  for (const alias of q.aliases) {
    acc[alias] = q.id
    acc[alias.toLowerCase()] = q.id
  }
  return acc
}, {})

/**
 * Normalizes any question type string, alias, or question object to its canonical identifier.
 */
export function normalizeQuestionType(typeOrQuestion) {
  if (!typeOrQuestion) return 'DESCRIPTIVE'
  let rawType = typeOrQuestion
  if (typeof typeOrQuestion === 'object' && typeOrQuestion !== null) {
    rawType = typeOrQuestion.type || typeOrQuestion.question_type || typeOrQuestion.questionType || typeOrQuestion.id
  }
  if (!rawType || typeof rawType !== 'string') return 'DESCRIPTIVE'
  const clean = rawType.trim().toUpperCase().replace(/\s+/g, '_')
  return QUESTION_TYPE_ALIASES[clean] || (CANONICAL_QUESTION_TYPES.includes(clean) ? clean : 'DESCRIPTIVE')
}

/**
 * Validates whether a given question type string or object maps to a supported canonical type.
 */
export function isValidQuestionType(typeOrQuestion) {
  if (!typeOrQuestion) return false
  let rawType = typeOrQuestion
  if (typeof typeOrQuestion === 'object' && typeOrQuestion !== null) {
    rawType = typeOrQuestion.type || typeOrQuestion.question_type || typeOrQuestion.questionType
  }
  if (!rawType || typeof rawType !== 'string') return false
  const clean = rawType.trim().toUpperCase().replace(/\s+/g, '_')
  const resolved = QUESTION_TYPE_ALIASES[clean]
  return Boolean(resolved && CANONICAL_QUESTION_TYPES.includes(resolved))
}

/**
 * Authoritative default microphone policy:
 * ONLY Short Answer and Descriptive/Open-Ended have microphone ON by default.
 * All other 13 question types have microphone OFF by default.
 */
export function isMicDefaultOn(typeOrQuestion) {
  let rawType = typeOrQuestion
  if (typeof typeOrQuestion === 'object' && typeOrQuestion !== null) {
    rawType = typeOrQuestion.type || typeOrQuestion.question_type || typeOrQuestion.questionType
  }
  if (!rawType || typeof rawType !== 'string') return false
  const canonical = normalizeQuestionType(rawType)
  return canonical === 'SHORT_ANSWER' || canonical === 'DESCRIPTIVE'
}

/**
 * Validates and normalizes structured question payloads to ensure complete interactive data.
 */
export function normalizeQuestionPayload(question, defaultType = 'SHORT_ANSWER') {
  if (!question || typeof question !== 'object') {
    return {
      text: 'Could you summarize your core professional background and technical competencies?',
      type: defaultType,
      skill: 'Core Competency',
      topic: 'Assessment',
      difficulty: 'MEDIUM',
    }
  }

  const rawQType = question.type || defaultType
  const canonicalType = normalizeQuestionType(rawQType)
  const normalized = {
    ...question,
    type: canonicalType === 'SELECT_MOST_APPROPRIATE' && question.type === 'SCENARIO' ? 'SCENARIO' : canonicalType,
    text: String(question.text || question.question_text || '').trim(),
    skill: question.skill || 'Core Competency',
    topic: question.topic || 'Assessment',
    difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(String(question.difficulty).toUpperCase())
      ? String(question.difficulty).toUpperCase()
      : 'MEDIUM',
  }

  // Type-specific structural guarantees
  switch (canonicalType) {
    case 'MULTIPLE_CHOICE':
    case 'MULTI_SELECT':
    case 'SELECT_MOST_APPROPRIATE': {
      if (!Array.isArray(normalized.options) || normalized.options.length < 2) {
        normalized.options = [
          'High throughput architecture with asynchronous queue processing',
          'Synchronous blocking alternative with immediate consistency',
          'Event-driven reactive pipeline with optimistic locking',
          'In-memory distributed cache with write-through persistence',
        ]
      }
      break
    }

    case 'TRUE_FALSE': {
      if (!Array.isArray(normalized.options) || normalized.options.length < 2) {
        normalized.options = ['True', 'False']
      }
      break
    }

    case 'CODING_CHALLENGE': {
      if (!normalized.codeSnippet) {
        normalized.codeSnippet = '// Write your solution below\nfunction solution(input) {\n  return null;\n}'
      }
      normalized.language = normalized.language || 'javascript'
      break
    }

    case 'PREDICT_CODE_OUTPUT': {
      if (!normalized.codeSnippet) {
        normalized.codeSnippet = '// Determine the output of this code snippet\nconsole.log([1, 2, 3].map(x => x * 2));'
      }
      normalized.language = normalized.language || 'javascript'
      break
    }

    case 'DEBUGGING': {
      if (!normalized.codeSnippet) {
        normalized.codeSnippet = '// Identify and fix the defect in this function\nfunction findAverage(arr) {\n  let sum = 0;\n  for (let i = 0; i <= arr.length; i++) {\n    sum += arr[i];\n  }\n  return sum / arr.length;\n}'
      }
      normalized.language = normalized.language || 'javascript'
      break
    }

    case 'COMPLETE_THE_CODE': {
      if (!normalized.codeSnippet) {
        normalized.codeSnippet = 'function binarySearch(arr, target) {\n  let left = 0, right = arr.length - 1;\n  while (left <= right) {\n    /* TODO: Implement binary search mid calculation and pointer shifts */\n  }\n  return -1;\n}'
      }
      normalized.language = normalized.language || 'javascript'
      break
    }

    case 'ARRANGE_ORDER': {
      let rawItems = Array.isArray(normalized.items) && normalized.items.length >= 2
        ? normalized.items
        : (Array.isArray(normalized.options) && normalized.options.length >= 2 ? normalized.options : null)

      if (!rawItems) {
        rawItems = [
          'Requirements Analysis & Architecture Design',
          'Core Implementation & Unit Testing',
          'Continuous Integration & Peer Review',
          'Production Deployment & Monitoring',
        ]
      }

      if (Array.isArray(rawItems)) {
        const canonicalItems = rawItems.map((item, idx) => {
          if (typeof item === 'string') {
            return { id: `item-${idx + 1}`, label: item.trim() }
          }
          return {
            id: item?.id || `item-${idx + 1}`,
            label: String(item?.label || item?.text || item || '').trim(),
          }
        })

        // Capture canonical expected answer if provided or if list represents ground truth sequence
        if (!normalized.expectedAnswer) {
          normalized.expectedAnswer = normalized.expected_answer || canonicalItems.map((it) => it.label)
        }

        const exp = normalized.expectedAnswer || normalized.expected_answer
        const isExpArray = Array.isArray(exp)

        // Scramble initial display order if identical to expected order so candidate has a true ordering task
        if (isExpArray && canonicalItems.length >= 3) {
          const itemLabels = canonicalItems.map((it) => it.label)
          const isIdentical = JSON.stringify(itemLabels) === JSON.stringify(exp.map((s) => (typeof s === 'object' && s !== null ? s.label : String(s).trim())))
          if (isIdentical) {
            // Swap first and last items for presentation challenge
            const scrambled = [...canonicalItems]
            const temp = scrambled[0]
            scrambled[0] = scrambled[scrambled.length - 1]
            scrambled[scrambled.length - 1] = temp
            normalized.items = scrambled
          } else {
            normalized.items = canonicalItems
          }
        } else {
          normalized.items = canonicalItems
        }
      }
      break
    }

    case 'SLIDER_SCALE': {
      normalized.sliderConfig = {
        min: Number(normalized.sliderConfig?.min ?? normalized.min ?? 1),
        max: Number(normalized.sliderConfig?.max ?? normalized.max ?? 10),
        step: Number(normalized.sliderConfig?.step ?? normalized.step ?? 1),
        defaultValue: Number(normalized.sliderConfig?.defaultValue ?? normalized.defaultValue ?? 5),
        minLabel: normalized.sliderConfig?.minLabel || normalized.minLabel || '1 (Foundational / Low)',
        maxLabel: normalized.sliderConfig?.maxLabel || normalized.maxLabel || '10 (Expert / High)',
      }
      break
    }

    case 'MATCHING_PAIRS': {
      if (!Array.isArray(normalized.leftItems) || normalized.leftItems.length === 0) {
        normalized.leftItems = ['Raft', 'Kafka', 'Redis', 'PostgreSQL']
      }
      if (!Array.isArray(normalized.rightItems) || normalized.rightItems.length === 0) {
        normalized.rightItems = [
          'Distributed Consensus Protocol',
          'Distributed Log Partition Event Bus',
          'In-Memory Data Store & Cache',
          'ACID Relational Database',
        ]
      }
      break
    }

    case 'NUMERICAL_APTITUDE': {
      normalized.numericalConfig = {
        unit: normalized.numericalConfig?.unit || normalized.unit || '',
        tolerance: Number(normalized.numericalConfig?.tolerance ?? normalized.tolerance ?? 0.05),
      }
      break
    }

    case 'FILL_IN_THE_BLANK': {
      if (!normalized.text.includes('___') && !normalized.text.includes('[blank]')) {
        normalized.text = `${normalized.text} (Fill in the blank: ___)`
      }
      break
    }

    case 'SHORT_ANSWER':
    case 'DESCRIPTIVE':
    default:
      break
  }

  return normalized
}

/**
 * Validates that a generated question is structurally complete and valid for its template.
 */
export function validateQuestionSchema(question) {
  if (!question || typeof question !== 'object') {
    return { valid: false, error: 'Question must be a non-null object' }
  }

  const text = String(question.text || question.question_text || '').trim()
  if (!text || text.length < 5) {
    return { valid: false, error: 'Question text is missing or too short' }
  }

  const canonicalType = normalizeQuestionType(question.type)
  if (!CANONICAL_QUESTION_TYPES.includes(canonicalType)) {
    return { valid: false, error: `Invalid question type: "${question.type}"` }
  }

  switch (canonicalType) {
    case 'MULTIPLE_CHOICE':
    case 'MULTI_SELECT':
    case 'SELECT_MOST_APPROPRIATE': {
      const opts = question.options
      if (!Array.isArray(opts) || opts.length < 2) {
        return { valid: false, error: `${canonicalType} requires at least 2 options` }
      }
      break
    }

    case 'TRUE_FALSE': {
      if (Array.isArray(question.options) && question.options.length < 2) {
        return { valid: false, error: 'TRUE_FALSE requires at least 2 choices' }
      }
      break
    }

    case 'CODING_CHALLENGE':
    case 'PREDICT_CODE_OUTPUT':
    case 'DEBUGGING':
    case 'COMPLETE_THE_CODE': {
      const snippet = question.codeSnippet || question.code_snippet
      if (!snippet || String(snippet).trim().length < 5) {
        return { valid: false, error: `${canonicalType} requires a non-empty code snippet` }
      }
      break
    }

    case 'ARRANGE_ORDER': {
      const items = question.items || question.options
      if (!Array.isArray(items) || items.length < 2) {
        return { valid: false, error: 'ARRANGE_ORDER requires at least 2 reorderable items' }
      }
      const labels = items.map((it) => (typeof it === 'string' ? it.trim() : (it?.label || it?.text || String(it || '')).trim()))
      if (labels.some((l) => !l)) {
        return { valid: false, error: 'ARRANGE_ORDER items must have non-empty text labels' }
      }
      const isAllGeneric = labels.every((l) => /^step\s*\d+$/i.test(l))
      if (isAllGeneric) {
        return { valid: false, error: 'ARRANGE_ORDER cannot use generic Step placeholder items' }
      }
      const uniqueLabels = new Set(labels.map((l) => l.toLowerCase()))
      if (uniqueLabels.size < items.length) {
        return { valid: false, error: 'ARRANGE_ORDER items must be distinct' }
      }
      break
    }

    case 'MATCHING_PAIRS': {
      const left = question.leftItems || question.left_items
      const right = question.rightItems || question.right_items
      if (!Array.isArray(left) || !Array.isArray(right) || left.length < 2 || right.length < 2) {
        return { valid: false, error: 'MATCHING_PAIRS requires leftItems and rightItems arrays with >= 2 elements' }
      }
      break
    }

    case 'SLIDER_SCALE': {
      const config = question.sliderConfig || question.slider_config
      if (config) {
        const min = Number(config.min ?? 1)
        const max = Number(config.max ?? 10)
        if (min >= max) {
          return { valid: false, error: 'SLIDER_SCALE min must be less than max' }
        }
      }
      break
    }

    default:
      break
  }

  return { valid: true, isValid: true, canonicalType }
}

/**
 * Performs deterministic evaluation on objective candidate answers where an answer key or expected calculation exists.
 * Returns null if the question type requires full semantic evaluation (e.g. DESCRIPTIVE).
 */
export function evaluateAnswerDeterministically(question, candidateAnswer, structuredAnswer = null) {
  if (!question) return null
  const canonicalType = normalizeQuestionType(question.type)
  const expectedAnswer = question.expectedAnswer ?? question.expected_answer ?? question.metadata?.expected_answer ?? question.correctAnswer ?? question.correct_answer

  // Normalize inputs if candidateAnswer was passed as an object containing structured data
  if (typeof candidateAnswer === 'object' && candidateAnswer !== null && !structuredAnswer) {
    structuredAnswer = candidateAnswer
    candidateAnswer = candidateAnswer.text || candidateAnswer.answer || candidateAnswer.selectedOption || ''
  }

  const cleanAns = String(candidateAnswer || '').trim().toLowerCase()

  switch (canonicalType) {
    case 'TRUE_FALSE': {
      if (expectedAnswer === undefined || expectedAnswer === null) return null
      const expClean = String(expectedAnswer).trim().toLowerCase()
      const isCorrect = (cleanAns === expClean) ||
        (cleanAns.includes('true') && expClean === 'true') ||
        (cleanAns.includes('false') && expClean === 'false') ||
        (cleanAns === 'yes' && expClean === 'true') ||
        (cleanAns === 'no' && expClean === 'false')
      const score = isCorrect ? 10 : 2
      return {
        isDeterministic: true,
        correct: isCorrect,
        score,
        correctness: score,
        depth: isCorrect ? 8 : 3,
        relevance: 10,
        skill_estimate: isCorrect ? 'EXPERT' : 'NOVICE',
        concepts_detected: isCorrect ? ['Assertion validation'] : [],
        missing_concepts: isCorrect ? [] : ['Correct assertion distinction'],
        feedback_summary: isCorrect ? 'Correct boolean determination.' : 'Incorrect boolean choice.',
      }
    }

    case 'MULTIPLE_CHOICE': {
      if (expectedAnswer === undefined || expectedAnswer === null) return null
      const expKey = String(expectedAnswer).trim().toLowerCase()
      const selectedOpt = structuredAnswer?.selectedOption || structuredAnswer?.selectedOptionId || structuredAnswer?.key || null
      let isCorrect = false
      if (selectedOpt && String(selectedOpt).trim().toLowerCase() === expKey) {
        isCorrect = true
      } else if (cleanAns === expKey || cleanAns.includes(expKey) || cleanAns.endsWith(expKey)) {
        isCorrect = true
      } else if (expKey.startsWith('option ') && cleanAns.length === 1) {
        const letter = expKey.replace(/^option\s+([a-d]).*$/, '$1')
        if (cleanAns === letter) isCorrect = true
      }
      const score = isCorrect ? 10 : 2
      return {
        isDeterministic: true,
        correct: isCorrect,
        score,
        correctness: score,
        depth: isCorrect ? 8 : 3,
        relevance: 10,
        skill_estimate: isCorrect ? 'COMPETENT' : 'NOVICE',
        concepts_detected: isCorrect ? ['Accurate option selection'] : [],
        missing_concepts: isCorrect ? [] : ['Option alignment'],
        feedback_summary: isCorrect ? 'Correct multiple-choice selection.' : 'Option selection did not match expected solution.',
      }
    }

    case 'MULTI_SELECT': {
      if (!Array.isArray(expectedAnswer)) return null
      const selected = structuredAnswer?.selectedOptions || (Array.isArray(candidateAnswer) ? candidateAnswer : null)
      if (!Array.isArray(selected)) return null
      const expSet = new Set(expectedAnswer.map((s) => String(s).trim().toLowerCase()))
      const candSet = new Set(selected.map((s) => String(s).trim().toLowerCase()))
      const isCorrect = expSet.size === candSet.size && [...expSet].every((v) => candSet.has(v))
      const score = isCorrect ? 10 : 2
      return {
        isDeterministic: true,
        correct: isCorrect,
        score,
        correctness: score,
        depth: isCorrect ? 8 : 3,
        relevance: 10,
        skill_estimate: isCorrect ? 'EXPERT' : 'NOVICE',
        concepts_detected: isCorrect ? ['Multi-option criteria identification'] : [],
        missing_concepts: isCorrect ? [] : ['Incomplete option selection'],
        feedback_summary: isCorrect ? 'Correct multi-select answer.' : 'Selected options did not match expected set.',
      }
    }

    case 'FILL_IN_THE_BLANK': {
      if (expectedAnswer === undefined || expectedAnswer === null) return null
      const expClean = String(expectedAnswer).trim().toLowerCase()
      const isCorrect = cleanAns === expClean || cleanAns.includes(expClean)
      const score = isCorrect ? 10 : 2
      return {
        isDeterministic: true,
        correct: isCorrect,
        score,
        correctness: score,
        depth: isCorrect ? 8 : 3,
        relevance: 10,
        skill_estimate: isCorrect ? 'EXPERT' : 'NOVICE',
        concepts_detected: isCorrect ? ['Blank keyword accuracy'] : [],
        missing_concepts: isCorrect ? [] : ['Missing technical keyword'],
        feedback_summary: isCorrect ? `Correct fill-in-the-blank answer: "${expectedAnswer}".` : `Expected "${expectedAnswer}", got "${candidateAnswer}".`,
      }
    }

    case 'PREDICT_CODE_OUTPUT': {
      if (expectedAnswer === undefined || expectedAnswer === null) return null
      const expClean = String(expectedAnswer).trim().toLowerCase().replace(/\s+/g, '')
      const candClean = cleanAns.replace(/\s+/g, '')
      const isCorrect = candClean === expClean
      const score = isCorrect ? 10 : 2
      return {
        isDeterministic: true,
        correct: isCorrect,
        score,
        correctness: score,
        depth: isCorrect ? 8 : 3,
        relevance: 10,
        skill_estimate: isCorrect ? 'EXPERT' : 'NOVICE',
        concepts_detected: isCorrect ? ['Accurate code execution prediction'] : [],
        missing_concepts: isCorrect ? [] : ['Runtime output miscalculation'],
        feedback_summary: isCorrect ? 'Correct code output prediction.' : `Predicted "${candidateAnswer}", expected "${expectedAnswer}".`,
      }
    }

    case 'ARRANGE_ORDER': {
      if (!Array.isArray(expectedAnswer) || expectedAnswer.length === 0) return null
      const rawOrdered = structuredAnswer?.orderedItems || structuredAnswer?.items || structuredAnswer?.orderedIds || (Array.isArray(candidateAnswer) ? candidateAnswer : null)
      if (!Array.isArray(rawOrdered) || rawOrdered.length === 0) return null

      const extractKey = (val) => {
        if (!val) return ''
        if (typeof val === 'string') return val.trim().toLowerCase()
        if (typeof val === 'object') return String(val.label || val.text || val.id || '').trim().toLowerCase()
        return String(val).trim().toLowerCase()
      }

      const idToLabelMap = new Map()
      if (Array.isArray(question.items)) {
        question.items.forEach((it) => {
          if (it?.id && it?.label) {
            idToLabelMap.set(String(it.id).trim().toLowerCase(), String(it.label).trim().toLowerCase())
          }
        })
      }

      const orderedKeys = rawOrdered.map((val) => {
        const k = extractKey(val)
        return idToLabelMap.get(k) || k
      })
      const expectedKeys = expectedAnswer.map((val) => {
        const k = extractKey(val)
        return idToLabelMap.get(k) || k
      })

      const isExactMatch = JSON.stringify(orderedKeys) === JSON.stringify(expectedKeys)
      const rawIds = structuredAnswer?.orderedIds
      const isIdMatch = Array.isArray(rawIds) && JSON.stringify(rawIds.map(String)) === JSON.stringify(expectedAnswer.map(String))
      const isCorrect = isExactMatch || isIdMatch

      // Pairwise relative ordering calculation for fair partial scoring
      let pairwiseMatches = 0
      let totalPairs = 0
      for (let i = 0; i < expectedKeys.length; i++) {
        for (let j = i + 1; j < expectedKeys.length; j++) {
          totalPairs++
          const posI = orderedKeys.indexOf(expectedKeys[i])
          const posJ = orderedKeys.indexOf(expectedKeys[j])
          if (posI !== -1 && posJ !== -1 && posI < posJ) {
            pairwiseMatches++
          }
        }
      }
      const pairRatio = totalPairs > 0 ? pairwiseMatches / totalPairs : 0
      const score = isCorrect ? 10 : Math.max(1, Math.round(pairRatio * 8))

      return {
        isDeterministic: true,
        correct: isCorrect,
        score,
        correctness: score,
        depth: isCorrect ? 9 : 3,
        relevance: 10,
        skill_estimate: isCorrect ? 'EXPERT' : (score >= 6 ? 'COMPETENT' : 'NOVICE'),
        concepts_detected: isCorrect ? ['Correct sequence ordering'] : (pairRatio >= 0.5 ? ['Partial sequence ordering'] : []),
        missing_concepts: isCorrect ? [] : ['Sequence misalignment'],
        feedback_summary: isCorrect ? 'Correct sequential ordering.' : `Sequence did not match required workflow order (${pairwiseMatches}/${totalPairs} relative pairs correct).`,
      }
    }

    case 'MATCHING_PAIRS': {
      if (!expectedAnswer || typeof expectedAnswer !== 'object') return null
      const pairs = structuredAnswer?.pairs || (typeof candidateAnswer === 'object' && candidateAnswer?.pairs) || null
      if (!pairs || typeof pairs !== 'object') return null
      let allMatch = true
      for (const [k, v] of Object.entries(expectedAnswer)) {
        if (String(pairs[k] || '').trim().toLowerCase() !== String(v).trim().toLowerCase()) {
          allMatch = false
          break
        }
      }
      const isCorrect = allMatch
      const score = isCorrect ? 10 : 2
      return {
        isDeterministic: true,
        correct: isCorrect,
        score,
        correctness: score,
        depth: isCorrect ? 8 : 3,
        relevance: 10,
        skill_estimate: isCorrect ? 'EXPERT' : 'NOVICE',
        concepts_detected: isCorrect ? ['Accurate domain association'] : [],
        missing_concepts: isCorrect ? [] : ['Mismatched concept pairings'],
        feedback_summary: isCorrect ? 'All matching pairs correctly associated.' : 'Some pairs were mismatched.',
      }
    }

    case 'NUMERICAL_APTITUDE': {
      if (expectedAnswer === undefined || expectedAnswer === null) return null
      const expectedNum = Number(expectedAnswer)
      if (isNaN(expectedNum)) return null
      const candNum = typeof structuredAnswer?.numericAnswer === 'number'
        ? structuredAnswer.numericAnswer
        : (typeof candidateAnswer === 'number' ? candidateAnswer : Number(cleanAns.replace(/[^0-9.-]/g, '')))
      if (isNaN(candNum)) return null

      const tolerance = Number(question.numericalConfig?.tolerance ?? question.tolerance ?? 0.05)
      const absDiff = Math.abs(candNum - expectedNum)
      const allowedMargin = Math.max(0.0001, Math.abs(expectedNum) * tolerance)
      const isExact = absDiff === 0
      const isWithinTolerance = absDiff <= allowedMargin

      const isCorrect = isExact || isWithinTolerance
      const score = isExact ? 10 : isWithinTolerance ? 9 : 2
      return {
        isDeterministic: true,
        correct: isCorrect,
        score,
        correctness: score,
        depth: score >= 9 ? 8 : 3,
        relevance: 10,
        skill_estimate: score >= 9 ? 'EXPERT' : 'NOVICE',
        concepts_detected: score >= 9 ? ['Precise quantitative calculation'] : [],
        missing_concepts: score >= 9 ? [] : ['Calculation precision'],
        feedback_summary: score >= 9
          ? `Correct numeric calculation: ${candNum} (expected ${expectedNum}).`
          : `Calculated ${candNum}, expected ${expectedNum}.`,
      }
    }

    case 'SLIDER_SCALE': {
      if (expectedAnswer === undefined || expectedAnswer === null) return null
      const expVal = Number(expectedAnswer)
      const candVal = typeof structuredAnswer?.numericValue === 'number'
        ? structuredAnswer.numericValue
        : (typeof candidateAnswer === 'number' ? candidateAnswer : Number(cleanAns.replace(/[^0-9.-]/g, '')))
      if (isNaN(expVal) || isNaN(candVal)) return null
      const diff = Math.abs(candVal - expVal)
      const isCorrect = diff <= 1
      const score = diff === 0 ? 10 : diff <= 1 ? 8 : diff <= 2 ? 6 : 4
      return {
        isDeterministic: true,
        correct: isCorrect,
        score,
        correctness: score,
        depth: 7,
        relevance: 10,
        skill_estimate: score >= 8 ? 'EXPERT' : score >= 6 ? 'COMPETENT' : 'NOVICE',
        concepts_detected: score >= 8 ? ['Scale rating trade-off awareness'] : [],
        missing_concepts: score < 6 ? ['Scale calibration'] : [],
        feedback_summary: `Rated ${candVal} against reference ${expVal}.`,
      }
    }

    default:
      return null
  }
}

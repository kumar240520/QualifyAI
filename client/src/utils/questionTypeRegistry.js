/**
 * Client-Side Enterprise Question-Type Registry
 * Canonical definitions, descriptions, mic defaults, and normalization for all 15 question types.
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
  },
  {
    id: 'MULTI_SELECT',
    canonicalKey: 'multi_select',
    label: 'Multiple Select',
    desc: 'Candidate selects one or more valid options with partial credit support.',
    micDefault: false,
    category: 'KNOWLEDGE_EVALUATION',
    aliases: ['MULTIPLE_SELECT'],
  },
  {
    id: 'TRUE_FALSE',
    canonicalKey: 'true_false',
    label: 'True / False',
    desc: 'Binary choice assertion validating nuanced conceptual and domain precision.',
    micDefault: false,
    category: 'KNOWLEDGE_EVALUATION',
    aliases: ['YES_NO', 'BOOLEAN'],
  },
  {
    id: 'SHORT_ANSWER',
    canonicalKey: 'short_answer',
    label: 'Short Answer',
    desc: 'Direct, brief textual or spoken answer (1-2 sentences) testing concise articulation.',
    micDefault: true,
    category: 'VERBAL_ARTICULATION',
    aliases: [],
  },
  {
    id: 'DESCRIPTIVE',
    canonicalKey: 'descriptive',
    label: 'Descriptive / Open-Ended',
    desc: 'In-depth architectural, strategic, or trade-off reasoning with adaptive follow-ups.',
    micDefault: true,
    category: 'VERBAL_ARTICULATION',
    aliases: ['ESSAY', 'OPEN_ENDED', 'BEHAVIORAL'],
  },
  {
    id: 'FILL_IN_THE_BLANK',
    canonicalKey: 'fill_blank',
    label: 'Fill in the Blank',
    desc: 'Statement, syntax, or expression with missing keyword or value to complete.',
    micDefault: false,
    category: 'TECHNICAL_PRECISION',
    aliases: ['FILL_BLANK'],
  },
  {
    id: 'CODING_CHALLENGE',
    canonicalKey: 'coding_challenge',
    label: 'Coding Challenge',
    desc: 'Programming problem with description, constraints, and starter code editor.',
    micDefault: false,
    category: 'SOFTWARE_ENGINEERING',
    aliases: ['CODE_WRITING', 'SQL', 'CODING'],
  },
  {
    id: 'PREDICT_CODE_OUTPUT',
    canonicalKey: 'predict_output',
    label: 'Predict the Code Output',
    desc: 'Read-only code snippet; candidate analyzes execution and predicts output state.',
    micDefault: false,
    category: 'CODE_ANALYSIS',
    aliases: ['CODE_OUTPUT', 'PREDICT_OUTPUT'],
  },
  {
    id: 'DEBUGGING',
    canonicalKey: 'debugging',
    label: 'Debugging / Find the Error',
    desc: 'Code snippet or scenario containing a defect; candidate pinpoints and corrects it.',
    micDefault: false,
    category: 'CODE_ANALYSIS',
    aliases: ['FIND_THE_ERROR', 'BUG_HUNT'],
  },
  {
    id: 'COMPLETE_THE_CODE',
    canonicalKey: 'complete_code',
    label: 'Complete the Code',
    desc: 'Incomplete code with missing statements; candidate writes the missing implementation.',
    micDefault: false,
    category: 'SOFTWARE_ENGINEERING',
    aliases: ['CODE_COMPLETION', 'COMPLETE_CODE'],
  },
  {
    id: 'ARRANGE_ORDER',
    canonicalKey: 'ordering',
    label: 'Arrange in the Correct Order',
    desc: 'Interactive reorderable sequence of workflow stages, algorithm steps, or layers.',
    micDefault: false,
    category: 'LOGICAL_REASONING',
    aliases: ['ORDERING', 'SEQUENCE'],
  },
  {
    id: 'SELECT_MOST_APPROPRIATE',
    canonicalKey: 'best_option',
    label: 'Select the Most Appropriate Option',
    desc: 'Real-world situational judgment, incident response, and trade-off decision making.',
    micDefault: false,
    category: 'SITUATIONAL_JUDGMENT',
    aliases: ['SCENARIO', 'SITUATIONAL', 'BEST_OPTION'],
  },
  {
    id: 'SLIDER_SCALE',
    canonicalKey: 'slider',
    label: 'Slider / Numeric Scale',
    desc: 'Continuous or stepped scale assessing architectural priority, trade-off, or rating.',
    micDefault: false,
    category: 'QUANTITATIVE_RATING',
    aliases: ['SLIDER', 'NUMERIC_SCALE'],
  },
  {
    id: 'MATCHING_PAIRS',
    canonicalKey: 'matching',
    label: 'Matching / Pairing',
    desc: 'Two sets of related terms or concepts to associate into correct pairs.',
    micDefault: false,
    category: 'LOGICAL_REASONING',
    aliases: ['MATCHING', 'PAIRING'],
  },
  {
    id: 'NUMERICAL_APTITUDE',
    canonicalKey: 'numerical',
    label: 'Numerical / Aptitude Problem',
    desc: 'Quantitative reasoning, calculation, math problem, or complexity estimation.',
    micDefault: false,
    category: 'QUANTITATIVE_RATING',
    aliases: ['APTITUDE', 'MATH_CALCULATION', 'NUMERICAL', 'MATH'],
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

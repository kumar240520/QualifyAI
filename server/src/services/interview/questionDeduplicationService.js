/**
 * Enterprise Question Deduplication and Topic Diversity Engine
 * 
 * Invariants:
 * 1. Reject exact duplicates (case-insensitive, normalized punctuation).
 * 2. Reject near-duplicates that test the same core concept with superficial wording differences.
 * 3. Reject duplicate mathematical calculations that merely change numerical constants
 *    (e.g., $50,000 / 100 points vs $40,000 / 80 points).
 * 4. Enforce subtopic diversity within each pillar.
 */

/**
 * Normalizes text for semantic comparison: lowercases, strips digits, punctuation, and filler words.
 */
export function normalizeSemanticFingerprint(text = '') {
  if (!text || typeof text !== 'string') return ''
  return text
    .toLowerCase()
    .replace(/[0-9]+/g, '<NUM>') // Abstract numbers to detect duplicate calculations
    .replace(/[$€£¥%]/g, '<SYM>')
    .replace(/[^a-z<>]+/g, ' ')
    .trim()
}

/**
 * Extracts calculation signature from question text if numerical reasoning is involved.
 */
export function extractCalculationSignature(text = '') {
  const t = String(text || '').toLowerCase()
  const signatures = []

  // Check for common calculation patterns
  if (/(velocity|story point|sprint).*(cost|budget|dollar|\$)/i.test(t) || /(cost|budget|\$).*(velocity|story point)/i.test(t)) {
    signatures.push('CALC_STORY_POINT_COST')
  }
  if (/(percentage|percent|increase|decrease|discount|margin)/i.test(t)) {
    signatures.push('CALC_PERCENTAGE')
  }
  if (/(ratio|proportion|share|divide in the ratio)/i.test(t)) {
    signatures.push('CALC_RATIO')
  }
  if (/(average|mean|weighted average)/i.test(t)) {
    signatures.push('CALC_AVERAGE')
  }
  if (/(speed|distance|time|travel|train|relative speed)/i.test(t)) {
    signatures.push('CALC_SPEED_DISTANCE_TIME')
  }
  if (/(time and work|days to complete|efficiency|working together)/i.test(t)) {
    signatures.push('CALC_TIME_AND_WORK')
  }
  if (/(profit|loss|cost price|selling price|markup)/i.test(t)) {
    signatures.push('CALC_PROFIT_LOSS')
  }
  if (/(mother of|father of|sister of|brother of|daughter of|son of|related to)/i.test(t)) {
    signatures.push('REASONING_FAMILY_RELATIONSHIP')
  }

  return signatures
}

/**
 * Computes word-level Jaccard similarity between two strings.
 */
export function computeJaccardSimilarity(textA = '', textB = '') {
  const wordsA = new Set(String(textA).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((w) => w.length > 2))
  const wordsB = new Set(String(textB).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((w) => w.length > 2))

  if (wordsA.size === 0 || wordsB.size === 0) return 0
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)))
  const union = new Set([...wordsA, ...wordsB])

  return union.size > 0 ? intersection.size / union.size : 0
}

/**
 * Evaluates whether candidate question is an exact duplicate, near-duplicate,
 * or equivalent calculation of any existing questions in the interview pool or history.
 * 
 * @param {Object} candidateQuestion - Question to validate
 * @param {Array<Object>} existingQuestions - Already generated or asked questions
 * @returns {{ isDuplicate: boolean, reason?: string, matchedQuestion?: Object }}
 */
export function checkDuplicateQuestion(candidateQuestion, existingQuestions = []) {
  const candText = String(candidateQuestion?.text || candidateQuestion?.question_text || '').trim()
  if (!candText) {
    return { isDuplicate: false }
  }

  const candFingerprint = normalizeSemanticFingerprint(candText)
  const candSignatures = extractCalculationSignature(candText)
  const candCriterionId = candidateQuestion.rubricCriterionId || candidateQuestion.rubric_criterion_id

  for (const existing of existingQuestions) {
    if (!existing) continue
    const existText = String(existing.text || existing.question_text || '').trim()
    if (!existText) continue

    // 1. Exact textual match check (normalized spaces and punctuation)
    if (candText.toLowerCase().replace(/[^a-z0-9]+/g, ' ') === existText.toLowerCase().replace(/[^a-z0-9]+/g, ' ')) {
      return {
        isDuplicate: true,
        reason: 'Exact textual match with previously generated question.',
        matchedQuestion: existing,
      }
    }

    // 2. Normalized Semantic Fingerprint Match (stripping numbers/symbols)
    const existFingerprint = normalizeSemanticFingerprint(existText)
    if (candFingerprint === existFingerprint && candFingerprint.length > 25) {
      return {
        isDuplicate: true,
        reason: 'Identical semantic structure with only altered numerical values or superficial tokens.',
        matchedQuestion: existing,
      }
    }

    // 3. High Jaccard Lexical Overlap (> 75%)
    const similarity = computeJaccardSimilarity(candFingerprint, existFingerprint)
    if (similarity >= 0.75) {
      return {
        isDuplicate: true,
        reason: `High lexical and conceptual similarity (${Math.round(similarity * 100)}%) with prior question.`,
        matchedQuestion: existing,
      }
    }

    // 4. Duplicate Calculation Signature check (Requirement 12)
    const existSignatures = extractCalculationSignature(existText)
    const commonSigs = candSignatures.filter((sig) => existSignatures.includes(sig))
    if (commonSigs.length > 0) {
      const existCriterionId = existing.rubricCriterionId || existing.rubric_criterion_id
      const samePillar = !candCriterionId || !existCriterionId || candCriterionId === existCriterionId
      if (samePillar && (similarity >= 0.35 || commonSigs.includes('CALC_STORY_POINT_COST'))) {
        return {
          isDuplicate: true,
          reason: `Repeats equivalent calculation (${commonSigs.join(', ')}) without providing new assessment signal.`,
          matchedQuestion: existing,
        }
      }
    }
  }

  return { isDuplicate: false }
}

/**
 * Checks whether the candidate question promotes topic diversity within its pillar.
 */
export function checkTopicDiversity(candidateQuestion, existingQuestionsInPillar = []) {
  if (!existingQuestionsInPillar || existingQuestionsInPillar.length === 0) {
    return { isDiverse: true }
  }

  const candSubtopic = candidateQuestion.subtopicId || candidateQuestion.topic
  if (!candSubtopic) return { isDiverse: true }

  const subtopicCounts = existingQuestionsInPillar.filter(
    (q) => (q.subtopicId || q.topic) === candSubtopic
  ).length

  // If this subtopic has already been tested twice while other subtopics in the pillar exist
  if (subtopicCounts >= 2) {
    return {
      isDiverse: false,
      reason: `Subtopic "${candSubtopic}" is already well represented (${subtopicCounts} questions) in this pillar.`,
    }
  }

  return { isDiverse: true }
}

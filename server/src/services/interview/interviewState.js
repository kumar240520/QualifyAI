export function validateActiveQuestionAnswer(metadata = {}, { questionId, questionSequence } = {}) {
  const currentSequence = Number(metadata.current_question_sequence) || 0
  const answered = Array.isArray(metadata.answered_sequences) ? metadata.answered_sequences : []
  const activeQuestion = metadata.current_question

  if (typeof questionSequence === 'number' && answered.includes(questionSequence)) {
    const committed = (metadata.answer_history || []).find((answer) => answer.questionSequence === questionSequence)
    if (!committed || committed.questionId !== questionId) {
      const error = new Error('The answer does not match the question that was committed for this sequence.')
      error.status = 409
      throw error
    }
    return { duplicate: true, currentSequence, activeQuestion }
  }
  if (
    !activeQuestion ||
    !questionId ||
    questionId !== activeQuestion.id ||
    questionSequence !== currentSequence
  ) {
    const error = new Error('The answer does not match the currently active interview question.')
    error.status = 409
    throw error
  }
  return { duplicate: false, currentSequence, activeQuestion }
}

export function isQuestionSequenceNewer(currentSequence, incomingSequence) {
  return Number.isFinite(incomingSequence) && incomingSequence > currentSequence
}

export function parseInterviewDurationMinutes(...values) {
  for (const value of values) {
    const match = String(value ?? '').match(/\d+/)
    const minutes = Number(match?.[0])
    if (Number.isFinite(minutes) && minutes > 0) return minutes
  }
  return 20
}

export function createAnswerCommit({ sessionId, answerId, question, answerText, inputMode, committedAt }) {
  return {
    sessionId,
    answerId,
    questionId: question.id,
    questionSequence: question.sequence,
    answerText: String(answerText).trim(),
    inputMode,
    committedAt,
  }
}

/**
 * Detects whether candidate utterance is a request to repeat, re-read, or clarify the question.
 */
export function isRepeatQuestionRequest(text) {
  if (!text || typeof text !== 'string') return false
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (clean.length < 3 || clean.length > 90) return false

  const exactPhrases = [
    'repeat',
    'repeat please',
    'please repeat',
    'repeat question',
    'repeat the question',
    'please repeat the question',
    'can you repeat',
    'can you repeat please',
    'can you repeat that',
    'can you repeat that please',
    'can you repeat the question',
    'can you repeat the question please',
    'could you repeat',
    'could you repeat please',
    'could you repeat that',
    'could you repeat that please',
    'could you repeat the question',
    'could you repeat the question please',
    'would you repeat that',
    'would you repeat the question',
    'say that again',
    'can you say that again',
    'could you say that again',
    'say that again please',
    'pardon',
    'pardon me',
    'beg your pardon',
    'come again',
    'what was the question',
    'what did you say',
    'i didnt hear you',
    "i didn't hear you",
    'i didnt hear you well',
    "i didn't hear you well",
    'i could not hear you',
    "i couldn't hear you",
    "i didn't catch that",
    'i didnt catch that',
    'what is the question',
  ]

  if (exactPhrases.includes(clean)) return true

  const patterns = [
    /\b(can|could|would)\s+(you\s+)?(please\s+)?repeat(\s+that|\s+it|\s+the\s+question)?(\s+please)?\b/,
    /\b(can|could|would)\s+(you\s+)?(please\s+)?say\s+that\s+again\b/,
    /\b(please\s+)?repeat\s+(the\s+question|that|it)\b/,
    /\b(i\s+)?(didn't|did\s+not|couldn't|could\s+not)\s+(hear|catch)\s+(you|that|it|the\s+question)\b/,
    /\bwhat\s+(was|is)\s+the\s+question\b/,
    /\b(can\s+you|could\s+you|please)\s+repeat\b/,
  ]

  return patterns.some((p) => p.test(clean))
}

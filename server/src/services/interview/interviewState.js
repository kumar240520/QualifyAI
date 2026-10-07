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

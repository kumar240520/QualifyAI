export function getQuestionEventSequence(event, lastProcessedSequence = -1) {
  if (typeof event?.questionSequence === 'number') return event.questionSequence
  if (typeof event?.question?.sequence === 'number') return event.question.sequence
  if (typeof event?.sequence === 'number') return event.sequence
  return lastProcessedSequence + 1
}

export function shouldAcceptQuestionEvent(event, lastProcessedSequence = -1) {
  return Boolean(event?.question) && getQuestionEventSequence(event, lastProcessedSequence) > lastProcessedSequence
}

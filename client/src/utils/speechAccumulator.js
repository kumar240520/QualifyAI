/**
 * QualifyAI - Speech Accumulator & Reconciliation Utility
 *
 * Provides authoritative speech accumulation across pauses, recognition restarts,
 * cumulative/delta transcription streams, and manual candidate keyboard edits.
 */

/**
 * Appends a newly transcribed speech segment onto an existing base text,
 * guaranteeing no duplicated words, proper spacing/punctuation, and handling
 * both delta-style and cumulative speech recognition engines.
 *
 * @param {string} baseText - The existing accumulated or manually entered text
 * @param {string} newSegment - The newly emitted speech segment (interim or final)
 * @returns {string} The reconciled, accumulated text
 */
export function appendSpeechSegment(baseText, newSegment) {
  const base = (baseText || '').trim()
  const segment = (newSegment || '').trim()

  if (!base) return segment
  if (!segment) return base

  // 1. Exact match / identical segment
  if (base === segment) return base

  // 2. Cumulative provider: newSegment already starts with the base
  if (segment.startsWith(base)) return segment
  if (segment.toLowerCase().startsWith(base.toLowerCase())) return segment

  // 3. Repeated delivery: base already ends with the new segment
  if (base.endsWith(segment)) return base
  if (base.toLowerCase().endsWith(segment.toLowerCase())) return base

  // 4. Punctuation prefix (e.g. segment starts with comma or period)
  if (/^[.,!?;:]/.test(segment)) {
    return `${base}${segment}`
  }

  // 5. Standard segment appending with single clean space
  return `${base} ${segment}`
}

/**
 * Reconciles incoming candidate speech with existing manual keyboard edits
 * and the persisted speech buffer.
 *
 * @param {Object} params
 * @param {string} params.currentAnswer - Current value in the answer textarea
 * @param {string} params.speechBuffer - Persisted finalized speech buffer
 * @param {string} params.incomingSpeech - The latest speech text from the engine
 * @param {boolean} params.isFinal - Whether incomingSpeech is a confirmed final segment
 * @returns {{ accumulated: string, buffer: string }}
 */
export function reconcileSpeechWithAnswer({
  currentAnswer = '',
  speechBuffer = '',
  incomingSpeech = '',
  isFinal = false,
}) {
  const currentStr = (currentAnswer || '').trim()
  const bufferStr = (speechBuffer || '').trim()
  const rawSpeech = (incomingSpeech || '').trim()

  if (!rawSpeech) {
    return {
      accumulated: currentStr || bufferStr,
      buffer: bufferStr,
    }
  }

  // Determine authoritative base text:
  // If the candidate typed or modified the answer in the textarea,
  // that manual text is authoritative and must NOT be discarded.
  let authoritativeBase = bufferStr
  if (currentStr && currentStr !== bufferStr) {
    authoritativeBase = currentStr
  }

  if (isFinal) {
    const finalized = appendSpeechSegment(authoritativeBase, rawSpeech)
    return {
      accumulated: finalized,
      buffer: finalized,
    }
  }

  // Interim preview: append raw speech to base for real-time display
  const preview = appendSpeechSegment(authoritativeBase, rawSpeech)
  return {
    accumulated: preview,
    buffer: authoritativeBase, // Buffer only commits finalized speech
  }
}

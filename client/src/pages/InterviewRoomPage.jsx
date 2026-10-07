import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Maximize2,
  PhoneOff,
  Send,
  Mic,
  MicOff,
  Volume2,
} from 'lucide-react'
import { interviewService } from '../services/interviewService.js'
import { VoiceInterviewEngine } from '../services/voiceInterviewEngine.js'
import { proctoringService } from '../services/proctoringService.js'
import {
  normalizeQuestion,
  isThoughtOrMetaPlanning,
  extractCleanQuestionPrompt,
} from '../utils/questionNormalizer.js'
import { getQuestionEventSequence, shouldAcceptQuestionEvent } from '../utils/questionEvent.js'

// Subcomponents
import InterviewHeader from '../components/interview/InterviewHeader.jsx'
import AIInterviewerPanel from '../components/interview/AIInterviewerPanel.jsx'
import ActiveQuestionPanel from '../components/interview/ActiveQuestionPanel.jsx'
import QuestionRenderer from '../components/interview/QuestionRenderer.jsx'
import ConversationStream from '../components/interview/ConversationStream.jsx'

/**
 * Determines whether a question requires open-ended conversational voice/essay input.
 * ONLY descriptive, short-answer, and behavioral questions keep the microphone unmuted by default.
 * Multiple choice, coding, SQL, output, and boolean questions default the microphone to MUTED.
 */
function isLongFormVoiceQuestion(questionOrType) {
  if (!questionOrType) return false
  const t = typeof questionOrType === 'string'
    ? questionOrType.toUpperCase()
    : String(questionOrType.type || '').toUpperCase()
  return ['DESCRIPTIVE', 'SHORT_ANSWER', 'BEHAVIORAL'].includes(t)
}

/**
 * Recognizes conversational requests by the candidate to repeat or clarify the active question.
 */
function isRepeatQuestionRequest(text) {
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

export default function InterviewRoomPage() {
  const { token } = useParams()
  const navigate = useNavigate()

  // Core Session State & Canonical Sequencing
  const [session, setSession] = useState(null)
  const [transcripts, setTranscripts] = useState([])
  const [currentQuestionData, setCurrentQuestionData] = useState(null)
  const [activeQuestion, setActiveQuestion] = useState(null)
  const [activeQuestionText, setActiveQuestionText] = useState('')
  const [coverageMatrix, setCoverageMatrix] = useState([])
  const [sequence, setSequence] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [totalDurationMinutes, setTotalDurationMinutes] = useState(0)
  const [wrapUpStarted, setWrapUpStarted] = useState(false)
  const [candidateFeedback, setCandidateFeedback] = useState('')
  const [candidateAiRating, setCandidateAiRating] = useState(null)
  const lastProcessedSequenceRef = useRef(-1)
  const lastSubmittedSequenceRef = useRef(-1)
  const hasRequestedWrapUpRef = useRef(false)
  const hasCompletedOnTimerRef = useRef(false)
  const candidateFeedbackRef = useRef('')
  const candidateAiRatingRef = useRef(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)
  const [lastAnalysis, setLastAnalysis] = useState(null)

  // Dynamic Answer Input State
  const [answerInputValue, setAnswerInputValue] = useState('')
  const [candidateInterimText, setCandidateInterimText] = useState('')
  const candidateSpeechBufferRef = useRef('')

  // Secondary Conversation Drawer State
  const [isConversationDrawerOpen, setIsConversationDrawerOpen] = useState(false)

  // AI Evaluator Silence & Patience Policy State
  const [nudgeCount, setNudgeCount] = useState(0) // 0: none, 1: nudge 1, 2: nudge 2
  const [unansweredQuestionsCount, setUnansweredQuestionsCount] = useState(0) // Server concludes after 3 consecutive unanswered questions
  const [isTerminatedForUnanswered, setIsTerminatedForUnanswered] = useState(false)
  const [silenceSeconds, setSilenceSeconds] = useState(0)
  const silenceTimerRef = useRef(null)

  // Assessment Integrity & 3-Warnings Proctoring State
  const [warningsCount, setWarningsCount] = useState(0)
  const [warningsHistory, setWarningsHistory] = useState([])
  const [integrityWarning, setIntegrityWarning] = useState(null)
  const [showFullscreenLockModal, setShowFullscreenLockModal] = useState(false)
  const [isTerminatedForViolations, setIsTerminatedForViolations] = useState(false)
  const proctoringTrackerRef = useRef(null)

  // Real-Time Voice Engine State
  const [voiceState, setVoiceState] = useState('CONNECTING')
  const [audioLevel, setAudioLevel] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [speechLanguage, setSpeechLanguage] = useState('en-IN')
  const [liveAiSpeech, setLiveAiSpeech] = useState('')
  const [preventInterruption, setPreventInterruption] = useState(true)
  const voiceEngineRef = useRef(null)
  const autoSubmitTimerRef = useRef(null)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const activeQuestionRef = useRef(activeQuestion)
  activeQuestionRef.current = activeQuestion
  const isSubmittingRef = useRef(isSubmitting)
  isSubmittingRef.current = isSubmitting
  const voiceStateRef = useRef(voiceState)
  voiceStateRef.current = voiceState
  const preventInterruptionRef = useRef(preventInterruption)
  preventInterruptionRef.current = preventInterruption
  const handleSubmitAnswerRef = useRef(null)
  const lastSpeechActivityTimeRef = useRef(0)
  const lastScheduledTextRef = useRef('')
  const isCandidateTurnLockedRef = useRef(true)
  const lastTypingActivityTimeRef = useRef(0)
  const autoMutedForNonDescriptiveRef = useRef(false)
  const liveAiSpeechStreamRef = useRef('')

  // 2-second warmup buffer after arriving in room before AI speaks
  const [roomStartupCountdown, setRoomStartupCountdown] = useState(2)
  const hasTriggeredInterviewStartRef = useRef(false)

  // Activate Proctoring Telemetry Tracker on session start (Strict 3-warning limit)
  useEffect(() => {
    if (session?.interview_id && !isCompleted && !isTerminatedForViolations) {
      proctoringTrackerRef.current = proctoringService.createTracker(session.interview_id, {
        maxWarnings: 3,
        onWarning: ({ count, maxWarnings, violation, message }) => {
          setWarningsCount(count)
          setWarningsHistory((prev) => [...prev, violation])
          setIntegrityWarning(message)
          if (violation.type === 'FULLSCREEN_EXIT') {
            setShowFullscreenLockModal(true)
          }
          setTimeout(() => {
            setIntegrityWarning(null)
          }, 4500)
        },
        onTerminate: async ({ count, maxWarnings, reason, history }) => {
          console.warn('[Integrity] Maximum warnings exceeded (3/3). Auto-terminating session.')
          setIsTerminatedForViolations(true)
          setIsCompleted(true)
          setShowFullscreenLockModal(false)

          if (voiceEngineRef.current) {
            voiceEngineRef.current.stop()
            voiceEngineRef.current = null
          }

          try {
            const targetId = session?.interview_id || session?.id || 'auto'
            await interviewService.completeInterview(targetId, token)
          } catch (err) {
            console.warn('Auto-termination completion notice:', err.message)
          }
        },
      })

      return () => {
        proctoringTrackerRef.current?.destroy()
      }
    }
  }, [session?.interview_id, isCompleted, isTerminatedForViolations, token])

  // Fullscreen state listener: prompt modal if candidate exits fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        setShowFullscreenLockModal(false)
      } else if (!isCompleted && !isTerminatedForViolations && session?.id) {
        setShowFullscreenLockModal(true)
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [isCompleted, isTerminatedForViolations, session?.id])

  // Helper to extract clean active question line (satisfies UI test & display)
  const getMainQuestionLine = () => {
    return activeQuestion?.text || activeQuestionText || 'Waiting for the interviewer...'
  }

  // Canonical AI Question Event Handler with Monotonic Sequence Invariant
  const handleIncomingAiQuestion = (event) => {
    if (!shouldAcceptQuestionEvent(event, lastProcessedSequenceRef.current)) return
    if (event.sessionId && session?.id && event.sessionId !== session.id) return
    const incomingSeq = getQuestionEventSequence(event, lastProcessedSequenceRef.current)

    // CRITICAL MONOTONIC SEQUENCE GUARD:
    // Client must NEVER accept an older or equal sequence question after a newer question has been received!
    if (incomingSeq <= lastProcessedSequenceRef.current) {
      console.log(`[InterviewRoom] Monotonic Guard: Ignoring question event with sequence ${incomingSeq} <= lastProcessed ${lastProcessedSequenceRef.current}`)
      return
    }

    console.log(`[InterviewRoom] Authoritative AI Question accepted: Sequence #${incomingSeq}`)
    lastProcessedSequenceRef.current = incomingSeq
    setSequence(incomingSeq)

    const qObj = event.question
    const qText = qObj.question_text || qObj.text || ''
    setCurrentQuestionData(qObj)
    setActiveQuestionText(qText)

    const normalized = normalizeQuestion(qObj, qText, incomingSeq)
    setActiveQuestion(normalized)

    // Record authoritative AI Question into transcripts SMS dialogue stream
    setTranscripts((prev) => {
      const alreadyHas = prev.some((t) => t.sequence === incomingSeq && t.speaker === 'AI')
      if (alreadyHas) return prev
      return [
        ...prev,
        {
          id: `ai-q-${incomingSeq}-${Date.now()}`,
          speaker: 'AI',
          sequence: incomingSeq,
          content: qText || qObj.spoken_lead_in || '',
          created_at: new Date().toISOString(),
        },
      ]
    })

    // Clear autoSubmitTimer if active
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current)
      autoSubmitTimerRef.current = null
    }

    // Reset candidate answer inputs and speech buffers for a clean response window
    setAnswerInputValue('')
    candidateSpeechBufferRef.current = ''
    setCandidateInterimText('')
    lastScheduledTextRef.current = ''
    lastSpeechActivityTimeRef.current = 0
    if (lastSubmittedSequenceRef.current === incomingSeq) {
      lastSubmittedSequenceRef.current = -1
    }
    setIsSubmitting(false)

    // STRICT PACING GUARD: Lock candidate turn while AI presents the question!
    // The candidate cannot answer or auto-submit until AI finishes speaking!
    isCandidateTurnLockedRef.current = true
    setVoiceState('SPEAKING')
    setNudgeCount(0)
    setSilenceSeconds(0)

    if (typeof event.remainingSeconds === 'number') {
      setRemainingSeconds(event.remainingSeconds)
    }

    // Flush speech recognition recognition tokens so residual words don't bleed into new question
    if (voiceEngineRef.current) {
      voiceEngineRef.current.resetCandidateSpeechRecognition()
    }

    // Question-type microphone gating:
    // ONLY descriptive, short-answer, and behavioral questions keep microphone unmuted.
    // Multiple-choice, code, SQL, output, and boolean questions default microphone to MUTED!
    const incomingType = normalized?.type || qObj?.type
    const isVoiceType = isLongFormVoiceQuestion(incomingType)
    if (!isVoiceType) {
      console.log(`[InterviewRoom] Non-descriptive question (${incomingType}). Defaulting microphone to MUTED.`)
      autoMutedForNonDescriptiveRef.current = true
      if (voiceEngineRef.current) {
        voiceEngineRef.current.setMute(true)
      }
      setIsMuted(true)
    } else if (autoMutedForNonDescriptiveRef.current) {
      console.log('[InterviewRoom] Transitioning to descriptive question. Restoring unmuted microphone.')
      autoMutedForNonDescriptiveRef.current = false
      if (voiceEngineRef.current) {
        voiceEngineRef.current.setMute(false)
      }
      setIsMuted(false)
    }

    // Deliver spoken lead-in if voice engine is active and speakAloud is requested
    const spokenLeadIn = qObj.spoken_lead_in || qText
    setLiveAiSpeech(spokenLeadIn)
    liveAiSpeechStreamRef.current = ''

    if (voiceEngineRef.current && spokenLeadIn && event.speakAloud !== false && !event.alreadyTriggeredOnServer) {
      voiceEngineRef.current.speakAiQuestion(spokenLeadIn)
    } else if (event.speakAloud === false) {
      // If voice engine is explicitly not speaking aloud, unlock candidate after brief reading delay (1.5s)
      setTimeout(() => {
        isCandidateTurnLockedRef.current = false
        if (!isVoiceType) {
          autoMutedForNonDescriptiveRef.current = true
          if (voiceEngineRef.current) voiceEngineRef.current.setMute(true)
          setIsMuted(true)
        } else {
          setVoiceState('LISTENING')
        }
      }, 1500)
    }
  }

  // Initialize Interview Session
  const initInterview = async () => {
    if (!token) {
      setError('Invitation token is missing.')
      setIsLoading(false)
      return
    }

    try {
      const data = await interviewService.startInterview(token)
      setSession(data.session)
      setTranscripts(data.transcripts || [])
      if (!data.currentQuestion && !data.isCompleted) {
        throw new Error('The interview session did not provide an active question.')
      }

      if (data.currentQuestionEvent) {
        handleIncomingAiQuestion(data.currentQuestionEvent)
      }

      const hydratedSeq = typeof data.sequence === 'number'
        ? data.sequence
        : typeof data.currentQuestion?.sequence === 'number'
        ? data.currentQuestion.sequence
        : 0

      // Only set initial question if it's newer than whatever we've already processed
      if (!data.currentQuestionEvent && hydratedSeq > lastProcessedSequenceRef.current) {
        lastProcessedSequenceRef.current = hydratedSeq
        setSequence(hydratedSeq)

        const initialQ = data.currentQuestion?.question_text || ''

        setCurrentQuestionData(data.currentQuestion || { question_text: initialQ })
        setActiveQuestionText(initialQ)

        const normalized = normalizeQuestion(
          data.currentQuestion || { question_text: initialQ },
          initialQ,
          hydratedSeq
        )
        setActiveQuestion(normalized)
        setLiveAiSpeech(data.currentQuestion?.spoken_lead_in || initialQ)
        isCandidateTurnLockedRef.current = true
        setVoiceState('SPEAKING')

        setTranscripts((prev) => {
          if (prev.length > 0) return prev
          return [
            {
              id: `ai-q-0-${Date.now()}`,
              speaker: 'AI',
              sequence: 0,
              content: initialQ,
              created_at: new Date().toISOString(),
            },
          ]
        })
      }

      setRemainingSeconds(data.remainingSeconds ?? data.session?.remaining_seconds ?? 0)
      setTotalDurationMinutes(data.session?.duration_minutes ?? 0)
      setCoverageMatrix(data.coverageMatrix || data.session?.session_metadata?.coverage_matrix || [])
      setWrapUpStarted(Boolean(data.session?.session_metadata?.wrap_up_started))
      hasRequestedWrapUpRef.current = Boolean(data.session?.session_metadata?.wrap_up_started)
      setIsCompleted(data.interview?.status === 'COMPLETED')
    } catch (err) {
      console.error('Failed to start interview:', err)
      setError(err.message || 'Unable to connect to interview session.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    initInterview()
  }, [token])

  useEffect(() => {
    if (!session?.id || isCompleted || isLoading) return undefined
    const timer = setInterval(() => {
      setRemainingSeconds((previous) => {
        const next = Math.max(0, previous - 1)
        if (next <= 120 && next > 0 && !hasRequestedWrapUpRef.current) {
          hasRequestedWrapUpRef.current = true
          interviewService.startWrapUp(session.id, token).then((result) => {
            if (result.isCompleted) {
              setIsCompleted(true)
              return
            }
            if (result.session) setSession(result.session)
            if (result.coverageMatrix) setCoverageMatrix(result.coverageMatrix)
            setWrapUpStarted(true)
            if (result.nextQuestion) {
              handleIncomingAiQuestion({ sequence: result.sequence, question: result.nextQuestion, remainingSeconds: result.remainingSeconds, speakAloud: true })
            }
          }).catch((err) => {
            hasRequestedWrapUpRef.current = false
            console.warn('Unable to start feedback wrap-up:', err.message)
          })
        }
        if (next === 0 && !hasCompletedOnTimerRef.current) {
          hasCompletedOnTimerRef.current = true
          interviewService.completeInterview(session.interview_id || session.id, token, candidateFeedbackRef.current, candidateAiRatingRef.current)
            .catch((err) => console.warn('Timer completion notice:', err.message))
            .finally(() => setIsCompleted(true))
        }
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [session?.id, session?.interview_id, token, isCompleted, isLoading])

  // 2-second warmup countdown buffer after candidate lands in room
  useEffect(() => {
    if (!session?.id || isLoading || isCompleted || hasTriggeredInterviewStartRef.current) {
      return
    }

    if (roomStartupCountdown > 0) {
      const timer = setTimeout(() => {
        setRoomStartupCountdown((prev) => {
          const next = prev - 1
          if (next <= 0) {
            hasTriggeredInterviewStartRef.current = true
            console.log(
              '[InterviewRoom] 2-second warmup buffer elapsed. Candidate seated in room; triggering AI interview start.'
            )
            if (voiceEngineRef.current) {
              voiceEngineRef.current.markCandidateEnteredRoom()
            }
          }
          return next
        })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [session?.id, isLoading, isCompleted, roomStartupCountdown])

  // AI Evaluator Silence & Patience Monitor (10s intervals for nudges & advance)
  useEffect(() => {
    if (
      isCompleted ||
      isTerminatedForViolations ||
      isTerminatedForUnanswered ||
      isLoading ||
      isSubmitting
    ) {
      if (silenceTimerRef.current) clearInterval(silenceTimerRef.current)
      return
    }

    const interval = setInterval(() => {
      // 1. Active Speech Pause Watchdog:
      // If candidate has spoken text (>= 4 chars), has paused for >= 6.0s (5-7s calibration requirement),
      // candidate turn is unlocked, and is not currently submitting:
      const recordedSpeech = (candidateSpeechBufferRef.current || candidateInterimText || '').trim()
      const timeSinceLastSpeech = Date.now() - (lastSpeechActivityTimeRef.current || 0)
      const currentActiveQ = activeQuestionRef.current
      const isVoiceQ = isLongFormVoiceQuestion(currentActiveQ)

      if (
        isVoiceQ &&
        !isCandidateTurnLockedRef.current &&
        recordedSpeech.length >= 4 &&
        lastSpeechActivityTimeRef.current > 0 &&
        timeSinceLastSpeech >= 6000 &&
        !isSubmittingRef.current &&
        !isCompleted &&
        voiceStateRef.current !== 'SPEAKING'
      ) {
        if (isRepeatQuestionRequest(recordedSpeech)) {
          console.log('[InterviewRoom] Pause watchdog intercepted repeat query:', recordedSpeech)
          handleRepeatCurrentQuestion()
          return
        }
        console.log('[InterviewRoom] Pause watchdog triggered. Auto-submitting speech answer after 6.0s pause.')
        if (autoSubmitTimerRef.current) {
          clearTimeout(autoSubmitTimerRef.current)
          autoSubmitTimerRef.current = null
        }
        if (handleSubmitAnswerRef.current) {
          handleSubmitAnswerRef.current(recordedSpeech, 'VOICE')
        }
        return
      }

      // Active typing activity watchdog:
      // If candidate was actively typing within the last 25 seconds, reset silence timer!
      const hasRecentTyping = (Date.now() - (lastTypingActivityTimeRef.current || 0)) < 25000

      if (
        voiceState === 'SPEAKING' ||
        audioLevel > 0.20 ||
        candidateInterimText ||
        hasRecentTyping ||
        isSubmitting
      ) {
        setSilenceSeconds(0)
        return
      }

      setSilenceSeconds((prev) => {
        const next = prev + 1

        // Silence Nudge 1: after 35 seconds of true silence (allows candidate time to read options/code)
        if (next >= 35 && nudgeCount === 0) {
          setNudgeCount(1)
          if (voiceEngineRef.current) {
            voiceEngineRef.current.triggerSilenceNudge(1)
          }
          return 0
        }

        // Silence Nudge 2: after another 30 seconds of true silence (65s total)
        if (next >= 30 && nudgeCount === 1) {
          setNudgeCount(2)
          if (voiceEngineRef.current) {
            voiceEngineRef.current.triggerSilenceNudge(2)
          }
          return 0
        }

        // After Nudge 2 (another 35 seconds = 100s total without response): Skip question
        if (next >= 35 && nudgeCount === 2) {
          handleSkipUnanswered()
          return 0
        }

        return next
      })
    }, 1000)

    silenceTimerRef.current = interval
    return () => clearInterval(interval)
  }, [
    voiceState,
    audioLevel,
    candidateInterimText,
    answerInputValue,
    nudgeCount,
    isCompleted,
    isTerminatedForViolations,
    isTerminatedForUnanswered,
    isLoading,
    isSubmitting,
  ])



  // After two check-ins, ask the canonical interviewer to choose the next question.
  const handleSkipUnanswered = async () => {
    setNudgeCount(0)
    setSilenceSeconds(0)
    if (!session?.id) return
    setIsSubmitting(true)
    try {
      const result = await interviewService.advanceAfterSilence(session.id, token)
      const nextCount = result.session?.session_metadata?.unanswered_questions_in_a_row
      if (typeof nextCount === 'number') setUnansweredQuestionsCount(nextCount)
      if (result.isCompleted) {
        setIsTerminatedForUnanswered(true)
        setIsCompleted(true)
        if (voiceEngineRef.current) voiceEngineRef.current.speakAiQuestion(result.closingMessage || 'We have not received a response after three questions, so we will conclude here. Thank you for your time.')
        return
      }
      if (result.nextQuestion) {
        handleIncomingAiQuestion({ sequence: result.sequence, question: result.nextQuestion, remainingSeconds: result.remainingSeconds, speakAloud: true })
      }
    } catch (err) {
      console.warn('Unable to continue after silence:', err.message)
      setError(err.message || 'Unable to continue the interview.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Spoken or Typed/Selected Candidate Answer Submission (Unified pipeline)
  const handleSubmitAnswer = async (payloadOrText, inputMode = 'TEXT') => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current)
      autoSubmitTimerRef.current = null
    }

    let answerText = ''
    if (typeof payloadOrText === 'string') {
      answerText = payloadOrText.trim()
    } else if (payloadOrText && typeof payloadOrText === 'object') {
      if (payloadOrText.selectedOptionId || payloadOrText.key) {
        const optKey = payloadOrText.key ? `Option ${payloadOrText.key}: ` : ''
        answerText = `Selected ${optKey}${payloadOrText.label || payloadOrText.text || ''}`.trim()
      } else if (Array.isArray(payloadOrText.selectedOptionIds) || Array.isArray(payloadOrText.keys)) {
        answerText = `Selected: ${(payloadOrText.labels || []).join(', ') || payloadOrText.text || ''}`.trim()
      } else {
        answerText = (payloadOrText.text || payloadOrText.label || payloadOrText.code || payloadOrText.sqlQuery || payloadOrText.predictedOutput || '').trim()
      }
    } else {
      if (answerInputValue && typeof answerInputValue === 'object') {
        if (answerInputValue.selectedOptionId || answerInputValue.key) {
          const optKey = answerInputValue.key ? `Option ${answerInputValue.key}: ` : ''
          answerText = `Selected ${optKey}${answerInputValue.label || answerInputValue.text || ''}`.trim()
        } else {
          answerText = (answerInputValue.text || answerInputValue.label || answerInputValue.code || answerInputValue.sqlQuery || '').trim()
        }
      } else {
        const fallback = typeof answerInputValue === 'string'
          ? answerInputValue
          : answerInputValue?.text || answerInputValue?.label || answerInputValue?.code || ''
        answerText = (fallback || candidateSpeechBufferRef.current || candidateInterimText || '').trim()
      }
    }

    const currentSession = sessionRef.current || session
    const currentActiveQuestion = activeQuestionRef.current || activeQuestion

    if (!answerText || !currentSession?.id) return

    // Intercept candidate repeat question queries so they never advance sequence or score as an answer!
    if (isRepeatQuestionRequest(answerText)) {
      console.log(`[InterviewRoom] handleSubmitAnswer intercepted repeat request: "${answerText}". Triggering repeat flow.`)
      handleRepeatCurrentQuestion()
      return
    }

    const currentQSeq = typeof currentActiveQuestion?.sequence === 'number'
      ? currentActiveQuestion.sequence
      : (lastProcessedSequenceRef.current >= 0 ? lastProcessedSequenceRef.current : 0)

    // Double-submission protection: reject multiple submits for the exact same sequence
    if (lastSubmittedSequenceRef.current === currentQSeq) {
      console.log(`[InterviewRoom] Double-submission guard: Question #${currentQSeq} already submitting.`)
      return
    }
    lastSubmittedSequenceRef.current = currentQSeq

    // Reset inputs and patience tracking
    setAnswerInputValue('')
    candidateSpeechBufferRef.current = ''
    setCandidateInterimText('')
    lastScheduledTextRef.current = ''
    lastSpeechActivityTimeRef.current = 0
    setNudgeCount(0)
    setSilenceSeconds(0)
    setUnansweredQuestionsCount(0) // Candidate gave an active response!
    setIsSubmitting(true)
    setVoiceState('THINKING')
    setError('')

    // 1. Add candidate message bubble to dialogue stream immediately
    const optimisticTurn = {
      id: `cand-${Date.now()}`,
      speaker: 'CANDIDATE',
      content: answerText,
      created_at: new Date().toISOString(),
    }
    setTranscripts((prev) => [...prev, optimisticTurn])

    try {
      const evalStartTime = Date.now()
      const result = await interviewService.submitAnswer(
        currentSession.id,
        token,
        answerText,
        currentQSeq,
        currentActiveQuestion?.id,
        inputMode
      )

      // Fast responsive turn: add slight buffer (600ms) only if response returns instantly
      const elapsed = Date.now() - evalStartTime
      if (elapsed < 600) {
        await new Promise((r) => setTimeout(r, 600 - elapsed))
      }

      if (result.session) {
        setSession(result.session)
      }
      if (result.coverageMatrix) {
        setCoverageMatrix(result.coverageMatrix)
      }
      if (result.answerAnalysis) {
        setLastAnalysis(result.answerAnalysis)
      }
      if (typeof result.remainingSeconds === 'number') {
        setRemainingSeconds(result.remainingSeconds)
      }

      if (result.isCompleted) {
        setIsCompleted(true)
        const wrapUpMsg = result.closingMessage ||
          `Thank you, ${candidate?.full_name || 'Candidate'}. That concludes your technical interview for the ${job?.title || 'role'}. Your responses have been recorded and will now be evaluated.`
        if (voiceEngineRef.current) {
          voiceEngineRef.current.speakAiQuestion(wrapUpMsg)
        }
        return
      }

      // Synchronize real-time question generated by AI
      if (result.nextQuestion) {
        handleIncomingAiQuestion({
          sequence: result.sequence,
          question: result.nextQuestion,
          remainingSeconds: result.remainingSeconds,
          speakAloud: true,
        })
      }
    } catch (err) {
      console.warn('Evaluation submission notice:', err.message)
      lastSubmittedSequenceRef.current = -1 // Allow retry on failure
    } finally {
      setIsSubmitting(false)
    }
  }

  handleSubmitAnswerRef.current = handleSubmitAnswer

  // Handle explicit or spoken request to repeat active question aloud
  const handleRepeatCurrentQuestion = () => {
    const currentQ = activeQuestionRef.current || activeQuestion
    if (!currentQ) return

    const rawPrompt =
      currentQ.question_text || currentQ.prompt || currentQ.title || 'Please answer the active question.'
    console.log('[InterviewRoom] Repeating active question aloud:', rawPrompt)

    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current)
      autoSubmitTimerRef.current = null
    }
    candidateSpeechBufferRef.current = ''
    setCandidateInterimText('')
    lastScheduledTextRef.current = ''
    lastSpeechActivityTimeRef.current = 0

    isCandidateTurnLockedRef.current = true
    setVoiceState('SPEAKING')

    const repeatPrompt = `Sure, let me repeat that: ${rawPrompt}`
    setLiveAiSpeech(repeatPrompt)
    liveAiSpeechStreamRef.current = ''

    setTranscripts((prev) => [
      ...prev,
      {
        id: `ai-repeat-${Date.now()}`,
        speaker: 'AI',
        content: `Sure, let me repeat that: "${rawPrompt}"`,
        created_at: new Date().toISOString(),
      },
    ])

    if (voiceEngineRef.current) {
      voiceEngineRef.current.repeatAiQuestion(repeatPrompt)
    }
  }

  // Real-Time Voice Engine Lifecycle
  useEffect(() => {
    if (token && !isCompleted && !isLoading && session?.id) {
      if (!voiceEngineRef.current) {
        // Check for a pre-connected engine from InvitationAcceptancePage countdown
        const preconnected = VoiceInterviewEngine.consumePreconnectedEngine()

        const setupEngineCallbacks = (engine) => ({
          language: speechLanguage,
          onStateChange: (state) => setVoiceState(state),
          onAudioLevel: (level) => setAudioLevel(level),
          onAiSpeakingConcluded: () => {
            console.log('[InterviewRoom] AI speaking concluded. Candidate turn unlocked.')
            isCandidateTurnLockedRef.current = false
            setLiveAiSpeech('') // Clear temporary spoken banner so question is not written twice on panel!
            liveAiSpeechStreamRef.current = ''
            candidateSpeechBufferRef.current = ''
            setCandidateInterimText('')
            lastSpeechActivityTimeRef.current = 0
            lastScheduledTextRef.current = ''

            // Auto-mute candidate microphone on non-descriptive questions (e.g. MCQ, coding, output)
            const currentQ = activeQuestionRef.current
            const isVoiceQuestion = isLongFormVoiceQuestion(currentQ)
            if (!isVoiceQuestion) {
              console.log(`[InterviewRoom] Non-descriptive question (${currentQ?.type}). Auto-muting microphone by default.`)
              autoMutedForNonDescriptiveRef.current = true
              if (voiceEngineRef.current) {
                voiceEngineRef.current.setMute(true)
              }
              setIsMuted(true)
            } else {
              if (autoMutedForNonDescriptiveRef.current) {
                autoMutedForNonDescriptiveRef.current = false
                if (voiceEngineRef.current) {
                  voiceEngineRef.current.setMute(false)
                }
                setIsMuted(false)
              }
              setVoiceState('LISTENING')
            }
          },
          onAiQuestion: (event) => {
            console.log('[InterviewRoom] Received authoritative ai_question via WebSocket:', event.sequence)
            handleIncomingAiQuestion(event)
          },
          onInterviewCompleted: () => setIsCompleted(true),
          onCandidateSpeech: ({ text, isInterim, isFinal }) => {
            // STRICT TURN LOCK: Reject candidate speech while AI is speaking or session submitting/completed
            if (
              isCandidateTurnLockedRef.current ||
              voiceStateRef.current === 'SPEAKING' ||
              isSubmittingRef.current ||
              isCompleted
            ) {
              return
            }

            const raw = (text || '').trim()
            if (!raw) return

            let activeFullText = ''
            if (isFinal) {
              candidateSpeechBufferRef.current = candidateSpeechBufferRef.current
                ? `${candidateSpeechBufferRef.current} ${raw}`
                : raw
              activeFullText = candidateSpeechBufferRef.current
            } else {
              activeFullText = candidateSpeechBufferRef.current
                ? `${candidateSpeechBufferRef.current} ${raw}`
                : raw
            }

            activeFullText = activeFullText.trim()
            if (!activeFullText) return

            // 0. Candidate repetition request:
            if (isRepeatQuestionRequest(activeFullText)) {
              console.log(`[InterviewRoom] Candidate asked to repeat question: "${activeFullText}". Triggering repeat flow.`)
              if (autoSubmitTimerRef.current) {
                clearTimeout(autoSubmitTimerRef.current)
                autoSubmitTimerRef.current = null
              }
              candidateSpeechBufferRef.current = ''
              setCandidateInterimText('')
              lastScheduledTextRef.current = ''
              lastSpeechActivityTimeRef.current = 0

              handleRepeatCurrentQuestion()
              return
            }

            // 1. Single voice recording box: immediately reflect speech in candidate voice response box
            setCandidateInterimText(activeFullText)
            lastSpeechActivityTimeRef.current = Date.now()

            // 2. High-responsiveness silence detection & auto-submit:
            // STRICT REQUIREMENT: Only auto-submit voice answers for DESCRIPTIVE, SHORT_ANSWER, or BEHAVIORAL questions!
            // Multiple-choice, code, SQL, output, and boolean questions MUST NOT auto-submit on background sounds!
            const currentQ = activeQuestionRef.current
            const isVoiceQuestion = isLongFormVoiceQuestion(currentQ)
            if (!isVoiceQuestion) {
              return
            }

            const prevText = lastScheduledTextRef.current || ''
            const hasGrown = activeFullText.length > prevText.length + 3

            if (activeFullText.length >= 4) {
              lastScheduledTextRef.current = activeFullText

              // If text has grown, or if no timer is ticking, schedule auto-submit!
              // 6.0 second pause gap (user requirement: 5-7s)
              if (hasGrown || !autoSubmitTimerRef.current) {
                if (autoSubmitTimerRef.current) {
                  clearTimeout(autoSubmitTimerRef.current)
                }
                const finalizationDelay = 6000 // 6.0 seconds pause buffer
                autoSubmitTimerRef.current = setTimeout(() => {
                  console.log(`[InterviewRoom] Candidate speech settled (6.0s pause). Submitting answer for active question.`)
                  if (handleSubmitAnswerRef.current) {
                    handleSubmitAnswerRef.current(activeFullText, 'VOICE')
                  }
                }, finalizationDelay)
              }
            }
          },
          onTranscript: ({ text, isNudge, isTermination, isFinal, isDelta, speaker }) => {
            if (speaker === 'AI') {
              if (isThoughtOrMetaPlanning(text)) return

              const cleanText = text
                .replace(/^#+\s+/gm, '')
                .replace(/\*\*.*?\*\*/g, '')
                .replace(/^[A-Z\s]+:\s*/, '')
                .trim()

              if (!cleanText) return

              if (isDelta) {
                // Accumulate streaming text tokens into liveAiSpeechStreamRef from fresh buffer
                // NEVER append to prev (which already held spokenLeadIn and caused the duplication in the user screenshot)!
                liveAiSpeechStreamRef.current = liveAiSpeechStreamRef.current
                  ? `${liveAiSpeechStreamRef.current} ${cleanText}`
                  : cleanText
                setLiveAiSpeech(liveAiSpeechStreamRef.current)
                return
              }

              if (isFinal) {
                setSilenceSeconds(0)
                const finalText = cleanText || liveAiSpeechStreamRef.current
                if (finalText) {
                  setLiveAiSpeech(finalText)
                }
                liveAiSpeechStreamRef.current = ''

                // STRICT ARCHITECTURAL INVARIANT:
                // onTranscript NEVER overwrites activeQuestion!
                // Active question is strictly updated by onAiQuestion and handleIncomingAiQuestion!

                if (isTermination) {
                  setTimeout(() => {
                    setIsTerminatedForUnanswered(true)
                    setIsCompleted(true)
                  }, 4000)
                }

                setTranscripts((prev) => {
                  const last = prev[prev.length - 1]
                  if (last && last.speaker === 'AI' && last.content.trim() === cleanText) {
                    return prev
                  }
                  return [
                    ...prev,
                    {
                      id: `voice-ai-${Date.now()}`,
                      speaker: 'AI',
                      content: cleanText,
                      isNudge,
                      created_at: new Date().toISOString(),
                    },
                  ]
                })
              }
            }
          },
          onError: (err) => {
            console.warn('[Voice Mode Notice]:', err)
          },
        })

        if (
          preconnected &&
          preconnected.isPreconnected &&
          preconnected.isConnected &&
          preconnected.ws?.readyState === WebSocket.OPEN
        ) {
          voiceEngineRef.current = preconnected
          preconnected.attachCallbacksAndMic(setupEngineCallbacks(preconnected))

          if (hasTriggeredInterviewStartRef.current) {
            preconnected.markCandidateEnteredRoom()
          }
        } else {
          if (preconnected) {
            try {
              preconnected.stop()
            } catch (_) {}
          }

          const engine = new VoiceInterviewEngine({
            token,
            ...setupEngineCallbacks(),
          })
          voiceEngineRef.current = engine
          engine.start()
          if (hasTriggeredInterviewStartRef.current) {
            engine.markCandidateEnteredRoom()
          }
        }
      }
    }

    return () => {
      if (voiceEngineRef.current) {
        voiceEngineRef.current.stop()
        voiceEngineRef.current = null
      }
    }
  }, [token, isCompleted, isLoading, Boolean(session?.id)])

  const handleToggleMute = () => {
    autoMutedForNonDescriptiveRef.current = false
    if (voiceEngineRef.current) {
      const muted = voiceEngineRef.current.toggleMute()
      setIsMuted(muted)
    } else {
      setIsMuted((prev) => !prev)
    }
  }

  const handleTogglePreventInterruption = () => {
    setPreventInterruption((prev) => {
      const next = !prev
      if (voiceEngineRef.current) {
        voiceEngineRef.current.setPreventAiInterruption(next)
      }
      return next
    })
  }

  const handleChangeLanguage = (newLang) => {
    setSpeechLanguage(newLang)
    if (voiceEngineRef.current) {
      voiceEngineRef.current.setLanguage(newLang)
    }
  }

  const handleReconnectVoice = async () => {
    if (voiceEngineRef.current) {
      setVoiceState('CONNECTING')
      await voiceEngineRef.current.reconnect()
    } else {
      initInterview()
    }
  }

  const handleEndInterview = async () => {
    try {
      if (voiceEngineRef.current) {
        voiceEngineRef.current.stop()
        voiceEngineRef.current = null
      }
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen()
        } catch (_) {}
      }
      setIsCompleted(true)
      const targetId = session?.interview_id || session?.id || 'auto'
      await interviewService.completeInterview(targetId, token, candidateFeedbackRef.current, candidateAiRatingRef.current)
    } catch (err) {
      console.warn('Interview termination notice:', err.message)
      setIsCompleted(true)
    }
  }

  // Automatic termination on window close / pagehide
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (token && !isCompleted) {
        const targetId = session?.interview_id || session?.id || 'auto'
        const payload = JSON.stringify({ token, autoTerminated: true, feedback: candidateFeedbackRef.current, feedbackRating: candidateAiRatingRef.current })
        const url = `${import.meta.env.VITE_API_URL || '/api'}/interviews/${targetId}/complete`
        navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleBeforeUnload)
    }
  }, [token, session, isCompleted])

  // Loading Screen
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs font-mono font-bold text-slate-600 tracking-wider uppercase">
          Initializing QualifyAI Live Assessment Engine...
        </p>
      </div>
    )
  }

  // Access Error Screen
  if (error && !session) {
    return (
      <div className="h-screen w-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-3xl p-8 text-center space-y-5 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-heading font-extrabold text-slate-900 tracking-tight">
              Unable to Access Interview
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-xs font-semibold text-white transition shadow-sm cursor-pointer"
          >
            Return to QualifyAI Home
          </button>
        </div>
      </div>
    )
  }

  const { job, candidate, organization } = session || {}
  const coveredCount = Array.isArray(coverageMatrix)
    ? coverageMatrix.filter((c) => c.status === 'SUFFICIENTLY_EVALUATED' || c.status === 'MASTERY_PROVEN').length
    : 0
  const totalCriteriaCount = Array.isArray(coverageMatrix) ? coverageMatrix.length : 0

  // Silence Nudge Hint Text
  const silenceNudgeText = nudgeCount === 1 && voiceState !== 'SPEAKING'
    ? "I am here, take your time. You can just tell me or submit when you are done."
    : nudgeCount === 2 && voiceState !== 'SPEAKING'
    ? "Whenever you're ready, feel free to submit your solution, or we can move on to the next question."
    : null

  return (
    <div className="h-screen w-screen bg-[#f8fafc] text-slate-900 flex flex-col overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* 1. Header with Authoritative Countdown Timer & Monotonic Sequence */}
      <InterviewHeader
        jobTitle={job?.title ? `Role: ${job.title}` : 'Role: Technical Assessment'}
        seniority={job?.seniority || 'SENIOR'}
        sequence={sequence}
        remainingSeconds={remainingSeconds}
        totalDurationMinutes={totalDurationMinutes}
        coveredCriteriaCount={coveredCount}
        totalCriteriaCount={totalCriteriaCount}
        isConnected={voiceState !== 'DISCONNECTED'}
        warningsCount={warningsCount}
        maxWarnings={3}
        onEndInterview={handleEndInterview}
        isCompleted={isCompleted}
      />

      {/* Proctoring Warning Toast Banner */}
      {integrityWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-amber-500 text-slate-950 text-xs font-bold shadow-2xl border border-amber-300 flex items-center gap-2.5 animate-bounce">
          <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
          <span>{integrityWarning}</span>
        </div>
      )}

      {/* Mandatory Fullscreen Lockout Overlay */}
      {showFullscreenLockModal && !isCompleted && !isTerminatedForViolations && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 text-center space-y-4 shadow-2xl border border-rose-300">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 uppercase">
                Lockdown Violation • Warning {warningsCount} of 3
              </span>
              <h3 className="text-lg font-heading font-extrabold text-slate-900">
                Fullscreen Mode Required
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                You have exited fullscreen mode. Leaving fullscreen violates assessment integrity policy and has been recorded as an integrity warning. Reaching 3 warnings will automatically terminate your interview.
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  await document.documentElement.requestFullscreen()
                  setShowFullscreenLockModal(false)
                } catch (e) {
                  setShowFullscreenLockModal(false)
                }
              }}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Return to Fullscreen Mode</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden p-4 sm:p-5 gap-5 max-w-7xl w-full mx-auto">
        {/* Terminal Case 1: Inactivity (4 Unanswered Questions) */}
        {isTerminatedForUnanswered ? (
          <div className="lg:col-span-12 flex items-center justify-center p-6">
            <div className="py-8 px-8 sm:px-10 rounded-3xl bg-white border border-amber-200 shadow-2xl text-center space-y-6 max-w-xl w-full">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
                <Clock className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-mono font-bold tracking-wide">
                  <span>INACTIVITY POLICY • 3 QUESTIONS UNANSWERED</span>
                </div>
                <h2 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight">
                  Assessment Concluded
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  The live interview session has concluded because no spoken or written responses were received across 3 questions.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs leading-relaxed text-left space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-slate-800">
                  <span>Thank You for Participating</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Thank you, <strong>{candidate?.full_name || 'Candidate'}</strong>. Any answers recorded prior to conclusion have been securely saved and submitted to the hiring team for evaluation.
                </p>
              </div>

              <div className="pt-1 flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-xs font-semibold text-white transition shadow-sm cursor-pointer"
                >
                  Return to QualifyAI Home
                </button>
              </div>
            </div>
          </div>
        ) : isTerminatedForViolations ? (
          /* Terminal Case 2: Security Violations (3 Warnings Reached) */
          <div className="lg:col-span-12 flex items-center justify-center p-6">
            <div className="py-8 px-8 sm:px-10 rounded-3xl bg-white border border-rose-200 shadow-2xl text-center space-y-6 max-w-xl w-full">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-sm">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-mono font-bold tracking-wide">
                  <span>SECURITY LIMIT REACHED • 3 / 3 WARNINGS</span>
                </div>
                <h2 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight">
                  Assessment Terminated
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  The interview room has been automatically terminated because the 3-warning security threshold was reached.
                </p>
              </div>

              {/* Audit Trail Breakdown */}
              <div className="text-left bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="text-[11px] font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Integrity Violation Audit Trail</span>
                  <span className="text-rose-600">{warningsHistory.length} Recorded</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {warningsHistory.map((w, idx) => (
                    <div
                      key={w.id || idx}
                      className="text-xs p-2 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                          #{w.warningNumber || idx + 1}
                        </span>
                        <span className="text-[11px] text-slate-700 truncate">{w.reason}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {w.timestamp
                          ? new Date(w.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-950 text-xs leading-relaxed text-left space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <span>Thank You for Participating</span>
                </div>
                <p className="text-[11px] text-amber-900/90">
                  Thank you, <strong>{candidate?.full_name || 'Candidate'}</strong>. Your interview session has concluded. All answers recorded prior to termination and the complete proctoring audit log have been securely transmitted to the recruitment team.
                </p>
              </div>

              <div className="pt-1 flex items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-xs font-semibold text-white transition shadow-sm cursor-pointer"
                >
                  Return to QualifyAI Home
                </button>
              </div>
            </div>
          </div>
        ) : isCompleted ? (
          /* Normal Successful Completion View */
          <div className="lg:col-span-12 flex items-center justify-center p-6">
            <div className="py-10 px-8 rounded-3xl bg-white border border-emerald-200 shadow-xl text-center space-y-5 max-w-lg w-full">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight">
                  Assessment Completed Successfully
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Thank you, <strong>{candidate?.full_name}</strong>. Your spoken and written responses have been evaluated and recorded. This single-use interview session has now concluded.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => navigate(`/diagnostic/${token}`)}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>View Diagnostic Scorecard</span>
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-xs font-semibold text-white transition shadow-sm cursor-pointer"
                >
                  <span>Return to QualifyAI Home</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Active Dual-Region Live Meeting Room */
          <>
            {/* Left Region: AI Interviewer Presence & Animated Orb */}
            <div className="lg:col-span-5 h-full overflow-hidden">
              <AIInterviewerPanel
                conversationState={
                  roomStartupCountdown > 0
                    ? 'STARTING'
                    : isSubmitting
                    ? 'THINKING'
                    : isMuted
                    ? 'MUTED'
                    : voiceState
                }
                audioLevel={roomStartupCountdown > 0 ? 0 : audioLevel}
                isMuted={isMuted || voiceState === 'SPEAKING' || roomStartupCountdown > 0}
                language={speechLanguage}
                preventInterruption={preventInterruption}
                onTogglePreventInterruption={handleTogglePreventInterruption}
                onToggleMute={handleToggleMute}
                onChangeLanguage={handleChangeLanguage}
                onReconnect={handleReconnectVoice}
                onOpenConversation={() => setIsConversationDrawerOpen(true)}
                unreadTurnsCount={transcripts.length}
                silenceNudgeText={silenceNudgeText}
              />
            </div>

            {/* Right Region: Active Question Panel & Dynamic Interaction Area */}
            <div className="lg:col-span-7 h-full flex flex-col justify-between overflow-hidden gap-3.5">
              {/* Pinned Top Question Banner / Dialogue Box with SMS Thread */}
              <ActiveQuestionPanel
                question={activeQuestion}
                sequence={sequence}
                roomStartupCountdown={roomStartupCountdown}
                criterionName={activeQuestion?.metadata?.rubric_focus || null}
                liveAiSpeech={liveAiSpeech}
                isAiSpeaking={voiceState === 'SPEAKING'}
                transcripts={transcripts}
                candidateName={candidate?.full_name || 'You'}
                onRepeatQuestion={handleRepeatCurrentQuestion}
              />

              {/* Dynamic Interaction Area */}
              <div className="flex-1 min-h-0 bg-white/70 backdrop-blur-xs rounded-3xl border border-slate-200/90 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto shadow-2xs">
                {wrapUpStarted && (
                  <section className="mb-3 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 shrink-0">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-bold">Final interview feedback</h3>
                        <p className="text-[11px] text-indigo-800 mt-0.5">Share feedback and rate your experience. Current AI rubric ratings are shown below.</p>
                      </div>
                      <span className="text-xs font-bold tabular-nums">{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}</span>
                    </div>
                    {coverageMatrix.length > 0 && (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                        {coverageMatrix.map((criterion) => (
                          <div key={criterion.criterion_id || criterion.name} className="flex justify-between gap-2 text-[10px] text-indigo-900">
                            <span className="truncate">{criterion.name}</span>
                            <span className="font-bold shrink-0">{criterion.attempts ? `${criterion.average_score}/10` : 'Not assessed'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 pt-2 border-t border-indigo-200/80">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-900">
                        Rate the AI interviewer
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            aria-label={`Rate AI interviewer ${rating} out of 5`}
                            aria-pressed={candidateAiRating === rating}
                            onClick={() => { setCandidateAiRating(rating); candidateAiRatingRef.current = rating }}
                            className={`ml-0.5 w-6 h-6 rounded-full text-[10px] font-bold ${candidateAiRating === rating ? 'bg-indigo-700 text-white' : 'bg-white border border-indigo-200 text-indigo-800 hover:bg-indigo-100'}`}
                          >{rating}</button>
                        ))}
                      </div>
                      <textarea
                        value={candidateFeedback}
                        onChange={(event) => { setCandidateFeedback(event.target.value); candidateFeedbackRef.current = event.target.value }}
                        maxLength={4000}
                        rows={2}
                        placeholder="Your interview feedback (optional)"
                        className="mt-2 w-full resize-y rounded-xl border border-indigo-200 bg-white px-3 py-2 text-[11px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                  </section>
                )}

                {/* 1. Transcriber Box & Submit Bar (Moved UPWARD, between Dialogue Box and Text Box) */}
                <div className="mb-3.5 shrink-0">
                  {voiceState === 'SPEAKING' || roomStartupCountdown > 0 ? (
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <Volume2 className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <div className="font-sans font-bold text-[11px] text-blue-700 uppercase tracking-normal flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                            <span>AI Interviewer is Speaking</span>
                          </div>
                          <p className="text-slate-600 font-sans text-xs mt-0.5">
                            Please listen. Your microphone and response submission will unlock once the question is finished.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled
                        className="px-4 py-2.5 rounded-xl bg-slate-200 text-slate-400 font-sans font-semibold text-xs cursor-not-allowed shrink-0 flex items-center justify-center gap-1.5"
                      >
                        <span>Submit Response</span>
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : candidateInterimText ? (
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-50/95 via-indigo-50/90 to-sky-50/90 border border-blue-200/90 text-blue-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-fade-in">
                      <div className="flex items-start gap-2.5 overflow-hidden flex-1">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <Mic className="w-4 h-4 animate-pulse" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 font-sans font-bold text-[11px] text-blue-700 uppercase tracking-normal">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping shrink-0" />
                            <span>Live Transcribed Voice Response</span>
                          </div>
                          <p className="italic text-slate-800 font-sans text-xs sm:text-[13px] leading-relaxed break-words font-medium">
                            &ldquo;{candidateInterimText}&rdquo;
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2.5 shrink-0">
                        <span className="text-[10px] text-blue-700 font-sans hidden sm:inline font-medium bg-blue-100/80 px-2.5 py-1 rounded-lg border border-blue-200">
                          Auto-submits in 6s on pause
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSubmitAnswer(candidateInterimText, 'VOICE')}
                          disabled={isSubmitting}
                          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-sans font-semibold text-xs transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                          title="Submit response immediately without waiting for silence timer"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span>Submit Response</span>
                              <Send className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : isMuted ? (
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/75 border border-amber-200/90 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-fade-in">
                      <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                          <MicOff className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-sans font-bold text-[11px] text-amber-800 uppercase tracking-normal flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            <span>
                              {['CODE_WRITING', 'CODE_OUTPUT', 'SQL'].includes(activeQuestion?.type)
                                ? 'Microphone Muted (Coding Mode)'
                                : 'Microphone Muted'}
                            </span>
                          </div>
                          <p className="text-amber-900/80 font-sans text-xs mt-0.5">
                            {['CODE_WRITING', 'CODE_OUTPUT', 'SQL'].includes(activeQuestion?.type)
                              ? 'Focus on writing your solution below. Typing clatter will not auto-submit. Click "Unmute Mic" anytime to speak.'
                              : 'Microphone is currently muted. Click "Unmute Mic" if you want to answer aloud.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleToggleMute}
                          className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 font-sans font-semibold text-xs transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Unmute microphone"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>Unmute Mic</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const textToSubmit = answerInputValue || candidateInterimText
                            if (textToSubmit) {
                              handleSubmitAnswer(textToSubmit, 'TEXT')
                            }
                          }}
                          disabled={
                            isSubmitting ||
                            !(
                              typeof answerInputValue === 'string'
                                ? answerInputValue.trim().length > 0
                                : answerInputValue &&
                                  (answerInputValue.code ||
                                    answerInputValue.text ||
                                    answerInputValue.sqlQuery ||
                                    answerInputValue.predictedOutput)
                            )
                          }
                          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-sans font-semibold text-xs transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Submit your response to the AI interviewer"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span>Submit Response</span>
                              <Send className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Mic className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-sans font-bold text-[11px] text-emerald-700 uppercase tracking-normal flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>Your Turn to Answer</span>
                          </div>
                          <p className="text-slate-600 font-sans text-xs mt-0.5">
                            {answerInputValue
                              ? 'Response entered below. Click "Submit Response" when ready.'
                              : 'Speak aloud into your microphone or write your answer below.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const textToSubmit = answerInputValue || candidateInterimText
                            if (textToSubmit) {
                              handleSubmitAnswer(textToSubmit, candidateInterimText ? 'VOICE' : 'TEXT')
                            }
                          }}
                          disabled={isSubmitting || (!answerInputValue && !candidateInterimText)}
                          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-sans font-semibold text-xs transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Submit your response to the AI interviewer"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <>
                              <span>Submit Response</span>
                              <Send className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Text Box / Interactive Workspace (Placed BELOW the Transcriber Box) */}
                <div className="flex-1 flex flex-col justify-center">
                  <QuestionRenderer
                    question={activeQuestion}
                    value={answerInputValue}
                    candidateSpeech={candidateInterimText}
                    onChange={(val) => {
                      setAnswerInputValue(val)
                      lastTypingActivityTimeRef.current = Date.now()
                      setSilenceSeconds(0)
                    }}
                    onSubmit={(payload) => handleSubmitAnswer(payload)}
                    isSubmitting={isSubmitting}
                    isAiSpeaking={voiceState === 'SPEAKING' || roomStartupCountdown > 0}
                  />
                </div>
              </div>
            </div>

            {/* Secondary Conversation History Drawer / Modal */}
            <ConversationStream
              transcripts={transcripts}
              candidateName={candidate?.full_name || 'You'}
              candidateInterimText={candidateInterimText}
              isSubmitting={isSubmitting}
              isOpen={isConversationDrawerOpen}
              onClose={() => setIsConversationDrawerOpen(false)}
            />
          </>
        )}
      </main>
    </div>
  )
}

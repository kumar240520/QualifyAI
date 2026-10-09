import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  X,
  Mic,
  MicOff,
  Volume2,
} from 'lucide-react'
import { interviewService } from '../services/interviewService.js'
import { VoiceInterviewEngine } from '../services/voiceInterviewEngine.js'
import { API_BASE_URL } from '../services/apiConfig.js'
import { proctoringService } from '../services/proctoringService.js'
import { VisualProctoringService } from '../services/visualProctoringService.js'
import { normalizeApiError } from '../utils/errorNormalizer.js'
import {
  normalizeQuestion,
  isThoughtOrMetaPlanning,
  extractCleanQuestionPrompt,
} from '../utils/questionNormalizer.js'
import { getQuestionEventSequence, shouldAcceptQuestionEvent } from '../utils/questionEvent.js'
import { checkDeviceCompatibility } from '../utils/deviceCompatibility.js'
import DesktopRequiredScreen from '../components/common/DesktopRequiredScreen.jsx'

// Subcomponents
import InterviewHeader from '../components/interview/InterviewHeader.jsx'
import AIInterviewerPanel from '../components/interview/AIInterviewerPanel.jsx'
import ActiveQuestionPanel from '../components/interview/ActiveQuestionPanel.jsx'
import QuestionRenderer from '../components/interview/QuestionRenderer.jsx'
import ConversationStream from '../components/interview/ConversationStream.jsx'
import { appendSpeechSegment } from '../utils/speechAccumulator.js'

import { isMicDefaultOn } from '../utils/questionTypeRegistry.js'

/**
 * Authoritative default microphone policy:
 * - SHORT_ANSWER, DESCRIPTIVE → microphone strictly ON by default (true)
 * - Every other question type (MCQ, Coding, SQL, Sliders, Ordering, Debugging, etc.) → microphone OFF by default (false)
 */
function getDefaultMicEnabled(questionOrType) {
  return isMicDefaultOn(questionOrType)
}

function isLongFormVoiceQuestion(questionOrType) {
  return isMicDefaultOn(questionOrType)
}

/**
 * Question stage durations (in seconds):
 * - Multiple choice / boolean: 15s (15s -> Filler 1 -> 15s -> Filler 2 -> 15s -> Skip)
 * - Fill in blank / Code output: 20s (20s -> Filler 1 -> 20s -> Filler 2 -> 20s -> Skip)
 * - Code writing / SQL: 45s (45s -> Filler 1 -> 45s -> Filler 2 -> 45s -> Skip)
 * - Descriptive / Short answer: 15s stage duration to START responding.
 *   (If user responds by speaking or typing, all time limits are removed!)
 */
function getQuestionStageDuration(questionOrType) {
  if (!questionOrType) return 15
  const t = typeof questionOrType === 'string'
    ? questionOrType.toUpperCase()
    : String(questionOrType.type || questionOrType.question_type || '').toUpperCase()

  switch (t) {
    case 'CODE_WRITING':
    case 'SQL':
      return 45
    case 'CODE_OUTPUT':
    case 'FILL_IN_THE_BLANK':
      return 20
    case 'MULTIPLE_CHOICE':
    case 'SINGLE_CHOICE':
    case 'MULTI_SELECT':
    case 'TRUE_FALSE':
    case 'YES_NO':
      return 15
    case 'SHORT_ANSWER':
    case 'DESCRIPTIVE':
    case 'BEHAVIORAL':
    case 'SCENARIO':
    default:
      return 15
  }
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

  // Hardware compatibility gate: Desktop / PC required (Requirement 10)
  const [deviceCheck] = useState(() => checkDeviceCompatibility())

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
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [error, setError] = useState('')
  const [isCompleted, setIsCompleted] = useState(false)
  const isCompletedRef = useRef(false)
  isCompletedRef.current = isCompleted
  const [lastAnalysis, setLastAnalysis] = useState(null)

  // Dynamic Answer Input State
  const [answerInputValue, setAnswerInputValue] = useState('')
  const answerInputValueRef = useRef('')
  answerInputValueRef.current = answerInputValue
  const [candidateInterimText, setCandidateInterimText] = useState('')
  const candidateSpeechBufferRef = useRef('')
  const currentInterimSpeechRef = useRef('')
  const finalizedSegmentIdsRef = useRef(new Set())
  const lastFinalizedSegmentRef = useRef('')

  // Secondary Conversation Drawer State
  const [isConversationDrawerOpen, setIsConversationDrawerOpen] = useState(false)

  // AI Evaluator Silence & Patience Policy State
  const [nudgeCount, setNudgeCount] = useState(0) // 0: none, 1: nudge 1, 2: nudge 2
  const [unansweredQuestionsCount, setUnansweredQuestionsCount] = useState(0) // Server concludes after 3 consecutive unanswered questions
  const [isTerminatedForUnanswered, setIsTerminatedForUnanswered] = useState(false)
  const isTerminatedForUnansweredRef = useRef(false)
  isTerminatedForUnansweredRef.current = isTerminatedForUnanswered
  const [silenceSeconds, setSilenceSeconds] = useState(0)
  const silenceTimerRef = useRef(null)
  const nudgeCountRef = useRef(0)
  nudgeCountRef.current = nudgeCount
  const unansweredCountRef = useRef(0)
  unansweredCountRef.current = unansweredQuestionsCount
  const audioLevelRef = useRef(0)
  const candidateInterimTextRef = useRef('')
  candidateInterimTextRef.current = candidateInterimText

  // Assessment Integrity & 3-Warnings Proctoring State
  const [warningsCount, setWarningsCount] = useState(0)
  const [warningsHistory, setWarningsHistory] = useState([])
  const [integrityWarning, setIntegrityWarning] = useState(null)
  const [showFullscreenLockModal, setShowFullscreenLockModal] = useState(false)
  const [isTerminatedForViolations, setIsTerminatedForViolations] = useState(false)
  const isTerminatedForViolationsRef = useRef(false)
  isTerminatedForViolationsRef.current = isTerminatedForViolations
  const proctoringTrackerRef = useRef(null)
  const cameraPreviewRef = useRef(null)
  const visualProctoringRef = useRef(null)
  const [cameraStatus, setCameraStatus] = useState('Starting camera…')

  // Real-Time Voice Engine State
  const [voiceState, setVoiceState] = useState('CONNECTING')
  const [audioLevel, setAudioLevel] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const isMutedRef = useRef(false)
  isMutedRef.current = isMuted
  const [manualMicOverride, setManualMicOverride] = useState(false)
  const manualMicOverrideRef = useRef(false)
  manualMicOverrideRef.current = manualMicOverride
  const [speechLanguage, setSpeechLanguage] = useState('en-IN')
  const [liveAiSpeech, setLiveAiSpeech] = useState('')
  const [preventInterruption, setPreventInterruption] = useState(true)
  const voiceEngineRef = useRef(null)
  const pendingAiSpeechRef = useRef(null)
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
  const voiceCaptureCancelledRef = useRef(false)
  const lastScheduledTextRef = useRef('')
  const isCandidateTurnLockedRef = useRef(true)
  const lastTypingActivityTimeRef = useRef(0)
  const lastUserActivityTimeRef = useRef(Date.now())
  const silenceSecondsRef = useRef(0)
  const autoMutedForNonDescriptiveRef = useRef(false)
  const liveAiSpeechStreamRef = useRef('')
  const targetSpokenScriptRef = useRef('')
  const audioProgressActiveRef = useRef(false)
  const scriptFallbackTickerRef = useRef(null)
  const scriptFallbackTimeoutRef = useRef(null)
  const handoverScheduledRef = useRef(false)
  const hasCandidateRespondedRef = useRef(false)
  const [hasCandidateResponded, setHasCandidateResponded] = useState(false)

  const speakPendingAiPrompt = (engine = voiceEngineRef.current) => {
    const pending = pendingAiSpeechRef.current
    if (!pending || !engine?.hasEnteredRoom) return
    pendingAiSpeechRef.current = null
    engine.speakAiQuestion({
      text: pending.text,
      questionId: pending.questionId || null,
      sequence: pending.sequence,
    })
  }

  // Progressively reveal spoken script synchronously with speech playback
  const startScriptReveal = (script) => {
    // Deduplication guard: if already revealing this exact script, preserve current progress
    if (targetSpokenScriptRef.current === script && script) {
      return
    }

    targetSpokenScriptRef.current = script || ''
    setLiveAiSpeech('')
    audioProgressActiveRef.current = false
    handoverScheduledRef.current = false
    if (scriptFallbackTimeoutRef.current) {
      clearTimeout(scriptFallbackTimeoutRef.current)
      scriptFallbackTimeoutRef.current = null
    }
    if (scriptFallbackTickerRef.current) {
      clearInterval(scriptFallbackTickerRef.current)
      scriptFallbackTickerRef.current = null
    }

    if (!script) return
    const clean = script
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*.*?\*\*/g, '')
      .replace(/^[A-Z\s]+:\s*/, '')
      .trim()
    const words = clean.split(/\s+/)
    if (words.length === 0) return

    // Fallback ticker: in case native audio stream is delayed or fails to connect,
    // start revealing words progressively after a 6-second grace period rather than racing ahead of native audio.
    let revealedIndex = 0
    scriptFallbackTimeoutRef.current = setTimeout(() => {
      if (!audioProgressActiveRef.current && targetSpokenScriptRef.current === script && voiceStateRef.current === 'SPEAKING') {
        revealedIndex = 1
        setLiveAiSpeech(words.slice(0, 1).join(' '))
        scriptFallbackTickerRef.current = setInterval(() => {
          if (audioProgressActiveRef.current || targetSpokenScriptRef.current !== script || voiceStateRef.current !== 'SPEAKING') {
            clearInterval(scriptFallbackTickerRef.current)
            scriptFallbackTickerRef.current = null
            return
          }
          revealedIndex = Math.min(words.length, revealedIndex + 1)
          setLiveAiSpeech(words.slice(0, revealedIndex).join(' '))
          if (revealedIndex >= words.length) {
            clearInterval(scriptFallbackTickerRef.current)
            scriptFallbackTickerRef.current = null
            // Hand over mic to candidate after natural pause if audio progress is not driving
            if (!audioProgressActiveRef.current && voiceStateRef.current === 'SPEAKING') {
              setTimeout(() => {
                if (targetSpokenScriptRef.current === script && voiceStateRef.current === 'SPEAKING') {
                  concludeSpeakingAndPassMic()
                }
              }, 600)
            }
          }
        }, 320)
      }
    }, 6000)
  }

  // Authoritatively pass the microphone to the candidate and unlock candidate answering turn
  const concludeSpeakingAndPassMic = () => {
    console.log('[InterviewRoom] AI speaking concluded. Passing microphone to candidate. Turn unlocked.')
    isCandidateTurnLockedRef.current = false
    handoverScheduledRef.current = false
    voiceStateRef.current = 'LISTENING'
    liveAiSpeechStreamRef.current = ''
    audioProgressActiveRef.current = false
    if (scriptFallbackTimeoutRef.current) {
      clearTimeout(scriptFallbackTimeoutRef.current)
      scriptFallbackTimeoutRef.current = null
    }
    if (scriptFallbackTickerRef.current) {
      clearInterval(scriptFallbackTickerRef.current)
      scriptFallbackTickerRef.current = null
    }
    candidateSpeechBufferRef.current = ''
    currentInterimSpeechRef.current = ''
    finalizedSegmentIdsRef.current.clear()
    lastFinalizedSegmentRef.current = ''
    setCandidateInterimText('')
    lastSpeechActivityTimeRef.current = 0
    lastScheduledTextRef.current = ''
    lastUserActivityTimeRef.current = Date.now()
    silenceSecondsRef.current = 0
    setSilenceSeconds(0)

    // Determine microphone state based on candidate manual override vs question-type default policy (Requirements #1-3)
    const isOverridden = manualMicOverrideRef.current
    let micShouldBeMuted = false

    if (isOverridden) {
      // Respect candidate's explicit manual mic toggle within this question
      micShouldBeMuted = Boolean(isMutedRef.current)
    } else {
      // Apply question-type default policy:
      // SHORT_ANSWER, DESCRIPTIVE → ON by default (muted = false)
      // MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_THE_BLANK, SCORED_OUTPUT → OFF by default (muted = true)
      const currentQ = activeQuestionRef.current || currentQuestionData
      const defaultMicOn = getDefaultMicEnabled(currentQ)
      micShouldBeMuted = !defaultMicOn
    }

    autoMutedForNonDescriptiveRef.current = micShouldBeMuted
    setIsMuted(micShouldBeMuted)
    isMutedRef.current = micShouldBeMuted
    if (voiceEngineRef.current) {
      if (!micShouldBeMuted) {
        if (typeof voiceEngineRef.current.unmuteAndStartListening === 'function') {
          voiceEngineRef.current.unmuteAndStartListening()
        } else {
          voiceEngineRef.current.setMicrophoneMuted(false)
        }
      } else {
        voiceEngineRef.current.setMicrophoneMuted(true)
      }
    }
    setVoiceState(micShouldBeMuted ? 'MUTED' : 'LISTENING')
  }

  // 2-second warmup buffer after arriving in room before AI speaks
  const [roomStartupCountdown, setRoomStartupCountdown] = useState(2)
  const roomStartupCountdownRef = useRef(2)
  roomStartupCountdownRef.current = roomStartupCountdown
  const hasTriggeredInterviewStartRef = useRef(false)

  // Activate Proctoring Telemetry Tracker on session start (Strict 3-warning limit)
  useEffect(() => {
    const interviewId = session?.interview_id || session?.id
    if (interviewId && !isCompleted && !isTerminatedForViolations) {
      proctoringTrackerRef.current = proctoringService.createTracker(interviewId, {
        token,
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
            await interviewService.completeInterview(targetId, token, '', null, {
              is_terminated: true,
              terminated_for_violations: true,
              warning_count: count || 3,
              max_warnings: maxWarnings || 3,
              reason: reason || 'Assessment automatically terminated: Exceeded 3-warning security limit due to repeated integrity violations.',
              history: history || warningsHistory || [],
            })
          } catch (err) {
            console.warn('Auto-termination completion notice:', err.message)
          }
        },
      })

      return () => {
        proctoringTrackerRef.current?.destroy()
      }
    }
  }, [session?.interview_id, session?.id, isCompleted, isTerminatedForViolations, token])

  // MediaPipe processes camera frames on-device. Only sustained event metadata is sent to the API.
  useEffect(() => {
    const interviewId = session?.interview_id || session?.id
    if (!interviewId || isCompleted || isTerminatedForViolations || isTerminatedForUnanswered) return undefined
    if (!cameraPreviewRef.current) return undefined

    const visual = new VisualProctoringService({
      video: cameraPreviewRef.current,
      onStatus: ({ cameraReady, facePresent, degraded, message }) => {
        setCameraStatus(degraded ? 'Camera analysis paused' : !cameraReady ? (message || 'Camera disconnected') : facePresent ? 'Camera active · face visible' : 'Camera active · center your face')
      },
      onEvent: (event) => {
        console.warn('[VisualProctoring] Security violation event detected:', event.type, event.reason)
        proctoringTrackerRef.current?.triggerViolation(event.type, event.reason, event.severity, {
          source: event.source,
          confidence: event.confidence,
          durationMs: event.durationMs,
          timestamp: event.timestamp,
          ...event.metadata,
        })
        if (event.type === 'FACE_ABSENT') {
          setIntegrityWarning('Face not detected! Please keep your face centered in the camera.')
          setTimeout(() => setIntegrityWarning(null), 4000)
        } else if (event.type === 'MULTIPLE_FACES') {
          setIntegrityWarning('Multiple faces detected in camera frame.')
          setTimeout(() => setIntegrityWarning(null), 4000)
        }
      },
    })
    visualProctoringRef.current = visual
    visual.start().catch((error) => {
      setCameraStatus(error.name === 'NotAllowedError' ? 'Camera permission blocked · retry access' : 'Camera unavailable · voice interview can continue')
      console.warn('[InterviewRoom] Local camera setup notice:', error.message)
    })
    return () => {
      visual.stop()
      if (visualProctoringRef.current === visual) visualProctoringRef.current = null
    }
  }, [session?.interview_id, session?.id, isCompleted, isTerminatedForViolations, isTerminatedForUnanswered])

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
    activeQuestionRef.current = normalized
    hasCandidateRespondedRef.current = false
    setHasCandidateResponded(false)

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
    currentInterimSpeechRef.current = ''
    finalizedSegmentIdsRef.current.clear()
    lastFinalizedSegmentRef.current = ''
    setCandidateInterimText('')
    lastScheduledTextRef.current = ''
    lastSpeechActivityTimeRef.current = 0
    if (lastSubmittedSequenceRef.current === incomingSeq) {
      lastSubmittedSequenceRef.current = -1
    }
    setError('')
    setIsSubmitting(false)
    voiceCaptureCancelledRef.current = false

    // STRICT PACING GUARD: Lock candidate turn while AI presents the question!
    // The candidate cannot answer or auto-submit until AI finishes speaking!
    isCandidateTurnLockedRef.current = true
    handoverScheduledRef.current = false
    voiceStateRef.current = 'SPEAKING'
    setVoiceState('SPEAKING')
    setNudgeCount(0)
    nudgeCountRef.current = 0
    setSilenceSeconds(0)
    silenceSecondsRef.current = 0
    lastUserActivityTimeRef.current = Date.now()

    // Reset manual mic override for newly active question
    manualMicOverrideRef.current = false
    setManualMicOverride(false)

    // Apply default mic policy for candidate response stage (kept locked & muted while AI speaks)
    const defaultMicOn = getDefaultMicEnabled(normalized)
    const initialMicMuted = !defaultMicOn
    autoMutedForNonDescriptiveRef.current = initialMicMuted
    setIsMuted(initialMicMuted)
    isMutedRef.current = initialMicMuted
    if (voiceEngineRef.current) {
      voiceEngineRef.current.setMicrophoneMuted(true)
    }

    if (typeof event.remainingSeconds === 'number') {
      setRemainingSeconds(event.remainingSeconds)
    }

    // Flush speech recognition recognition tokens so residual words don't bleed into new question
    if (voiceEngineRef.current) {
      voiceEngineRef.current.resetCandidateSpeechRecognition()
    }

    // Deliver spoken lead-in if voice engine is active and speakAloud is requested
    const spokenLeadIn = qObj.spoken_lead_in || qText
    startScriptReveal(spokenLeadIn)
    liveAiSpeechStreamRef.current = ''

    if (spokenLeadIn && event.speakAloud !== false) {
      if (voiceEngineRef.current?.hasEnteredRoom) {
        voiceEngineRef.current.speakAiQuestion({
          text: spokenLeadIn,
          questionId: qObj.id || null,
          sequence: incomingSeq,
        })
      } else {
        pendingAiSpeechRef.current = { text: spokenLeadIn, questionId: qObj.id || null, sequence: incomingSeq }
      }
    } else if (event.speakAloud === false) {
      // If voice engine is explicitly not speaking aloud, unlock candidate after brief reading delay (1.5s)
      setTimeout(() => {
        concludeSpeakingAndPassMic()
      }, 1500)
    }
  }

  // Initialize Interview Session
  const initInterview = async () => {
    if (!deviceCheck.isDesktop) {
      setIsLoading(false)
      return
    }

    if (!token) {
      setError('Invitation token is missing.')
      setIsLoading(false)
      return
    }

    try {
      const data = await interviewService.startInterview(token)
      setSession(data.session)
      setWarningsCount(Number(data.session?.warning_count) || 0)
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
        activeQuestionRef.current = normalized
        hasCandidateRespondedRef.current = false
        setHasCandidateResponded(false)
        manualMicOverrideRef.current = false
        setManualMicOverride(false)

        const defaultMicOn = getDefaultMicEnabled(normalized)
        const initialMicMuted = !defaultMicOn
        autoMutedForNonDescriptiveRef.current = initialMicMuted
        setIsMuted(initialMicMuted)
        isMutedRef.current = initialMicMuted
        if (voiceEngineRef.current) {
          voiceEngineRef.current.setMicrophoneMuted(true)
        }
        const spokenLead = data.currentQuestion?.spoken_lead_in || initialQ
        startScriptReveal(spokenLead)
        isCandidateTurnLockedRef.current = true
        setVoiceState('SPEAKING')
        pendingAiSpeechRef.current = { text: spokenLead, sequence: hydratedSeq, questionId: data.currentQuestion?.id || null }
        if (voiceEngineRef.current?.hasEnteredRoom) {
          voiceEngineRef.current.speakAiQuestion({
            text: spokenLead,
            sequence: hydratedSeq,
            questionId: data.currentQuestion?.id || null,
          })
        }

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
      const normalized = normalizeApiError(err, 'Unable to connect to interview session. Please try again.')
      setError(normalized.message)
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
        if (next <= 60 && next > 0 && !hasRequestedWrapUpRef.current) {
          hasRequestedWrapUpRef.current = true
          interviewService.startWrapUp(session.id, token).then((result) => {
            if (result.isCompleted) {
              setIsCompleted(true)
              return
            }
            if (result.session) {
              setSession((prev) => ({
                ...prev,
                ...result.session,
                job: result.session?.job || prev?.job,
                candidate: result.session?.candidate || prev?.candidate,
                organization: result.session?.organization || prev?.organization,
              }))
            }
            if (result.coverageMatrix) setCoverageMatrix(result.coverageMatrix)
            setWrapUpStarted(true)
            if (silenceTimerRef.current) {
              clearInterval(silenceTimerRef.current)
              silenceTimerRef.current = null
            }
            if (voiceEngineRef.current) {
              voiceEngineRef.current.cancelCurrentAudio('Transition to Final Feedback phase')
            }
            const invitation = result.feedbackInvitation || `Thank you for completing the technical assessment. We have reserved our final minute for candidate feedback. Please take a moment to rate your experience and share any feedback.`
            if (voiceEngineRef.current && typeof voiceEngineRef.current.speakAiQuestion === 'function') {
              voiceEngineRef.current.speakAiQuestion({
                text: invitation,
                force: true,
              })
            }
            setLiveAiSpeech(invitation)
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
          roomStartupCountdownRef.current = next
          if (next <= 0) {
            hasTriggeredInterviewStartRef.current = true
            console.log(
              '[InterviewRoom] 2-second warmup buffer elapsed. Candidate seated in room; triggering AI interview start.'
            )
            if (voiceEngineRef.current) {
              voiceEngineRef.current.markCandidateEnteredRoom()
              speakPendingAiPrompt(voiceEngineRef.current)
            }
          }
          return next
        })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [session?.id, isLoading, isCompleted, roomStartupCountdown])

  // Guarantee audible filler nudge output using the unified CosyVoice audio pipeline
  const speakFillerNudgeAloud = (level = 1) => {
    if (wrapUpStarted || remainingSeconds <= 60 || isCompleted) {
      return ''
    }
    let spokenText = ''
    if (voiceEngineRef.current && typeof voiceEngineRef.current.triggerSilenceNudge === 'function') {
      spokenText = voiceEngineRef.current.triggerSilenceNudge(level)
    }

    if (!spokenText) {
      const nudge1Phrases = [
        "Whenever you're ready, you can answer. I'm still here.",
        "I am here, you can just answer it. You can answer it in your own way.",
        "Take your time, I am here. You can just answer it in your own way."
      ]
      const nudge2Phrases = [
        "Take your time. You can answer whenever you're ready.",
        "Whenever you're ready, feel free to answer, or we can move forward.",
        "I am still here. Feel free to answer in your own words, or we can move to the next question."
      ]
      spokenText = level === 1
        ? nudge1Phrases[Math.floor(Math.random() * nudge1Phrases.length)]
        : nudge2Phrases[Math.floor(Math.random() * nudge2Phrases.length)]
      if (voiceEngineRef.current && typeof voiceEngineRef.current.speakAiQuestion === 'function') {
        voiceEngineRef.current.speakAiQuestion({
          text: spokenText,
          sequence,
          questionId: activeQuestionRef.current?.id || null,
          isFiller: true,
        })
      }
    }

    isCandidateTurnLockedRef.current = true
    voiceStateRef.current = 'SPEAKING'
    setVoiceState('SPEAKING')
    silenceSecondsRef.current = 0
    setSilenceSeconds(0)
    lastUserActivityTimeRef.current = Date.now()
    setLiveAiSpeech(spokenText)
    startScriptReveal(spokenText)

    // Safety turn watchdog: if filler speech audio ends or gets dropped, guarantee turn concludes cleanly within 6s
    setTimeout(() => {
      if (voiceStateRef.current === 'SPEAKING' && isCandidateTurnLockedRef.current) {
        console.warn('[InterviewRoom] Safety filler turn watchdog concluded speaking turn.')
        concludeSpeakingAndPassMic()
      }
    }, 6000)

    return spokenText
  }

  // User Activity Tracker for Non-Descriptive / Interactive Questions
  // (Multiple choice, fill in the blanks, code output, code writing, SQL, boolean, etc.)
  // Detects keyboard typing, mouse movements, clicks, and scrolls so candidates are never interrupted while working.
  useEffect(() => {
    const handleUserActivity = (evt) => {
      if (
        isCompleted ||
        isLoading ||
        voiceStateRef.current === 'SPEAKING' ||
        isCandidateTurnLockedRef.current
      ) {
        return
      }

      const evtType = evt?.type || ''
      const currentActiveQ = activeQuestionRef.current
      const isVoiceQ = isLongFormVoiceQuestion(currentActiveQ)

      // On descriptive / short answer voice questions, only actual speech or typing/submitting answers counts as activity.
      // Passive mouse hover or mouse movement must NEVER reset voice silence or cancel filler nudges!
      if (isVoiceQ && (evtType === 'mousemove' || evtType === 'wheel')) {
        return
      }

      lastUserActivityTimeRef.current = Date.now()
      silenceSecondsRef.current = 0

      // If candidate was in a nudged state, fresh activity shows engagement has resumed:
      if (nudgeCountRef.current > 0) {
        nudgeCountRef.current = 0
        setNudgeCount(0)
      }
    }

    let lastThrottledActivity = 0
    const handleThrottledActivity = (evt) => {
      const now = Date.now()
      if (now - lastThrottledActivity > 800) {
        lastThrottledActivity = now
        handleUserActivity(evt)
      }
    }

    // Deliberate user interaction (clicks, keys, inputs, touches, mouse moves, scrolls)
    const immediateEvents = ['mousedown', 'keydown', 'input', 'touchstart']
    immediateEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true, capture: true })
    })
    const throttledEvents = ['mousemove', 'wheel']
    throttledEvents.forEach((evt) => {
      window.addEventListener(evt, handleThrottledActivity, { passive: true, capture: true })
    })

    return () => {
      immediateEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity, { capture: true })
      })
      throttledEvents.forEach((evt) => {
        window.removeEventListener(evt, handleThrottledActivity, { capture: true })
      })
    }
  }, [isCompleted, isLoading])

  // AI Evaluator Silence & Inactivity Cadence:
  // - Per-question stage durations (15s for MCQ, 20s for code output/fill-in-blank, 45s for code writing/SQL).
  // - For voice/descriptive questions: exactly 15s to START responding.
  //   CRITICAL: Once candidate begins speaking or typing their answer, NO TIME LIMIT applies!
  // - If idle without responding: Stage 1 -> Filler Nudge #1 -> Stage 2 -> Filler Nudge #2 -> Stage 3 -> Skip question.
  // - After 3 consecutive unanswered questions, the interview session automatically terminates.
  useEffect(() => {
    if (
      isCompleted ||
      isTerminatedForViolations ||
      isTerminatedForUnanswered ||
      isLoading
    ) {
      if (silenceTimerRef.current) {
        clearInterval(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
      return
    }

    const interval = setInterval(() => {
      // 0. AI is speaking, candidate turn is locked, warmup active, submitting, or completed:
      if (
        voiceStateRef.current === 'SPEAKING' ||
        isCandidateTurnLockedRef.current ||
        roomStartupCountdownRef.current > 0 ||
        isSubmittingRef.current ||
        isCompletedRef.current ||
        isTerminatedForViolationsRef.current ||
        isTerminatedForUnansweredRef.current ||
        isLoading ||
        wrapUpStarted ||
        remainingSeconds <= 60
      ) {
        silenceSecondsRef.current = 0
        setSilenceSeconds(0)
        return
      }

      const currentActiveQ = activeQuestionRef.current
      const isVoiceQ = isLongFormVoiceQuestion(currentActiveQ)
      const stageDuration = getQuestionStageDuration(currentActiveQ)
      const recordedSpeech = (candidateSpeechBufferRef.current || candidateInterimTextRef.current || '').trim()
      const typedAnswer = (typeof answerInputValueRef.current === 'string'
        ? answerInputValueRef.current
        : answerInputValueRef.current?.text || answerInputValueRef.current?.code || '').trim()
      const currentAudioLvl = audioLevelRef.current || 0

      // Detect if candidate has started responding to a voice question (speech or text)
      // Note: Audio decibels must NEVER mark candidate responded. Only actual transcribed speech or typed answers count!
      if (isVoiceQ && !hasCandidateRespondedRef.current) {
        if (recordedSpeech.length >= 3 || typedAnswer.length >= 3) {
          hasCandidateRespondedRef.current = true
          setHasCandidateResponded(true)
        }
      }

      // 1. Candidate speech and activity tracking:
      // Candidate pauses while speaking Short Answer or Descriptive questions must NEVER trigger premature auto-submission.
      // The candidate has freedom to formulate answers and use Submit Response when ready.
      // 2. Compute elapsed inactivity duration from last verified user activity timestamp:
      const idleMs = Date.now() - (lastUserActivityTimeRef.current || 0)
      const idleSeconds = Math.max(0, Math.floor(idleMs / 1000))
      silenceSecondsRef.current = idleSeconds
      setSilenceSeconds(idleSeconds)

      const currentNudges = nudgeCountRef.current

      // Step 1: Exactly stageDuration seconds of inactivity -> Speak Filler Nudge #1 aloud!
      if (idleSeconds >= stageDuration && currentNudges === 0) {
        console.log(`[InterviewRoom] ${stageDuration}s inactivity reached -> Speaking Filler Nudge #1 aloud`)
        nudgeCountRef.current = 1
        setNudgeCount(1)
        lastUserActivityTimeRef.current = Date.now()
        silenceSecondsRef.current = 0
        setSilenceSeconds(0)
        speakFillerNudgeAloud(1)
        return
      }

      // Step 2: Exactly stageDuration seconds of inactivity after Nudge 1 -> Speak Filler Nudge #2 aloud!
      if (idleSeconds >= stageDuration && currentNudges === 1) {
        console.log(`[InterviewRoom] ${stageDuration}s inactivity reached after Nudge 1 -> Speaking Filler Nudge #2 aloud`)
        nudgeCountRef.current = 2
        setNudgeCount(2)
        lastUserActivityTimeRef.current = Date.now()
        silenceSecondsRef.current = 0
        setSilenceSeconds(0)
        speakFillerNudgeAloud(2)
        return
      }

      // Step 3: Exactly stageDuration seconds of inactivity after Nudge 2 -> Authoritative inactivity fallback
      if (idleSeconds >= stageDuration && currentNudges === 2) {
        console.log(`[InterviewRoom] ${stageDuration}s inactivity reached after Nudge 2 -> Triggering inactivity fallback`)
        silenceSecondsRef.current = 0
        setSilenceSeconds(0)
        const finalRecordedSpeech = (candidateSpeechBufferRef.current || '').trim()
        const finalTyped = (typeof answerInputValueRef.current === 'string'
          ? answerInputValueRef.current
          : answerInputValueRef.current?.text || answerInputValueRef.current?.code || '').trim()
        const pendingResponse = finalRecordedSpeech || finalTyped
        if (isVoiceQ && pendingResponse.length >= 3 && handleSubmitAnswerRef.current) {
          console.log('[InterviewRoom] Inactivity fallback auto-submitting accumulated response after complete timeout.')
          handleSubmitAnswerRef.current(pendingResponse, 'VOICE')
        } else {
          handleSkipUnanswered()
        }
        return
      }
    }, 1000)

    silenceTimerRef.current = interval
    return () => {
      clearInterval(interval)
      silenceTimerRef.current = null
    }
  }, [
    isCompleted,
    isTerminatedForViolations,
    isTerminatedForUnanswered,
    isLoading,
  ])

  // After two filler nudges, advance to next question or conclude after 3 consecutive unanswered questions
  const handleSkipUnanswered = async () => {
    nudgeCountRef.current = 0
    setNudgeCount(0)
    setSilenceSeconds(0)
    hasCandidateRespondedRef.current = false
    setHasCandidateResponded(false)
    const targetId = session?.id || session?.interview_id
    if (!targetId) return

    setIsSubmitting(true)
    try {
      const nextCount = unansweredCountRef.current + 1
      unansweredCountRef.current = nextCount
      setUnansweredQuestionsCount(nextCount)

      // Conclude immediately if 3 consecutive questions received no answer
      if (nextCount >= 3) {
        console.warn('[InterviewRoom] 3 consecutive questions unanswered. Concluding interview session.')
        setIsTerminatedForUnanswered(true)
        setIsCompleted(true)
        const closingMsg = 'We have not received a response across three consecutive questions. This interview session has now concluded. Thank you for your time.'
        if (voiceEngineRef.current && typeof voiceEngineRef.current.speakAiQuestion === 'function') {
          voiceEngineRef.current.speakAiQuestion({ text: closingMsg, sequence, force: true })
        }
        setLiveAiSpeech(closingMsg)
        try {
          const compId = session?.interview_id || session?.id || 'auto'
          await interviewService.completeInterview(compId, token)
        } catch (err) {
          console.warn('Auto-termination complete notice:', err.message)
        }
        return
      }

      const result = await interviewService.advanceAfterSilence(targetId, token)
      const serverCount = result.session?.session_metadata?.unanswered_questions_in_a_row
      if (typeof serverCount === 'number') {
        const syncd = Math.max(nextCount, serverCount)
        unansweredCountRef.current = syncd
        setUnansweredQuestionsCount(syncd)
      }
      if (result.isCompleted) {
        setIsTerminatedForUnanswered(true)
        setIsCompleted(true)
        const closingMsg = result.closingMessage || 'We have not received a response after three questions, so we will conclude here. Thank you for your time.'
        if (voiceEngineRef.current && typeof voiceEngineRef.current.speakAiQuestion === 'function') {
          voiceEngineRef.current.speakAiQuestion({ text: closingMsg, sequence, force: true })
        }
        setLiveAiSpeech(closingMsg)
        return
      }
      if (result.nextQuestion) {
        nudgeCountRef.current = 0
        setNudgeCount(0)
        setSilenceSeconds(0)
        handleIncomingAiQuestion({
          sequence: result.sequence,
          question: result.nextQuestion,
          remainingSeconds: result.remainingSeconds,
          speakAloud: true,
        })
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

    // Safely reconcile any finalizing recognized voice text buffer without waiting indefinitely
    const finalizingSpeech = (candidateSpeechBufferRef.current || candidateInterimText || '').trim()
    if (finalizingSpeech && finalizingSpeech.length > answerText.length && (finalizingSpeech.startsWith(answerText) || !answerText)) {
      answerText = finalizingSpeech
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

    // Double-submission protection: reject multiple submits for the exact same sequence or while submitting
    if (lastSubmittedSequenceRef.current === currentQSeq || isSubmittingRef.current) {
      console.log(`[InterviewRoom] Double-submission guard: Question #${currentQSeq} already submitting.`)
      return
    }
    lastSubmittedSequenceRef.current = currentQSeq
    isSubmittingRef.current = true

    // Reset inputs and patience tracking
    setAnswerInputValue('')
    candidateSpeechBufferRef.current = ''
    currentInterimSpeechRef.current = ''
    finalizedSegmentIdsRef.current.clear()
    lastFinalizedSegmentRef.current = ''
    setCandidateInterimText('')
    lastScheduledTextRef.current = ''
    lastSpeechActivityTimeRef.current = 0
    nudgeCountRef.current = 0
    setNudgeCount(0)
    setSilenceSeconds(0)
    silenceSecondsRef.current = 0
    lastUserActivityTimeRef.current = Date.now()
    unansweredCountRef.current = 0
    setUnansweredQuestionsCount(0) // Candidate gave an active response!
    hasCandidateRespondedRef.current = false
    setHasCandidateResponded(false)
    manualMicOverrideRef.current = false
    setManualMicOverride(false)
    setIsSubmitting(true)
    setVoiceState('THINKING')
    if (voiceEngineRef.current?.cancelCurrentAudio) {
      voiceEngineRef.current.cancelCurrentAudio('Candidate submitted answer')
    }
    setError('')

    // 1. Add candidate message bubble to dialogue stream immediately
    const optimisticTurnId = `cand-${Date.now()}`
    const optimisticTurn = {
      id: optimisticTurnId,
      speaker: 'CANDIDATE',
      content: answerText,
      created_at: new Date().toISOString(),
    }
    setTranscripts((prev) => [...prev, optimisticTurn])

    try {
      const structuredAnswer = typeof payloadOrText === 'object' && payloadOrText !== null ? payloadOrText : null
      const result = await interviewService.submitAnswer(
        currentSession.id,
        token,
        answerText,
        currentQSeq,
        currentActiveQuestion?.id,
        inputMode,
        structuredAnswer
      )

      if (result.session) {
        setSession((prev) => ({
          ...prev,
          ...result.session,
          job: result.session?.job || prev?.job,
          candidate: result.session?.candidate || prev?.candidate,
          organization: result.session?.organization || prev?.organization,
        }))
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
          voiceEngineRef.current.speakAiQuestion({ text: wrapUpMsg, sequence, force: true })
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
      setTranscripts((prev) => prev.filter((turn) => turn.id !== optimisticTurnId))
      setAnswerInputValue(answerText)
      candidateSpeechBufferRef.current = answerText
      if (inputMode === 'VOICE') setCandidateInterimText(answerText)
      const normalized = normalizeApiError(err, 'We could not submit that response just now. Your answer has been preserved. Please try submitting again.')
      setError(normalized.message)
      setVoiceState('LISTENING')
    } finally {
      setIsSubmitting(false)
    }
  }

  handleSubmitAnswerRef.current = handleSubmitAnswer

  const handleCancelVoiceSubmission = () => {
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current)
      autoSubmitTimerRef.current = null
    }
    candidateSpeechBufferRef.current = ''
    currentInterimSpeechRef.current = ''
    finalizedSegmentIdsRef.current.clear()
    lastFinalizedSegmentRef.current = ''
    setCandidateInterimText('')
    setAnswerInputValue('')
    lastScheduledTextRef.current = ''
    lastSpeechActivityTimeRef.current = 0
    hasCandidateRespondedRef.current = false
    setHasCandidateResponded(false)
    if (voiceEngineRef.current) {
      voiceEngineRef.current.resetCandidateSpeechRecognition()
    }
  }

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
    currentInterimSpeechRef.current = ''
    finalizedSegmentIdsRef.current.clear()
    lastFinalizedSegmentRef.current = ''
    setCandidateInterimText('')
    setAnswerInputValue('')
    lastScheduledTextRef.current = ''
    lastSpeechActivityTimeRef.current = 0

    isCandidateTurnLockedRef.current = true
    voiceStateRef.current = 'SPEAKING'
    setVoiceState('SPEAKING')
    nudgeCountRef.current = 0
    setNudgeCount(0)
    silenceSecondsRef.current = 0
    setSilenceSeconds(0)
    lastUserActivityTimeRef.current = Date.now()

    const repeatPrompt = `Sure, let me repeat that: ${rawPrompt}`
    startScriptReveal(repeatPrompt)
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
          onStateChange: (state) => {
            voiceStateRef.current = state
            setVoiceState(state)
          },
          onAudioLevel: (level) => {
            audioLevelRef.current = level
            setAudioLevel(level)
          },
          onAiAudioStarted: (msg) => {
            voiceStateRef.current = 'SPEAKING'
            setVoiceState('SPEAKING')
            isCandidateTurnLockedRef.current = true
            if (msg?.spokenPrompt) {
              startScriptReveal(msg.spokenPrompt)
            }
          },
          onAiSpeechProgress: ({ progress }) => {
            audioProgressActiveRef.current = true
            if (scriptFallbackTimeoutRef.current) {
              clearTimeout(scriptFallbackTimeoutRef.current)
              scriptFallbackTimeoutRef.current = null
            }
            if (scriptFallbackTickerRef.current) {
              clearInterval(scriptFallbackTickerRef.current)
              scriptFallbackTickerRef.current = null
            }
            const fullScript = targetSpokenScriptRef.current
            if (!fullScript) return
            const clean = fullScript
              .replace(/^#+\s+/gm, '')
              .replace(/\*\*.*?\*\*/g, '')
              .replace(/^[A-Z\s]+:\s*/, '')
              .trim()
            const words = clean.split(/\s+/)
            if (words.length === 0) return
            const count = progress >= 0.98
              ? words.length
              : Math.min(words.length, Math.max(1, Math.ceil(progress * words.length)))
            setLiveAiSpeech(words.slice(0, count).join(' '))
          },
          onAiSpeakingConcluded: () => {
            concludeSpeakingAndPassMic()
          },
          onAiQuestion: (event) => {
            console.log('[InterviewRoom] Received authoritative ai_question via WebSocket:', event.sequence)
            handleIncomingAiQuestion(event)
          },
          onInterviewCompleted: () => setIsCompleted(true),
          onCandidateSpeech: ({ text, isInterim, isFinal, segmentId }) => {
            // STRICT TURN LOCK: Reject candidate speech while AI is speaking or session submitting/completed
            if (
              voiceCaptureCancelledRef.current ||
              isCandidateTurnLockedRef.current ||
              voiceStateRef.current === 'SPEAKING' ||
              isSubmittingRef.current ||
              isCompleted
            ) {
              return
            }

            const raw = (text || '').trim()

            // 0. Candidate repetition request:
            if (raw && isRepeatQuestionRequest(raw)) {
              console.log(`[InterviewRoom] Candidate asked to repeat question: "${raw}". Triggering repeat flow.`)
              if (autoSubmitTimerRef.current) {
                clearTimeout(autoSubmitTimerRef.current)
                autoSubmitTimerRef.current = null
              }
              candidateSpeechBufferRef.current = ''
              currentInterimSpeechRef.current = ''
              finalizedSegmentIdsRef.current.clear()
              lastFinalizedSegmentRef.current = ''
              setCandidateInterimText('')
              setAnswerInputValue('')
              lastScheduledTextRef.current = ''
              lastSpeechActivityTimeRef.current = 0

              handleRepeatCurrentQuestion()
              return
            }

            if (isFinal) {
              if (!raw) return

              // Event-level deduplication: ignore if segmentId was already processed
              if (segmentId && finalizedSegmentIdsRef.current.has(segmentId)) {
                return
              }
              if (segmentId) {
                finalizedSegmentIdsRef.current.add(segmentId)
              }

              // Do not duplicate if this exact final text was just processed
              if (lastFinalizedSegmentRef.current && lastFinalizedSegmentRef.current === raw) {
                return
              }
              lastFinalizedSegmentRef.current = raw

              // Reset ephemeral interim text
              currentInterimSpeechRef.current = ''

              // Append new finalized segment to authoritative buffer
              const base = candidateSpeechBufferRef.current || ''
              const newAccumulated = appendSpeechSegment(base, raw)
              candidateSpeechBufferRef.current = newAccumulated

              // Update the visible live transcript panel
              setCandidateInterimText(newAccumulated)

              // Synchronize the editable answer input field
              const updatedAnswerValue =
                typeof answerInputValueRef.current === 'object' && answerInputValueRef.current !== null
                  ? { ...answerInputValueRef.current, text: newAccumulated, inputMethod: 'voice_text' }
                  : newAccumulated
              setAnswerInputValue(updatedAnswerValue)
            } else if (isInterim) {
              currentInterimSpeechRef.current = raw

              // Ephemeral interim preview:
              // Display base accumulated text + current in-progress words in the blue panel
              const base = candidateSpeechBufferRef.current || ''
              const liveDisplay = base
                ? (raw ? `${base} ${raw}` : base)
                : raw

              setCandidateInterimText(liveDisplay)
              // NOTE: Unconfirmed interim words are NOT committed into answerInputValue or candidateSpeechBufferRef!
            }

            lastSpeechActivityTimeRef.current = Date.now()
            lastUserActivityTimeRef.current = Date.now()
            silenceSecondsRef.current = 0
            if (nudgeCountRef.current > 0) {
              nudgeCountRef.current = 0
              setNudgeCount(0)
            }
            if (isLongFormVoiceQuestion(activeQuestionRef.current)) {
              if (!hasCandidateRespondedRef.current) {
                hasCandidateRespondedRef.current = true
                setHasCandidateResponded(true)
              }
            }

            // Candidate speaks freely without racing a short silence timer.
            // Short pauses to think or segment endings must NEVER auto-submit their partial response.
            // Manual "Submit Response" is the primary submission mechanism.
            lastScheduledTextRef.current = candidateSpeechBufferRef.current
          },
          onTranscript: ({ text, isNudge, isTermination, isFinal, isDelta, speaker, sequence: transcriptSeq }) => {
            if (speaker === 'AI') {
              if (isThoughtOrMetaPlanning(text)) return

              // MONOTONIC SEQUENCE GUARD: Reject late transcript events from previous questions
              if (typeof transcriptSeq === 'number' && transcriptSeq < lastProcessedSequenceRef.current) {
                console.log(`[InterviewRoom] Monotonic Guard: Ignoring stale transcript with sequence ${transcriptSeq} < current ${lastProcessedSequenceRef.current}`)
                return
              }

              const cleanText = text
                .replace(/^#+\s+/gm, '')
                .replace(/\*\*.*?\*\*/g, '')
                .replace(/^[A-Z\s]+:\s*/, '')
                .trim()

              if (!cleanText) return

              if (isDelta) {
                // If no pre-known spoken script is active, smoothly accumulate stream without resetting the reveal!
                if (!targetSpokenScriptRef.current) {
                  liveAiSpeechStreamRef.current = liveAiSpeechStreamRef.current
                    ? `${liveAiSpeechStreamRef.current} ${cleanText}`
                    : cleanText
                  setLiveAiSpeech(liveAiSpeechStreamRef.current)
                }
                return
              }

              if (isFinal) {
                setSilenceSeconds(0)
                const finalText = cleanText || liveAiSpeechStreamRef.current
                if (finalText && !targetSpokenScriptRef.current) {
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
            setError(`Interviewer voice unavailable: ${err?.message || err}`)
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
            speakPendingAiPrompt(preconnected)
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
            speakPendingAiPrompt(engine)
          }
        }
      }
    }

    return () => {
      if (scriptFallbackTickerRef.current) {
        clearInterval(scriptFallbackTickerRef.current)
        scriptFallbackTickerRef.current = null
      }
      if (voiceEngineRef.current) {
        voiceEngineRef.current.stop()
        voiceEngineRef.current = null
      }
    }
  }, [token, isCompleted, isLoading, Boolean(session?.id)])

  const handleToggleMute = () => {
    // Explicit candidate manual microphone action for this question (Requirements #2, #4, #26)
    manualMicOverrideRef.current = true
    setManualMicOverride(true)

    // If AI is currently speaking, toggling mute halts AI speech and immediately unlocks candidate mic and turn!
    if (voiceStateRef.current === 'SPEAKING' || isCandidateTurnLockedRef.current) {
      console.log('[InterviewRoom] Candidate clicked unmute during AI speech. Halting speech and passing mic immediately.')
      if (voiceEngineRef.current?.cancelCurrentAudio) {
        voiceEngineRef.current.cancelCurrentAudio('Candidate clicked unmute during AI speech')
      }
      concludeSpeakingAndPassMic()
      return
    }

    if (voiceEngineRef.current) {
      const muted = voiceEngineRef.current.toggleMute()
      if (!muted) voiceCaptureCancelledRef.current = false
      setIsMuted(muted)
      isMutedRef.current = muted
      setVoiceState(muted ? 'MUTED' : 'LISTENING')
    } else {
      setIsMuted((prev) => {
        const next = !prev
        if (!next) voiceCaptureCancelledRef.current = false
        isMutedRef.current = next
        setVoiceState(next ? 'MUTED' : 'LISTENING')
        return next
      })
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
        const url = `${API_BASE_URL}/interviews/${targetId}/complete`
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

  // Canonical Active Question State Model (Requirement #26)
  const activeQuestionState = useMemo(() => {
    const q = activeQuestion || currentQuestionData
    const qType = q?.type || 'DESCRIPTIVE'
    const defaultMic = getDefaultMicEnabled(q)
    return {
      questionId: q?.id || `q_${sequence}`,
      questionType: qType,
      inputMode: isLongFormVoiceQuestion(q) ? 'VOICE' : 'INTERACTIVE',
      defaultMicEnabled: defaultMic,
      manualMicOverride: manualMicOverride,
      candidateResponded: Boolean(answerInputValue || candidateInterimText),
      fillerCount: nudgeCount,
    }
  }, [activeQuestion, currentQuestionData, sequence, manualMicOverride, answerInputValue, candidateInterimText, nudgeCount])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__QUALIFYAI_ACTIVE_QUESTION_STATE__ = activeQuestionState
    }
  }, [activeQuestionState])

  // Desktop/PC hardware gate (Requirement 10)
  if (!deviceCheck.isDesktop) {
    return <DesktopRequiredScreen detectedType={deviceCheck.detectedType} />
  }

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
    ? coverageMatrix.filter((c) =>
        c.status === 'SUFFICIENTLY_EVALUATED' ||
        c.status === 'MASTERY_PROVEN' ||
        c.status === 'ASSESSED' ||
        c.assessed === true ||
        (Number(c.attempts) >= 1 && (Number(c.average_score) > 0 || (Array.isArray(c.scores) && c.scores.length > 0)))
      ).length
    : 0
  const totalCriteriaCount = Array.isArray(coverageMatrix) ? coverageMatrix.length : 0

  // Silence Nudge Hint Text
  const silenceNudgeText = nudgeCount === 1 && voiceState !== 'SPEAKING'
    ? "Whenever you're ready, you can answer. I'm still here."
    : nudgeCount === 2 && voiceState !== 'SPEAKING'
    ? "Take your time. You can answer whenever you're ready."
    : null

  return (
    <div className="h-screen w-screen bg-[#f8fafc] text-slate-900 flex flex-col overflow-hidden selection:bg-blue-600 selection:text-white">
      {session?.interview_id && !isCompleted && !isTerminatedForViolations && (
        <video
          ref={cameraPreviewRef}
          autoPlay
          muted
          playsInline
          className="fixed bottom-5 right-5 z-50 h-24 w-36 rounded-xl object-cover -scale-x-100 shadow-xl ring-1 ring-black/10 sm:h-28 sm:w-40"
          aria-label="Live local camera preview"
        />
      )}
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
            {/* Left Region: AI Interviewer Presence & Animated Orb with Dialogue Box directly beneath */}
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
                liveAiSpeech={liveAiSpeech}
                isAiSpeaking={voiceState === 'SPEAKING'}
              />
            </div>

            {/* Right Region: Active Question Panel & Dynamic Interaction Area OR Dedicated Final Feedback Phase */}
            <div className="lg:col-span-7 h-full flex flex-col justify-between overflow-hidden gap-3.5 min-w-0">
              {error && (
                <div role="alert" className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
                  {error}
                </div>
              )}

              {wrapUpStarted || (remainingSeconds <= 60 && !isLoading && Boolean(session?.id)) || session?.session_metadata?.interview_phase === 'FEEDBACK' ? (
                <div className="flex-1 min-h-0 bg-white/90 backdrop-blur-md rounded-3xl border border-indigo-200/90 p-5 sm:p-7 flex flex-col justify-between overflow-y-auto shadow-sm">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                          Final Phase • Candidate Feedback
                        </span>
                        <h2 className="text-base sm:text-lg font-sans font-bold text-slate-900 mt-1">
                          Technical Assessment Complete
                        </h2>
                        <p className="text-xs text-slate-600 mt-0.5">
                          The final 60 seconds are reserved exclusively for candidate feedback. Please rate your experience and share any feedback.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl text-indigo-900 font-mono text-xs font-bold tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}</span>
                      </div>
                    </div>

                    {/* Assessed Rubric Pillars Summary */}
                    {coverageMatrix.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                        <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                          Assessed Rubric Pillars
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {coverageMatrix.map((criterion) => (
                            <div key={criterion.criterion_id || criterion.name} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80">
                              <span className="font-medium text-slate-700 truncate">{criterion.name}</span>
                              <span className={`text-[11px] font-bold ${criterion.attempts ? 'text-blue-600' : 'text-slate-400'}`}>
                                {criterion.attempts ? `${criterion.average_score}/10` : 'Not Assessed'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* AI Interviewer Rating */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 block">
                        Rate the AI Interviewer Experience
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            aria-label={`Rate ${rating} stars out of 5`}
                            aria-pressed={candidateAiRating === rating}
                            onClick={() => { setCandidateAiRating(rating); candidateAiRatingRef.current = rating }}
                            className={`w-10 h-10 rounded-2xl text-xs font-bold font-mono transition-all flex items-center justify-center cursor-pointer ${
                              candidateAiRating === rating
                                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400 scale-105'
                                : 'bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:bg-indigo-50/50'
                            }`}
                          >
                            {rating}★
                          </button>
                        ))}
                        <span className="text-xs text-slate-500 ml-2">
                          {candidateAiRating === 5 ? 'Exceptional' : candidateAiRating === 4 ? 'Very Good' : candidateAiRating === 3 ? 'Good' : candidateAiRating ? 'Needs Improvement' : 'Select a rating'}
                        </span>
                      </div>
                    </div>

                    {/* Feedback text area */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-800 block">
                        Candidate Comments & Reflections (Optional)
                      </label>
                      <textarea
                        value={candidateFeedback}
                        onChange={(event) => { setCandidateFeedback(event.target.value); candidateFeedbackRef.current = event.target.value }}
                        maxLength={4000}
                        rows={4}
                        placeholder="Share your thoughts on the technical pacing, clarity of questions, or the interview room..."
                        className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 focus:border-indigo-500 leading-relaxed font-sans"
                      />
                    </div>
                  </div>

                  {/* Submit button */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-3">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Session concludes at 0:00 or upon clicking submit
                    </span>
                    <button
                      type="button"
                      disabled={isSubmittingFeedback || isCompleted}
                      onClick={async () => {
                        if (isSubmittingFeedback) return
                        setIsSubmittingFeedback(true)
                        try {
                          await interviewService.completeInterview(
                            session?.interview_id || session?.id,
                            token,
                            candidateFeedbackRef.current,
                            candidateAiRatingRef.current
                          )
                        } catch (err) {
                          console.warn('Feedback submit error:', err.message)
                        } finally {
                          setIsCompleted(true)
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-semibold text-xs shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isSubmittingFeedback ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Submitting & Finalizing...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Feedback & Conclude</span>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                  <div className="flex-1 min-h-0 bg-white/70 backdrop-blur-xs rounded-3xl border border-slate-200/90 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto shadow-2xs min-w-0 w-full">

                {/* 1. Transcriber Box & Submit Bar (Moved UPWARD, between Dialogue Box and Text Box) */}
                <div className="mb-3.5 shrink-0 w-full min-w-0">
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
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            console.log('[InterviewRoom] Candidate clicked Ready to Speak.')
                            concludeSpeakingAndPassMic()
                          }}
                          className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-blue-50 active:scale-[0.98] border border-blue-200 text-blue-700 font-sans font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Unmute your microphone and start answering immediately"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>Ready to Speak</span>
                        </button>
                        <button
                          type="button"
                          disabled
                          className="px-4 py-2.5 rounded-xl bg-slate-200 text-slate-400 font-sans font-semibold text-xs cursor-not-allowed shrink-0 flex items-center justify-center gap-1.5"
                        >
                          <span>Submit Response</span>
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : candidateInterimText ? (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/95 via-indigo-50/90 to-sky-50/90 border border-blue-200/90 text-blue-950 text-xs flex flex-col gap-3.5 shadow-2xs animate-fade-in w-full min-w-0">
                      {/* Region A: Full-width live transcript content area */}
                      <div className="flex items-start gap-3 w-full min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                          <Mic className="w-4 h-4 animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-1.5 font-sans font-bold text-[11px] text-blue-700 uppercase tracking-normal">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping shrink-0" />
                            <span>Live Transcribed Voice Response</span>
                          </div>
                          <p className="italic text-slate-800 font-sans text-sm sm:text-[15px] leading-relaxed font-medium break-words [overflow-wrap:anywhere] w-full">
                            &ldquo;{candidateInterimText}&rdquo;
                          </p>
                        </div>
                      </div>

                      {/* Region B: Action controls area beneath the transcript */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-blue-200/70 w-full min-w-0">
                        <span className="text-[11px] text-blue-700 font-sans font-medium bg-blue-100/80 px-2.5 py-1 rounded-lg border border-blue-200 self-start sm:self-auto">
                          Speak naturally • Submit when ready
                        </span>
                        <div className="flex items-center justify-end gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleCancelVoiceSubmission}
                            disabled={isSubmitting}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-sans font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Clear this voice response and re-record or edit"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Clear Response</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSubmitAnswer(candidateInterimText || (typeof answerInputValue === 'object' ? answerInputValue?.text : answerInputValue), 'VOICE')}
                            disabled={isSubmitting}
                            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-sans font-semibold text-xs transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                            title="Submit response"
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
                      const isVoiceSync = typeof val === 'object' && val?.inputMethod === 'voice_text'
                      if (!isVoiceSync) {
                        lastTypingActivityTimeRef.current = Date.now()
                        lastUserActivityTimeRef.current = Date.now()
                        silenceSecondsRef.current = 0
                        setSilenceSeconds(0)
                        if (nudgeCountRef.current > 0) {
                          nudgeCountRef.current = 0
                          setNudgeCount(0)
                        }
                        const valStr = typeof val === 'string' ? val : val?.text || val?.code || ''
                        // Synchronize candidateSpeechBufferRef and candidateInterimText with manual keyboard edits
                        candidateSpeechBufferRef.current = valStr
                        setCandidateInterimText(valStr)

                        if (valStr.trim().length >= 3 && isLongFormVoiceQuestion(activeQuestionRef.current)) {
                          if (!hasCandidateRespondedRef.current) {
                            hasCandidateRespondedRef.current = true
                            setHasCandidateResponded(true)
                          }
                        }
                      }
                    }}
                    onSubmit={(payload) => handleSubmitAnswer(payload)}
                    isSubmitting={isSubmitting}
                    isAiSpeaking={voiceState === 'SPEAKING' || roomStartupCountdown > 0}
                  />
                </div>
              </div>
            </>
          )}
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

        {/* Candidate Camera Proctoring Tile & Mirror Feed */}
        <div
          className={`fixed bottom-4 right-4 z-40 flex flex-col items-end gap-1.5 transition-all duration-300 ${
            isCompleted || isTerminatedForViolations || isTerminatedForUnanswered ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div
            className={`relative overflow-hidden rounded-2xl border-2 bg-slate-900 shadow-2xl transition-all duration-300 w-36 h-28 sm:w-44 sm:h-32 ${
              cameraStatus.includes('face visible')
                ? 'border-emerald-500/80 shadow-emerald-500/10'
                : 'border-rose-500/80 shadow-rose-500/20 animate-pulse'
            }`}
          >
            <video
              ref={cameraPreviewRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover -scale-x-100"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-xs text-[10px] text-white font-medium select-none">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  cameraStatus.includes('face visible') ? 'bg-emerald-400' : 'bg-rose-400 animate-ping'
                }`}
              />
              <span className="truncate max-w-[95px]">
                {cameraStatus.includes('face visible') ? 'Face In Frame' : 'Face Away'}
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

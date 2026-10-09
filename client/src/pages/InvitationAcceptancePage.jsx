import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Mic,
  Camera,
  Clock,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Volume2,
  Award,
  Maximize2,
  Lock,
  Play,
  EyeOff,
  Radio,
  FileCheck,
} from 'lucide-react'
import { candidateService } from '../services/candidateService.js'
import { VoiceInterviewEngine } from '../services/voiceInterviewEngine.js'
import { validateName, validatePhone } from '../utils/validators.js'
import { normalizeApiError } from '../utils/errorNormalizer.js'
import { VisualProctoringService } from '../services/visualProctoringService.js'
import { checkDeviceCompatibility } from '../utils/deviceCompatibility.js'
import DesktopRequiredScreen from '../components/common/DesktopRequiredScreen.jsx'
import {
  MICROPHONE_VERIFICATION_STATES,
  analyzeAudioFrame,
  isFrameNonSilent,
  evaluateRollingWindow,
} from '../utils/microphoneValidator.js'

/**
 * Modernized Candidate Assessment Onboarding & Staging Flow
 * High-legibility 2-Column Left/Right layout with generous margins & spacing
 * Stage 1: Candidate Verification & Profile Registration
 * Stage 2: Examination Rules, Honor Code & Strict 3-Warning Tab Switch Lockdown
 * Stage 3: Light-Themed Hardware & Full-Screen Lockdown Verification (Slider Removed)
 */
export default function InvitationAcceptancePage() {
  const { token } = useParams()
  const navigate = useNavigate()

  // Hardware compatibility gate: Desktop / PC required (Requirement 10)
  const [deviceCheck] = useState(() => checkDeviceCompatibility())

  const [invitationData, setInvitationData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Flow Stages: 1 = 'register', 2 = 'rules', 3 = 'checks'
  const [currentStage, setCurrentStage] = useState(1)

  // Stage 1: Candidate Registration State
  const [candidateForm, setCandidateForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    experienceYears: '3–5 Years',
    specialization: 'Distributed Systems & Cloud',
    recentCompany: '',
  })
  const [registerError, setRegisterError] = useState('')
  const [candidateFieldErrors, setCandidateFieldErrors] = useState({})

  // Stage 2: Honor Code Agreement
  const [rulesAccepted, setRulesAccepted] = useState(false)

  // Stage 3: Real Mic Check & Full Screen State
  const [micAudioLevel, setMicAudioLevel] = useState(0)
  const [micLevelDb, setMicLevelDb] = useState(-60)
  const [micVerificationState, setMicVerificationState] = useState(
    MICROPHONE_VERIFICATION_STATES.WAITING_FOR_INPUT
  )
  const [micStatusMessage, setMicStatusMessage] = useState(
    'Starting microphone check automatically...'
  )
  const [audioInputDevices, setAudioInputDevices] = useState([])
  const [selectedMicId, setSelectedMicId] = useState('')
  const [micTestError, setMicTestError] = useState('')
  const [isMicTesting, setIsMicTesting] = useState(false)
  const [audioCheckPassed, setAudioCheckPassed] = useState(false)
  const [cameraCheckPassed, setCameraCheckPassed] = useState(false)
  const [faceCheckPassed, setFaceCheckPassed] = useState(false)
  const [isCameraTesting, setIsCameraTesting] = useState(false)
  const [cameraStatusMessage, setCameraStatusMessage] = useState('Camera access and a clear face view are required.')
  const [fullscreenCheckPassed, setFullscreenCheckPassed] = useState(false)
  const [isReadyForAssessment, setIsReadyForAssessment] = useState(false)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)
  const micStreamRef = useRef(null)
  const micRequestIdRef = useRef(0)
  const rollingFramesRef = useRef([])
  const noiseFloorRef = useRef(-65)
  const speechDetectedSinceRef = useRef(null)
  const cameraVideoRef = useRef(null)
  const visualProctoringRef = useRef(null)

  const handleStartCameraTest = async () => {
    visualProctoringRef.current?.stop()
    setCameraCheckPassed(false)
    setFaceCheckPassed(false)
    setIsCameraTesting(true)
    setCameraStatusMessage('Requesting camera and loading local face detection…')
    try {
      const checker = new VisualProctoringService({
        video: cameraVideoRef.current,
        onStatus: ({ cameraReady, facePresent, faceCount, degraded, message }) => {
          setCameraCheckPassed(Boolean(cameraReady))
          setFaceCheckPassed(Boolean(cameraReady && facePresent && faceCount === 1))
          if (degraded) {
            setCameraStatusMessage(message || 'Face detection is temporarily unavailable.')
          } else if (cameraReady && faceCount === 1) {
            setCameraStatusMessage('Camera and face detection passed. Video stays on this device.')
          } else if (cameraReady && faceCount > 1) {
            setCameraStatusMessage('Only one person should be visible in the camera.')
          } else if (cameraReady) {
            setCameraStatusMessage('Camera is on. Center your face in the preview to pass the face check.')
          } else if (message) setCameraStatusMessage(message)
        },
      })
      visualProctoringRef.current = checker
      await checker.start()
      setIsCameraTesting(false)
    } catch (error) {
      setIsCameraTesting(false)
      setCameraCheckPassed(false)
      setFaceCheckPassed(false)
      setCameraStatusMessage(error.name === 'NotAllowedError' ? 'Allow camera access in your browser, then try again.' : error.message || 'Unable to start camera check.')
    }
  }

  // Stage 4: Modal & 5-4-3-2-1 Countdown + Gemini Voice Pre-Connect
  const [showLaunchModal, setShowLaunchModal] = useState(false)
  const [isCountingDown, setIsCountingDown] = useState(false)
  const [countdownValue, setCountdownValue] = useState(5)
  const [voicePreconnectStatus, setVoicePreconnectStatus] = useState('idle') // 'idle' | 'connecting' | 'connected' | 'failed'
  const [voicePreconnectError, setVoicePreconnectError] = useState('')
  const voiceEngineRef = useRef(null)

  // Fetch token & invitation data
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setError('No invitation token provided.')
        setIsLoading(false)
        return
      }

      try {
        const data = await candidateService.getInvitationByToken(token)
        setInvitationData(data)

        if (data?.candidate) {
          setCandidateForm((prev) => ({
            ...prev,
            fullName: data.candidate.full_name || '',
            email: data.candidate.email || '',
            phone: data.candidate.phone || '',
            experienceYears: data.candidate.experience_years || prev.experienceYears,
            specialization: data.candidate.specialization || prev.specialization,
            recentCompany: data.candidate.recent_company || prev.recentCompany,
          }))
        }
      } catch (err) {
        console.error('Invitation verification error:', err)
        const normalized = normalizeApiError(err, 'This invitation link is invalid or has expired.')
        setError(normalized.message)
      } finally {
        setIsLoading(false)
      }
    }

    verifyToken()
  }, [token])

  const refreshAudioInputDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter((device) => device.kind === 'audioinput')
      setAudioInputDevices(inputs)
      if (selectedMicId && !inputs.some((device) => device.deviceId === selectedMicId)) {
        setSelectedMicId('')
      }
    } catch (err) {
      console.warn('Unable to list audio input devices:', err.message)
    }
  }

  const stopMicTest = () => {
    micRequestIdRef.current += 1
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop())
      micStreamRef.current = null
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close().catch(() => {}) } catch (_) {}
      audioContextRef.current = null
    }
    analyserRef.current = null
    rollingFramesRef.current = []
  }

  // Measure actual input RMS and validate technical acoustic capture (quiet speech allowed, clicks rejected)
  const handleStartMicTest = async (requestedDeviceId = selectedMicId) => {
    stopMicTest()
    const requestId = micRequestIdRef.current

    try {
      setIsMicTesting(true)
      setAudioCheckPassed(false)
      setMicTestError('')
      setMicAudioLevel(0)
      setMicLevelDb(-60)
      rollingFramesRef.current = []
      noiseFloorRef.current = -65
      setMicVerificationState(MICROPHONE_VERIFICATION_STATES.WAITING_FOR_INPUT)
      setMicStatusMessage('Microphone active — speak normally into your microphone...')
      speechDetectedSinceRef.current = null

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(requestedDeviceId ? { deviceId: { exact: requestedDeviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      if (requestId !== micRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      micStreamRef.current = stream
      const activeDeviceId = stream.getAudioTracks()[0]?.getSettings?.().deviceId || requestedDeviceId || ''
      if (activeDeviceId) {
        setSelectedMicId(activeDeviceId)
        try { window.localStorage.setItem('qualifyai:selected-microphone', activeDeviceId) } catch (_) {}
      }
      await refreshAudioInputDevices()
      if (requestId !== micRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (requestId !== micRequestIdRef.current) return
          analyserRef.current = null
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
          if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
          audioContextRef.current = null
          setIsMicTesting(false)
          setAudioCheckPassed(false)
          setMicAudioLevel(0)
          const errorMsg = 'The selected microphone disconnected. Choose an available input device.'
          setMicVerificationState(MICROPHONE_VERIFICATION_STATES.NEEDS_ATTENTION)
          setMicTestError(errorMsg)
          setMicStatusMessage(errorMsg)
        }
      })

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.85
      analyser.minDecibels = -90
      analyser.maxDecibels = -10
      source.connect(analyser)
      analyserRef.current = analyser

      const timeData = new Float32Array(analyser.fftSize)
      let smoothedLevel = 0
      let lastUiUpdate = 0

      const updateLevel = () => {
        if (requestId !== micRequestIdRef.current || !analyserRef.current) return
        analyserRef.current.getFloatTimeDomainData(timeData)
        const frameMetrics = analyzeAudioFrame(timeData)

        // Dynamic noise floor tracking during quiet/ambient periods
        if (frameMetrics.db < -50) {
          noiseFloorRef.current = noiseFloorRef.current * 0.95 + frameMetrics.db * 0.05
        }

        const isNonSilent = isFrameNonSilent(frameMetrics, noiseFloorRef.current)
        const now = Date.now()

        rollingFramesRef.current.push({
          timestamp: now,
          db: frameMetrics.db,
          rms: frameMetrics.rms,
          peakSample: frameMetrics.peakSample,
          zeroCrossings: frameMetrics.zeroCrossings,
          isDigitalSilence: frameMetrics.isDigitalSilence,
          isNonSilent,
        })

        // Retain rolling frame history
        if (rollingFramesRef.current.length > 60) {
          rollingFramesRef.current = rollingFramesRef.current.filter((f) => now - f.timestamp <= 1200)
        }

        // Live visual meter (diagnostic visual indicator - does not gate verification)
        const dbClamped = Math.max(-60, Math.min(0, frameMetrics.db))
        const rawLevel = Math.round(((dbClamped + 60) / 60) * 100)
        if (rawLevel > smoothedLevel) {
          smoothedLevel += (rawLevel - smoothedLevel) * 0.55
        } else {
          smoothedLevel += (rawLevel - smoothedLevel) * 0.18
        }
        if (now - lastUiUpdate >= 50) {
          setMicAudioLevel(Math.round(smoothedLevel))
          setMicLevelDb(Math.round(dbClamped))
          lastUiUpdate = now
        }

        // Technical signal verification over short rolling window
        const evalResult = evaluateRollingWindow(rollingFramesRef.current, noiseFloorRef.current, now)
        setMicVerificationState(evalResult.state)
        setMicStatusMessage(evalResult.message)

        if (evalResult.isVerified) {
          setAudioCheckPassed(true)
        }

        animFrameRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()
    } catch (err) {
      console.warn('Microphone access notice:', err.message)
      const friendlyMessage = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        ? 'Allow microphone access in your browser to continue.'
        : err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError'
        ? 'That microphone is unavailable. Choose another input device.'
        : err.name === 'OverconstrainedError'
        ? 'That microphone could not be opened. Choose another input device.'
        : 'The microphone could not be started. Check it and try again.'
      if (requestId === micRequestIdRef.current) {
        setMicVerificationState(MICROPHONE_VERIFICATION_STATES.NEEDS_ATTENTION)
        setMicTestError(friendlyMessage)
        setMicStatusMessage(friendlyMessage)
        micStreamRef.current?.getTracks().forEach((track) => track.stop())
        micStreamRef.current = null
        setIsMicTesting(false)
        setAudioCheckPassed(false)
      }
    }
  }

  // Full Screen Mode Request & Listener
  const handleRequestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setFullscreenCheckPassed(true)
      } else {
        setFullscreenCheckPassed(true)
      }
    } catch (err) {
      console.warn('Fullscreen request error:', err)
      // Fallback for browsers with strict permissions
      setFullscreenCheckPassed(true)
    }
  }

  // Start hardware checks when entering the final onboarding step.
  useEffect(() => {
    if (currentStage === 3) {
      // 1. Request full screen automatically
      if (!document.fullscreenElement) {
        handleRequestFullscreen()
      } else {
        setFullscreenCheckPassed(true)
      }

      // 2. Start live microphone audio check automatically
      if (!isMicTesting && !audioCheckPassed) {
        handleStartMicTest()
      }
      if (!cameraCheckPassed && !isCameraTesting) handleStartCameraTest()

      const handleDeviceChange = () => refreshAudioInputDevices()
      navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange)
      return () => {
        navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange)
        visualProctoringRef.current?.stop()
        visualProctoringRef.current = null
      }
    }
  }, [currentStage])

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreenCheckPassed(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Resume suspended AudioContext on user interaction
  useEffect(() => {
    const resumeAudio = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {})
      }
    }
    window.addEventListener('click', resumeAudio)
    window.addEventListener('keydown', resumeAudio)
    return () => {
      window.removeEventListener('click', resumeAudio)
      window.removeEventListener('keydown', resumeAudio)
    }
  }, [])

  // Audio Context & Stream cleanup ONLY on unmount
  useEffect(() => {
    return () => {
      stopMicTest()
      visualProctoringRef.current?.stop()
    }
  }, [])

  // All hardware checks gate the assessment start.
  useEffect(() => {
    setIsReadyForAssessment(audioCheckPassed && cameraCheckPassed && faceCheckPassed && fullscreenCheckPassed)
  }, [audioCheckPassed, cameraCheckPassed, faceCheckPassed, fullscreenCheckPassed])

  // Countdown timer + Gemini Live Voice Engine Pre-Connect during countdown
  useEffect(() => {
    if (!isCountingDown) return

    // Kick off Gemini voice preconnect immediately when countdown starts (only once)
    if (voicePreconnectStatus === 'idle') {
      setVoicePreconnectStatus('connecting')

      const engine = new VoiceInterviewEngine({
        token,
        onStateChange: () => {},
        onTranscript: () => {},
        onCandidateSpeech: () => {},
        onAudioLevel: () => {},
        onError: () => {},
      })
      voiceEngineRef.current = engine

      engine.preconnect(12000).then((result) => {
        if (result.success) {
          setVoicePreconnectStatus('connected')
        } else {
          setVoicePreconnectStatus('failed')
          setVoicePreconnectError(result.error || 'Voice engine connection failed.')
          engine.stop()
          voiceEngineRef.current = null
        }
      })
    }

    if (countdownValue > 1) {
      const timer = setTimeout(() => {
        setCountdownValue((prev) => prev - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (countdownValue === 1) {
      const timer = setTimeout(async () => {
        // Countdown finished: check voice connection health
        if (voicePreconnectStatus === 'failed') {
          return
        }

        // If still connecting (slow network), wait a bit more then check
        if (voicePreconnectStatus === 'connecting') {
          const waitResult = await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
              if (voiceEngineRef.current?.isPreconnected) {
                clearInterval(checkInterval)
                resolve(true)
              }
            }, 300)
            setTimeout(() => {
              clearInterval(checkInterval)
              resolve(voiceEngineRef.current?.isPreconnected || false)
            }, 3000)
          })

          if (!waitResult) {
            setVoicePreconnectStatus('failed')
            setVoicePreconnectError('AI evaluator took too long to initialize. Please try again in a few minutes.')
            if (voiceEngineRef.current) {
              voiceEngineRef.current.stop()
              voiceEngineRef.current = null
            }
            return
          }
          setVoicePreconnectStatus('connected')
        }

        // Voice engine is connected! Store it for InterviewRoomPage to consume
        if (voiceEngineRef.current) {
          VoiceInterviewEngine.setPreconnectedEngine(voiceEngineRef.current)
          voiceEngineRef.current = null
        }

        try {
          await candidateService.acceptInvitation(token, candidateForm)
        } catch (e) {
          console.warn('Acceptance recorded locally:', e.message)
        }
        navigate(`/interview/${token}`)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isCountingDown, countdownValue, token, candidateForm, navigate, voicePreconnectStatus])

  // Cleanup voice engine on unmount if not transferred
  useEffect(() => {
    return () => {
      if (voiceEngineRef.current) {
        voiceEngineRef.current.stop()
        voiceEngineRef.current = null
      }
    }
  }, [])

  // Desktop/PC hardware gate (Requirement 10)
  if (!deviceCheck.isDesktop) {
    return <DesktopRequiredScreen detectedType={deviceCheck.detectedType} />
  }

  if (isLoading) {
    return (
      <div className="h-screen bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs font-mono font-bold text-slate-500 tracking-wider uppercase">
          Verifying cryptographic invitation token...
        </p>
      </div>
    )
  }

  if (error || !invitationData) {
    return (
      <div className="h-screen bg-[#f8fafc] text-slate-900 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-3xl p-8 text-center space-y-5 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-heading font-extrabold text-slate-900 tracking-tight">
              Assessment Access Restricted
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {error || 'This interview access link is no longer valid. Please contact the recruiting team.'}
            </p>
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

  const { invitation, job, candidate, organization } = invitationData

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] text-slate-900 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Header */}
      <header className="h-14 px-6 border-b border-slate-200/90 bg-white flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-heading font-extrabold text-sm tracking-tight text-slate-900">
            Qualify<span className="text-blue-600">AI</span>
          </span>
          <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase hidden sm:inline">
            Candidate Assessment Gateway
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-xs font-sans font-semibold text-rose-700 flex items-center gap-2 tracking-normal shadow-2xs">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>3-Strike Tab-Lock Active</span>
          </span>
          <span className="px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-sans font-semibold text-emerald-800 hidden md:flex items-center gap-2 tracking-normal shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Transient Single-Use Session</span>
          </span>
        </div>
      </header>

      {/* Main 2-Column Split Workspace */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-3.5rem)]">
        {/* LEFT COLUMN: Role Context, Stepper & Proctoring Policy */}
        <aside className="lg:col-span-4 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/90 p-6 sm:p-8 lg:p-9 flex flex-col justify-between lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto">
          <div className="space-y-6">
            {/* Position Summary Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-blue-50/60 via-slate-50/40 to-white border border-slate-200/80 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold uppercase tracking-wider">
                  {job?.seniority || 'SENIOR'}
                </span>
                <span className="text-xs font-mono text-slate-500 font-medium">
                  {job?.department || 'Engineering Core'}
                </span>
              </div>
              <h2 className="text-xl font-heading font-extrabold text-slate-900 leading-snug">
                {job?.title || 'Technical Assessment'}
              </h2>
              <div className="text-xs text-slate-500 flex items-center gap-2 pt-0.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium text-slate-600">{organization?.name || 'Hiring Organization'}</span>
              </div>
            </div>

            {/* 3-Step Visual Stepper */}
            <div className="space-y-3.5">
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Assessment Onboarding Stages
              </div>

              <div className="space-y-3">
                {[
                  { step: 1, title: 'Candidate Profile', desc: 'Verify identity & engineering background' },
                  { step: 2, title: 'Examination Rules', desc: 'Tab-switch lockdown & automatic detention policy' },
                  { step: 3, title: 'Hardware Verification', desc: 'Microphone, camera, face detection & fullscreen' },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`p-3.5 rounded-2xl border flex items-center gap-3.5 transition-all ${
                      currentStage === s.step
                        ? 'bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs'
                        : currentStage > s.step
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50/60 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                        currentStage === s.step
                          ? 'bg-blue-600 text-white shadow-xs'
                          : currentStage > s.step
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {currentStage > s.step ? '✓' : s.step}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight text-slate-900">{s.title}</div>
                      <div className="text-[11px] opacity-75 truncate mt-0.5 leading-normal">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Persistent Security & Automatic Detention Policy Notice Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/90 to-rose-50/50 border border-amber-200/90 space-y-2.5 shadow-2xs">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Strict 3-Strike Warning Policy</span>
              </div>
              <p className="text-[11px] text-amber-900/80 leading-relaxed">
                Tab switching, window unfocusing, or leaving full-screen are tracked by active proctoring telemetry.
                Exceeding <strong>3 warnings results in instant automatic detention</strong> and session disqualification.
              </p>
            </div>
          </div>

          {/* Left Footer: Specs & Security */}
          <div className="pt-5 border-t border-slate-100 space-y-2.5 text-xs font-mono text-slate-400">
            <div className="flex items-center justify-between">
              <span>Format:</span>
              <span className="text-slate-800 font-semibold">Conversational AI Voice</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Duration:</span>
              <span className="text-slate-800 font-semibold">
                {invitation?.interview_duration_minutes ? `~${invitation.interview_duration_minutes} Minutes` : '~15–20 Minutes'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Lockdown:</span>
              <span className="text-rose-600 font-bold">Strict 3 Warnings Max</span>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Interactive Form Surface (Directly in main area, no enclosing card) */}
        <div className="lg:col-span-8 bg-[#f8fafc] p-6 sm:p-8 lg:p-12 flex flex-col justify-between">
          {/* STAGE 1: Profile Registration */}
          {currentStage === 1 && (
            <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest">
                    Step 1 of 3 • Identity & Context
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 tracking-tight mt-1 mb-2">
                    Candidate Verification & Profile Registration
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
                    Verify your contact information and engineering background before proceeding to examination rules and hardware checks.
                  </p>
                </div>

                {registerError && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5 shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{registerError}</span>
                  </div>
                )}

                <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                    <FileCheck className="w-4 h-4 text-blue-600" />
                    <span>Candidate Profile Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 pt-1">
                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                        Full Legal Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={candidateForm.fullName}
                        onChange={(e) => {
                          setCandidateForm({ ...candidateForm, fullName: e.target.value })
                          if (candidateFieldErrors.fullName) {
                            setCandidateFieldErrors((prev) => ({ ...prev, fullName: null }))
                          }
                        }}
                        placeholder="e.g. Devon Kaelen"
                        className={`w-full h-11 px-3.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none transition ${
                          candidateFieldErrors.fullName
                            ? 'border-rose-400 ring-2 ring-rose-400/20'
                            : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                        }`}
                      />
                      {candidateFieldErrors.fullName && (
                        <p className="mt-1 text-xs text-rose-600 font-medium">{candidateFieldErrors.fullName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                        Registered Email
                      </label>
                      <input
                        type="email"
                        readOnly
                        value={candidateForm.email}
                        className="w-full h-11 px-3.5 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-500 outline-none cursor-not-allowed font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                        Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={candidateForm.phone}
                        onChange={(e) => {
                          setCandidateForm({ ...candidateForm, phone: e.target.value })
                          if (candidateFieldErrors.phone) {
                            setCandidateFieldErrors((prev) => ({ ...prev, phone: null }))
                          }
                        }}
                        placeholder="+91 9876543210"
                        className={`w-full h-11 px-3.5 bg-slate-50 border rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none transition ${
                          candidateFieldErrors.phone
                            ? 'border-rose-400 ring-2 ring-rose-400/20'
                            : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                        }`}
                      />
                      {candidateFieldErrors.phone && (
                        <p className="mt-1 text-xs text-rose-600 font-medium">{candidateFieldErrors.phone}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                        Experience Level
                      </label>
                      <select
                        value={candidateForm.experienceYears}
                        onChange={(e) => setCandidateForm({ ...candidateForm, experienceYears: e.target.value })}
                        className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                      >
                        <option value="0–2 Years">0 – 2 Years (Associate)</option>
                        <option value="3–5 Years">3 – 5 Years (Mid-Level)</option>
                        <option value="5–8 Years">5 – 8 Years (Senior)</option>
                        <option value="8+ Years">8+ Years (Staff / Principal)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                        Primary Technical Domain
                      </label>
                      <input
                        type="text"
                        value={candidateForm.specialization}
                        onChange={(e) => setCandidateForm({ ...candidateForm, specialization: e.target.value })}
                        placeholder="e.g. Distributed Systems, Go, Storage Engines"
                        className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                        Recent Employer or Institute
                      </label>
                      <input
                        type="text"
                        value={candidateForm.recentCompany}
                        onChange={(e) => setCandidateForm({ ...candidateForm, recentCompany: e.target.value })}
                        placeholder="e.g. Enterprise Infrastructure Corp"
                        className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-6 border-t border-slate-200/80 flex items-center justify-between mt-auto">
                <span className="text-xs text-slate-400 font-mono">
                  Encrypted applicant telemetry record
                </span>
                <button
                  onClick={() => {
                    const errors = {}
                    const nameRes = validateName(candidateForm.fullName, 'Full Legal Name', { min: 2, max: 100 })
                    if (!nameRes.valid) errors.fullName = nameRes.error

                    const phoneRes = validatePhone(candidateForm.phone, { required: true })
                    if (!phoneRes.valid) errors.phone = phoneRes.error

                    if (Object.keys(errors).length > 0) {
                      setCandidateFieldErrors(errors)
                      setRegisterError('Please correct the highlighted fields before proceeding.')
                      return
                    }

                    setCandidateFieldErrors({})
                    setRegisterError('')
                    setCurrentStage(2)
                  }}
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-semibold shadow-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to Examination Rules</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: Rules, Honor Code & Strict 3-Warning Tab Switch Policy */}
          {currentStage === 2 && (
            <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest">
                    Step 2 of 3 • Mandatory Integrity Protocol
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 tracking-tight mt-1 mb-2">
                    Examination Rules & 3-Warning Detention Protocol
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
                    Review all integrity rules and proctoring constraints carefully before entering hardware calibration.
                  </p>
                </div>

                {/* Prominent High-Visibility Warning Callout Banner */}
                <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-950 space-y-2 shadow-2xs">
                  <div className="flex items-center gap-2.5 font-heading font-extrabold text-xs sm:text-sm text-rose-900">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>Strict Tab-Switch & 3-Warning Automatic Detention Rule</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-rose-800/90 leading-relaxed">
                    Switching browser tabs, minimizing the screen, or unfocusing the test window triggers an instantaneous proctoring strike. 
                    Candidates reaching <strong>3 warnings will experience automatic detention and instant disqualification</strong> from the assessment with zero re-entry permitted.
                  </p>
                </div>

                {/* 6 Structured, Beautifully Spaced Rule Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-4.5">
                  {/* Rule 1: Tab Switch & Window Focus */}
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2 hover:bg-slate-50/80 transition shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                        <EyeOff className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Tab Switch & Focus Guard</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Strike Rule
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Navigating away from the active tab, switching applications, or opening secondary windows is tracked in real-time and logs a security warning.
                    </p>
                  </div>

                  {/* Rule 2: Automatic Detention on 3rd Strike */}
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2 hover:bg-slate-50/80 transition shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Automatic Detention</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                        Disqualification
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Accumulating 3 warnings automatically detains and terminates the session immediately. An incident report is recorded directly in your candidate audit file.
                    </p>
                  </div>

                  {/* Rule 3: Continuous Full-Screen Enforcement */}
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2 hover:bg-slate-50/80 transition shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                        <Maximize2 className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Full-Screen Lockdown</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        Mandatory
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      The interview must run exclusively in full-screen mode. Pressing Escape or resizing the window raises an integrity warning and halts questions.
                    </p>
                  </div>

                  {/* Rule 4: Zero External AI Tools or Devices */}
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2 hover:bg-slate-50/80 transition shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                        <Lock className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Zero External AI Tools</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        Strict Ban
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Third-party AI assistants, ChatGPT, Copilot, secondary monitors, or mobile lookups are strictly prohibited and flagged by behavioral heuristics.
                    </p>
                  </div>

                  {/* Rule 5: Continuous Audio & Speech Verification */}
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2 hover:bg-slate-50/80 transition shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                        <Mic className="w-4 h-4 text-purple-600 shrink-0" />
                        <span>Voice Acoustic Analysis</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        Live Stream
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Microphone audio captures live verbal speech. Multiple speaker voices in the room, whispering, or synthetic speech generators will trigger anomaly warnings.
                    </p>
                  </div>

                  {/* Rule 6: Single-Use Cryptographic Session */}
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2 hover:bg-slate-50/80 transition shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Single-Use Session</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        One-Time
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      This token is single-use only. Once started, closed, or terminated due to warnings, the link permanently expires and cannot be restarted.
                    </p>
                  </div>
                </div>

                {/* Interactive Honor Code Agreement Card with Native Checkbox Accessibility */}
                <label
                  htmlFor="rules-consent-checkbox"
                  className={`p-5 sm:p-6 rounded-2xl border-2 transition-all cursor-pointer select-none block shadow-2xs ${
                    rulesAccepted
                      ? 'bg-blue-50/70 border-blue-500 shadow-xs ring-2 ring-blue-100'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="pt-0.5">
                      <input
                        id="rules-consent-checkbox"
                        type="checkbox"
                        checked={rulesAccepted}
                        onChange={(e) => setRulesAccepted(e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded-lg border-slate-300 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                        I solemnly agree to the Honor Code, Tab-Switch Rules, and 3-Warning Lockdown Policy
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed">
                        I explicitly acknowledge that switching tabs, unfocusing the window, or exiting full screen will issue security warnings, and reaching 3 warnings will result in immediate automatic detention and irreversible session disqualification.
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-6 border-t border-slate-200/80 flex items-center justify-between mt-auto">
                <button
                  onClick={() => setCurrentStage(1)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  disabled={!rulesAccepted}
                  onClick={async () => {
                    try {
                      await handleRequestFullscreen()
                    } catch (_) {}
                    setCurrentStage(3)
                  }}
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-semibold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Continue to Hardware Checks</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: Pre-Assessment Hardware Verification */}
          {currentStage === 3 && (
            <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-between space-y-8">
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest">
                    Step 3 of 3 • Mandatory Verification Gate
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 tracking-tight mt-1 mb-2">
                    Hardware Calibration & Full-Screen Lockdown
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
                    Verify live audio detection and confirm full-screen mode before launching your official session.
                  </p>
                </div>

                {/* Tab Switch & Detention Warning Reminder Callout */}
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 font-heading font-bold text-xs sm:text-sm text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Final Warning Before Session Launch</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-amber-800/90 leading-relaxed">
                    Once you launch the assessment, tab switching and window minimization are strictly prohibited. 
                    Reaching <strong>3 warnings results in automatic detention</strong> and immediate test conclusion.
                  </p>
                </div>

                {/* Voice, local camera/face detection, and fullscreen checks */}
                <div className="space-y-6">
                  {/* Check 1: Real Live Microphone Audio Check */}
                  <div
                    className={`p-5 sm:p-6 rounded-2xl border transition-all ${
                      audioCheckPassed
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                        : micVerificationState === MICROPHONE_VERIFICATION_STATES.NEEDS_ATTENTION
                        ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                        : micVerificationState === MICROPHONE_VERIFICATION_STATES.INPUT_DETECTED
                        ? 'bg-blue-50/40 border-blue-200 text-blue-950'
                        : 'bg-white border-slate-200/90 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            audioCheckPassed
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : micVerificationState === MICROPHONE_VERIFICATION_STATES.NEEDS_ATTENTION
                              ? 'bg-rose-100 text-rose-600 border border-rose-200'
                              : micVerificationState === MICROPHONE_VERIFICATION_STATES.INPUT_DETECTED
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-blue-50 text-blue-600 border border-blue-200'
                          }`}
                        >
                          <Mic className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
                            <span>Check 1: Live Microphone Audio Check</span>
                            {audioCheckPassed ? (
                              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                VERIFIED ✓
                              </span>
                            ) : micVerificationState === MICROPHONE_VERIFICATION_STATES.INPUT_DETECTED ? (
                              <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                INPUT DETECTED
                              </span>
                            ) : micVerificationState === MICROPHONE_VERIFICATION_STATES.NEEDS_ATTENTION ? (
                              <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                NEEDS ATTENTION
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full">
                                WAITING FOR INPUT
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 leading-normal">
                            {audioCheckPassed
                              ? 'Microphone verified. Genuine voice signal captured successfully.'
                              : micStatusMessage || 'Starting microphone check automatically...'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-1">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-semibold text-slate-700">Microphone input</span>
                        <select
                          value={selectedMicId}
                          onChange={(event) => {
                            const deviceId = event.target.value
                            setSelectedMicId(deviceId)
                            setAudioCheckPassed(false)
                            setMicVerificationState(MICROPHONE_VERIFICATION_STATES.WAITING_FOR_INPUT)
                            handleStartMicTest(deviceId)
                          }}
                          disabled={!audioInputDevices.length}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                        >
                          {audioInputDevices.length === 0 && <option value="">Waiting for microphone permission...</option>}
                          {audioInputDevices.map((device, index) => (
                            <option key={device.deviceId || `mic-${index}`} value={device.deviceId}>
                              {device.label || `Microphone ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4 shadow-inner">
                        <div className="mb-3 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-700">Live input level (Diagnostic meter)</span>
                          <span className="font-mono tabular-nums text-slate-500">{isMicTesting ? `${micLevelDb} dB` : 'Mic off'}</span>
                        </div>
                        <div
                          className="h-4 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200"
                          role="meter"
                          aria-label="Microphone input level (Diagnostic visual indicator)"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={micAudioLevel}
                        >
                          <div
                            className={`h-full rounded-full transition-[width] duration-75 ${
                              audioCheckPassed
                                ? 'bg-emerald-500'
                                : micAudioLevel > 70
                                ? 'bg-amber-400'
                                : 'bg-blue-500'
                            }`}
                            style={{ width: `${micAudioLevel}%` }}
                          />
                        </div>
                        <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                          <span>Quiet</span><span>Normal conversational level</span><span>Loud</span>
                        </div>
                        <p className="mt-3 min-h-5 text-xs text-slate-600" aria-live="polite">
                          {micTestError ? (
                            <span className="text-rose-600 font-medium">{micTestError}</span>
                          ) : audioCheckPassed ? (
                            'Your voice is captured clearly. The microphone is ready for the assessment.'
                          ) : isMicTesting ? (
                            micStatusMessage || 'Speak normally or quietly to verify your microphone.'
                          ) : (
                            'Choose a microphone and start the live check.'
                          )}
                        </p>
                      </div>

                      {(!isMicTesting || micTestError || !audioCheckPassed) && (
                        <button
                          type="button"
                          onClick={() => handleStartMicTest(selectedMicId)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
                        >
                          <Volume2 className="h-3.5 w-3.5 text-blue-600" />
                          {micTestError ? 'Try microphone again' : isMicTesting ? 'Restart check' : 'Start microphone check'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Check 2: Local camera and face detection */}
                  <div className={`p-5 sm:p-6 rounded-2xl border transition-all ${cameraCheckPassed && faceCheckPassed ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cameraCheckPassed && faceCheckPassed ? 'bg-emerald-600 text-white' : 'bg-indigo-50 text-indigo-600 border border-indigo-200'}`}>
                          <Camera className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
                            <span>Check 2: Camera & Face Detection</span>
                            {cameraCheckPassed && faceCheckPassed && <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">VERIFIED ✓</span>}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">Camera frames are analyzed locally and are not recorded or uploaded.</div>
                        </div>
                      </div>
                      <button type="button" onClick={handleStartCameraTest} disabled={isCameraTesting} className="shrink-0 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer">
                        {isCameraTesting ? 'Checking…' : cameraCheckPassed ? 'Restart check' : 'Start camera'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4 items-center">
                      <div className="aspect-video overflow-hidden rounded-xl border border-slate-300 bg-slate-950">
                        <video ref={cameraVideoRef} autoPlay muted playsInline className="h-full w-full object-cover -scale-x-100" aria-label="Local camera preview" />
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-700"><span className={`h-2 w-2 rounded-full ${cameraCheckPassed ? 'bg-emerald-500' : 'bg-slate-300'}`} />Camera access {cameraCheckPassed ? 'ready' : 'needed'}</div>
                        <div className="flex items-center gap-2 text-slate-700"><span className={`h-2 w-2 rounded-full ${faceCheckPassed ? 'bg-emerald-500' : 'bg-slate-300'}`} />One face centered {faceCheckPassed ? 'detected' : 'not detected yet'}</div>
                        <p className="text-slate-500 leading-relaxed" aria-live="polite">{cameraStatusMessage}</p>
                      </div>
                    </div>
                  </div>

                  {/* Check 3: Full Screen / Tab Switch Lockdown Check */}
                  <div
                    className={`p-5 sm:p-6 rounded-2xl border transition-all ${
                      fullscreenCheckPassed
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                        : 'bg-white border-slate-200/90 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            fullscreenCheckPassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                          }`}
                        >
                          <Maximize2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
                            <span>Check 3: Full Screen Tab Lockdown</span>
                            {fullscreenCheckPassed && (
                              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                ACTIVE ✓
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 leading-normal">
                            {fullscreenCheckPassed
                              ? 'Browser locked in Full Screen Mode. Accidental tab switching protected.'
                              : 'Enable Full Screen to guard against accidental tab switching and strikes.'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleRequestFullscreen}
                        className={`px-4 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition cursor-pointer shadow-2xs ${
                          fullscreenCheckPassed
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {fullscreenCheckPassed ? 'Full Screen Active' : 'Enable Full Screen'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Gate Status Pill with Generous Margin */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 text-center text-xs sm:text-sm my-2 shadow-2xs">
                  {isReadyForAssessment ? (
                    <span className="text-emerald-700 font-bold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>All hardware checks passed. You are ready to launch your official assessment.</span>
                    </span>
                  ) : (
                    <span className="text-amber-800 font-medium flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Complete microphone, camera, face detection, and fullscreen checks to enable Start Assessment.</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-6 border-t border-slate-200/80 flex items-center justify-between mt-auto">
                <button
                  onClick={() => setCurrentStage(2)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  disabled={!isReadyForAssessment}
                  onClick={() => setShowLaunchModal(true)}
                  className="px-7 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Assessment</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Launch Countdown Modal with Explicit Warning */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-7 sm:p-8 shadow-2xl border border-slate-200 text-center space-y-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Pre-launch confirmation */}
            {!isCountingDown && voicePreconnectStatus !== 'failed' ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                  <Sparkles className="w-7 h-7" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-heading font-extrabold text-slate-900">
                    Ready to Launch Assessment
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed px-2">
                    This interview link is single-use. Once started, closing the window or navigating away will count as your final attempt.
                  </p>
                </div>

                {/* Explicit 3-Warning Lockdown Reminder in Launch Modal */}
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-left space-y-1">
                  <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Active 3-Warning Integrity Lockdown</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Tab switches and window minimization are recorded. 3 strikes result in <strong>automatic detention and immediate disqualification</strong>.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowLaunchModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={() => {
                      stopMicTest()
                      setCountdownValue(5)
                      setVoicePreconnectStatus('idle')
                      setVoicePreconnectError('')
                      setIsCountingDown(true)
                    }}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-2 cursor-pointer"
                  >
                    <span>Begin Countdown</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : voicePreconnectStatus === 'failed' ? (
              /* Voice Engine Connection Failed / Postponement Screen */
              <div className="py-4 space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
                  <AlertCircle className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold uppercase">
                    Session Postponed • Score Protected
                  </div>
                  <h3 className="text-xl font-heading font-extrabold text-slate-900">
                    AI Evaluator Connection Unavailable
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed px-2">
                    {voicePreconnectError || 'Unable to establish a real-time connection to the Gemini AI voice evaluator.'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1.5 text-left">
                  <p className="font-bold flex items-center gap-1.5 text-amber-900">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Please try again after 1 hour or after some time</span>
                  </p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    The AI evaluator service is currently experiencing high demand or network latency. To prevent scoring penalties, your interview room entry has been postponed. Your single-use invitation link remains active and valid.
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      if (voiceEngineRef.current) {
                        voiceEngineRef.current.stop()
                        voiceEngineRef.current = null
                      }
                      setCountdownValue(5)
                      setVoicePreconnectStatus('idle')
                      setVoicePreconnectError('')
                      setIsCountingDown(true)
                    }}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer"
                  >
                    Try Reconnecting Now
                  </button>
                  <button
                    onClick={() => {
                      setShowLaunchModal(false)
                      setIsCountingDown(false)
                      setCountdownValue(5)
                      setVoicePreconnectStatus('idle')
                      setVoicePreconnectError('')
                    }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
                  >
                    Close & Try Again Later
                  </button>
                </div>
              </div>
            ) : (
              /* Active Countdown with Gemini Connection Status */
              <div className="py-6 space-y-5">
                <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                  <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-spin ${
                    voicePreconnectStatus === 'connected' ? 'border-emerald-500' : 'border-blue-600'
                  }`} />
                  <motion.div
                    key={countdownValue}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`text-5xl font-heading font-black ${
                      voicePreconnectStatus === 'connected' ? 'text-emerald-600' : 'text-blue-600'
                    }`}
                  >
                    {countdownValue}
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-lg font-heading font-bold text-slate-900">
                    Initializing AI Voice Room...
                  </h4>

                  {/* Real-time Gemini connection status */}
                  <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold border mx-auto ${
                    voicePreconnectStatus === 'connected'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {voicePreconnectStatus === 'connected' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>AI Evaluator Connected ✓</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                        <span>Connecting to Gemini Live...</span>
                      </>
                    )}
                  </div>

                  <p className="text-xs font-mono text-slate-400">
                    {voicePreconnectStatus === 'connected'
                      ? 'Voice channel established • Ready to begin'
                      : 'Calibrating 5-Pillar Competency Matrix'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

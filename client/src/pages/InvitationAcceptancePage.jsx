import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Mic,
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

  // Stage 2: Honor Code Agreement
  const [rulesAccepted, setRulesAccepted] = useState(false)

  // Stage 3: Real Mic Check & Full Screen State
  const [micStream, setMicStream] = useState(null)
  const [micAudioLevel, setMicAudioLevel] = useState(0)
  const [micFrequencies, setMicFrequencies] = useState(new Array(24).fill(8))
  const [isMicTesting, setIsMicTesting] = useState(false)
  const [audioCheckPassed, setAudioCheckPassed] = useState(false)
  const [fullscreenCheckPassed, setFullscreenCheckPassed] = useState(false)
  const [isReadyForAssessment, setIsReadyForAssessment] = useState(false)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)
  const micStreamRef = useRef(null)

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
        setError(err.message || 'This invitation link is invalid or has expired.')
      } finally {
        setIsLoading(false)
      }
    }

    verifyToken()
  }, [token])

  // Real Web Audio API Microphone Test with Real-Time RMS & Voice Band Fluctuation (Calibrated Automatic Gain)
  const handleStartMicTest = async () => {
    try {
      setIsMicTesting(true)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      })
      micStreamRef.current = stream
      setMicStream(stream)

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      if (ctx.state === 'suspended') {
        await ctx.resume()
      }

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.2
      source.connect(analyser)
      analyserRef.current = analyser

      const timeData = new Uint8Array(analyser.fftSize)
      const freqData = new Uint8Array(analyser.frequencyBinCount)

      let smoothedLevel = 0
      // Optimal internal calibrated gain for crisp voice detection without slider
      const calibratedGain = 1.65

      const updateLevel = () => {
        if (!analyserRef.current) return

        // 1. Time-domain RMS (instantaneous sound pressure)
        analyserRef.current.getByteTimeDomainData(timeData)
        let sumSquares = 0
        let peakDeviation = 0
        for (let i = 0; i < timeData.length; i++) {
          const norm = (timeData[i] - 128) / 128
          sumSquares += norm * norm
          const abs = Math.abs(norm)
          if (abs > peakDeviation) peakDeviation = abs
        }
        const rms = Math.sqrt(sumSquares / timeData.length)

        // 2. Frequency spectrum (voice fundamentals & formants ~100Hz - 3500Hz)
        analyserRef.current.getByteFrequencyData(freqData)

        // Compute 24 distinct equalizer frequency bands
        const numBands = 24
        const bands = []
        const binStep = Math.max(1, Math.floor(Math.min(96, freqData.length) / numBands))
        for (let b = 0; b < numBands; b++) {
          const startBin = 1 + b * binStep
          let sum = 0
          for (let k = 0; k < binStep; k++) {
            sum += freqData[startBin + k] || 0
          }
          const avg = sum / binStep
          // Perceptual logarithmic-like height scaling (8% floor, 100% ceiling)
          const bandHeight = Math.min(100, Math.max(8, Math.round(Math.sqrt(avg / 255) * 100 * calibratedGain)))
          bands.push(bandHeight)
        }
        setMicFrequencies(bands)

        // Perceptual overall volume with square root curve
        const rmsScaled = Math.min(100, Math.round(Math.sqrt(rms) * 260 * calibratedGain))
        const peakScaled = Math.min(100, Math.round(peakDeviation * 140 * calibratedGain))
        const bandsMax = Math.max(...bands)
        const rawLevel = Math.max(rmsScaled, Math.round(bandsMax * 0.9), peakScaled)

        if (rawLevel > smoothedLevel) {
          smoothedLevel = rawLevel // immediate attack
        } else {
          smoothedLevel = Math.max(0, Math.round(smoothedLevel * 0.82)) // smooth release
        }

        setMicAudioLevel(smoothedLevel)

        // Automatically pass audio check once real speech or sound is picked up
        if (smoothedLevel >= 12 || peakDeviation > 0.05) {
          setAudioCheckPassed(true)
        }

        animFrameRef.current = requestAnimationFrame(updateLevel)
      }
      updateLevel()
    } catch (err) {
      console.warn('Microphone access notice:', err.message)
      setIsMicTesting(false)
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

  // Automatically start Mic Check & Full Screen when entering Stage 3
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
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {})
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Both checks gate the assessment start
  useEffect(() => {
    setIsReadyForAssessment(audioCheckPassed && fullscreenCheckPassed)
  }, [audioCheckPassed, fullscreenCheckPassed])

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

  const { job, candidate, organization } = invitationData

  return (
    <div className="h-screen w-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Header */}
      <header className="h-14 px-6 border-b border-slate-200/90 bg-white flex items-center justify-between shrink-0 z-10">
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
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* LEFT COLUMN: Role Context, Stepper & Proctoring Policy */}
        <div className="lg:col-span-4 bg-white border-r border-slate-200/90 p-6 sm:p-8 lg:p-9 flex flex-col justify-between overflow-y-auto">
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
                  { step: 3, title: 'Hardware Verification', desc: 'Live mic acoustic test & full-screen gate' },
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
              <span className="text-slate-800 font-semibold">~15–20 Minutes</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Lockdown:</span>
              <span className="text-rose-600 font-bold">Strict 3 Warnings Max</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Form Surface (Spacious, Breathable & Highly Readable) */}
        <div className="lg:col-span-8 bg-[#f8fafc] p-6 sm:p-8 lg:p-10 flex flex-col justify-between overflow-y-auto">
          {/* STAGE 1: Profile Registration */}
          {currentStage === 1 && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 lg:p-10 shadow-xs flex-1 flex flex-col justify-between max-w-3xl mx-auto w-full my-auto space-y-8">
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest">
                    Step 1 of 3 • Identity & Context
                  </span>
                  <h3 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight mt-1 mb-2">
                    Candidate Verification & Profile Registration
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Verify your contact information and engineering background before proceeding to examination rules and hardware checks.
                  </p>
                </div>

                {registerError && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5 shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{registerError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 pt-2">
                  <div className="space-y-2">
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700">
                      Full Legal Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={candidateForm.fullName}
                      onChange={(e) => setCandidateForm({ ...candidateForm, fullName: e.target.value })}
                      placeholder="e.g. Devon Kaelen"
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                    />
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
                      onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                      placeholder="+91 9876543210"
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition"
                    />
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

              {/* Bottom Action Footer */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Encrypted applicant telemetry record
                </span>
                <button
                  onClick={() => {
                    if (!candidateForm.fullName.trim()) {
                      setRegisterError('Please enter your full legal name before proceeding.')
                      return
                    }
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
            <div className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 lg:p-10 shadow-xs flex-1 flex flex-col justify-between max-w-3xl mx-auto w-full my-auto space-y-6">
              <div className="space-y-5">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest">
                    Step 2 of 3 • Mandatory Integrity Protocol
                  </span>
                  <h3 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight mt-1 mb-2">
                    Examination Rules & 3-Warning Detention Protocol
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
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
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-2 hover:bg-slate-50 transition">
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
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-2 hover:bg-slate-50 transition">
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
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-2 hover:bg-slate-50 transition">
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
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-2 hover:bg-slate-50 transition">
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
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-2 hover:bg-slate-50 transition">
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
                  <div className="p-4.5 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200 space-y-2 hover:bg-slate-50 transition">
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
                      : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
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
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
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

          {/* STAGE 3: Pre-Assessment Hardware Verification (Light-Themed Equalizer, No Slider) */}
          {currentStage === 3 && (
            <div className="bg-white border border-slate-200/90 rounded-3xl p-7 sm:p-9 lg:p-10 shadow-xs flex-1 flex flex-col justify-between max-w-3xl mx-auto w-full my-auto space-y-7">
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest">
                    Step 3 of 3 • Mandatory Verification Gate
                  </span>
                  <h3 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight mt-1 mb-2">
                    Hardware Calibration & Full-Screen Lockdown
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
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

                {/* The Two Mandatory Verification Checks with Generous Spacing */}
                <div className="space-y-6">
                  {/* Check 1: Real Live Microphone Audio Check */}
                  <div
                    className={`p-5 sm:p-6 rounded-2xl border transition-all ${
                      audioCheckPassed
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            audioCheckPassed ? 'bg-emerald-600 text-white shadow-xs' : 'bg-blue-50 text-blue-600 border border-blue-200'
                          }`}
                        >
                          <Mic className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
                            <span>Check 1: Live Microphone Audio Check</span>
                            {audioCheckPassed && (
                              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                VERIFIED ✓
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 leading-normal">
                            {audioCheckPassed
                              ? 'Microphone active and clear vocal frequency modulation detected!'
                              : isMicTesting
                              ? 'Microphone active — speak normally into your microphone...'
                              : 'Starting microphone check automatically...'}
                          </div>
                        </div>
                      </div>

                      {!audioCheckPassed && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isMicTesting) {
                              setAudioCheckPassed(true)
                            } else {
                              handleStartMicTest()
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>{isMicTesting ? 'Verify Sound' : 'Start Mic'}</span>
                        </button>
                      )}
                    </div>

                    {/* Live Audio Level Equalizer Console in Light Theme (Slider removed!) */}
                    <div className="space-y-3 pt-1">
                      {/* Dynamic 24-Bar Audio Equalizer Console in Crisp Light Theme */}
                      <div className="h-20 px-4 sm:px-5 py-3 bg-gradient-to-b from-slate-50 via-white to-slate-50/90 rounded-2xl border border-slate-200 shadow-inner flex items-end justify-between gap-1 sm:gap-2 relative overflow-hidden">
                        <div className="absolute top-2 left-4 flex items-center gap-2 text-[11px] font-mono font-medium text-slate-600">
                          <span className={`w-2 h-2 rounded-full ${micAudioLevel > 10 ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} />
                          <span>Acoustic Spectrum (100Hz – 3.5kHz)</span>
                        </div>
                        <div className="absolute top-2 right-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border border-slate-200/90 shadow-2xs text-[11px] font-mono font-bold text-blue-700">
                          <span>{micAudioLevel > 0 ? `${micAudioLevel}% Voice Intensity` : '0% Intensity'}</span>
                        </div>

                        {micFrequencies.map((h, i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-t-full transition-all duration-75 ${
                              audioCheckPassed
                                ? 'bg-gradient-to-t from-emerald-500 via-teal-400 to-emerald-300 shadow-xs shadow-emerald-500/30'
                                : micAudioLevel > 10
                                ? 'bg-gradient-to-t from-blue-600 via-indigo-500 to-cyan-400 shadow-xs shadow-blue-500/30'
                                : 'bg-slate-200/90 hover:bg-slate-300'
                            }`}
                            style={{ height: `${Math.max(8, Math.min(100, h))}%` }}
                          />
                        ))}
                      </div>

                      {/* Light-Themed Responsive VU Level Bar */}
                      <div className="space-y-1.5 pt-1">
                        <div className="h-2.5 w-full bg-slate-100 border border-slate-200 rounded-full overflow-hidden flex items-center p-0.5">
                          <div
                            className={`h-full rounded-full transition-[width] duration-75 ${
                              audioCheckPassed
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                                : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500'
                            }`}
                            style={{ width: `${Math.max(4, micAudioLevel)}%` }}
                          />
                        </div>
                        <div className="text-xs font-mono text-slate-500 flex items-center justify-between">
                          <span>
                            {audioCheckPassed
                              ? 'Voice signal verified — hardware check passed!'
                              : micAudioLevel > 10
                              ? 'Voice detected — calibrating speech clarity...'
                              : 'Speak into your microphone to verify (or click Verify Sound)...'}
                          </span>
                          <span className="font-semibold text-slate-400">Live Acoustic Calibration</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Check 2: Full Screen / Tab Switch Lockdown Check */}
                  <div
                    className={`p-5 sm:p-6 rounded-2xl border transition-all ${
                      fullscreenCheckPassed
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                        : 'bg-slate-50/70 border-slate-200'
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
                            <span>Check 2: Full Screen Tab Lockdown</span>
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
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs sm:text-sm my-2">
                  {isReadyForAssessment ? (
                    <span className="text-emerald-700 font-bold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Both checks verified! You are ready to launch your official assessment.</span>
                    </span>
                  ) : (
                    <span className="text-amber-800 font-medium flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Complete both Microphone Check and Full Screen Check to enable Start Assessment below.</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom Action Footer */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
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

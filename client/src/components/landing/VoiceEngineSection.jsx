import React, { useState, useEffect, useRef } from 'react'
import {
  Mic,
  Activity,
  Cpu,
  Volume2,
  Headphones,
  Bot,
  User,
  Sparkles,
  ArrowDown,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import BorderGlow from '../common/BorderGlow.jsx'
import TextType from '../common/TextType.jsx'

const PIPELINE_CARDS = [
  {
    title: 'Candidate Speaks',
    subtitle: 'Raw 24kHz PCM',
    tag: 'AUDIO INGEST',
    icon: Mic,
    glowColor: 'cyan',
    iconBg: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    tagBg: 'text-cyan-700 bg-cyan-50 border-cyan-100',
    border: 'border-slate-200/90',
  },
  {
    title: 'Deepgram Nova-2',
    subtitle: 'STT <220ms',
    tag: 'SPEECH TO TEXT',
    icon: Activity,
    glowColor: 'teal',
    iconBg: 'bg-teal-100 text-teal-700 border-teal-200',
    tagBg: 'text-teal-800 bg-teal-100 border-teal-200',
    border: 'border-teal-300/80',
    subtitleHighlight: 'text-teal-700 font-bold',
  },
  {
    title: 'GPT-4o Reasoning',
    subtitle: 'Dynamic Follow-Up',
    tag: 'EVALUATION',
    icon: Cpu,
    glowColor: 'blue',
    iconBg: 'bg-blue-100 text-blue-700 border-blue-200',
    tagBg: 'text-blue-800 bg-blue-100 border-blue-200',
    border: 'border-blue-300/80',
    subtitleHighlight: 'text-blue-700 font-bold',
  },
  {
    title: 'ElevenLabs Turbo',
    subtitle: 'Stream <280ms',
    tag: 'SPEECH SYNTHESIS',
    icon: Volume2,
    glowColor: 'indigo',
    iconBg: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    tagBg: 'text-indigo-800 bg-indigo-100 border-indigo-200',
    border: 'border-indigo-300/80',
    subtitleHighlight: 'text-indigo-700 font-bold',
  },
  {
    title: 'Candidate Hears',
    subtitle: '<1.2s Round-Trip',
    tag: 'CONVERSATIONAL',
    icon: Headphones,
    glowColor: 'emerald',
    iconBg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    tagBg: 'text-emerald-800 bg-emerald-100 border-emerald-200',
    border: 'border-emerald-300/80',
    subtitleHighlight: 'text-emerald-700 font-bold',
  },
]

export default function VoiceEngineSection() {
  const [cardsInView, setCardsInView] = useState(false)
  const [transcriptStep, setTranscriptStep] = useState(1) // 1: AI Prompt, 2: User Chat, 3: Depth Eval, 4: Last AI Chat
  const cardsRef = useRef(null)
  const transcriptRef = useRef(null)
  const transcriptStepRef = useRef(transcriptStep)
  transcriptStepRef.current = transcriptStep

  const box1Ref = useRef(null)
  const box2Ref = useRef(null)
  const box3Ref = useRef(null)
  const box4Ref = useRef(null)

  // 1. Time-lag entrance for the 5 pipeline cards when entering viewport
  // Staggered: Card 1 -> Card 2 -> Card 3 -> Card 4 -> Card 5
  useEffect(() => {
    const el = cardsRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCardsInView(true)
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Step-forward helper that advances step AND slightly scrolls the page smoothly
  // so the user can easily see the newly appeared chat bubble down below
  const advanceStep = (nextStep) => {
    setTranscriptStep(nextStep)
    transcriptStepRef.current = nextStep

    // Sizable yet gentle scroll down per step
    const stepScrollAmounts = { 2: 140, 3: 95, 4: 165 }
    const delta = stepScrollAmounts[nextStep] || 120

    window.scrollBy({
      top: delta,
      behavior: 'smooth',
    })

    // After animation expands, ensure newly revealed box is comfortably framed above the bottom edge
    setTimeout(() => {
      let targetEl = null
      if (nextStep === 2) targetEl = box2Ref.current
      else if (nextStep === 3) targetEl = box3Ref.current
      else if (nextStep === 4) targetEl = box4Ref.current

      if (targetEl) {
        const rect = targetEl.getBoundingClientRect()
        const windowHeight = window.innerHeight
        const comfortablePadding = 90
        if (rect.bottom > windowHeight - comfortablePadding) {
          window.scrollBy({
            top: rect.bottom - (windowHeight - comfortablePadding),
            behavior: 'smooth',
          })
        }
      }
    }, 120)
  }

  // Step-backward helper for reverse scrolling
  const regressStep = (nextStep) => {
    setTranscriptStep(nextStep)
    transcriptStepRef.current = nextStep

    const stepUpAmounts = { 3: -130, 2: -95, 1: -140 }
    const delta = stepUpAmounts[nextStep] || -110

    window.scrollBy({
      top: delta,
      behavior: 'smooth',
    })
  }

  // 2. Scroll-driven step-by-step reveal of the Live Interview Simulation Transcript:
  // - Step 1: AI Examiner chat appears first
  // - User scrolls -> Step 2: Next User/Candidate chat appears + page slightly scrolls down
  // - User scrolls -> Step 3: Depth Evaluation box appears + page slightly scrolls down
  // - User scrolls -> Step 4: Last AI probing chat appears + page slightly scrolls down
  // - User scrolls again at Step 4 -> native page scroll resumes to continue down the page
  useEffect(() => {
    const transcriptEl = transcriptRef.current
    if (!transcriptEl) return

    let isCooldown = false
    let cooldownTimer = null

    const handleWheel = (e) => {
      if (e.ctrlKey) return
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return

      const delta = e.deltaY
      if (Math.abs(delta) < 15) return

      const rect = transcriptEl.getBoundingClientRect()
      const windowHeight = window.innerHeight

      // Check if the transcript card is currently active in viewport
      const isInView =
        rect.top <= windowHeight * 0.70 &&
        rect.bottom >= windowHeight * 0.25

      if (!isInView) return

      const current = transcriptStepRef.current

      if (delta > 0) {
        // User scrolling DOWN
        if (current < 4) {
          e.preventDefault()

          if (isCooldown) return
          isCooldown = true

          advanceStep(current + 1)

          clearTimeout(cooldownTimer)
          cooldownTimer = setTimeout(() => {
            isCooldown = false
          }, 360)
        }
        // At current === 4, e.preventDefault() is NOT called, so normal downward scroll continues to next section!
      } else if (delta < 0) {
        // User scrolling UP
        if (current > 1) {
          e.preventDefault()

          if (isCooldown) return
          isCooldown = true

          regressStep(current - 1)

          clearTimeout(cooldownTimer)
          cooldownTimer = setTimeout(() => {
            isCooldown = false
          }, 360)
        }
        // At current === 1, e.preventDefault() is NOT called, allowing natural scroll up to cards/hero!
      }
    }

    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase()
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        document.activeElement?.isContentEditable
      ) {
        return
      }

      const rect = transcriptEl.getBoundingClientRect()
      const windowHeight = window.innerHeight
      const isInView =
        rect.top <= windowHeight * 0.70 &&
        rect.bottom >= windowHeight * 0.25

      if (!isInView) return

      const current = transcriptStepRef.current

      if (
        e.key === 'ArrowDown' ||
        e.key === 'PageDown' ||
        (e.key === ' ' && !e.shiftKey)
      ) {
        if (current < 4) {
          e.preventDefault()
          if (isCooldown) return
          isCooldown = true
          advanceStep(current + 1)
          clearTimeout(cooldownTimer)
          cooldownTimer = setTimeout(() => {
            isCooldown = false
          }, 360)
        }
      } else if (
        e.key === 'ArrowUp' ||
        e.key === 'PageUp' ||
        (e.key === ' ' && e.shiftKey)
      ) {
        if (current > 1) {
          e.preventDefault()
          if (isCooldown) return
          isCooldown = true
          regressStep(current - 1)
          clearTimeout(cooldownTimer)
          cooldownTimer = setTimeout(() => {
            isCooldown = false
          }, 360)
        }
      }
    }

    let touchStartY = 0
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY
    }

    const handleTouchMove = (e) => {
      const rect = transcriptEl.getBoundingClientRect()
      const windowHeight = window.innerHeight
      const isInView =
        rect.top <= windowHeight * 0.70 &&
        rect.bottom >= windowHeight * 0.25

      if (!isInView) return

      const currentY = e.touches[0].clientY
      const diff = touchStartY - currentY // positive = swiping up = scrolling down

      if (Math.abs(diff) < 25) return

      const current = transcriptStepRef.current

      if (diff > 0 && current < 4) {
        e.preventDefault()
        if (!isCooldown) {
          isCooldown = true
          touchStartY = currentY
          advanceStep(current + 1)
          clearTimeout(cooldownTimer)
          cooldownTimer = setTimeout(() => {
            isCooldown = false
          }, 360)
        }
      } else if (diff < 0 && current > 1) {
        e.preventDefault()
        if (!isCooldown) {
          isCooldown = true
          touchStartY = currentY
          regressStep(current - 1)
          clearTimeout(cooldownTimer)
          cooldownTimer = setTimeout(() => {
            isCooldown = false
          }, 360)
        }
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      clearTimeout(cooldownTimer)
    }
  }, [])

  return (
    <section
      id="voice-engine"
      className="py-24 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/70 border-b border-slate-200/80 relative overflow-hidden bg-grid-pattern"
    >
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-cyan-200/25 blur-3xl -z-10 rounded-full animate-float-slow pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[300px] bg-indigo-200/20 blur-3xl -z-10 rounded-full animate-float-reverse-slow pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold uppercase tracking-wider shadow-xs">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            CONVERSATIONAL ACOUSTIC PIPELINE
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.3]">
            Real-Time Voice Engine &
            <span className="block mt-1 sm:mt-2 text-cyan-600">
              <TextType
                text={[
                  'Adaptive Follow-Up Simulator',
                  'Context-Aware Turn Taking',
                  'Low-Latency Audio Sockets',
                ]}
                typingSpeed={38}
                deletingSpeed={22}
                pauseDuration={2000}
                showCursor={true}
                cursorCharacter="|"
                cursorClassName="text-cyan-600 font-bold"
                className="inline-block text-cyan-600"
              />
            </span>
          </h2>

          <p className="text-base text-slate-600 leading-relaxed">
            Powered by ultra-low-latency STT, context-aware reasoning, and high-fidelity speech synthesis with intelligent conversational turn-taking.
          </p>
        </div>

        {/* 5-Step Pipeline Strip: Cards Appear With a Time Lag From Each Other */}
        <div
          ref={cardsRef}
          className="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl shadow-slate-100 mb-12 border-gradient-glow"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {PIPELINE_CARDS.map((card, i) => {
              const Icon = card.icon
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 32, scale: 0.92 }}
                  animate={
                    cardsInView
                      ? { opacity: 1, y: 0, scale: 1 }
                      : { opacity: 0, y: 32, scale: 0.92 }
                  }
                  transition={{
                    duration: 0.55,
                    delay: i * 0.25, // Staggered time lag for each card (Card 1 -> Card 2 -> Card 3 -> Card 4 -> Card 5)
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={`h-full ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`}
                >
                  <BorderGlow
                    glowColor={card.glowColor}
                    backgroundColor="#ffffff"
                    borderRadius={16}
                    className={`h-full border shadow-xs transition-transform duration-300 hover:-translate-y-1 ${card.border}`}
                  >
                    <div className="p-5 text-center space-y-2 flex flex-col justify-between h-full">
                      <div>
                        <div
                          className={`w-11 h-11 rounded-2xl border flex items-center justify-center mx-auto shadow-xs mb-3 ${card.iconBg}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <h4 className="font-heading font-bold text-slate-900 text-xs sm:text-sm">
                          {card.title}
                        </h4>
                        <span
                          className={`text-[11px] font-mono ${
                            card.subtitleHighlight || 'text-slate-500'
                          }`}
                        >
                          {card.subtitle}
                        </span>
                      </div>
                      <div
                        className={`pt-2 border-t border-slate-100 text-[10px] font-mono font-bold rounded py-0.5 border ${card.tagBg}`}
                      >
                        {card.tag}
                      </div>
                    </div>
                  </BorderGlow>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Live Interview Simulation Transcript Card (Scroll-Driven 4-Step Reveal with slight page scroll) */}
        <div ref={transcriptRef} className="scroll-mt-24">
          <BorderGlow
            glowColor="cyan"
            backgroundColor="#ffffff"
            borderRadius={28}
            className="max-w-4xl mx-auto border border-slate-200/90 shadow-2xl relative"
          >
            <div className="p-6 sm:p-10 space-y-6">
              {/* Card Header with Live Indicator & Interactive Step Controls */}
              <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
                  <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider">
                    LIVE INTERVIEW SIMULATION TRANSCRIPT
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Step pills to jump or indicate current state */}
                  <div className="hidden sm:flex items-center gap-1 mr-2">
                    {[1, 2, 3, 4].map((stepNum) => (
                      <button
                        key={stepNum}
                        onClick={() => {
                          if (stepNum > transcriptStep) {
                            advanceStep(stepNum)
                          } else if (stepNum < transcriptStep) {
                            regressStep(stepNum)
                          }
                        }}
                        className={`w-6 h-6 rounded-lg text-[10px] font-mono font-bold transition-all ${
                          transcriptStep === stepNum
                            ? 'bg-cyan-600 text-white shadow-xs scale-105'
                            : stepNum < transcriptStep
                            ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                            : 'bg-slate-100 text-slate-400 hover:text-slate-700'
                        }`}
                        title={`Jump to step ${stepNum}`}
                      >
                        {stepNum}
                      </button>
                    ))}
                  </div>

                  {/* Status pill matching reference */}
                  <span className="px-3.5 py-1 rounded-full text-xs font-mono font-semibold bg-cyan-50/80 text-cyan-800 border border-cyan-200 shadow-xs inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                    Turn 03 of 12 • Active
                  </span>

                  {transcriptStep < 4 ? (
                    <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-cyan-700 bg-cyan-50/60 px-2.5 py-1 rounded-full border border-cyan-100">
                      <ArrowDown className="w-3 h-3 text-cyan-600 animate-bounce" />
                      Scroll down ({transcriptStep}/4)
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setTranscriptStep(1)
                        transcriptStepRef.current = 1
                        transcriptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono font-semibold transition"
                      title="Replay conversation"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Replay</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Box 1: AI Prompt (Always appears first) */}
              <div ref={box1Ref} className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-cyan-100 text-cyan-700 border border-cyan-200 flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="p-5 rounded-2xl bg-slate-50/90 border border-slate-200/90 text-sm text-slate-800 flex-1 space-y-1 shadow-xs">
                  <span className="text-[11px] font-mono font-bold text-cyan-700 block uppercase">
                    QUALIFYAI EXAMINER
                  </span>
                  <p className="leading-relaxed">
                    "Explain how database indexing affects performance in high-write transactional systems."
                  </p>
                </div>
              </div>

              {/* 2. Box 2: Next User Chat (Appears when user scrolls, page slightly scrolls down) */}
              <AnimatePresence>
                {transcriptStep >= 2 && (
                  <motion.div
                    ref={box2Ref}
                    initial={{ opacity: 0, y: 24, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.98 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-start gap-4 justify-end"
                  >
                    <div className="p-5 rounded-2xl bg-blue-50/80 border border-blue-200 text-sm text-slate-800 flex-1 space-y-1 text-right shadow-xs">
                      <span className="text-[11px] font-mono font-bold text-blue-700 block uppercase">
                        CANDIDATE (SPEECH-TO-TEXT)
                      </span>
                      <p className="leading-relaxed">
                        "Indexes use B-Trees to speed up reads, but they add overhead to inserts because each write must update the index tree."
                      </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0 shadow-xs">
                      <User className="w-5 h-5" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 3. Box 3: Next Box - Real-Time Depth Evaluation Callout (Appears on subsequent scroll) */}
              <AnimatePresence>
                {transcriptStep >= 3 && (
                  <motion.div
                    ref={box3Ref}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="p-4 rounded-2xl bg-gradient-to-r from-cyan-50/90 via-blue-50/80 to-indigo-50/90 text-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm border border-cyan-200/90"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-600 animate-spin" />
                      <span className="text-slate-700">
                        Real-Time Depth Evaluation: <strong className="text-cyan-800 font-bold">8.5/10</strong>{' '}
                        <span className="text-slate-500 font-medium">(Valid baseline logic)</span>
                      </span>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
                      TRIGGERED LEVEL 2 ADAPTIVE PROBE
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 4. Box 4: Last AI Chat - Adaptive Probing Question (Appears on final scroll) */}
              <AnimatePresence>
                {transcriptStep >= 4 && (
                  <motion.div
                    ref={box4Ref}
                    initial={{ opacity: 0, y: 24, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.98 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-cyan-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/25">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="p-5 rounded-2xl bg-cyan-50/80 border-2 border-cyan-400 text-sm text-slate-900 flex-1 space-y-1 shadow-sm">
                      <span className="text-[11px] font-mono font-bold text-cyan-800 block uppercase">
                        QUALIFYAI EVALUATOR (ADAPTIVE TURN)
                      </span>
                      <p className="font-semibold leading-relaxed">
                        "Precisely. What strategy would you implement if your write latency spikes specifically due to secondary indexes in a high-volume PostgreSQL cluster?"
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom Footer Bar with Guidance and Launch Button */}
              <div className="flex flex-wrap items-center justify-between pt-4 border-t border-slate-100 gap-3">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                  <span>Step {transcriptStep} of 4</span>
                  {transcriptStep < 4 ? (
                    <span className="text-cyan-600 font-semibold flex items-center gap-1">
                      <ArrowDown className="w-3.5 h-3.5 animate-bounce" /> Scroll down for next message
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> All messages revealed • Scroll down to proceed
                    </span>
                  )}
                </div>

                <a
                  href="/interview"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 text-white text-xs font-bold tracking-wide shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02] transition-all"
                >
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  <span>Launch Live Interview Simulation</span>
                </a>
              </div>
            </div>
          </BorderGlow>
        </div>
      </div>
    </section>
  )
}

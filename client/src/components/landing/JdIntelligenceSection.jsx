import React, { useState, useEffect, useRef } from 'react'
import {
  FileText,
  Sparkles,
  BrainCircuit,
  Loader2,
  RefreshCw,
  Check,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import BorderGlow from '../common/BorderGlow.jsx'
import ThoughtLine from '../common/ThoughtLine.jsx'
import RotatingText from '../common/RotatingText.jsx'

const ALL_STEPS = [
  'Deconstructing raw requisition requirements',
  'Extracting core distributed systems taxonomy',
  'Synthesizing 4-pillar objective rubric weights',
  'Calibrating interview question difficulty',
]

export default function JdIntelligenceSection() {
  const sectionRef = useRef(null)
  const [hasTriggered, setHasTriggered] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [elapsedTime, setElapsedTime] = useState('3.0')
  const [activeSteps, setActiveSteps] = useState([ALL_STEPS[0]])
  const [parseCount, setParseCount] = useState(0)

  // Automatically start parsing when user scrolls this section into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered) {
          setHasTriggered(true)
          setIsParsing(true)
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
      }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [hasTriggered])

  // Progressively reveal steps during the 3.0s thinking line duration
  useEffect(() => {
    if (!isParsing) return

    setActiveSteps([ALL_STEPS[0]])
    const t1 = setTimeout(() => {
      setActiveSteps([ALL_STEPS[0], ALL_STEPS[1]])
    }, 750)
    const t2 = setTimeout(() => {
      setActiveSteps([ALL_STEPS[0], ALL_STEPS[1], ALL_STEPS[2]])
    }, 1550)
    const t3 = setTimeout(() => {
      setActiveSteps(ALL_STEPS)
    }, 2350)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [isParsing, parseCount])

  // Called when ThoughtLine completes its 3-second trace
  const handleThoughtSettle = (seconds) => {
    setIsParsing(false)
    const timeVal = typeof seconds === 'number' && seconds > 0 ? seconds.toFixed(1) : '3.0'
    setElapsedTime(timeVal)
    // Settle trace is briefly shown, then vanishes so the card appears in its place
    setTimeout(() => {
      setIsCompleted(true)
    }, 500)
  }

  // Re-run parse option
  const handleReParse = () => {
    setIsCompleted(false)
    setIsParsing(true)
    setParseCount((prev) => prev + 1)
  }

  // Manual start option (if clicked before scroll)
  const handleManualStart = () => {
    if (isParsing) return
    setHasTriggered(true)
    setIsCompleted(false)
    setIsParsing(true)
    setParseCount((prev) => prev + 1)
  }

  return (
    <section
      ref={sectionRef}
      id="rubrics"
      className="py-24 bg-gradient-to-b from-white via-slate-50/50 to-white border-b border-slate-200/80 relative overflow-hidden bg-grid-pattern"
    >
      {/* Background Ambient Orbs */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-cyan-200/20 blur-3xl -z-10 rounded-full animate-float-slow pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-200/20 blur-3xl -z-10 rounded-full animate-float-reverse-slow pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold uppercase tracking-wider shadow-xs">
            <BrainCircuit className="w-3.5 h-3.5 text-blue-600" />
            INTELLIGENT DECOMPOSITION ENGINE
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.3] flex flex-wrap items-center justify-center gap-x-3">
            <span>JD Intelligence &</span>
            <RotatingText
              texts={['Calibrated Rubrics', 'Competency Graphs', 'Objective Matrices', 'Seniority Benchmarks']}
              mainClassName="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-2xl border border-indigo-200 shadow-xs inline-flex overflow-hidden align-middle my-1"
              rotationInterval={2400}
            />
          </h2>

          <p className="text-base text-slate-600 leading-relaxed">
            Paste any raw requisition. Our LLM-powered parser deconstructs implicit requirements and synthesizes an objective scoring matrix in real time.
          </p>

          {isCompleted && (
            <div className="pt-1">
              <button
                onClick={handleReParse}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:border-blue-300 shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Re-Run Parse Simulation
              </button>
            </div>
          )}
        </div>

        {/* Two-Column Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch relative">
          {/* Left Box: Raw Job Description (6 cols) */}
          <div className="lg:col-span-6 anim-delay h-full flex flex-col">
            <BorderGlow
              glowColor="cyan"
              backgroundColor="#ffffff"
              borderRadius={28}
              topAccent="from-cyan-500 to-blue-500"
              className="h-full border border-slate-200/90 shadow-xl shadow-cyan-500/5"
            >
              <div className="p-6 sm:p-8 space-y-5 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <FileText className="w-4 h-4 text-cyan-600" />
                      RAW JOB DESCRIPTION INPUT
                    </div>

                    {/* Status Badge */}
                    {isParsing ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        PARSING...
                      </span>
                    ) : isCompleted ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        ANALYZED
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        READY
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="font-heading font-bold text-slate-900 text-base sm:text-lg">
                      Staff Backend Engineer — High Throughput Financial Core
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      FinTech Global • San Francisco, CA (Hybrid)
                    </p>
                  </div>

                  <div className="mt-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200 font-mono text-[11px] sm:text-xs text-slate-700 space-y-2 leading-relaxed shadow-inner">
                    <p>
                      "Role Overview: Scaling our transactional settlement core. We need a Senior/Staff Engineer who has architected ultra-low-latency APIs handling 100k+ RPS with sub-millisecond p99 guarantees.
                    </p>
                    <p>
                      Requirements: Deep proficiency in Go (Golang), transactional persistence in PostgreSQL, distributed caching with Redis, and gRPC communication protocols. Candidate must be deeply comfortable debugging distributed deadlocks, implementing idempotency keys, and 2-phase commits across microservices."
                    </p>
                  </div>
                </div>

                {/* Bottom Meta Bar: Appearing after process gets completed */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  {isCompleted ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-center justify-between w-full"
                    >
                      <span className="font-mono text-slate-600 font-semibold">
                        Token length: 482 words
                      </span>
                      <span className="flex items-center gap-1.5 text-cyan-700 font-semibold bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200 shadow-2xs font-mono">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                        Parsed in {elapsedTime}s
                      </span>
                    </motion.div>
                  ) : isParsing ? (
                    <div className="flex items-center justify-between w-full text-slate-400 font-mono">
                      <span className="animate-pulse">Analyzing 482 token requisition...</span>
                      <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 text-[10px] font-bold">
                        <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                        Extracting...
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 font-mono">
                      Scroll to trigger automated decomposition
                    </span>
                  )}
                </div>
              </div>
            </BorderGlow>
          </div>

          {/* Mobile Loading Badge between cards */}
          <div className="flex lg:hidden justify-center my-1">
            {isParsing ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-cyan-300 text-cyan-700 text-xs font-bold shadow-md shadow-cyan-500/10">
                <Loader2 className="w-4 h-4 text-cyan-600 animate-spin" />
                <span>Extracting Taxonomy & Rubrics…</span>
              </div>
            ) : isCompleted ? (
              <button
                type="button"
                onClick={handleReParse}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                <span>Rubric Calibrated in {elapsedTime}s • Tap to re-run</span>
              </button>
            ) : null}
          </div>

          {/* Middle Floating Button: Acts as a loading button until parsing completes, then a tick appears in the place of loading */}
          <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 items-center justify-center">
            {isParsing ? (
              <div
                className="w-16 h-16 rounded-full bg-white border-2 border-cyan-400 flex items-center justify-center shadow-xl shadow-cyan-500/30 relative"
                title="Deconstructing requisition..."
              >
                <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
                <span className="absolute inset-0 rounded-full border-2 border-cyan-300 animate-ping opacity-35 pointer-events-none" />
              </div>
            ) : isCompleted ? (
              <motion.button
                type="button"
                onClick={handleReParse}
                title={`Parsed in ${elapsedTime}s • Click to re-run`}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-16 h-16 rounded-full bg-emerald-500 border-2 border-emerald-400 flex items-center justify-center text-white shadow-xl shadow-emerald-500/30 cursor-pointer transition-transform"
              >
                <Check className="w-8 h-8 stroke-[3]" />
              </motion.button>
            ) : (
              <button
                type="button"
                onClick={handleManualStart}
                title="Click to start parsing"
                className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-cyan-600 hover:border-cyan-300 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-6 h-6 text-cyan-600" />
              </button>
            )}
          </div>

          {/* Right Box: Only the thinking line effect takes place for 3s, vanishes, and then the card appears in that place */}
          <div className="lg:col-span-6 anim-delay h-full flex flex-col">
            <AnimatePresence mode="wait">
              {!isCompleted ? (
                <motion.div
                  key={isParsing ? `thinking-active-${parseCount}` : 'thinking-standby'}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 0.94,
                    filter: 'blur(4px)',
                    transition: { duration: 0.4, ease: 'easeOut' },
                  }}
                  className="h-full min-h-[460px] rounded-[28px] border border-slate-200/90 bg-white/80 backdrop-blur-md p-8 sm:p-10 flex flex-col justify-center shadow-xl shadow-cyan-500/5 relative overflow-hidden"
                >
                  {/* Decorative background ambient glow */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-tr from-cyan-100/40 via-blue-100/30 to-indigo-100/40 blur-3xl rounded-full -z-10 pointer-events-none" />

                  {isParsing ? (
                    <div className="w-full max-w-md mx-auto">
                      <ThoughtLine
                        key={parseCount}
                        working={true}
                        settleAfter={3.0}
                        onSettle={handleThoughtSettle}
                        steps={activeSteps}
                        label="Synthesizing Rubric & Taxonomy…"
                        doneLabel="Rubric Calibrated in"
                        glyph="sparkle"
                        color="#0f172a"
                        glyphColor="#06b6d4"
                        fontSize={16}
                        breathPeriod={1.4}
                        breathDepth={0.45}
                        settleDuration={300}
                        collapsible={true}
                        collapseOnSettle={false}
                        showTimer={true}
                      />
                    </div>
                  ) : (
                    <div className="text-center space-y-3 max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 mx-auto shadow-xs">
                        <Sparkles className="w-6 h-6 text-cyan-600 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-heading font-bold text-slate-800 text-sm sm:text-base">
                          JD Intelligence Standby
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Scroll into view to automatically initialize real-time AI taxonomy deconstruction.
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="completed-card"
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="h-full flex flex-col"
                >
                  <BorderGlow
                    glowColor="indigo"
                    backgroundColor="#ffffff"
                    borderRadius={28}
                    topAccent="from-indigo-500 via-purple-500 to-pink-500"
                    className="border border-slate-200/90 shadow-xl shadow-indigo-500/5 h-full"
                  >
                    <div className="p-6 sm:p-8 space-y-5 h-full flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                            <BrainCircuit className="w-4 h-4 text-indigo-600" />
                            AI EXTRACTED TAXONOMY & WEIGHTS
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Rubric v2.4 Calibrated
                          </span>
                        </div>

                        {/* 1. Core Technical Stack */}
                        <div className="mb-4">
                          <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-2">
                            1. CORE TECHNICAL DOMAINS IDENTIFIED
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {[
                              'Go (Golang)',
                              'PostgreSQL',
                              'Redis Clusters',
                              'gRPC / Protobuf',
                              'Raft Consensus',
                            ].map((tech, i) => (
                              <span
                                key={i}
                                className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200/80 shadow-2xs hover:bg-white transition-colors"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* 2. Architecture Competency Focus */}
                        <div className="mb-4">
                          <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-2">
                            2. ARCHITECTURE COMPETENCY FOCUS
                          </span>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                              <span className="text-xs font-bold text-slate-800 block">
                                Distributed Tx
                              </span>
                              <span className="text-[10px] text-slate-500">Saga & 2PC</span>
                            </div>

                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                              <span className="text-xs font-bold text-slate-800 block">
                                Idempotency
                              </span>
                              <span className="text-[10px] text-slate-500">Replay Safe</span>
                            </div>

                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                              <span className="text-xs font-bold text-slate-800 block">
                                Sub-ms Latency
                              </span>
                              <span className="text-[10px] text-slate-500">p99 Tuning</span>
                            </div>
                          </div>
                        </div>

                        {/* 3. Calibrated Scoring Weights */}
                        <div className="space-y-3 pt-1">
                          <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                            3. BALANCED PILLAR WEIGHTINGS
                          </span>

                          <div>
                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                              <span>Technical Correctness (Go & Concurrency)</span>
                              <span className="text-cyan-700 font-mono font-bold">40%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: '40%' }}
                                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                              <span>System Design & Architectural Trade-offs</span>
                              <span className="text-blue-700 font-mono font-bold">30%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: '30%' }}
                                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                              <span>Communication Clarity & Cadence</span>
                              <span className="text-indigo-700 font-mono font-bold">20%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                              <motion.div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: '20%' }}
                                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                              <span>Failure Recovery & Edge Scenarios</span>
                              <span className="text-slate-700 font-mono font-bold">10%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                              <motion.div
                                className="h-full bg-slate-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: '10%' }}
                                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.4 }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </BorderGlow>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

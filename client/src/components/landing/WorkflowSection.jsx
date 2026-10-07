import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  FileUp,
  Cpu,
  CheckCircle,
  BrainCircuit,
  Mic,
  GitBranch,
  BarChart,
  Award,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Terminal,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import Stack from '../common/Stack.jsx'
import TextType from '../common/TextType.jsx'

const STEPS = [
  {
    num: '01',
    title: 'Ingest Job Description',
    description:
      'Upload raw PDF, markdown, or URL. QualifyAI instantly strips recruitment boilerplate to parse genuine requirements.',
    tag: 'Text & PDF Ingestion',
    icon: FileUp,
    accent: 'from-cyan-500 to-blue-500',
    glowColor: 'cyan',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    inspectorTitle: 'Step 01 • Intelligent Ingestion Payload',
    inspectorSnippet: '{\n  "source": "Staff-Distributed-Systems.pdf",\n  "clean_token_count": 2480,\n  "role_level": "Staff / L6",\n  "parsing_latency": "640ms"\n}',
  },
  {
    num: '02',
    title: 'Extract Competencies',
    description:
      'Dissects the role into core technical domains, runtime constraints, architecture patterns, and required seniority depth.',
    tag: 'Taxonomy Synthesis',
    icon: Cpu,
    accent: 'from-blue-500 to-indigo-500',
    glowColor: 'blue',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    inspectorTitle: 'Step 02 • Extracted Competency Graph',
    inspectorSnippet: '{\n  "primary_runtime": "Go 1.22",\n  "distributed_primitives": ["Raft", "Paxos", "Gossip"],\n  "message_queues": ["Apache Kafka", "Redpanda"],\n  "concurrency_depth": "Goroutines, channels, sync/atomic"\n}',
  },
  {
    num: '03',
    title: 'Synthesize Role Rubric',
    description:
      'Automatically creates balanced evaluation weightings across Correctness, System Design, Communication, and Failure Scenarios.',
    tag: 'Calibrated Pillars',
    icon: CheckCircle,
    accent: 'from-indigo-500 to-violet-500',
    glowColor: 'indigo',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    inspectorTitle: 'Step 03 • Calibrated Rubric Weights',
    inspectorSnippet: '{\n  "pillars": {\n    "architecture_scalability": 0.35,\n    "technical_correctness": 0.35,\n    "edge_case_resilience": 0.20,\n    "cadence_and_clarity": 0.10\n  }\n}',
  },
  {
    num: '04',
    title: 'Generate Dynamic Bank',
    description:
      "Engine generates an adaptive question pool calibrated specifically for this role's tech stack and real production constraints.",
    tag: 'Scenario-Driven Pools',
    icon: BrainCircuit,
    accent: 'from-violet-500 to-purple-500',
    glowColor: 'violet',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    inspectorTitle: 'Step 04 • Adaptive Question Pool',
    inspectorSnippet: '[\n  "How do you prevent split-brain during quorum loss in a 5-node cluster?",\n  "Explain write amplification trade-offs in LSM trees vs B-Trees under heavy ingest."\n]',
  },
  {
    num: '05',
    title: 'Real-Time Voice Session',
    description:
      'Candidates speak naturally over WebSockets with conversational AI in low-latency voice with graceful turn-taking.',
    tag: 'Sub-Second Latency',
    icon: Mic,
    accent: 'from-cyan-400 to-teal-500',
    glowColor: 'cyan',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    inspectorTitle: 'Step 05 • Real-Time Voice Socket Stream',
    inspectorSnippet: '{\n  "protocol": "wss://engine.qualifyai.io/v1/voice",\n  "stt_latency_ms": 220,\n  "llm_turn_latency_ms": 380,\n  "tts_audio_chunk_ms": 220,\n  "roundtrip_total_ms": 820\n}',
  },
  {
    num: '06',
    title: 'Multi-Turn Follow-Ups',
    description:
      'If an answer sounds superficial or rote, the AI agent dynamically pivots to probe internal mechanics, edge cases, and compromises.',
    tag: 'Adaptive Depth Probing',
    icon: GitBranch,
    accent: 'from-pink-500 to-rose-500',
    glowColor: 'rose',
    badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
    inspectorTitle: 'Step 06 • Dynamic Depth Trigger',
    inspectorSnippet: '{\n  "candidate_response_type": "high_level_summary",\n  "probe_level": 2,\n  "followup_prompt": "You mentioned Raft leader election, but what happens when a partitioned follower rejoins with higher Term?"\n}',
  },
  {
    num: '07',
    title: 'Multi-Dimensional Scoring',
    description:
      'Analyzes technical validity, latency trade-offs, clarity of expression, and delivery metrics against the predetermined rubric.',
    tag: 'Rigorous 0–100 Scores',
    icon: BarChart,
    accent: 'from-emerald-500 to-teal-600',
    glowColor: 'emerald',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inspectorTitle: 'Step 07 • Multi-Dimensional Evaluation',
    inspectorSnippet: '{\n  "overall_composite": 91.5,\n  "pillar_scores": {\n    "architecture": 94,\n    "concurrency_accuracy": 92,\n    "edge_cases": 88,\n    "articulation_wpm": 138\n  },\n  "integrity_verdict": "LOW_RISK"\n}',
  },
  {
    num: '08',
    title: 'Split Diagnostic Delivery',
    description:
      'Recruiters receive instant ATS candidate stack-rankings; candidates unlock comprehensive growth feedback reports.',
    tag: 'Recruiter + Candidate Wins',
    icon: Award,
    accent: 'from-amber-500 to-orange-500',
    glowColor: 'amber',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    inspectorTitle: 'Step 08 • Bi-Directional Artifacts Dispatched',
    inspectorSnippet: '{\n  "recruiter_ats_webhook": "delivered (200 OK)",\n  "recruiter_rank": "Top 4% of applicant cohort",\n  "candidate_report_url": "https://qualifyai.io/report/c-8291f",\n  "feedback_generated": true\n}',
  },
]

export default function WorkflowSection() {
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const sectionRef = useRef(null)
  const activeStepIndexRef = useRef(activeStepIndex)
  activeStepIndexRef.current = activeStepIndex

  const isTransitioningRef = useRef(false)

  const activeStep = STEPS[activeStepIndex] || STEPS[0]

  // Fixed section lock: Locks the page when reaching the section,
  // absorbs fast scrolls to prevent overshooting, and steps through cards 1 by 1
  // via mouse wheel, arrow keys (ArrowDown/ArrowUp), PageDown/PageUp, Space, or mobile touch.
  useEffect(() => {
    const sectionEl = sectionRef.current
    if (!sectionEl) return

    const getNavbarHeight = () => {
      const header = document.querySelector('header')
      return header ? Math.min(header.offsetHeight, 48) : 40
    }

    const snapToSection = (smooth = true) => {
      const navH = getNavbarHeight()
      const rect = sectionEl.getBoundingClientRect()
      const targetY = window.scrollY + rect.top - navH
      window.scrollTo({
        top: Math.max(0, targetY),
        behavior: smooth ? 'smooth' : 'auto',
      })
    }

    let cooldownTimer = null

    const handleWheel = (e) => {
      // Don't intercept browser pinch-zoom or Ctrl+scroll
      if (e.ctrlKey) return

      // Ignore pure horizontal swipe gestures
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return

      const delta = e.deltaY
      if (Math.abs(delta) < 12) return

      const navH = getNavbarHeight()
      const rect = sectionEl.getBoundingClientRect()
      const offsetFromNav = rect.top - navH
      const windowHeight = window.innerHeight
      const current = activeStepIndexRef.current

      // 1. If currently inside or pinned at this section:
      const isInSection =
        Math.abs(offsetFromNav) <= 50 ||
        (offsetFromNav < 0 && rect.bottom >= windowHeight * 0.45)

      if (isInSection) {
        if (delta > 0) {
          // DOWNWARD scroll
          if (current < STEPS.length - 1) {
            e.preventDefault()

            // Keep section cleanly locked to navbar top
            if (Math.abs(offsetFromNav) > 4) {
              window.scrollTo({
                top: window.scrollY + offsetFromNav,
                behavior: 'auto',
              })
            }

            if (isTransitioningRef.current) return
            isTransitioningRef.current = true

            setActiveStepIndex(prev => {
              const next = Math.min(prev + 1, STEPS.length - 1)
              activeStepIndexRef.current = next
              return next
            })

            clearTimeout(cooldownTimer)
            cooldownTimer = setTimeout(() => {
              isTransitioningRef.current = false
            }, 450)
            return
          } else {
            // At last stage (08): allow user to scroll down to next section
            return
          }
        } else if (delta < 0) {
          // UPWARD scroll
          if (current > 0) {
            e.preventDefault()

            if (Math.abs(offsetFromNav) > 4) {
              window.scrollTo({
                top: window.scrollY + offsetFromNav,
                behavior: 'auto',
              })
            }

            if (isTransitioningRef.current) return
            isTransitioningRef.current = true

            setActiveStepIndex(prev => {
              const next = Math.max(prev - 1, 0)
              activeStepIndexRef.current = next
              return next
            })

            clearTimeout(cooldownTimer)
            cooldownTimer = setTimeout(() => {
              isTransitioningRef.current = false
            }, 450)
            return
          } else {
            // At first stage (01): allow user to scroll up to previous section
            return
          }
        }
      }

      // 2. Approaching from ABOVE: Scrolling DOWN towards section
      // Intercept before fast velocity or momentum overshoots the section
      if (delta > 0 && offsetFromNav > 0) {
        const threshold = Math.max(delta * 1.5, 220)
        if (offsetFromNav <= threshold) {
          e.preventDefault()
          snapToSection(true)
          setActiveStepIndex(0)
          activeStepIndexRef.current = 0
          isTransitioningRef.current = true
          clearTimeout(cooldownTimer)
          cooldownTimer = setTimeout(() => {
            isTransitioningRef.current = false
          }, 450)
          return
        }
      }

      // 3. Approaching from BELOW: Scrolling UP towards section
      if (delta < 0 && rect.bottom < windowHeight && rect.bottom > 0) {
        const distanceToSection = windowHeight - rect.bottom
        const threshold = Math.max(Math.abs(delta) * 1.5, 220)
        if (distanceToSection <= threshold) {
          e.preventDefault()
          snapToSection(true)
          setActiveStepIndex(STEPS.length - 1)
          activeStepIndexRef.current = STEPS.length - 1
          isTransitioningRef.current = true
          clearTimeout(cooldownTimer)
          cooldownTimer = setTimeout(() => {
            isTransitioningRef.current = false
          }, 450)
          return
        }
      }
    }

    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase()
      if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable) {
        return
      }

      const navH = getNavbarHeight()
      const rect = sectionEl.getBoundingClientRect()
      const offsetFromNav = rect.top - navH
      const windowHeight = window.innerHeight

      const isInSection =
        Math.abs(offsetFromNav) <= 80 ||
        (rect.top <= navH + 100 && rect.bottom >= windowHeight * 0.4)

      if (!isInSection) return

      const current = activeStepIndexRef.current

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
        if (current < STEPS.length - 1) {
          e.preventDefault()
          if (Math.abs(offsetFromNav) > 4) {
            snapToSection(true)
          }
          if (isTransitioningRef.current) return
          isTransitioningRef.current = true
          setActiveStepIndex(prev => {
            const next = Math.min(prev + 1, STEPS.length - 1)
            activeStepIndexRef.current = next
            return next
          })
          clearTimeout(cooldownTimer)
          cooldownTimer = setTimeout(() => {
            isTransitioningRef.current = false
          }, 450)
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
        if (current > 0) {
          e.preventDefault()
          if (Math.abs(offsetFromNav) > 4) {
            snapToSection(true)
          }
          if (isTransitioningRef.current) return
          isTransitioningRef.current = true
          setActiveStepIndex(prev => {
            const next = Math.max(prev - 1, 0)
            activeStepIndexRef.current = next
            return next
          })
          clearTimeout(cooldownTimer)
          cooldownTimer = setTimeout(() => {
            isTransitioningRef.current = false
          }, 450)
        }
      }
    }

    let touchStartY = 0
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY
    }

    const handleTouchMove = (e) => {
      const navH = getNavbarHeight()
      const rect = sectionEl.getBoundingClientRect()
      const offsetFromNav = rect.top - navH
      const windowHeight = window.innerHeight

      const isInSection =
        Math.abs(offsetFromNav) <= 60 ||
        (offsetFromNav < 0 && rect.bottom >= windowHeight * 0.45)

      if (!isInSection) return

      const currentY = e.touches[0].clientY
      const diff = touchStartY - currentY // positive = swiping up / scrolling down

      if (Math.abs(diff) < 28) return

      const current = activeStepIndexRef.current

      if (diff > 0) {
        if (current < STEPS.length - 1) {
          e.preventDefault()
          if (!isTransitioningRef.current) {
            isTransitioningRef.current = true
            touchStartY = currentY
            setActiveStepIndex(prev => {
              const next = Math.min(prev + 1, STEPS.length - 1)
              activeStepIndexRef.current = next
              return next
            })
            clearTimeout(cooldownTimer)
            cooldownTimer = setTimeout(() => {
              isTransitioningRef.current = false
            }, 450)
          }
        }
      } else if (diff < 0) {
        if (current > 0) {
          e.preventDefault()
          if (!isTransitioningRef.current) {
            isTransitioningRef.current = true
            touchStartY = currentY
            setActiveStepIndex(prev => {
              const next = Math.max(prev - 1, 0)
              activeStepIndexRef.current = next
              return next
            })
            clearTimeout(cooldownTimer)
            cooldownTimer = setTimeout(() => {
              isTransitioningRef.current = false
            }, 450)
          }
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

  // Create card elements for React Bits Stack
  const cardElements = useMemo(() => {
    return STEPS.map((step) => {
      const Icon = step.icon
      return (
        <div
          key={step.num}
          className="w-full h-full bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden flex flex-col justify-between p-6 sm:p-8 relative select-none"
        >
          {/* Top colored accent line lying flush on top edge */}
          <div
            className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${step.accent}`}
          />

          <div>
            {/* Header: Number + Icon + Tag */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="font-heading text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
                  {step.num}
                </span>
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${step.badgeColor}`}>
                  {step.tag}
                </span>
              </div>

              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xs ${step.badgeColor}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>

            {/* Title */}
            <h3 className="font-heading font-bold text-slate-900 text-xl sm:text-2xl mb-3 leading-snug">
              {step.title}
            </h3>

            {/* Description */}
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Card Bottom Meta */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-mono text-[11px] flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Stage {step.num} of 08
            </span>
            <span className="text-[11px] font-bold text-blue-600 font-mono bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              Drag or Click to Cycle ⤹
            </span>
          </div>
        </div>
      )
    })
  }, [])

  const handlePrev = () => {
    setActiveStepIndex(prev => {
      const next = prev > 0 ? prev - 1 : 0
      activeStepIndexRef.current = next
      return next
    })
  }

  const handleNext = () => {
    setActiveStepIndex(prev => {
      const next = prev < STEPS.length - 1 ? prev + 1 : prev
      activeStepIndexRef.current = next
      return next
    })
  }

  return (
    <section
      ref={sectionRef}
      id="workflow"
      className="scroll-mt-4 pt-1 sm:pt-2 pb-14 lg:pb-16 bg-gradient-to-b from-white via-slate-50/60 to-white border-b border-slate-200/80 bg-grid-pattern relative overflow-hidden flex flex-col"
    >
      {/* Parallax Ambient Orbs */}
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-cyan-200/20 blur-3xl -z-10 rounded-full animate-float-slow pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-purple-200/20 blur-3xl -z-10 rounded-full animate-float-reverse-slow pointer-events-none" />

      {/* Main Content Container */}
      <div className="relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-4 sm:mb-6 space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              END-TO-END ORCHESTRATION PIPELINE
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.25]">
              The <span className="gradient-text-rainbow font-black">8-Step</span>
              <span className="block mt-1 sm:mt-1.5 text-slate-900">
                <TextType
                  text={['Autonomous Screening Workflow', 'Conversational AI Pipeline', 'Deterministic Technical Evaluation']}
                  typingSpeed={38}
                  deletingSpeed={22}
                  pauseDuration={2000}
                  showCursor={true}
                  cursorCharacter="|"
                  cursorClassName="text-blue-600 font-bold"
                  className="inline-block text-slate-900"
                />
              </span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
              {activeStepIndex === STEPS.length - 1 ? (
                <span className="text-blue-700 font-semibold inline-flex items-center gap-1.5">
                  ✓ Pipeline completed! Scroll down to continue to platform solutions ↓
                </span>
              ) : (
                <span>
                  Scroll or use <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-slate-100 border border-slate-300 rounded shadow-xs text-slate-800">↓</kbd> key to cycle through each stage. Telemetry updates in real-time.
                </span>
              )}
            </p>

            {/* Quick Step Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1.5">
              {STEPS.map((s, idx) => (
                <button
                  key={s.num}
                  onClick={() => {
                    setActiveStepIndex(idx)
                    activeStepIndexRef.current = idx
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                    activeStepIndex === idx
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-105 ring-2 ring-blue-400/50'
                      : idx < activeStepIndex
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {s.num}
                </button>
              ))}
            </div>
          </div>

          {/* Two-Column Single Section: Stack on Left, Telemetry on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Column: React Bits Stack Component (5 cols) */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-[420px] h-[360px] sm:h-[390px] relative">
                <Stack
                  cards={cardElements}
                  activeIndex={activeStepIndex}
                  onNext={handleNext}
                  onPrev={handlePrev}
                  sendToBackOnClick={true}
                  sensitivity={100}
                />
              </div>

              {/* Stack Controls / Quick Navigation */}
              <div className="flex items-center justify-between w-full max-w-[420px] mt-6 px-2 text-xs text-slate-500">
                <button
                  onClick={handlePrev}
                  disabled={activeStepIndex === 0}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border font-semibold shadow-xs transition-all active:scale-95 ${
                    activeStepIndex === 0
                      ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <span className="font-mono text-xs font-semibold text-slate-600">
                  Step {activeStep.num} / 08
                </span>

                <button
                  onClick={handleNext}
                  disabled={activeStepIndex === STEPS.length - 1}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border font-semibold shadow-xs transition-all active:scale-95 ${
                    activeStepIndex === STEPS.length - 1
                      ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>Next Step</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Right Column: Runtime Telemetry Box (7 cols) */}
            <div className="lg:col-span-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep.num}
                  initial={{ opacity: 0, y: 12, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.99 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="bg-gradient-to-br from-slate-50 via-white to-blue-50/40 rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl shadow-blue-500/5 text-slate-900 relative overflow-hidden"
                >
                  {/* Subtle Ambient Top Glow */}
                  <div className="absolute top-0 right-1/4 w-80 h-32 bg-blue-200/30 blur-3xl pointer-events-none" />

                  {/* Telemetry Header */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs shrink-0">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] sm:text-[11px] font-mono font-bold text-blue-600 uppercase tracking-widest block">
                          QUALIFYAI RUNTIME TELEMETRY
                        </span>
                        <h4 className="font-heading font-bold text-base sm:text-lg text-slate-900 leading-snug">
                          {activeStep.inspectorTitle}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-500 font-mono hidden sm:inline">Viewing Stage:</span>
                      <span className="px-3 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-800 font-mono text-xs font-bold">
                        {activeStep.num} of 08
                      </span>
                    </div>
                  </div>

                  {/* Telemetry Details & Payload */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                    {/* Left Side: Summary & Health */}
                    <div className="md:col-span-5 flex flex-col justify-between space-y-4">
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {activeStep.description}
                      </p>

                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 space-y-1 font-mono shadow-xs">
                        <div className="text-emerald-600 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          ✓ Automated Execution Passed
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          Status: Low-latency deterministic pipeline
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Payload JSON Box */}
                    <div className="md:col-span-7 bg-slate-50/95 rounded-2xl p-4 border border-slate-200 font-mono text-xs text-slate-800 overflow-x-auto shadow-inner flex flex-col justify-between">
                      <div className="flex items-center justify-between text-slate-400 text-[10px] pb-2 border-b border-slate-200 mb-3">
                        <span className="font-bold text-slate-600 uppercase tracking-wider">
                          PAYLOAD JSON • READONLY
                        </span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ● LIVE
                        </span>
                      </div>

                      <pre className="whitespace-pre-wrap leading-relaxed text-blue-950 font-mono text-[11px] sm:text-xs">
                        {activeStep.inspectorSnippet}
                      </pre>

                      <div className="pt-2 mt-3 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Latency: &lt;120ms</span>
                        <span className="text-slate-500 font-semibold">{activeStep.tag}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

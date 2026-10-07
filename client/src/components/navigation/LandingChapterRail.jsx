import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ChevronUp,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  GitBranch,
  Layers,
  FileCode,
  Mic,
  Award,
  ShieldCheck,
  Users,
  TrendingUp,
  Lock,
  Rocket,
} from 'lucide-react'

const CHAPTERS = [
  { id: 'hero', label: 'Overview', num: '01', icon: Sparkles, accent: '#2563eb' },
  { id: 'problem', label: 'The Problem', num: '02', icon: AlertTriangle, accent: '#e11d48' },
  { id: 'workflow', label: 'Autonomous Flow', num: '03', icon: GitBranch, accent: '#4f46e5' },
  { id: 'dual-sided', label: 'Platform Solutions', num: '04', icon: Layers, accent: '#059669' },
  { id: 'rubrics', label: 'JD Intelligence', num: '05', icon: FileCode, accent: '#0284c7' },
  { id: 'voice-engine', label: 'AI Voice Engine', num: '06', icon: Mic, accent: '#7c3aed' },
  { id: 'scorecard', label: 'Scorecard Rubric', num: '07', icon: Award, accent: '#d97706' },
  { id: 'integrity', label: 'Ethical Integrity', num: '08', icon: ShieldCheck, accent: '#0d9488' },
  { id: 'leaderboard', label: 'Cohort Leaderboard', num: '09', icon: Users, accent: '#2563eb' },
  { id: 'diagnostic', label: 'Diagnostic Reports', num: '10', icon: TrendingUp, accent: '#059669' },
  { id: 'security', label: 'Enterprise Security', num: '11', icon: Lock, accent: '#9333ea' },
  { id: 'cta', label: 'Get Started', num: '12', icon: Rocket, accent: '#2563eb' },
]

export default function LandingChapterRail() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeId, setActiveId] = useState('hero')

  // Scroll spy tracking across page sections
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 3

      for (let i = CHAPTERS.length - 1; i >= 0; i--) {
        const section = document.getElementById(CHAPTERS[i].id)
        if (section) {
          const top = section.offsetTop
          if (scrollPosition >= top) {
            setActiveId(CHAPTERS[i].id)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const currentIndex = CHAPTERS.findIndex((c) => c.id === activeId)
  const currentChapter = CHAPTERS[Math.max(0, currentIndex)]

  const scrollToChapter = (id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(id)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      scrollToChapter(CHAPTERS[currentIndex - 1].id)
    }
  }

  const handleNext = () => {
    if (currentIndex < CHAPTERS.length - 1) {
      scrollToChapter(CHAPTERS[currentIndex + 1].id)
    }
  }

  return (
    <nav
      aria-label="Landing page chapters navigation"
      className="fixed left-5 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-center gap-2 select-none"
    >
      {/* 1. Previous Section Jump Button (Light Theme) */}
      <button
        onClick={handlePrevious}
        disabled={currentIndex <= 0}
        aria-label="Previous chapter"
        className={`w-9 h-8 rounded-xl bg-white/95 border border-slate-200 text-slate-600 flex items-center justify-center transition-all duration-200 shadow-sm ${
          currentIndex <= 0
            ? 'opacity-35 cursor-not-allowed'
            : 'hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 hover:scale-105 active:scale-95 cursor-pointer'
        }`}
      >
        <ChevronUp className="w-4 h-4" />
      </button>

      {/* 2. Expandable Chapter Rail (Light Frosted Glass) */}
      <motion.div
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        animate={{ width: isExpanded ? 220 : 54 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] overflow-hidden flex flex-col gap-1"
        style={{ willChange: 'width' }}
      >
        {CHAPTERS.map((ch) => {
          const isActive = ch.id === activeId
          const Icon = ch.icon

          return (
            <button
              key={ch.id}
              onClick={() => scrollToChapter(ch.id)}
              className={`relative h-10 w-full rounded-xl flex items-center transition-colors duration-150 text-left group overflow-hidden ${
                isActive
                  ? 'text-slate-900 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
              }`}
              title={ch.label}
            >
              {/* Active Selection Sliding Plate (Light Blue Glass) */}
              {isActive && (
                <motion.div
                  layoutId="activeLandingChapterPlate"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-blue-50/90 border border-blue-200/90 shadow-xs z-0"
                  style={{
                    boxShadow: `0 0 12px ${ch.accent}18`,
                  }}
                />
              )}

              {/* Icon Container (always fixed at 42px width centered) */}
              <div className="w-[42px] shrink-0 flex items-center justify-center z-10">
                <Icon
                  className="w-4 h-4 transition-transform duration-200 group-hover:scale-110"
                  style={{ color: isActive ? ch.accent : undefined }}
                />
              </div>

              {/* Expanded Label and Number Chip */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="flex items-center gap-2 pl-1 pr-3 whitespace-nowrap z-10 overflow-hidden"
                  >
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold"
                      style={{
                        backgroundColor: `${ch.accent}15`,
                        color: ch.accent,
                      }}
                    >
                      {ch.num}
                    </span>
                    <span className="text-xs tracking-tight truncate text-slate-800">
                      {ch.label}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          )
        })}
      </motion.div>

      {/* 3. Next Section Jump Button (Light Theme) */}
      <button
        onClick={handleNext}
        disabled={currentIndex >= CHAPTERS.length - 1}
        aria-label="Next chapter"
        className={`w-9 h-8 rounded-xl bg-white/95 border border-slate-200 text-slate-600 flex items-center justify-center transition-all duration-200 shadow-sm ${
          currentIndex >= CHAPTERS.length - 1
            ? 'opacity-35 cursor-not-allowed'
            : 'hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 hover:scale-105 active:scale-95 cursor-pointer'
        }`}
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      {/* 4. Progress Badge (Light Theme) */}
      <motion.div
        animate={{ width: isExpanded ? 220 : 54 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="h-7 bg-white/95 border border-slate-200 rounded-xl px-2 flex items-center justify-center overflow-hidden shadow-xs text-slate-600 font-mono text-[10px]"
      >
        {isExpanded ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="tracking-wider uppercase font-semibold text-blue-600 whitespace-nowrap"
          >
            CHAPTER {currentChapter?.num} OF {CHAPTERS.length}
          </motion.span>
        ) : (
          <span className="font-bold text-slate-800">{currentChapter?.num}</span>
        )}
      </motion.div>
    </nav>
  )
}

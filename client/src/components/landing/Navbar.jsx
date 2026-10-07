import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Sparkles,
  ArrowRight,
  Menu,
  X,
  PlayCircle,
  LogIn,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'

/**
 * Landing Navbar Component
 * Floating Dual-Pill Architecture (NAVBAR_DESIGN_SYSTEM.md)
 * Styled in the QualifyAI Light Color Theme:
 * - Frosted white glass pills with subtle cool-slate borders
 * - Brand gradient logo tile (from-blue-600 via-indigo-600 to-cyan-500)
 * - Action hierarchy:
 *   1. Sign In (clean white pill with blue-600 LogIn)
 *   2. Get Started Free (signature blue-to-indigo gradient CTA)
 *   3. Workspace Dashboard (when authenticated)
 * - Mobile responsive drawer in matching light theme
 */
export default function Navbar({ onOpenAuth }) {
  const { isAuthenticated, user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleNavClick = (id) => {
    setMobileMenuOpen(false)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none pt-4 sm:pt-6 px-4 sm:px-8 lg:px-12 select-none transition-all">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between pointer-events-none">
        {/* Left: Brand Control Pill (Light Frosted Glass) */}
        <a
          href="#hero"
          aria-label="QualifyAI Home"
          className="pointer-events-auto group flex items-center gap-3 bg-white/90 hover:bg-white backdrop-blur-xl border border-slate-200/90 hover:border-blue-300 rounded-2xl px-4 py-2.5 shadow-[0_4px_20px_rgba(15,23,42,0.06)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.14)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
        >
          {/* Logo Tile with Brand Gradient */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform duration-200 shrink-0">
            <Sparkles className="w-4 h-4 text-white fill-white" />
          </div>

          {/* Wordmark in Slate-900 and Blue-600 */}
          <div className="flex items-center">
            <span className="font-heading font-extrabold text-xl tracking-tight text-slate-900 transition-colors duration-200 group-hover:text-blue-600">
              Qualify<span className="text-blue-600">AI</span>
            </span>
          </div>
        </a>

        {/* Right: Desktop Action Cluster (Light Color Theme) */}
        <div className="hidden sm:flex items-center gap-3 pointer-events-auto">
          {isAuthenticated ? (
            /* Authenticated User: Direct Link to Workspace Dashboard */
            <button
              onClick={() => onOpenAuth?.()}
              aria-label="Open Workspace Dashboard"
              className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/95 hover:bg-slate-50 active:scale-95 text-slate-800 hover:text-blue-600 text-xs sm:text-sm font-bold border border-slate-200/90 hover:border-blue-300 shadow-sm hover:shadow transition-all duration-200 transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Workspace Dashboard</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ) : (
            <>
              {/* Unauthenticated Action 1: Sign In */}
              <button
                onClick={() => onOpenAuth?.('login')}
                aria-label="Recruiter Portal Sign In"
                className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/90 hover:bg-slate-50 active:scale-95 text-slate-700 hover:text-blue-600 text-xs sm:text-sm font-bold border border-slate-200/90 hover:border-blue-300 shadow-sm hover:shadow transition-all duration-200 transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-blue-600 transition-transform group-hover:scale-110 shrink-0" />
                <span>Sign In</span>
              </button>

              {/* Unauthenticated Action 2: Get Started Free (Sign Up) */}
              <button
                onClick={() => onOpenAuth?.('signup')}
                aria-label="Get Started Free with QualifyAI"
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 active:scale-95 text-white text-xs sm:text-sm font-extrabold shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 transition-all duration-200 transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4 text-white transition-transform group-hover:translate-x-0.5 shrink-0" />
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Trigger (Light Glass Button) */}
        <div className="sm:hidden pointer-events-auto">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="w-11 h-11 rounded-2xl bg-white/95 border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center shadow-md transition-all active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-blue-600" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Revealed Dropdown Panel (Light Theme) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto max-w-sm ml-auto mt-2.5 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl p-4 shadow-2xl shadow-slate-900/10 space-y-4"
          >
            {/* Chapters Navigation Links */}
            <div className="space-y-1">
              <span className="px-2 text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase block pb-1">
                Chapters
              </span>
              {[
                { label: 'Autonomous Screening Flow', id: 'workflow' },
                { label: 'Platform Solutions', id: 'dual-sided' },
                { label: 'JD Intelligence & Rubrics', id: 'rubrics' },
                { label: 'Real-Time Voice Engine', id: 'voice-engine' },
                { label: 'Calibrated Scorecards', id: 'scorecard' },
                { label: 'Ethical Integrity & Proctoring', id: 'integrity' },
                { label: 'Cohort Leaderboard', id: 'leaderboard' },
                { label: 'Candidate Diagnostic Reports', id: 'diagnostic' },
                { label: 'Enterprise Security Architecture', id: 'security' },
              ].map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/60 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>{link.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              ))}
            </div>

            {/* Fine Divider */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <span className="px-2 text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase block pb-1">
                Actions
              </span>

              {/* Mobile Actions */}
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    onOpenAuth?.()
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 transition-all active:scale-95 cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Open Workspace Dashboard</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      onOpenAuth?.('login')
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-all active:scale-95 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 text-blue-600" />
                    <span>Sign In to Portal</span>
                  </button>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      onOpenAuth?.('signup')
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white text-xs font-extrabold shadow-md shadow-blue-500/25 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Get Started Free</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

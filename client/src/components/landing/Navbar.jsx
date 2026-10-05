import React, { useState } from 'react'
import { Sparkles, ArrowRight, Menu, X, ShieldCheck } from 'lucide-react'

export default function Navbar({ onOpenDemo }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center">
            <span className="font-heading font-extrabold text-2xl tracking-tight text-slate-900">
              Qualify<span className="text-blue-600">AI</span>
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#workflow" className="hover:text-blue-600 transition-colors">
            How It Works
          </a>
          <a href="#dual-sided" className="hover:text-blue-600 transition-colors">
            Platform Solutions
          </a>
          <a href="#voice-engine" className="hover:text-blue-600 transition-colors">
            AI Voice Engine
          </a>
          <a href="#rubrics" className="hover:text-blue-600 transition-colors">
            Rubric Intelligence
          </a>
          <a href="#security" className="hover:text-blue-600 transition-colors">
            Enterprise Security
          </a>
        </nav>

        {/* Right CTA Area */}
        <div className="hidden sm:flex items-center gap-3">
          <button
            onClick={onOpenDemo}
            className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition"
          >
            Live Simulator Demo
          </button>

          <a
            href="#cta"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/25 transition-all transform hover:-translate-y-0.5"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Mobile menu toggle */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-3">
          <a
            href="#workflow"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-700 hover:text-blue-600"
          >
            How It Works
          </a>
          <a
            href="#dual-sided"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-700 hover:text-blue-600"
          >
            Platform Solutions
          </a>
          <a
            href="#voice-engine"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-700 hover:text-blue-600"
          >
            AI Voice Engine
          </a>
          <a
            href="#rubrics"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-700 hover:text-blue-600"
          >
            Rubric Intelligence
          </a>
          <a
            href="#security"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-700 hover:text-blue-600"
          >
            Enterprise Security
          </a>
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false)
                onOpenDemo()
              }}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 text-center"
            >
              Live Simulator Demo
            </button>
            <a
              href="#cta"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold text-center shadow-md shadow-blue-600/20"
            >
              Get Started Free
            </a>
          </div>
        </div>
      )}
    </header>
  )
}

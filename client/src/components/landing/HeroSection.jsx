import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  ArrowRight,
  Volume2,
  Lock,
  FileText,
  Share2,
  CheckSquare,
  Activity,
  Layers,
  Building2,
  Code2,
  Zap,
  ShieldCheck,
} from 'lucide-react'
import heroIllustration from '../../assets/hero-illustration.png'
import BorderGlow from '../common/BorderGlow.jsx'
import SplitFlapText from '../common/SplitFlapText.jsx'

export default function HeroSection({ onOpenDemo }) {
  const [selectedPersona, setSelectedPersona] = useState('recruiter')
  const [waveMeter, setWaveMeter] = useState([30, 65, 95, 45, 85, 100, 75, 50, 90, 40])

  // Real-time audio waveform oscillation for 04 • VOICE STREAM
  useEffect(() => {
    const timer = setInterval(() => {
      setWaveMeter([
        Math.floor(20 + Math.random() * 60),
        Math.floor(40 + Math.random() * 55),
        Math.floor(50 + Math.random() * 50),
        Math.floor(30 + Math.random() * 65),
        Math.floor(60 + Math.random() * 40),
        Math.floor(70 + Math.random() * 30),
        Math.floor(50 + Math.random() * 50),
        Math.floor(30 + Math.random() * 60),
        Math.floor(60 + Math.random() * 40),
        Math.floor(25 + Math.random() * 50),
      ])
    }, 200)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="relative pt-16 pb-24 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50/80 border-b border-slate-200/60 bg-grid-pattern">
      {/* Parallax Floating Ambient Mesh Orbs */}
      <div className="absolute top-12 left-1/4 w-[600px] h-[350px] bg-gradient-to-tr from-blue-300/30 via-indigo-300/20 to-cyan-300/30 blur-3xl -z-10 rounded-full animate-float pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[500px] h-[320px] bg-gradient-to-tr from-cyan-300/30 via-blue-200/20 to-purple-300/20 blur-3xl -z-10 rounded-full animate-float-reverse pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Announcement Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-cyan-50/90 border border-cyan-200 text-cyan-800 text-xs font-semibold shadow-sm hover:border-cyan-300 hover:shadow-md transition-all cursor-default">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shadow-sm shadow-cyan-400" />
            <span className="font-heading tracking-wide">⚡ NEXT-GEN TECHNICAL SCREENING & AI VOICE INTERVIEWS</span>
          </div>
        </div>

        {/* Hero Headline & 3D Illustration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text Column (6 cols) */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-heading font-extrabold text-slate-900 leading-[1.18] tracking-tight">
              Technical Interviews,<br />
              Powered by
              <span className="block mt-2">
                <SplitFlapText
                  words={['INTELLIGENCE', 'VOICE AGENTS', 'CALIBRATION', 'OBJECTIVITY ']}
                  fontSize="clamp(22px, 3.8vw, 42px)"
                  tileRadius={6}
                  gap={4}
                  tileColor="#ffffff"
                  textColor="#2563eb"
                  padTo={12}
                  cycleDelay={2600}
                />
              </span>
            </h1>

            <p className="text-xl sm:text-2xl font-heading font-bold text-blue-600 leading-snug">
              From Job Description to Adaptive Voice Evaluation
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href="#cta"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold text-sm shadow-xl shadow-blue-500/30 transition-all transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/40"
              >
                Start Screening Candidates
                <ArrowRight className="w-4 h-4" />
              </a>

              <button
                onClick={onOpenDemo}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-300 text-slate-800 font-semibold text-sm shadow-sm hover:shadow-md transition-all transform hover:-translate-y-0.5"
              >
                <Volume2 className="w-4 h-4 text-blue-600" />
                Try an AI Practice Interview
              </button>
            </div>

            {/* Persona Switcher Strip */}
            <div className="pt-4 flex justify-center lg:justify-start">
              <div className="inline-flex p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/90 shadow-inner">
                <button
                  onClick={() => setSelectedPersona('recruiter')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    selectedPersona === 'recruiter'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  I am an Enterprise Recruiter
                </button>

                <button
                  onClick={() => setSelectedPersona('candidate')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    selectedPersona === 'candidate'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                  I am a Software Engineer / Candidate
                </button>
              </div>
            </div>
          </div>

          {/* Right 3D Visual Column with Parallax Floating Badges (6 cols) */}
          <div className="lg:col-span-6 relative flex justify-center perspective-1000">
            {/* Floating 3D Badge 1: Top Left */}
            <div className="absolute -top-4 -left-2 z-20 hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-cyan-200 shadow-xl shadow-cyan-500/10 animate-float text-xs font-semibold text-slate-800">
              <Zap className="w-4 h-4 text-cyan-600" />
              <span>STT Roundtrip: <strong className="text-cyan-700">820ms</strong></span>
            </div>

            {/* Floating 3D Badge 2: Bottom Right */}
            <div className="absolute -bottom-4 right-4 z-20 hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-emerald-200 shadow-xl shadow-emerald-500/10 animate-float-reverse text-xs font-semibold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>100% Objective Rubrics</span>
            </div>

            {/* Main Illustration Container with BorderGlow */}
            <BorderGlow
              glowColor="cyan"
              backgroundColor="#ffffff"
              borderRadius={28}
              className="w-full max-w-[620px] rounded-3xl border border-slate-200/90 shadow-2xl"
            >
              <img
                src={heroIllustration}
                alt="QualifyAI Intelligent Voice Interview 3D Mockup"
                className="w-full h-auto drop-shadow-2xl rounded-3xl"
              />
            </BorderGlow>
          </div>
        </div>

        {/* HERO FLOW VISUALIZER CARD (Full Interactive Instrument Mockup) */}
        <div className="mt-20 bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200 shadow-2xl shadow-blue-500/10 overflow-hidden border-gradient-glow">
          {/* Top Instrument Header */}
          <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-400 hover:scale-125 transition-transform cursor-pointer" />
                <span className="w-3 h-3 rounded-full bg-amber-400 hover:scale-125 transition-transform cursor-pointer" />
                <span className="w-3 h-3 rounded-full bg-emerald-400 hover:scale-125 transition-transform cursor-pointer" />
              </div>
              <span className="text-xs font-mono font-bold tracking-wide text-slate-700">
                AUTONOMOUS ASSESSMENT ORCHESTRATOR • SESSION #QA-9042
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold shadow-xs">
              <Lock className="w-3.5 h-3.5 text-cyan-600" />
              SOC2 Type II Encrypted
            </div>
          </div>

          {/* 5 Instrument Cards Grid with BorderGlow */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Card 1: 01 • JD INGEST */}
            <div className="anim-delay h-full" style={{ animationDelay: '80ms' }}>
              <BorderGlow
                glowColor="cyan"
                backgroundColor="#ffffff"
                borderRadius={16}
                className="h-full border border-slate-200/90 shadow-xs"
              >
                <div className="p-4 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between text-xs text-cyan-700 font-bold mb-2">
                      <span>01 • JD INGEST</span>
                      <FileText className="w-4 h-4 text-cyan-500" />
                    </div>
                    <h4 className="font-heading font-bold text-slate-900 text-sm">
                      Staff Distributed Systems
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      High-throughput raft replication, event-driven
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/80">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-100 text-cyan-800">
                      PARSED IN 0.8S
                    </span>
                  </div>
                </div>
              </BorderGlow>
            </div>

            {/* Card 2: 02 • TAXONOMY */}
            <div className="anim-delay h-full" style={{ animationDelay: '160ms' }}>
              <BorderGlow
                glowColor="blue"
                backgroundColor="#ffffff"
                borderRadius={16}
                className="h-full border border-slate-200/90 shadow-xs"
              >
                <div className="p-4 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between text-xs text-blue-600 font-bold mb-2">
                      <span>02 • TAXONOMY</span>
                      <Share2 className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white border border-slate-200 text-slate-700">
                        Go
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white border border-slate-200 text-slate-700">
                        Kafka
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white border border-slate-200 text-slate-700">
                        Raft
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white border border-slate-200 text-slate-700">
                        Tracing
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] text-slate-600 font-medium">
                    4 Core Domains
                  </div>
                </div>
              </BorderGlow>
            </div>

            {/* Card 3: 03 • RUBRIC */}
            <div className="anim-delay h-full" style={{ animationDelay: '240ms' }}>
              <BorderGlow
                glowColor="indigo"
                backgroundColor="#ffffff"
                borderRadius={16}
                className="h-full border border-slate-200/90 shadow-xs"
              >
                <div className="p-4 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between text-xs text-indigo-600 font-bold mb-2">
                      <span>03 • RUBRIC</span>
                      <CheckSquare className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="space-y-1 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Architecture:</span> <strong className="text-slate-900 font-mono">35%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Correctness:</span> <strong className="text-slate-900 font-mono">35%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Failure Modes:</span> <strong className="text-slate-900 font-mono">20%</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Comms:</span> <strong className="text-slate-900 font-mono">10%</strong>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/80">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800">
                      CALIBRATED
                    </span>
                  </div>
                </div>
              </BorderGlow>
            </div>

            {/* Card 4: 04 • VOICE STREAM */}
            <div className="anim-delay h-full" style={{ animationDelay: '320ms' }}>
              <BorderGlow
                glowColor="cyan"
                backgroundColor="#f0fdfa"
                borderRadius={16}
                className="h-full border-2 border-cyan-400 shadow-md shadow-cyan-500/20"
              >
                <div className="p-4 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between text-xs text-cyan-800 font-bold mb-2">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-600 animate-ping" />
                        04 • VOICE STREAM
                      </span>
                      <span className="font-mono text-cyan-900 font-extrabold">820ms</span>
                    </div>

                    {/* Live Real-Time Frequency Waveform */}
                    <div className="flex items-center justify-center gap-1 h-10 my-2">
                      {waveMeter.map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className="w-1.5 rounded-full bg-cyan-600 transition-all duration-200 shadow-xs"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-cyan-200 text-[10px] text-cyan-900 font-semibold truncate">
                    Sub-turn 4: Raft Log compaction
                  </div>
                </div>
              </BorderGlow>
            </div>

            {/* Card 5: 05 • DUAL OUTPUT */}
            <div className="anim-delay h-full" style={{ animationDelay: '400ms' }}>
              <BorderGlow
                glowColor="emerald"
                backgroundColor="#ffffff"
                borderRadius={16}
                className="h-full border border-slate-200/90 shadow-xs"
              >
                <div className="p-4 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between text-xs text-emerald-600 font-bold mb-2">
                      <span>05 • DUAL OUTPUT</span>
                      <Layers className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Recruiter:</span>
                        <strong className="text-emerald-700">91/100 • Low Risk</strong>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Candidate:</span>
                        <strong className="text-blue-700">88/100 • 138 WPM</strong>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200/80 text-[9px] font-mono text-emerald-700 font-bold uppercase tracking-wider">
                    INSTANT EXPORT READY
                  </div>
                </div>
              </BorderGlow>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

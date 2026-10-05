import React, { useState, useEffect } from 'react'
import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  BarChart3,
  Terminal,
  Activity,
  Award,
  ChevronRight,
  Layers,
  ArrowRight,
  RefreshCw,
  Sliders,
  Check,
  Zap,
  Globe,
  Lock,
} from 'lucide-react'

// Simulated Mock Data for the QualifyAI Experience
const SAMPLE_CANDIDATES = [
  {
    id: 'c1',
    name: 'Alex Rivera',
    role: 'Senior Systems Engineer',
    overallScore: 92,
    techDepth: 95,
    problemSolving: 90,
    commScore: 92,
    status: 'Recommended',
    proctoring: 'Clean (100%)',
    tags: ['Go', 'Distributed Systems', 'PostgreSQL', 'Raft'],
  },
  {
    id: 'c2',
    name: 'Sarah Chen',
    role: 'Senior Systems Engineer',
    overallScore: 88,
    techDepth: 91,
    problemSolving: 86,
    commScore: 89,
    status: 'Strong Hire',
    proctoring: 'Clean (98%)',
    tags: ['Kubernetes', 'gRPC', 'Distributed Storage', 'Rust'],
  },
  {
    id: 'c3',
    name: 'Marcus Brody',
    role: 'Senior Systems Engineer',
    overallScore: 74,
    techDepth: 72,
    problemSolving: 75,
    commScore: 80,
    status: 'Review Needed',
    proctoring: '1 Tab Switch',
    tags: ['Go', 'Redis', 'Docker'],
  },
  {
    id: 'c4',
    name: 'Elena Rostova',
    role: 'Senior Systems Engineer',
    overallScore: 61,
    techDepth: 58,
    problemSolving: 64,
    commScore: 70,
    status: 'Below Benchmark',
    proctoring: 'Clean (100%)',
    tags: ['Java', 'SQL', 'Microservices'],
  },
]

const SAMPLE_RUBRIC = [
  {
    category: 'Distributed Consensus & Concurrency',
    weight: '35%',
    benchmark1: 'Basic locks, unaware of split-brain or quorum concepts',
    benchmark3: 'Understands 2PC, Raft leader election, and CAS primitives',
    benchmark5: 'Deconstructs linearizability, Paxos/Raft trade-offs, and partial failure modes with precision',
  },
  {
    category: 'PostgreSQL Internals & Query Optimization',
    weight: '25%',
    benchmark1: 'Standard SQL queries, basic B-tree indexing intuition',
    benchmark3: 'MVCC mechanics, VACUUM impact, transaction isolation levels',
    benchmark5: 'Buffer pool sizing, WAL write bottlenecks, partition pruning, and lock contention profiling',
  },
  {
    category: 'Asynchronous Architecture & Messaging',
    weight: '20%',
    benchmark1: 'Generic queueing definitions without consumer retry handling',
    benchmark3: 'Dead-letter queues, idempotent processing, backpressure mechanisms',
    benchmark5: 'Exactly-once semantics vs at-least-once, outbox pattern, partition key skew management',
  },
  {
    category: 'Technical Communication & Clarity',
    weight: '20%',
    benchmark1: 'Rambling, fails to structure trade-offs under ambiguity',
    benchmark3: 'Clear terminology, answers directly, asks sensible scope constraints',
    benchmark5: 'Executive-level architectural synthesis, precise systems terminology, proactive trade-off analysis',
  },
]

const SIMULATED_DIALOGUE = [
  {
    speaker: 'ai',
    text: "Welcome Alex. Let's delve into high-throughput database architectures. In a write-intensive distributed PostgreSQL cluster, how do you manage WAL write contention and replication lag across multi-region read replicas?",
    timestamp: '00:08',
  },
  {
    speaker: 'candidate',
    text: "To address WAL saturation, I'd first decouple synchronous commit constraints if some replication lag is acceptable. We can switch to asynchronous streaming replication or quorum-based synchronous standbys. At the OS level, dedicating an NVMe volume with direct I/O for `pg_wal` and tuning `max_wal_size` alongside `checkpoint_completion_target = 0.9` prevents I/O spikes during checkpoints.",
    timestamp: '00:32',
  },
  {
    speaker: 'ai',
    text: "Good mitigation. Now, suppose a network partition isolates two replicas during a peak write burst. How do you prevent split-brain without sacrificing read throughput on the secondary region?",
    timestamp: '00:54',
  },
]

import LandingPage from './pages/LandingPage.jsx'

export default function App() {
  const [viewMode, setViewMode] = useState('landing') // 'landing' | 'demo'
  const [activeTab, setActiveTab] = useState('interview')
  const [interviewState, setInterviewState] = useState('speaking') // 'speaking' | 'listening' | 'thinking' | 'completed'
  const [micActive, setMicActive] = useState(true)
  const [turnCount, setTurnCount] = useState(2)
  const [audioMeter, setAudioMeter] = useState(65)

  // Subtle real-time audio meter animation
  useEffect(() => {
    const interval = setInterval(() => {
      if (interviewState === 'speaking') {
        setAudioMeter(Math.floor(40 + Math.random() * 55))
      } else if (interviewState === 'listening') {
        setAudioMeter(Math.floor(25 + Math.random() * 45))
      } else {
        setAudioMeter(10)
      }
    }, 180)
    return () => clearInterval(interval)
  }, [interviewState])

  // If in Landing Page mode, render the exact Figma Landing Page
  if (viewMode === 'landing') {
    return (
      <div className="relative">
        <LandingPage onOpenDemo={() => setViewMode('demo')} />

        {/* Floating Quick-Switch Banner */}
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setViewMode('demo')}
            className="group flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-2xl shadow-blue-500/40 hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:-translate-y-1 border border-white/20"
          >
            <Sparkles className="w-4 h-4 text-cyan-300 animate-spin" />
            <span>Launch Live Interview Simulator</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-border/80 bg-surface/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('landing')}
              className="mr-2 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-white/10 text-xs font-medium text-slate-300 border border-border flex items-center gap-1.5 transition"
              title="Return to Figma Landing Page"
            >
              ← Back to Landing Page
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 border border-white/10">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-lg tracking-tight text-white">
                  Qualify<span className="text-primary-light">AI</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-primary/20 text-primary-light border border-primary/30">
                  Simulator
                </span>
              </div>
              <p className="text-xs text-slate-400">AI-Guided Technical Recruitment & Assessment</p>
            </div>
          </div>

          {/* Navigation Pills */}
          <nav className="flex items-center gap-1 bg-surface-elevated/70 p-1 rounded-xl border border-border/60">
            <button
              onClick={() => setActiveTab('interview')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'interview'
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              Voice Interview Arena
            </button>

            <button
              onClick={() => setActiveTab('recruiter')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'recruiter'
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Recruiter Intelligence
            </button>

            <button
              onClick={() => setActiveTab('dossier')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'dossier'
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Diagnostic Dossier
            </button>

            <button
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'architecture'
                  ? 'bg-primary text-white shadow-md shadow-primary/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              System Architecture
            </button>
          </nav>

          {/* Right Status Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Audio Pipeline 840ms
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ============================================================== */}
        {/* TAB 1: AI VOICE INTERVIEW ARENA */}
        {/* ============================================================== */}
        {activeTab === 'interview' && (
          <div className="space-y-6">
            {/* Top Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-heading font-semibold text-white">
                    Live Interview: Senior Distributed Systems Engineer
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    REQ-2026-09
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Candidate: <strong className="text-slate-200">Alex Rivera</strong> • Rubric: High-Concurrency & Storage
                </p>
              </div>

              {/* State Controls for Simulation */}
              <div className="flex items-center gap-2 bg-surface-elevated/80 p-1.5 rounded-xl border border-border">
                <span className="text-[11px] font-medium text-slate-400 px-2">Voice State:</span>
                <button
                  onClick={() => setInterviewState('speaking')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    interviewState === 'speaking'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  AI Speaking
                </button>
                <button
                  onClick={() => setInterviewState('listening')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    interviewState === 'listening'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Listening
                </button>
                <button
                  onClick={() => setInterviewState('thinking')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    interviewState === 'thinking'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Reasoning
                </button>
                <button
                  onClick={() => setInterviewState('completed')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    interviewState === 'completed'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Complete
                </button>
              </div>
            </div>

            {/* Central Visualizer and Dialogue Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Visualizer Orb & Hardware Check (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Voice Visualizer Orb Card */}
                <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[380px]">
                  {/* Subtle Background Glow Rings */}
                  <div
                    className={`absolute w-64 h-64 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
                      interviewState === 'speaking'
                        ? 'bg-indigo-500/25 scale-110'
                        : interviewState === 'listening'
                        ? 'bg-sky-500/25 scale-100'
                        : interviewState === 'thinking'
                        ? 'bg-purple-500/25 scale-90'
                        : 'bg-emerald-500/20'
                    }`}
                  />

                  {/* Dynamic Status Pill */}
                  <div className="mb-8 z-10">
                    {interviewState === 'speaking' && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-xs font-medium shadow-lg shadow-indigo-500/10">
                        <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                        AI Interviewer Speaking
                      </span>
                    )}
                    {interviewState === 'listening' && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-medium shadow-lg shadow-sky-500/10">
                        <Mic className="w-3.5 h-3.5 animate-pulse" />
                        Listening to Candidate...
                      </span>
                    )}
                    {interviewState === 'thinking' && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-medium shadow-lg shadow-purple-500/10">
                        <Activity className="w-3.5 h-3.5 animate-spin" />
                        Formulating Adaptive Probe...
                      </span>
                    )}
                    {interviewState === 'completed' && (
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Interview Session Concluded
                      </span>
                    )}
                  </div>

                  {/* Visualizer Interactive Core */}
                  <div className="relative z-10 w-44 h-44 rounded-full flex items-center justify-center">
                    {/* Outer Rotating Ring */}
                    <div
                      className={`absolute inset-0 rounded-full border-2 border-dashed border-white/20 transition-all duration-1000 ${
                        interviewState === 'thinking'
                          ? 'animate-spin-slow border-purple-400/50'
                          : interviewState === 'speaking'
                          ? 'border-indigo-400/30'
                          : 'border-sky-400/30'
                      }`}
                    />

                    {/* Middle Pulsing Halo */}
                    <div
                      style={{ transform: `scale(${1 + (audioMeter - 30) / 140})` }}
                      className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-150 ${
                        interviewState === 'speaking'
                          ? 'bg-gradient-to-tr from-indigo-600/80 to-purple-600/80 shadow-2xl shadow-indigo-500/40'
                          : interviewState === 'listening'
                          ? 'bg-gradient-to-tr from-sky-600/80 to-indigo-600/80 shadow-2xl shadow-sky-500/40'
                          : interviewState === 'thinking'
                          ? 'bg-gradient-to-tr from-purple-700/80 to-pink-600/80 shadow-2xl shadow-purple-500/40'
                          : 'bg-emerald-600/80'
                      }`}
                    >
                      {/* Inner Emblem */}
                      <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center border border-white/20">
                        {interviewState === 'speaking' ? (
                          <Bot className="w-9 h-9 text-indigo-300" />
                        ) : interviewState === 'listening' ? (
                          <Mic className="w-9 h-9 text-sky-300" />
                        ) : (
                          <Sparkles className="w-9 h-9 text-purple-300" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Equalizer Frequency Wave Bars */}
                  <div className="flex items-center gap-1.5 h-8 mt-8 z-10">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                      <div
                        key={i}
                        style={{
                          height: `${Math.max(15, (audioMeter * ((i % 5) + 3)) / 10)}%`,
                          transition: 'height 0.15s ease',
                        }}
                        className={`w-1.5 rounded-full ${
                          interviewState === 'speaking'
                            ? 'bg-indigo-400'
                            : interviewState === 'listening'
                            ? 'bg-sky-400'
                            : 'bg-slate-600'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Latency & Packet Statistics */}
                  <div className="mt-4 flex items-center gap-4 text-[11px] text-slate-400 font-mono z-10">
                    <span>STT: Deepgram (16kHz)</span>
                    <span>•</span>
                    <span>Turn-Taking: VAD 1.2s</span>
                    <span>•</span>
                    <span>TTS: ElevenLabs</span>
                  </div>
                </div>

                {/* Pre-Flight Hardware & Integrity Checklist */}
                <div className="glass-card rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Integrity & Device Monitor
                    </span>
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" /> All Signals Nominal
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-xl bg-surface-elevated/60 border border-border/70 flex items-center justify-between">
                      <span className="text-slate-300">Microphone</span>
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Stereo 48kHz
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-surface-elevated/60 border border-border/70 flex items-center justify-between">
                      <span className="text-slate-300">Browser Focus</span>
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-surface-elevated/60 border border-border/70 flex items-center justify-between">
                      <span className="text-slate-300">Acoustic Check</span>
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Single Speaker
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-surface-elevated/60 border border-border/70 flex items-center justify-between">
                      <span className="text-slate-300">Biometric Scoring</span>
                      <span className="text-slate-400 font-mono text-[10px]">Strictly Banned</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Dialogue Stream & Transcripts (7 cols) */}
              <div className="lg:col-span-7 flex flex-col glass-card rounded-2xl p-6 min-h-[520px]">
                <div className="flex items-center justify-between pb-4 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-primary-light" />
                    <h2 className="text-sm font-semibold text-white">Live Conversation Transcript</h2>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Turn 2 of 5</span>
                </div>

                {/* Conversation Turns List */}
                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                  {SIMULATED_DIALOGUE.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 text-sm p-4 rounded-xl border transition-all ${
                        item.speaker === 'ai'
                          ? 'bg-surface-elevated/80 border-indigo-500/30'
                          : 'bg-surface/90 border-sky-500/30'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white font-medium ${
                          item.speaker === 'ai'
                            ? 'bg-indigo-600 shadow-md shadow-indigo-600/30'
                            : 'bg-sky-600 shadow-md shadow-sky-600/30'
                        }`}
                      >
                        {item.speaker === 'ai' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-slate-200">
                            {item.speaker === 'ai' ? 'QualifyAI Interviewer' : 'Alex Rivera (Candidate)'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">{item.timestamp}</span>
                        </div>
                        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">{item.text}</p>
                      </div>
                    </div>
                  ))}

                  {/* Active Typing/Thinking Indicator */}
                  {interviewState === 'thinking' && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs animate-pulse">
                      <Sparkles className="w-4 h-4 animate-spin text-purple-400" />
                      Evaluating candidate's WAL partition answer against Rubric Category 1...
                    </div>
                  )}
                </div>

                {/* Audio Input Controls Bar */}
                <div className="pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMicActive(!micActive)}
                      className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
                        micActive
                          ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30'
                          : 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                      }`}
                    >
                      {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      {micActive ? 'Mute Mic' : 'Unmute Mic'}
                    </button>

                    <button
                      onClick={() => setInterviewState('thinking')}
                      className="px-3 py-2 rounded-xl bg-surface-elevated hover:bg-white/5 border border-border text-xs text-slate-300 font-medium transition"
                    >
                      Send Candidate Response
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('dossier')}
                      className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-lg shadow-primary/20 flex items-center gap-2 transition"
                    >
                      View Generated Dossier
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: RECRUITER INTELLIGENCE & PIPELINE */}
        {/* ============================================================== */}
        {activeTab === 'recruiter' && (
          <div className="space-y-6">
            {/* Header & Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-primary">
                <span className="text-xs text-slate-400 font-medium">Requisition Status</span>
                <p className="text-xl font-heading font-bold text-white mt-1">Active (12 Invited)</p>
                <span className="text-[11px] text-indigo-400 font-mono mt-2 block">4 Screened • 8 Scheduled</span>
              </div>

              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-emerald-500">
                <span className="text-xs text-slate-400 font-medium">Top Match Index</span>
                <p className="text-xl font-heading font-bold text-white mt-1">92% (Alex Rivera)</p>
                <span className="text-[11px] text-emerald-400 font-mono mt-2 block">Surpasses Senior Threshold</span>
              </div>

              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-sky-500">
                <span className="text-xs text-slate-400 font-medium">Avg Engineering Time Saved</span>
                <p className="text-xl font-heading font-bold text-white mt-1">6.5 hrs / req</p>
                <span className="text-[11px] text-sky-400 font-mono mt-2 block">Zero human screening calls</span>
              </div>

              <div className="glass-card p-5 rounded-2xl border-l-4 border-l-purple-500">
                <span className="text-xs text-slate-400 font-medium">Rubric Compliance</span>
                <p className="text-xl font-heading font-bold text-white mt-1">100% Grounded</p>
                <span className="text-[11px] text-purple-400 font-mono mt-2 block">JD Requirements Extracted</span>
              </div>
            </div>

            {/* Candidate Leaderboard Table */}
            <div className="glass-card rounded-2xl overflow-hidden border border-border">
              <div className="p-5 border-b border-border/80 flex items-center justify-between">
                <div>
                  <h2 className="font-heading font-semibold text-white text-base">
                    Candidate Evaluation Leaderboard
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ranked by multi-dimensional rubric score, systems depth, and integrity audit.
                  </p>
                </div>
                <button className="px-3 py-1.5 rounded-lg bg-surface-elevated text-xs font-medium text-slate-300 border border-border hover:bg-white/5 transition flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" /> Adjust Weights
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-elevated/50 text-slate-400 uppercase tracking-wider text-[11px] border-b border-border/60">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">Candidate</th>
                      <th className="py-3.5 px-4 font-semibold">Match Index</th>
                      <th className="py-3.5 px-4 font-semibold">Systems Depth</th>
                      <th className="py-3.5 px-4 font-semibold">Problem Solving</th>
                      <th className="py-3.5 px-4 font-semibold">Communication</th>
                      <th className="py-3.5 px-4 font-semibold">Integrity Check</th>
                      <th className="py-3.5 px-4 font-semibold">Recommendation</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Dossier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {SAMPLE_CANDIDATES.map((cand) => (
                      <tr key={cand.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-4 font-medium text-slate-200">
                          <div>{cand.name}</div>
                          <div className="text-[11px] text-slate-500 font-normal">{cand.role}</div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold font-mono text-xs ${
                              cand.overallScore >= 90
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : cand.overallScore >= 75
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {cand.overallScore} / 100
                          </span>
                        </td>
                        <td className="py-4 px-4 font-mono font-medium text-slate-300">{cand.techDepth}%</td>
                        <td className="py-4 px-4 font-mono font-medium text-slate-300">{cand.problemSolving}%</td>
                        <td className="py-4 px-4 font-mono font-medium text-slate-300">{cand.commScore}%</td>
                        <td className="py-4 px-4 text-slate-400 flex items-center gap-1.5 pt-5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{cand.proctoring}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              cand.status === 'Recommended'
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : cand.status === 'Strong Hire'
                                ? 'bg-sky-500/10 text-sky-300'
                                : 'bg-amber-500/10 text-amber-300'
                            }`}
                          >
                            {cand.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => setActiveTab('dossier')}
                            className="p-1.5 rounded-lg bg-surface-elevated hover:bg-primary/20 text-primary-light transition"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Generated Rubric Inspector */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-white text-base">
                    Active Job Rubric (Auto-Generated from JD)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Extracted from JD upload using OpenAI / Gemini reasoning integration
                  </p>
                </div>
                <span className="text-xs text-indigo-400 font-mono">4 Dimensions Evaluated</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SAMPLE_RUBRIC.map((rubric, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-surface-elevated/50 border border-border/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white">{rubric.category}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-primary/20 text-primary-light">
                        Weight: {rubric.weight}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-1">
                      <p>
                        <strong className="text-slate-300">Level 3 (Competent):</strong> {rubric.benchmark3}
                      </p>
                      <p>
                        <strong className="text-slate-300">Level 5 (Mastery):</strong> {rubric.benchmark5}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: CANDIDATE DIAGNOSTIC DOSSIER */}
        {/* ============================================================== */}
        {activeTab === 'dossier' && (
          <div className="space-y-6">
            {/* Dossier Header Card */}
            <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 flex items-center justify-center font-bold text-2xl text-white shadow-xl shadow-emerald-500/20">
                  92
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-heading font-bold text-white">Alex Rivera</h1>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Recommendation: Strong Hire (Top 3%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Evaluated for <strong>Senior Distributed Systems Engineer</strong> • Interview Duration: 24 mins
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-white/5 border border-border text-xs text-slate-200 font-medium transition flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-light" />
                  Export PDF Dossier
                </button>
              </div>
            </div>

            {/* Scorecard Dimensions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Technical Breakdown */}
              <div className="glass-card rounded-2xl p-6 space-y-4">
                <h3 className="font-heading font-semibold text-white text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Multi-Dimensional Competency Scores
                </h3>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium">Technical Correctness</span>
                      <span className="text-emerald-400 font-mono font-semibold">94% (Level 5)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-elevated overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '94%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium">Distributed Systems Depth & Trade-offs</span>
                      <span className="text-indigo-400 font-mono font-semibold">95% (Level 5)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-elevated overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: '95%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium">Problem-Solving Methodology</span>
                      <span className="text-sky-400 font-mono font-semibold">90% (Level 4.5)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-elevated overflow-hidden">
                      <div className="h-full bg-sky-500 rounded-full" style={{ width: '90%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium">Technical Communication Clarity</span>
                      <span className="text-purple-400 font-mono font-semibold">92% (Level 4.5)</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-elevated overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: '92%' }} />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/60 text-xs text-slate-400 leading-relaxed">
                  <strong className="text-slate-200">AI Evaluator Synthesis:</strong> Candidate demonstrated
                  exceptional depth in database kernel trade-offs, spontaneously highlighting WAL write contention
                  and checkpoint frequency before prompting. Formulated clear quorum recovery models.
                </div>
              </div>

              {/* Cited Evidence & Integrity Report */}
              <div className="space-y-6">
                <div className="glass-card rounded-2xl p-6 space-y-3">
                  <h3 className="font-heading font-semibold text-white text-base flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-primary-light" />
                    Cited Transcript Evidence
                  </h3>
                  <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border text-xs text-slate-300 italic leading-relaxed">
                    "At the OS level, dedicating an NVMe volume with direct I/O for pg_wal and tuning max_wal_size
                    alongside checkpoint_completion_target = 0.9 prevents I/O spikes during checkpoints."
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono block">
                    Grounded Criterion: PostgreSQL Internals & Concurrency Control
                  </span>
                </div>

                <div className="glass-card rounded-2xl p-6 space-y-3">
                  <h3 className="font-heading font-semibold text-white text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Interview Integrity Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-surface-elevated/50 border border-border">
                      <span className="text-slate-400 text-[11px]">Tab / Window Switches</span>
                      <p className="text-emerald-400 font-semibold text-sm mt-0.5">0 Events (100% Focused)</p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-elevated/50 border border-border">
                      <span className="text-slate-400 text-[11px]">Acoustic Anomaly Check</span>
                      <p className="text-emerald-400 font-semibold text-sm mt-0.5">0 Anomalies Detected</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    * QualifyAI does not record or analyze facial expressions. Evaluated purely on objective technical dialogue.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: SYSTEM ARCHITECTURE & PIPELINE */}
        {/* ============================================================== */}
        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 rounded-2xl space-y-3">
              <h2 className="font-heading font-bold text-lg text-white">
                QualifyAI Modular Monolith Architecture
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                The repository is organized into five strict boundaries: client SPA, layered Node/Express server,
                tenant-isolated logical storage, formal governance documents, and supporting technical documentation.
              </p>
            </div>

            {/* Architecture Pipeline Map */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-5 rounded-2xl border-t-2 border-t-indigo-500 space-y-2">
                <span className="text-[11px] font-mono text-indigo-400">STAGE 1: INPUT</span>
                <h3 className="font-semibold text-sm text-white">JD Parsing & Rubric Synthesis</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Recruiter uploads PDF/text JD. LLM extracts technical requirements, frameworks, and seniority benchmarks.
                </p>
                <div className="pt-2 flex flex-wrap gap-1 text-[10px] font-mono text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-surface-elevated">OpenAI / Gemini</span>
                  <span className="px-2 py-0.5 rounded bg-surface-elevated">BullMQ Queue</span>
                </div>
              </div>

              <div className="glass-card p-5 rounded-2xl border-t-2 border-t-sky-500 space-y-2">
                <span className="text-[11px] font-mono text-sky-400">STAGE 2: REAL-TIME</span>
                <h3 className="font-semibold text-sm text-white">Conversational Voice Engine</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Microphone audio streams over WebSockets to Deepgram STT. LLM formulates adaptive probes, synthesized by ElevenLabs TTS.
                </p>
                <div className="pt-2 flex flex-wrap gap-1 text-[10px] font-mono text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-surface-elevated">Deepgram Live STT</span>
                  <span className="px-2 py-0.5 rounded bg-surface-elevated">ElevenLabs TTS</span>
                  <span className="px-2 py-0.5 rounded bg-surface-elevated">&lt; 1200ms Latency</span>
                </div>
              </div>

              <div className="glass-card p-5 rounded-2xl border-t-2 border-t-emerald-500 space-y-2">
                <span className="text-[11px] font-mono text-emerald-400">STAGE 3: EVALUATION</span>
                <h3 className="font-semibold text-sm text-white">Post-Interview Scoring & Dossier</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Post-interview worker scores candidate across rubric dimensions with cited transcript quotes and proctoring logs.
                </p>
                <div className="pt-2 flex flex-wrap gap-1 text-[10px] font-mono text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-surface-elevated">PostgreSQL</span>
                  <span className="px-2 py-0.5 rounded bg-surface-elevated">Prisma ORM</span>
                  <span className="px-2 py-0.5 rounded bg-surface-elevated">PDF Worker</span>
                </div>
              </div>
            </div>

            {/* Invariant Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border/80 text-xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold">
                  <Lock className="w-4 h-4" /> Multi-Tenant Isolation Rule
                </div>
                <p className="text-slate-400 leading-relaxed">
                  All database queries, storage buckets, and API transactions are segregated by <code>organizationId</code>.
                  Candidates receive short-lived single-use tokens restricted exclusively to their interview session.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border/80 text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" /> Ethical AI Invariant
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Facial expression analysis, webcam emotion scoring, and eye-tracking are strictly banned from QualifyAI.
                  Evaluations are 100% grounded in technical correctness and systems reasoning.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-surface/40 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div>
            QualifyAI Enterprise Platform • Powered by React 19, Vite, Tailwind CSS & Modular Node Services
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>Deepgram STT</span>
            <span>•</span>
            <span>OpenAI / Gemini Reasoning</span>
            <span>•</span>
            <span>ElevenLabs TTS</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

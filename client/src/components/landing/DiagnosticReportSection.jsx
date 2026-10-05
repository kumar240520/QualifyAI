import React, { useState } from 'react'
import { ThumbsUp, TrendingUp, Mic, PlayCircle, PauseCircle, Sparkles, Award, Volume2 } from 'lucide-react'
import BorderGlow from '../common/BorderGlow.jsx'
import SplitFlapText from '../common/SplitFlapText.jsx'

export default function DiagnosticReportSection({ onOpenDemo }) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  return (
    <section className="py-24 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/70 border-b border-slate-200/80 relative overflow-hidden">
      {/* Parallax Ambient Orbs */}
      <div className="absolute top-1/4 right-5 w-80 h-80 bg-emerald-200/20 blur-3xl -z-10 rounded-full animate-float-slow pointer-events-none" />
      <div className="absolute bottom-10 left-5 w-96 h-96 bg-blue-200/20 blur-3xl -z-10 rounded-full animate-float-reverse-slow pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Value Prop (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold uppercase tracking-wider shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
              EMPOWERING SOFTWARE ENGINEERS
            </div>

            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.3]">
              Candidate Diagnostic Reports: Real Growth Instead of
              <span className="block mt-2">
                <SplitFlapText
                  words={['REJECTIONS  ', 'BOILERPLATE ', 'NO FEEDBACK ']}
                  fontSize="clamp(20px, 3.4vw, 36px)"
                  tileRadius={6}
                  gap={4}
                  tileColor="#ffffff"
                  textColor="#2563eb"
                  padTo={12}
                  cycleDelay={2700}
                />
              </span>
            </h2>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Every candidate who completes a QualifyAI interview receives transparent, high-value technical feedback. Learn where your system trade-offs were rock solid and exactly how to tighten your architecture arguments for future rounds.
            </p>

            {/* Quick Feature Perks */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">✓</span>
                Detailed trade-off analysis on storage, caches, & distributed consensus
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">✓</span>
                Speech cadence (WPM) and logical signposting clarity benchmarks
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">✓</span>
                Direct pointers to production design papers and failure scenarios
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={onOpenDemo}
                className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-xl shadow-blue-500/25 transition-all transform hover:scale-105"
              >
                <PlayCircle className="w-4 h-4 text-cyan-200" />
                Try Free Candidate Mock
              </button>
            </div>
          </div>

          {/* Right Column: Diagnostic Report Card (7 cols) */}
          <div className="lg:col-span-7">
            <BorderGlow
              glowColor="cyan"
              backgroundColor="#ffffff"
              borderRadius={28}
              className="border border-slate-200/90 shadow-2xl"
            >
              <div className="p-6 sm:p-8 space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono font-bold text-slate-800 tracking-wide">
                      PERSONAL DIAGNOSTIC REPORT • MAYA PATEL
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs text-amber-800 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-mono">
                      Top 7% Distributed Systems
                    </span>
                  </div>
                </div>

                {/* Block 1: Verified Strengths (Emerald) */}
                <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <ThumbsUp className="w-4 h-4 text-emerald-600" />
                      VERIFIED STRENGTHS • SYSTEM ARCHITECTURE
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      SCORE 94/100
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                    "Superb grasp of distributed consensus and write-ahead logs. Successfully highlighted the exact trade-off between write amplification and query performance when implementing partial index tables."
                  </p>
                </div>

                {/* Block 2: Recommended Growth Area (Amber / Orange) */}
                <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <TrendingUp className="w-4 h-4 text-amber-700" />
                      RECOMMENDED GROWTH AREA • FAILOVER MODES
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                      HIGH PRIORITY
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                    "Clarify failover implications before diving into storage engine internals. When discussing PostgreSQL replication lag, outline heartbeat timeout thresholds before suggesting synchronous replica overrides."
                  </p>
                </div>

                {/* Block 3: Articulation & Cadence (Violet / Indigo) */}
                <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                      <Mic className="w-4 h-4 text-indigo-700" />
                      ARTICULATION & CADENCE
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded">
                      138 WPM • STEADY
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                    "Smooth cadence at 138 WPM with minimal hesitation. Logical signposting ('First, on the network tier... Second, at disk persistence...') made complex concepts effortless to follow."
                  </p>
                </div>

                {/* Interactive Audio Snippet Player */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-blue-50/50 to-indigo-50/50 border border-slate-200 text-slate-900 flex items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                      className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-all shadow-md shadow-blue-500/20 shrink-0"
                    >
                      {isPlayingAudio ? (
                        <PauseCircle className="w-5 h-5 text-white" />
                      ) : (
                        <PlayCircle className="w-5 h-5 text-white" />
                      )}
                    </button>
                    <div>
                      <span className="text-xs font-mono font-bold text-blue-900 block">
                        {isPlayingAudio ? 'Playing Interview Audio Snippet (0:12 / 0:45)' : 'Listen to AI Examiner Feedback Snippet'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Deepgram Nova-2 + ElevenLabs Natural Voice
                      </span>
                    </div>
                  </div>

                  {/* Animated Audio Equalizer Bars */}
                  <div className="flex items-center gap-1">
                    {[20, 45, 80, 50, 95, 30, 70, 40].map((h, i) => (
                      <div
                        key={i}
                        style={{
                          height: isPlayingAudio ? `${Math.max(15, (h * Math.random()).toFixed(0))}px` : '10px',
                        }}
                        className="w-1 bg-blue-600 rounded-full transition-all duration-150"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </BorderGlow>
          </div>
        </div>
      </div>
    </section>
  )
}

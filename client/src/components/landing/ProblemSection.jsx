import React, { useState } from 'react'
import { Clock, Sliders, FileCode, ShieldAlert, ArrowRight, Zap, CheckCircle2, XCircle } from 'lucide-react'
import BorderGlow from '../common/BorderGlow.jsx'
import RotatingText from '../common/RotatingText.jsx'

const PROBLEMS = [
  {
    tag: 'THE BOTTLENECK',
    title: 'Manual Engineering Drain',
    description:
      'Senior engineers lose 10+ hours every week conducting repetitive preliminary screens instead of building core architecture and shipping revenue-critical features.',
    icon: Clock,
    accent: 'from-rose-500 via-pink-500 to-orange-500',
    glowColor: 'rose',
    tagColor: 'bg-rose-50 text-rose-700 border-rose-200',
    iconBg: 'bg-rose-500/10 text-rose-600 border-rose-200',
    stat: '10+ hrs/wk',
    statLabel: 'Engineering lost per interviewer',
  },
  {
    tag: 'THE BIAS',
    title: 'Subjective & Inconsistent Review',
    description:
      'Scoring fluctuates wildly depending on interviewer mood, cognitive fatigue, and arbitrary follow-ups. True candidate competency gets lost in unstructured feedback.',
    icon: Sliders,
    accent: 'from-amber-500 via-orange-500 to-yellow-500',
    glowColor: 'amber',
    tagColor: 'bg-amber-50 text-amber-700 border-amber-200',
    iconBg: 'bg-amber-500/10 text-amber-600 border-amber-200',
    stat: '±42% variance',
    statLabel: 'Inter-rater evaluation inconsistency',
  },
  {
    tag: 'THE RIGIDITY',
    title: 'Static, Scripted Questionnaires',
    description:
      'Memorized algorithmic puzzles test syntactic recall rather than real-world systems thinking, concurrency trade-offs, or production debugging acumen.',
    icon: FileCode,
    accent: 'from-purple-500 via-violet-500 to-indigo-500',
    glowColor: 'violet',
    tagColor: 'bg-purple-50 text-purple-700 border-purple-200',
    iconBg: 'bg-purple-500/10 text-purple-600 border-purple-200',
    stat: '85% rote memorization',
    statLabel: 'Tests LeetCode tricks over real code',
  },
  {
    tag: 'THE FRUSTRATION',
    title: 'Zero Feedback & Remote Cheating',
    description:
      'Job seekers get ghosted with boilerplate rejections, while remote hiring teams face unverified AI ghost-writing and proxy test takers without clear integrity signals.',
    icon: ShieldAlert,
    accent: 'from-rose-600 via-red-500 to-pink-600',
    glowColor: 'rose',
    tagColor: 'bg-red-50 text-red-700 border-red-200',
    iconBg: 'bg-red-500/10 text-red-600 border-red-200',
    stat: '73% ghosted',
    statLabel: 'Candidates receiving zero actionable feedback',
  },
]

export default function ProblemSection() {
  const [activeTab, setActiveTab] = useState('with') // 'before' | 'with'

  return (
    <section className="py-24 bg-gradient-to-b from-white via-slate-50/70 to-white relative overflow-hidden bg-dot-pattern">
      {/* Parallax Floating Ambient Mesh Orbs */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-rose-200/25 blur-3xl -z-10 rounded-full animate-float-slow pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-200/25 blur-3xl -z-10 rounded-full animate-float-reverse-slow pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-amber-200/15 blur-3xl -z-10 rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with Creative Badge */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold uppercase tracking-wider shadow-xs">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              THE BOTTLENECK IN TECHNICAL SCREENING
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.3] flex flex-wrap items-center gap-x-3">
              <span>Technical Hiring Shouldn't Start With</span>
              <RotatingText
                texts={['Repetitive Screening', 'Manual Fatigue', 'Subjective Bias', 'Unstructured Calls']}
                mainClassName="text-rose-600 bg-rose-50 px-3 py-1 rounded-2xl border border-rose-200 shadow-xs inline-flex overflow-hidden align-middle my-1"
                rotationInterval={2400}
              />
            </h2>
            <p className="text-base text-slate-600 leading-relaxed">
              Engineering leaders lose hundreds of productive hours to uncalibrated initial calls. Here is what breaks down — and how QualifyAI fixes it.
            </p>
          </div>

          {/* Interactive Comparison Switcher */}
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-200/70 border border-slate-300/80 shadow-inner self-start md:self-auto">
            <button
              onClick={() => setActiveTab('before')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'before'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              Traditional Screening
            </button>
            <button
              onClick={() => setActiveTab('with')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'with'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              With QualifyAI
            </button>
          </div>
        </div>

        {/* 4 Problem Cards Grid with BorderGlow */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PROBLEMS.map((prob, i) => {
            const Icon = prob.icon
            return (
              <div
                key={i}
                style={{ animationDelay: `${i * 150}ms` }}
                className="anim-delay h-full"
              >
                <BorderGlow
                  glowColor={prob.glowColor}
                  backgroundColor="#ffffff"
                  borderRadius={20}
                  glowRadius={30}
                  topAccent={prob.accent}
                  className="h-full border border-slate-200/90 shadow-sm"
                >
                  <div className="p-5 sm:p-6 flex flex-col justify-between h-full space-y-4">
                    <div>
                      {/* Icon + Tag Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shadow-xs ${prob.iconBg}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${prob.tagColor}`}>
                          {prob.tag}
                        </span>
                      </div>

                      <h3 className="font-heading font-bold text-slate-900 text-base sm:text-lg leading-snug">
                        {prob.title}
                      </h3>
                    </div>

                    {/* Bottom Metric Callout */}
                    <div className="pt-3 border-t border-slate-100">
                      <span className="text-sm sm:text-base text-slate-700 font-normal block">
                        {prob.stat}
                      </span>
                      <span className="text-[11px] text-slate-400 font-normal block">
                        {prob.statLabel}
                      </span>
                    </div>
                  </div>
                </BorderGlow>
              </div>
            )
          })}
        </div>

        {/* Live Interactive Solution Banner Underneath */}
        <div className="mt-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50/70 to-cyan-50 border border-blue-200/90 text-slate-900 shadow-xl shadow-blue-500/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-xs font-mono font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              THE QUALIFYAI PROMISE
            </div>
            <h4 className="font-heading font-bold text-lg sm:text-xl text-slate-900 leading-snug">
              Deterministic, conversational technical screening delivered in &lt;15 minutes
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Free your senior engineers to conduct final culture and offer-closing rounds. Every candidate is evaluated on real system decisions, not memorized syntax.
            </p>
          </div>

          <a
            href="#workflow"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all transform hover:scale-105"
          >
            Explore 8-Step Workflow
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  )
}

import React, { useState } from 'react'
import {
  CheckCircle2,
  ArrowRight,
  Mic,
  Building2,
  Code2,
  Sparkles,
  Repeat,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { motion } from 'motion/react'
import FlipCard from '../common/FlipCard.jsx'
import SplitFlapText from '../common/SplitFlapText.jsx'

const RECRUITER_BULLETS = [
  {
    title: 'Role-Specific Rubrics in Seconds',
    desc: 'Auto-extract requirements from job postings into calibrated scoring pillars.',
  },
  {
    title: 'Automated Screening & Leaderboard',
    desc: 'Instant, objective stack-ranking across cohorts with zero engineering fatigue.',
  },
  {
    title: 'Tamper-Proof Integrity Signals',
    desc: 'Browser tab focus & acoustic anomaly detection with full audit trails.',
  },
]

const CANDIDATE_BULLETS = [
  {
    title: 'Conversational AI Partner',
    desc: 'Engage with dynamic voice AI that listens, asks logical follow-ups, and probes depth.',
  },
  {
    title: 'Granular Diagnostic Reports',
    desc: 'Receive immediate actionable scores on system design, trade-offs, and delivery cadence.',
  },
  {
    title: 'Stress-Free Practice Space',
    desc: 'Rehearse high-stakes technical interviews at your own pace without risk of ghosting.',
  },
]

export default function DualSidedSection({ onOpenDemo }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <section
      id="dual-sided"
      className="py-24 bg-gradient-to-b from-slate-50/70 via-white to-slate-50/70 border-b border-slate-200/80 relative overflow-hidden bg-dot-pattern"
    >
      {/* Background ambient glowing orbs */}
      <div className="absolute top-1/3 left-10 w-96 h-96 bg-cyan-200/25 blur-3xl -z-10 rounded-full animate-float-slow pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-200/25 blur-3xl -z-10 rounded-full animate-float-reverse-slow pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold uppercase tracking-wider shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
            TWO SIDES, ONE UNIFIED PLATFORM
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.25]">
            Built for Velocity in Talent Acquisition &
            <span className="block mt-2">
              <SplitFlapText
                words={['ENGINEERING ', 'DUAL SIDES  ', 'TRUE CANDOR ']}
                fontSize="clamp(20px, 3.4vw, 36px)"
                tileRadius={6}
                gap={4}
                tileColor="#ffffff"
                textColor="#2563eb"
                padTo={12}
                cycleDelay={2800}
              />
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            One shared rubric engine serving two crucial perspectives. Flip the interactive card to compare the recruiter and candidate experiences.
          </p>
        </div>

        {/* Two-Column Interactive Layout: Text & Switcher on Left, FlipCard on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Context, Switcher, & CTA */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              {/* Mode Toggle Switcher */}
              <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 border border-slate-200 shadow-inner">
                <button
                  onClick={() => setFlipped(false)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    !flipped
                      ? 'bg-white text-cyan-800 shadow-sm border border-cyan-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-cyan-600" />
                  Recruiter Mode
                </button>
                <button
                  onClick={() => setFlipped(true)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    flipped
                      ? 'bg-white text-indigo-800 shadow-sm border border-indigo-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Code2 className="w-4 h-4 text-indigo-600" />
                  Candidate Mode
                </button>
              </div>

              <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 leading-snug">
                {!flipped
                  ? 'Screen 10× More Candidates with Zero Fatigue'
                  : 'Practice Real Voice Technical Interviews on Demand'}
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed">
                {!flipped
                  ? 'Standardize your technical funnel with objective, unbiased voice evaluations that automatically integrate with your existing ATS workflow.'
                  : 'Never get ghosted with generic automated rejections again. QualifyAI gives you an intelligent conversational partner with instant actionable scores.'}
              </p>
            </div>

            {/* Click to Explore Hint Box */}
            <div
              onClick={() => setFlipped(prev => !prev)}
              className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 group-hover:rotate-180 transition-transform duration-500">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block group-hover:text-blue-600 transition-colors">
                    Click to flip & explore {!flipped ? 'Candidate Mode' : 'Recruiter Mode'}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Drag card sideways or click card face directly
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-1 transition-transform">
                Flip ↻
              </span>
            </div>

            {/* Primary Action Button */}
            <div>
              {!flipped ? (
                <button
                  onClick={onOpenDemo}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-sm shadow-xl shadow-cyan-600/25 transition-all transform hover:-translate-y-0.5"
                >
                  Explore Recruiter Console
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onOpenDemo}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-sm shadow-xl shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5"
                >
                  Start Free Candidate Practice
                  <Mic className="w-4 h-4 text-cyan-200" />
                </button>
              )}
            </div>
          </div>

          {/* Right Column: React Bits 3D FlipCard */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-[560px] h-[520px]">
              <FlipCard
                flipped={flipped}
                onFlipChange={isBack => setFlipped(isBack)}
                width="100%"
                height="100%"
                radius={28}
                perspective={1200}
                tiltMax={10}
                glare={true}
                glareOpacity={0.16}
                hoverScale={1.02}
                front={
                  /* Front Face: Recruiter & Talent Leader */
                  <div className="w-full h-full bg-white flex flex-col justify-between p-7 sm:p-9 relative select-none">
                    {/* Top colored accent line directly attached to the top border */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-500" />

                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold shadow-xs">
                          <Building2 className="w-3.5 h-3.5 text-cyan-600" />
                          RECRUITERS & HIRING MANAGERS
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-slate-400">
                          Face 1 of 2
                        </span>
                      </div>

                      <h3 className="text-xl sm:text-2xl font-heading font-extrabold text-slate-900 leading-snug mb-3">
                        Autonomous Technical Funnel Acceleration
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                        Eliminate hundreds of preliminary phone screens while keeping evaluations rigorously aligned to real production requirements.
                      </p>

                      {/* Staggered Bullet Points Appearing One by One */}
                      <motion.div
                        className="space-y-4"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={{
                          hidden: { opacity: 0 },
                          visible: {
                            opacity: 1,
                            transition: { staggerChildren: 0.18, delayChildren: 0.1 },
                          },
                        }}
                      >
                        {RECRUITER_BULLETS.map((b, i) => (
                          <motion.div
                            key={i}
                            variants={{
                              hidden: { opacity: 0, x: -16 },
                              visible: {
                                opacity: 1,
                                x: 0,
                                transition: { duration: 0.45, ease: 'easeOut' },
                              },
                            }}
                            className="flex items-start gap-3"
                          >
                            <div className="w-5 h-5 rounded-full bg-cyan-100 border border-cyan-200 flex items-center justify-center shrink-0 mt-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-700" />
                            </div>
                            <div className="text-xs sm:text-sm text-slate-700 leading-snug">
                              <strong className="text-slate-900 block font-semibold">
                                {b.title}
                              </strong>
                              <span className="text-slate-500">{b.desc}</span>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    </div>

                    {/* Card Footer: Flip trigger prompt */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                        ATS Sync: Greenhouse · Lever · Ashby
                      </span>
                      <span className="font-bold text-cyan-700 font-mono text-[11px] bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">
                        Click / Drag to Flip ↻
                      </span>
                    </div>
                  </div>
                }
                back={
                  /* Back Face: Engineers & Tech Applicants */
                  <div className="w-full h-full bg-white flex flex-col justify-between p-7 sm:p-9 relative select-none">
                    {/* Top colored accent line directly attached to the top border */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                    <div>
                      {/* Card Header */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold shadow-xs">
                          <Code2 className="w-3.5 h-3.5 text-indigo-600" />
                          ENGINEERS & TECH APPLICANTS
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-slate-400">
                          Face 2 of 2
                        </span>
                      </div>

                      <h3 className="text-xl sm:text-2xl font-heading font-extrabold text-slate-900 leading-snug mb-3">
                        Realistic Voice Practice with Instant Diagnostics
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                        Practice complex architecture trade-offs with an intelligent agent that actively challenges assumptions and scores delivery objectively.
                      </p>

                      {/* Staggered Bullet Points Appearing One by One */}
                      <motion.div
                        className="space-y-4"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={{
                          hidden: { opacity: 0 },
                          visible: {
                            opacity: 1,
                            transition: { staggerChildren: 0.18, delayChildren: 0.1 },
                          },
                        }}
                      >
                        {CANDIDATE_BULLETS.map((b, i) => (
                          <motion.div
                            key={i}
                            variants={{
                              hidden: { opacity: 0, x: -16 },
                              visible: {
                                opacity: 1,
                                x: 0,
                                transition: { duration: 0.45, ease: 'easeOut' },
                              },
                            }}
                            className="flex items-start gap-3"
                          >
                            <div className="w-5 h-5 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0 mt-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-700" />
                            </div>
                            <div className="text-xs sm:text-sm text-slate-700 leading-snug">
                              <strong className="text-slate-900 block font-semibold">
                                {b.title}
                              </strong>
                              <span className="text-slate-500">{b.desc}</span>
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    </div>

                    {/* Card Footer: Flip trigger prompt */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        Instant Diagnostic Growth Report
                      </span>
                      <span className="font-bold text-indigo-700 font-mono text-[11px] bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                        Click / Drag to Flip ↻
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

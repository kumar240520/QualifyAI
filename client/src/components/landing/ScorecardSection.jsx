import React, { useState, useEffect, useRef } from 'react'
import { Award, ShieldCheck, CheckCircle } from 'lucide-react'
import { motion } from 'motion/react'
import BorderGlow from '../common/BorderGlow.jsx'
import SplitFlapText from '../common/SplitFlapText.jsx'
import CountUp from '../common/CountUp.jsx'

export default function ScorecardSection() {
  const [inView, setInView] = useState(false)
  const scorecardRef = useRef(null)

  useEffect(() => {
    const el = scorecardRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true)
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="py-24 bg-gradient-to-b from-white via-slate-50/50 to-white border-b border-slate-200/80 relative overflow-hidden bg-dot-pattern">
      {/* Background Ambient Orbs */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-indigo-200/20 blur-3xl -z-10 rounded-full animate-float-slow pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-cyan-200/20 blur-3xl -z-10 rounded-full animate-float-reverse-slow pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold uppercase tracking-wider shadow-xs">
            <Award className="w-3.5 h-3.5 text-blue-600" />
            STANDARDIZED CALIBRATION
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.3]">
            Multi-Dimensional
            <span className="block mt-2">
              <SplitFlapText
                words={['SCORECARD   ', 'RUBRIC SCORE', 'OBJECTIVITY ']}
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

          <p className="text-base text-slate-600 leading-relaxed">
            Zero subjective ambiguity. Candidate evaluations are mathematically scored across rigorous domain rubrics with complete human auditability.
          </p>
        </div>

        {/* Candidate Scorecard Card with BorderGlow */}
        <div ref={scorecardRef}>
          <BorderGlow
            glowColor="indigo"
            backgroundColor="#ffffff"
            borderRadius={28}
            className="border border-slate-200/90 shadow-2xl max-w-4xl mx-auto"
          >
            {/* Top Candidate Bar */}
            <div className="p-6 sm:p-8 bg-slate-50/80 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white flex items-center justify-center font-heading font-extrabold text-xl shadow-lg shadow-cyan-500/25">
                  MP
                </div>
                <div>
                  <h3 className="font-heading font-bold text-slate-900 text-xl flex items-center gap-2">
                    Maya Patel
                    <span className="text-[11px] font-mono font-bold bg-cyan-100 text-cyan-800 px-2.5 py-0.5 rounded-full border border-cyan-200">
                      TOP 5%
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Applied for: Staff Distributed Systems Engineer • ID: #CAND-8831
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    OVERALL COMPOSITE
                  </span>
                  <div className="font-heading font-black text-3xl bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                    <CountUp end={89} trigger={inView} duration={1.6} />
                    <span className="text-sm font-normal text-slate-400">/100</span>
                  </div>
                </div>
                <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Recommended for Onsite
                </span>
              </div>
            </div>

            {/* 4 Dimension Breakdown Cards with CountUp & Sliding Progress Bars */}
            <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dimension 1: Technical Correctness (Cyan) */}
              <div className="p-5 rounded-2xl bg-cyan-50/40 border border-cyan-200/80 space-y-3">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-900">Technical Correctness</span>
                  <span className="text-cyan-700 font-mono font-bold">
                    <CountUp end={89} trigger={inView} duration={1.5} />/100
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={inView ? { width: '89%' } : { width: '0%' }}
                    transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Accurately analyzed Raft log compaction, quorum consensus, and snapshotting mechanisms.
                </p>
              </div>

              {/* Dimension 2: Technical Depth & Trade-offs (Blue) */}
              <div className="p-5 rounded-2xl bg-blue-50/40 border border-blue-200/80 space-y-3">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-900">Technical Depth & Trade-offs</span>
                  <span className="text-blue-700 font-mono font-bold">
                    <CountUp end={84} trigger={inView} duration={1.5} delay={100} />/100
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                    initial={{ width: '0%' }}
                    animate={inView ? { width: '84%' } : { width: '0%' }}
                    transition={{ duration: 1.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Articulated memory vs write overhead trade-offs cleanly when probed on secondary indexes.
                </p>
              </div>

              {/* Dimension 3: Architectural Problem Solving (Indigo) */}
              <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-200/80 space-y-3">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-900">Architectural Problem Solving</span>
                  <span className="text-indigo-700 font-mono font-bold">
                    <CountUp end={92} trigger={inView} duration={1.5} delay={200} />/100
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                    initial={{ width: '0%' }}
                    animate={inView ? { width: '92%' } : { width: '0%' }}
                    transition={{ duration: 1.4, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Top-percentile response regarding distributed idempotency tokens and outbox patterns.
                </p>
              </div>

              {/* Dimension 4: Communication & Articulation (Emerald) */}
              <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200/80 space-y-3">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-900">Communication & Articulation</span>
                  <span className="text-emerald-700 font-mono font-bold">
                    <CountUp end={86} trigger={inView} duration={1.5} delay={300} />/100
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={inView ? { width: '86%' } : { width: '0%' }}
                    transition={{ duration: 1.4, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Direct, structured explanations without verbose rambling or evasive filler terminology.
                </p>
              </div>
            </div>

            {/* Bottom Speech Metrics Bar */}
            <div className="px-6 sm:px-8 py-5 bg-slate-50/90 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                    SPEECH PACING
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    <CountUp end={138} trigger={inView} duration={1.4} /> WPM
                  </span>{' '}
                  <span className="text-slate-500 text-[11px] font-medium">(Optimal 130–155)</span>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                    FILLER WORDS
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    <CountUp end={3} trigger={inView} duration={1.2} /> / min
                  </span>{' '}
                  <span className="text-slate-500 text-[11px] font-medium">(Low)</span>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                    LATENCY RESPONSE
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    <CountUp end={1.1} decimals={1} trigger={inView} duration={1.3} />s avg
                  </span>{' '}
                  <span className="text-slate-500 text-[11px] font-medium">(Natural)</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Audio Anomaly Scan:</span>
                <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Pass • Clean Stream
                </span>
              </div>
            </div>
          </BorderGlow>
        </div>
      </div>
    </section>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import BorderGlow from '../common/BorderGlow.jsx'
import TextType from '../common/TextType.jsx'
import CountUp from '../common/CountUp.jsx'
import { Sparkles, TrendingUp, Clock, Users, CheckCircle2 } from 'lucide-react'

const METRICS = [
  {
    countProps: {
      end: 80,
      suffix: '%',
    },
    title: 'Screening Time Saved',
    description:
      'Reduction in senior engineering hours spent conducting repetitive preliminary phone screens.',
    gradient: 'from-cyan-500 to-blue-600',
    glowColor: 'cyan',
    icon: Clock,
    badge: '10+ hrs/wk saved',
  },
  {
    countProps: {
      prefix: '<',
      end: 1.2,
      decimals: 1,
      suffix: 's',
    },
    title: 'Voice Latency Round-Trip',
    description:
      'Deepgram Nova-2 speech recognition, streaming GPT-4o context evaluation, and ElevenLabs TTS.',
    gradient: 'from-blue-600 to-indigo-600',
    glowColor: 'blue',
    icon: TrendingUp,
    badge: 'True Conversational Tempo',
  },
  {
    countProps: {
      end: 1000,
      separator: ',',
      suffix: '+',
    },
    title: 'Concurrent Interviews',
    description:
      'Distributed WebSocket cluster ready for peak campus hiring and global enterprise requisition surges.',
    gradient: 'from-indigo-600 to-purple-600',
    glowColor: 'indigo',
    icon: Users,
    badge: 'Zero Queue Backpressure',
  },
  {
    countProps: {
      end: 100,
      suffix: '%',
    },
    title: 'Objective Rubric Coverage',
    description:
      'Every question scored deterministically against calibrated pillars with zero human bias or cognitive fatigue.',
    gradient: 'from-emerald-500 to-teal-600',
    glowColor: 'emerald',
    icon: CheckCircle2,
    badge: 'EEOC & GDPR Calibrated',
  },
]

export default function MetricsSection() {
  const [inView, setInView] = useState(false)
  const metricsRef = useRef(null)

  useEffect(() => {
    const el = metricsRef.current
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
    <section className="py-24 bg-gradient-to-b from-white via-slate-50 to-white border-b border-slate-200/80 relative overflow-hidden bg-grid-pattern">
      {/* Ambient Parallax Orbs */}
      <div className="absolute top-1/2 left-10 w-96 h-96 bg-cyan-200/20 blur-3xl -z-10 rounded-full animate-float-slow pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-purple-200/20 blur-3xl -z-10 rounded-full animate-float-reverse-slow pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold uppercase tracking-wider shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            MEASURABLE HIRING ACCELERATION
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.3]">
            Proven Impact &
            <span className="block mt-1 sm:mt-2 text-blue-600">
              <TextType
                text={['Projected Metrics at Scale', '80% Engineering Time Saved', '1,000+ Concurrent Streams']}
                typingSpeed={38}
                deletingSpeed={22}
                pauseDuration={2000}
                showCursor={true}
                cursorCharacter="|"
                cursorClassName="text-blue-600 font-bold"
                className="inline-block text-blue-600"
              />
            </span>
          </h2>
          <p className="text-base text-slate-600">
            Engineered to remove recruiting friction while surfacing exceptional engineering talent without compromise.
          </p>
        </div>

        {/* 4 Metrics Cards with BorderGlow & Staggered CountUp */}
        <div ref={metricsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {METRICS.map((m, i) => {
            const Icon = m.icon
            return (
              <div
                key={i}
                style={{ animationDelay: `${i * 120}ms` }}
                className="anim-delay h-full"
              >
                <BorderGlow
                  glowColor={m.glowColor}
                  backgroundColor="#ffffff"
                  borderRadius={24}
                  topAccent={m.gradient}
                  className="h-full border border-slate-200/90 shadow-sm"
                >
                  <div className="p-7 sm:p-8 flex flex-col justify-between h-full">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 shadow-xs">
                          <Icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                          {m.badge}
                        </span>
                      </div>

                      <span className={`font-heading font-black text-5xl sm:text-6xl bg-gradient-to-r ${m.gradient} bg-clip-text text-transparent block mb-3 tracking-tight`}>
                        <CountUp
                          {...m.countProps}
                          trigger={inView}
                          duration={1.6}
                          delay={i * 120}
                        />
                      </span>

                      <h3 className="font-heading font-bold text-slate-900 text-base sm:text-lg mb-2">
                        {m.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {m.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Validated in Production
                    </div>
                  </div>
                </BorderGlow>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

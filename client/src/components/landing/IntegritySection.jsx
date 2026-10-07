import React from 'react'
import { Eye, Volume2, ShieldCheck, CheckCircle2, Shield, Lock, Activity, Sparkles } from 'lucide-react'
import BorderGlow from '../common/BorderGlow.jsx'
import RotatingText from '../common/RotatingText.jsx'

const INTEGRITY_CARDS = [
  {
    title: 'Browser Focus & Tab Visibility',
    description:
      'Monitors document visibility state changes during active questioning. Flags instances where candidate leaves window to browse search engines or AI assistants.',
    tag: 'Non-invasive window tracking',
    icon: Eye,
    glowColor: 'cyan',
    accent: 'from-cyan-500 to-blue-500',
    stat: '99.8% In-Focus',
    statDetail: '0 unprompted blur events detected',
    badge: 'Window Telemetry',
  },
  {
    title: 'Acoustic Anomaly & Secondary Voice',
    description:
      'Multi-speaker diarization detects background coaching, secondary whisper streams, and synthetic audio loopbacks in real-time.',
    tag: 'Multi-speaker diarization',
    icon: Volume2,
    glowColor: 'indigo',
    accent: 'from-indigo-500 to-violet-500',
    stat: '1 Voice Stream',
    statDetail: 'Clean 24kHz spectral separation',
    badge: 'Acoustic Diarization',
  },
  {
    title: 'Composite Trust Signal Indicator',
    description:
      'Scores trust as Low Risk or Review Recommended. Provides recruiters with precise timestamps to inspect rather than automated auto-rejection.',
    tag: 'Human-in-the-loop audit trail',
    icon: ShieldCheck,
    glowColor: 'emerald',
    accent: 'from-emerald-500 to-teal-500',
    stat: '98/100 Trust Score',
    statDetail: 'Zero disqualifying anomalies',
    badge: 'Tamper-Proof Audit',
  },
]

export default function IntegritySection() {
  return (
    <section id="integrity" className="py-24 bg-gradient-to-b from-slate-50/80 via-white to-slate-50/80 border-b border-slate-200/80 relative overflow-hidden">
      {/* Background Radar Sweep Animation */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] pointer-events-none opacity-20 -z-10">
        <div className="w-full h-full rounded-full border border-cyan-500/30 flex items-center justify-center">
          <div className="w-3/4 h-3/4 rounded-full border border-blue-500/25 flex items-center justify-center">
            <div className="w-1/2 h-1/2 rounded-full border border-indigo-500/20" />
          </div>
        </div>
        <div className="absolute inset-0 animate-radar pointer-events-none">
          <div className="w-1/2 h-1/2 bg-gradient-to-br from-cyan-400/20 to-transparent rounded-tl-full" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider shadow-xs">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            UNCOMPROMISING ETHICAL INTEGRITY
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.3] flex flex-wrap items-center justify-center gap-x-3">
            <span>Assessment Integrity with</span>
            <RotatingText
              texts={['Ethical Signals', 'Non-Invasive Review', 'Zero Spyware', 'Anti-Ghostwriting']}
              mainClassName="text-emerald-700 bg-emerald-50 px-3 py-1 rounded-2xl border border-emerald-200 shadow-xs inline-flex overflow-hidden align-middle my-1"
              rotationInterval={2400}
            />
            <span>for Human Review</span>
          </h2>

          <p className="text-base text-slate-600 leading-relaxed">
            QualifyAI strictly avoids controversial facial micro-expression scoring. We rely on objective browser visibility tracking and acoustic stream anomaly detection to assist human hiring teams.
          </p>
        </div>

        {/* 3 Integrity Cards Grid with BorderGlow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {INTEGRITY_CARDS.map((card, i) => {
            const Icon = card.icon
            return (
              <div
                key={i}
                style={{ animationDelay: `${i * 150}ms` }}
                className="anim-delay h-full"
              >
                <BorderGlow
                  glowColor={card.glowColor}
                  backgroundColor="#ffffff"
                  borderRadius={28}
                  topAccent={card.accent}
                  className="h-full border border-slate-200/90 shadow-sm"
                >
                  <div className="p-7 sm:p-8 flex flex-col justify-between h-full">
                    <div>
                      {/* Header */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-800 shadow-xs">
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 text-slate-700">
                          {card.badge}
                        </span>
                      </div>

                      <h3 className="font-heading font-bold text-slate-900 text-xl mb-3">
                        {card.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                        {card.description}
                      </p>

                      {/* Live Telemetry Pill Container */}
                      <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-1 shadow-inner">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            {card.stat}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded">
                            VERIFIED
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {card.statDetail}
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-blue-600">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>{card.tag}</span>
                    </div>
                  </div>
                </BorderGlow>
              </div>
            )
          })}
        </div>

        {/* Ethical Charter Guarantee Ribbon */}
        <div className="mt-12 p-6 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50/60 to-slate-50 text-slate-900 border border-emerald-200 shadow-lg shadow-emerald-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-sm sm:text-base text-slate-900 leading-snug">
                Zero Facial Emotion or Pseudoscientific Micro-Expression AI
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                QualifyAI evaluates technical argumentation, code reasoning, and system trade-offs — never physical features.
              </p>
            </div>
          </div>

          <div className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-emerald-200 text-xs font-mono font-bold text-emerald-800 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            EEOC & GDPR AUDITED
          </div>
        </div>
      </div>
    </section>
  )
}

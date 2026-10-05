import React from 'react'
import {
  Code2,
  RefreshCw,
  Database,
  Radio,
  Brain,
  Layers,
  ShieldCheck,
  Lock,
  Trash2,
  Shield,
  Server,
  Zap,
} from 'lucide-react'
import BorderGlow from '../common/BorderGlow.jsx'
import RotatingText from '../common/RotatingText.jsx'

const TECH_STACK = [
  {
    name: 'Next.js & React 19',
    label: 'Client Streaming',
    spec: 'Concurrent Rendering',
    icon: Code2,
    glowColor: 'blue',
    iconColor: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  {
    name: 'Socket.io & WS',
    label: 'Bi-Directional Audio',
    spec: 'Sub-80ms Transport',
    icon: RefreshCw,
    glowColor: 'cyan',
    iconColor: 'text-cyan-600 bg-cyan-50 border-cyan-200',
  },
  {
    name: 'Deepgram Nova-2',
    label: 'Conversational STT',
    spec: 'Sub-220ms Transcripts',
    icon: Radio,
    glowColor: 'indigo',
    iconColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  },
  {
    name: 'OpenAI GPT-4o',
    label: 'Adaptive Reasoning',
    spec: 'Streaming Tokens',
    icon: Brain,
    glowColor: 'violet',
    iconColor: 'text-violet-600 bg-violet-50 border-violet-200',
  },
  {
    name: 'BullMQ & Redis',
    label: 'Queue Pipeline',
    spec: 'Async Evaluation',
    icon: Layers,
    glowColor: 'rose',
    iconColor: 'text-rose-600 bg-rose-50 border-rose-200',
  },
  {
    name: 'PostgreSQL + RLS',
    label: 'Tenant Isolation',
    spec: 'Zero Cross-Leakage',
    icon: Database,
    glowColor: 'emerald',
    iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
]

const SECURITY_PILLARS = [
  {
    title: 'SOC2 Type II Aligned',
    description: 'Continuous independent third-party audits, access logging, and immutable infrastructure controls.',
    icon: ShieldCheck,
    tag: 'Continuous Audit',
    glowColor: 'cyan',
  },
  {
    title: 'End-to-End Encryption',
    description: 'AES-256 for all stored audio artifacts and TLS 1.3 in-transit over encrypted WebSocket connections.',
    icon: Lock,
    tag: 'AES-256 / TLS 1.3',
    glowColor: 'blue',
  },
  {
    title: 'Automated GDPR Purge',
    description: 'Configurable enterprise retention schedules with single-click automated candidate wiping and audit confirmation.',
    icon: Trash2,
    tag: 'One-Click Purge',
    glowColor: 'amber',
  },
  {
    title: 'Row-Level Security (RLS)',
    description: 'Database-enforced tenant isolation guarantees organizationId boundaries cannot be breached under any query.',
    icon: Shield,
    tag: 'Multi-Tenant Boundary',
    glowColor: 'emerald',
  },
]

export default function TechSecuritySection() {
  return (
    <section id="security" className="py-24 bg-white border-b border-slate-200/80 relative overflow-hidden bg-dot-pattern">
      {/* Ambient Parallax Mesh Orbs */}
      <div className="absolute top-10 left-1/3 w-[500px] h-[300px] bg-blue-200/20 blur-3xl -z-10 rounded-full animate-float-slow pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[300px] bg-cyan-200/20 blur-3xl -z-10 rounded-full animate-float-reverse-slow pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold uppercase tracking-wider shadow-xs">
            <Server className="w-3.5 h-3.5 text-blue-600" />
            RESILIENT CLOUD INFRASTRUCTURE
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.3] flex flex-wrap items-center justify-center gap-x-3">
            <span>Technology Architecture &</span>
            <RotatingText
              texts={['Enterprise Security', 'SOC2 Readiness', 'Zero Data Retention', 'End-to-End Encryption']}
              mainClassName="text-blue-600 bg-blue-50 px-3 py-1 rounded-2xl border border-blue-200 shadow-xs inline-flex overflow-hidden align-middle my-1"
              rotationInterval={2400}
            />
          </h2>

          <p className="text-base text-slate-600 leading-relaxed">
            Engineered for mission-critical recruitment at global scale. Ultra-low latency voice streaming matched with rigorous data privacy and compliance.
          </p>
        </div>

        {/* Tech Stack 6 Cards Grid with BorderGlow */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {TECH_STACK.map((tech, i) => {
            const Icon = tech.icon
            return (
              <div
                key={i}
                style={{ animationDelay: `${i * 100}ms` }}
                className="anim-delay"
              >
                <BorderGlow
                  glowColor={tech.glowColor}
                  backgroundColor="#ffffff"
                  borderRadius={16}
                  glowRadius={30}
                  className="h-full border border-slate-200/90 shadow-xs"
                >
                  <div className="p-5 text-center space-y-3 flex flex-col justify-between h-full">
                    <div>
                      <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center mx-auto shadow-xs mb-3 ${tech.iconColor}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <h4 className="font-heading font-bold text-slate-900 text-xs sm:text-sm">
                        {tech.name}
                      </h4>
                      <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                        {tech.label}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {tech.spec}
                      </span>
                    </div>
                  </div>
                </BorderGlow>
              </div>
            )
          })}
        </div>

        {/* Enterprise Security 4 Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SECURITY_PILLARS.map((item, i) => {
            const Icon = item.icon
            return (
              <div
                key={i}
                style={{ animationDelay: `${i * 120}ms` }}
                className="anim-delay"
              >
                <BorderGlow
                  glowColor={item.glowColor}
                  backgroundColor="#ffffff"
                  borderRadius={24}
                  glowRadius={35}
                  topAccent={item.glowColor === 'cyan' ? 'from-cyan-500 to-blue-500' : item.glowColor === 'blue' ? 'from-blue-500 to-indigo-500' : item.glowColor === 'amber' ? 'from-amber-500 to-orange-500' : 'from-emerald-500 to-teal-500'}
                  className="h-full border border-slate-200/90 shadow-sm"
                >
                  <div className="p-7 flex flex-col justify-between h-full space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-800 flex items-center justify-center shadow-xs">
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                          {item.tag}
                        </span>
                      </div>

                      <h4 className="font-heading font-bold text-slate-900 text-base sm:text-lg">
                        {item.title}
                      </h4>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Hardened & Continuously Monitored</span>
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

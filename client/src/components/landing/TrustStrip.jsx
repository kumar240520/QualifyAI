import React from 'react'
import { CheckCircle2, Zap, Brain, Mic, ShieldCheck, FileSpreadsheet, Sparkles } from 'lucide-react'

const CAPABILITIES = [
  { text: 'JD Intelligence & Taxonomy Parsing', icon: Brain, color: 'text-blue-600' },
  { text: 'Adaptive Multi-Turn Follow-Ups', icon: Sparkles, color: 'text-indigo-600' },
  { text: 'Real-Time Voice (<1.2s round-trip)', icon: Mic, color: 'text-cyan-600' },
  { text: 'Quantitative 0–100 Rubrics', icon: FileSpreadsheet, color: 'text-violet-600' },
  { text: 'Acoustic & Focus Integrity Signals', icon: ShieldCheck, color: 'text-emerald-600' },
  { text: 'Instant Diagnostic Growth Reports', icon: Zap, color: 'text-amber-600' },
]

export default function TrustStrip() {
  return (
    <section className="py-7 bg-white border-b border-slate-200/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-3.5">
          {CAPABILITIES.map((cap, i) => {
            const Icon = cap.icon
            return (
              <div
                key={i}
                style={{ animationDelay: `${i * 60}ms` }}
                className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-50/90 border border-slate-200 text-slate-800 text-xs sm:text-[13px] font-semibold shadow-xs hover:border-blue-400 hover:bg-white hover:shadow-md hover:-translate-y-0.5 transition-all cursor-default"
              >
                <Icon className={`w-4 h-4 shrink-0 ${cap.color}`} />
                <span>{cap.text}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

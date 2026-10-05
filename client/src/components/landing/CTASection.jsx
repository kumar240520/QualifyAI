import React from 'react'
import { Rocket, ArrowRight, Mic, Calendar, Sparkles, ShieldCheck, Zap, Headphones } from 'lucide-react'
import BorderGlow from '../common/BorderGlow.jsx'
import RotatingText from '../common/RotatingText.jsx'

export default function CTASection({ onOpenDemo }) {
  return (
    <section id="cta" className="py-28 relative overflow-hidden bg-gradient-to-b from-slate-50 via-cyan-50/40 to-blue-50/40 border-b border-slate-200/80 bg-aurora">
      {/* Background ambient decorative glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[450px] bg-gradient-to-tr from-cyan-300/30 via-indigo-300/30 to-purple-300/30 blur-3xl -z-10 rounded-full animate-pulse-slow pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Floating 3D Parallax Badges */}
        <div className="absolute -top-6 left-4 z-20 hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-cyan-200 shadow-xl shadow-cyan-500/10 animate-float text-xs font-semibold text-slate-800">
          <Zap className="w-4 h-4 text-cyan-600" />
          <span>Round-Trip: <strong className="text-cyan-700">&lt;1.2s</strong></span>
        </div>

        <div className="absolute -top-6 right-4 z-20 hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-purple-200 shadow-xl shadow-purple-500/10 animate-float-reverse text-xs font-semibold text-slate-800">
          <ShieldCheck className="w-4 h-4 text-purple-600" />
          <span>SOC2 Type II Aligned</span>
        </div>

        <div className="absolute -bottom-6 left-12 z-20 hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/95 backdrop-blur-md border border-emerald-200 shadow-xl shadow-emerald-500/10 animate-float-reverse text-xs font-semibold text-slate-800">
          <Headphones className="w-4 h-4 text-emerald-600" />
          <span>24kHz Studio Audio</span>
        </div>

        {/* Elevated Cosmic Container with BorderGlow */}
        <BorderGlow
          glowColor="indigo"
          backgroundColor="#ffffff"
          borderRadius={28}
          glowRadius={45}
          topAccent="from-blue-600 via-indigo-600 to-purple-600"
          className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-2xl shadow-blue-500/15 text-center relative overflow-hidden"
        >
          <div className="p-8 sm:p-14 space-y-8 relative">
            {/* Subtle Corner Ambient Mesh */}
            <div className="absolute -top-20 -left-20 w-60 h-60 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-purple-400/20 rounded-full blur-2xl pointer-events-none" />

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-bold uppercase tracking-wider shadow-xs">
            <Rocket className="w-3.5 h-3.5 text-cyan-600" />
            TRANSFORM YOUR TECHNICAL HIRING FUNNEL
          </div>

          {/* Headline */}
          <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.22] flex flex-wrap items-center justify-center gap-x-3">
            <span>Build Better Technical Interviews With</span>
            <RotatingText
              texts={['QualifyAI', 'Voice Intelligence', 'Autonomous Calibration', 'Zero Bias']}
              mainClassName="text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-2xl border border-indigo-200 shadow-xs inline-flex overflow-hidden align-middle my-1"
              rotationInterval={2400}
            />
          </h2>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Whether you are screening thousands of global software applicants or sharpening your own system design answers, QualifyAI delivers instantaneous, calibrated intelligence.
          </p>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={onOpenDemo}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-sm shadow-xl shadow-blue-500/25 transition-all transform hover:-translate-y-1 hover:shadow-2xl"
            >
              Screen Candidates with AI
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenDemo}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-sm shadow-sm transition-all hover:border-slate-300 transform hover:-translate-y-0.5"
            >
              <Mic className="w-4 h-4 text-blue-600" />
              Try Candidate Mock Interview
            </button>
          </div>

          {/* Calendar Link */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm text-slate-600 font-medium">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Need a custom enterprise rollout?</span>
            <button
              onClick={onOpenDemo}
              className="text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-4"
            >
              Book a private demo with our architecture team
            </button>
          </div>
        </div>
      </BorderGlow>
    </div>
  </section>
)
}

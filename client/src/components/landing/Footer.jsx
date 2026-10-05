import React from 'react'
import { Sparkles, CheckCircle2 } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200/90 text-slate-600 text-xs pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Top Status & Brand Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-heading font-extrabold text-xl text-slate-900">
                Qualify<span className="text-blue-600">AI</span>
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Autonomous Low-Latency Voice Intelligence for Technical Recruiting
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 font-mono text-xs shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-emerald-700">ALL SYSTEMS OPERATIONAL</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-bold">Low Latency &lt;1.2s</span>
          </div>
        </div>

        {/* 5 Columns Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Col 1 */}
          <div className="space-y-3">
            <span className="font-heading font-bold text-slate-900 uppercase tracking-wider text-xs block">
              PRODUCT
            </span>
            <ul className="space-y-2 text-slate-600">
              <li><a href="#features" className="hover:text-blue-600 transition">Features</a></li>
              <li><a href="#workflow" className="hover:text-blue-600 transition">How It Works</a></li>
              <li><a href="#rubrics" className="hover:text-blue-600 transition">JD Intelligence</a></li>
              <li><a href="#voice-engine" className="hover:text-blue-600 transition">Voice Engine</a></li>
              <li><a href="#rubrics" className="hover:text-blue-600 transition">Rubrics & Scoring</a></li>
            </ul>
          </div>

          {/* Col 2 */}
          <div className="space-y-3">
            <span className="font-heading font-bold text-slate-900 uppercase tracking-wider text-xs block">
              FOR RECRUITERS
            </span>
            <ul className="space-y-2 text-slate-600">
              <li><a href="#dual-sided" className="hover:text-blue-600 transition">Role Profiling</a></li>
              <li><a href="#dual-sided" className="hover:text-blue-600 transition">Candidate Leaderboard</a></li>
              <li><a href="#dual-sided" className="hover:text-blue-600 transition">Integrity Review</a></li>
              <li><a href="#dual-sided" className="hover:text-blue-600 transition">ATS Export</a></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-3">
            <span className="font-heading font-bold text-slate-900 uppercase tracking-wider text-xs block">
              FOR CANDIDATES
            </span>
            <ul className="space-y-2 text-slate-600">
              <li><a href="#dual-sided" className="hover:text-blue-600 transition">AI Voice Mock</a></li>
              <li><a href="#dual-sided" className="hover:text-blue-600 transition">Diagnostic Reports</a></li>
              <li><a href="#dual-sided" className="hover:text-blue-600 transition">Speech Analytics</a></li>
              <li><a href="#dual-sided" className="hover:text-blue-600 transition">Transparent Feedback</a></li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-3">
            <span className="font-heading font-bold text-slate-900 uppercase tracking-wider text-xs block">
              TECHNOLOGY & SECURITY
            </span>
            <ul className="space-y-2 text-slate-600">
              <li><a href="#security" className="hover:text-blue-600 transition">WebSocket Pipeline</a></li>
              <li><a href="#security" className="hover:text-blue-600 transition">Deepgram & GPT-4o</a></li>
              <li><a href="#security" className="hover:text-blue-600 transition">Multi-tenant RLS</a></li>
              <li><a href="#security" className="hover:text-blue-600 transition">SOC2 Type II Certified</a></li>
            </ul>
          </div>

          {/* Col 5 */}
          <div className="space-y-3">
            <span className="font-heading font-bold text-slate-900 uppercase tracking-wider text-xs block">
              RESOURCES & LEGAL
            </span>
            <ul className="space-y-2 text-slate-600">
              <li><a href="#" className="hover:text-blue-600 transition">Documentation</a></li>
              <li><a href="#" className="hover:text-blue-600 transition">API Reference</a></li>
              <li><a href="#" className="hover:text-blue-600 transition">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-blue-600 transition">Terms of Service</a></li>
              <li><a href="#" className="hover:text-blue-600 transition">Ethical AI Charter</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright & Compliance Badges */}
        <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            © 2025 QualifyAI Technologies Inc. All rights reserved. Orchestrated for objective talent intelligence.
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-white border border-slate-200 font-mono text-[10px] font-semibold text-slate-700">
              ISO/IEC 27001
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-slate-200 font-mono text-[10px] font-semibold text-slate-700">
              GDPR COMPLIANT
            </span>
            <span className="px-3 py-1 rounded-full bg-white border border-slate-200 font-mono text-[10px] font-semibold text-slate-700">
              EEOC AUDITED
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

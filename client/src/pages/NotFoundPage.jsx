import React from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, ArrowLeft, Home, Search } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F3] text-slate-900 font-sans flex flex-col justify-between p-6 select-none">
      {/* Top Header */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between pb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/80 hover:bg-white text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-xs transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
          <span>Back to Home</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-heading font-extrabold text-sm tracking-tight text-slate-900">
            Qualify<span className="text-blue-600">AI</span>
          </span>
        </div>
      </div>

      {/* Center 404 Card */}
      <div className="w-full max-w-md mx-auto my-auto text-center bg-white p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-900/5 border border-slate-200/80 space-y-5">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-mono text-2xl font-extrabold shadow-sm">
          404
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-bold text-slate-900 tracking-tight">
            Page Not Found
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
            The assessment, workspace, or resource you are looking for does not exist or has been relocated.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#050505] hover:bg-black text-white text-xs font-semibold shadow-xs transition active:scale-95"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return to Home</span>
          </Link>
          <Link
            to="/auth"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition active:scale-95"
          >
            <span>Sign In to Workspace</span>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-4xl mx-auto text-center pt-4">
        <p className="text-[11px] text-slate-400 font-mono">
          QualifyAI Enterprise • Technical Recruitment Engine
        </p>
      </div>
    </div>
  )
}

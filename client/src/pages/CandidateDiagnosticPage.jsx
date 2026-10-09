import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Sparkles, ArrowLeft } from 'lucide-react'
import CandidateDiagnosticReportView from '../components/diagnostic/CandidateDiagnosticReportView.jsx'

export default function CandidateDiagnosticPage() {
  const { token } = useParams()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-blue-500/20">
              Q
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight text-sm">
                Qualify<span className="text-blue-600">AI</span>
              </span>
              <span className="block text-[10px] text-slate-400 font-mono">
                Candidate Growth Diagnostics
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        <CandidateDiagnosticReportView
          token={token}
          onBackToInterview={() => navigate(`/interview/${token}`)}
        />
      </main>
    </div>
  )
}

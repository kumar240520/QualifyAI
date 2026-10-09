import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  Award,
  CheckCircle2,
  TrendingUp,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Printer,
  Calendar,
  User,
  Briefcase,
  Target,
  Quote,
  Layers,
  ChevronRight,
  ShieldCheck,
  Cpu,
  RefreshCw,
} from 'lucide-react'
import { diagnosticService } from '../../services/diagnosticService.js'

export default function CandidateDiagnosticReportView({
  token,
  interviewId,
  initialData = null,
  onBackToInterview = null,
}) {
  const [report, setReport] = useState(initialData)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState(null)

  const fetchReport = async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      let data
      if (token) {
        data = await diagnosticService.getDiagnosticByToken(token, refresh)
      } else if (interviewId) {
        data = await diagnosticService.getDiagnosticByInterviewId(interviewId, null, refresh)
      } else {
        throw new Error('No assessment token or interview reference provided.')
      }
      setReport(data)
    } catch (err) {
      console.error('[CandidateDiagnosticReportView] Error fetching report:', err)
      setError(err.message || 'Unable to load candidate diagnostic report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initialData) {
      fetchReport()
    }
  }, [token, interviewId])

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-2xl bg-blue-500/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/25">
            <Sparkles className="w-8 h-8 animate-spin" />
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900">Synthesizing Growth Diagnostics</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Grounded evaluation models are analyzing your technical dialogue, verified strengths, and personalized learning roadmap...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 rounded-3xl bg-rose-50 border border-rose-200 text-center space-y-4 max-w-xl mx-auto my-12">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <Target className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-rose-900">Diagnostic Not Ready</h3>
          <p className="text-xs text-rose-700">{error}</p>
        </div>
        <button
          onClick={() => fetchReport(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Analysis
        </button>
      </div>
    )
  }

  if (!report) return null

  const pillarRatings = report.pillar_ratings || []
  const verifiedStrengths = report.verified_strengths || []
  const recommendedGrowth = report.recommended_growth_areas || []
  const actionPlan = report.action_plan || []

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-8 px-4 sm:px-6">
      {/* 1. Header Banner & Action Bar */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Assessment Completed
              </span>
              <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Personalized Growth Report
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Technical Competency & Diagnostic Debrief
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-slate-800">{report.candidate_name}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                {report.job_title}
              </span>
              {report.completed_at && (
                <span className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(report.completed_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition flex items-center gap-2 cursor-pointer print:hidden"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              Print / Save PDF
            </button>
            {onBackToInterview && (
              <button
                onClick={onBackToInterview}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer print:hidden"
              >
                ← Back to Session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Executive Growth Overview & Articulation Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Executive Growth Summary</h2>
          </div>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-3 whitespace-pre-line">
            {report.candidate_visible_summary}
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30 border border-indigo-100 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Verbal Articulation</h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {report.articulation_summary ||
              'Clear and structured technical exposition with strong pacing and contextual framing.'}
          </p>
          <div className="pt-2 border-t border-indigo-100/60">
            <span className="text-[11px] font-medium text-indigo-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              Objective Speech Evaluation
            </span>
          </div>
        </div>
      </div>

      {/* 3. Pillar Competency Breakdown */}
      {pillarRatings.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Diagnostic Pillar Mastery</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluation breakdown across core architectural and problem-solving dimensions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pillarRatings.map((p, idx) => {
              const isUnassessed = p.status === 'UNASSESSED' || p.score === null || p.proficiency_level === 'UNASSESSED'
              const score = isUnassessed ? null : Number(p.score)
              let levelBadge = 'bg-slate-100 text-slate-700 border-slate-200'

              if (isUnassessed) {
                levelBadge = 'bg-slate-100 text-slate-500 border-slate-200'
              } else if (p.proficiency_level === 'EXPERT') {
                levelBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200'
              } else if (p.proficiency_level === 'ADVANCED') {
                levelBadge = 'bg-blue-50 text-blue-700 border-blue-200'
              } else if (p.proficiency_level === 'PROFICIENT') {
                levelBadge = 'bg-cyan-50 text-cyan-700 border-cyan-200'
              } else {
                levelBadge = 'bg-amber-50 text-amber-700 border-amber-200'
              }

              return (
                <div
                  key={idx}
                  className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 transition space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{p.pillar}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${levelBadge}`}>
                        {isUnassessed ? 'UNASSESSED' : p.proficiency_level || 'PROFICIENT'}
                      </span>
                      <span className="text-xs font-mono font-black text-slate-800">
                        {isUnassessed ? '—' : `${score}%`}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isUnassessed
                          ? 'bg-slate-300 w-0'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                      }`}
                      style={{ width: isUnassessed ? '0%' : `${Math.min(100, Math.max(5, score))}%` }}
                    />
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {p.feedback || (isUnassessed ? 'This competency was not assessed in this interview session.' : '')}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. Verified Technical Strengths */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Verified Technical Strengths</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Demonstrated core competencies grounded in verbatim transcript evidence.
            </p>
          </div>
        </div>

        {verifiedStrengths.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {verifiedStrengths.map((s, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl border border-emerald-100/80 bg-emerald-50/20 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <h4 className="text-xs font-bold text-slate-900">{s.topic}</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{s.description}</p>
                {s.evidence_quote && (
                  <div className="p-3 rounded-xl bg-white border border-emerald-100 text-[11px] text-slate-600 italic flex items-start gap-2">
                    <Quote className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>&ldquo;{s.evidence_quote}&rdquo;</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 rounded-2xl border border-slate-200/70 bg-slate-50/50 text-center space-y-1">
            <p className="text-xs font-medium text-slate-600">
              Insufficient evidence to establish verified mastery strengths.
            </p>
            <p className="text-[11px] text-slate-400">
              No recorded responses met the threshold for verified mastery in this session.
            </p>
          </div>
        )}
      </div>

      {/* 5. Recommended Growth Areas & Actionable Resources */}
      {recommendedGrowth.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Targeted Growth Vectors</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Concrete opportunities to expand depth, edge-case mitigation, and system scale.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {recommendedGrowth.map((g, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl border border-slate-200/70 bg-white hover:border-slate-300 transition space-y-3"
              >
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  {g.topic}
                </h4>
                {g.observation && (
                  <p className="text-xs text-slate-500">
                    <strong className="text-slate-700">Observation:</strong> {g.observation}
                  </p>
                )}
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong className="text-indigo-700">Recommendation:</strong> {g.recommendation}
                </p>

                {g.suggested_resources && g.suggested_resources.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-slate-400" /> Recommended:
                    </span>
                    {g.suggested_resources.map((res, rIdx) => (
                      <span
                        key={rIdx}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/60"
                      >
                        {res}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Personalized 30-Day Growth Roadmap */}
      {actionPlan.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Personalized Growth Action Plan</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Suggested study sprints and hands-on implementation targets for your career advancement.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {actionPlan.map((step, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl border border-blue-100 bg-blue-50/20 space-y-2 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-100 text-blue-700">
                    {step.phase || `Sprint ${idx + 1}`}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 pt-1">{step.focus}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{step.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Fairness & Privacy Guarantee Footer */}
      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          QualifyAI Candidate Privacy & Fairness Guarantee
        </div>
        <p className="text-[11px] text-slate-500 max-w-xl mx-auto">
          This report is generated purely for your self-reflection and professional career progression. All evaluations are grounded in objective technical rubrics without demographic or facial bias.
        </p>
      </div>
    </div>
  )
}

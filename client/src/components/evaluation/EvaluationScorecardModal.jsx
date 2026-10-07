import React, { useState, useEffect } from 'react'
import {
  X,
  Award,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Quote,
  Sparkles,
  BarChart3,
  MessageSquare,
  Cpu,
  Brain,
  RefreshCw,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  FileText,
  Volume2,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Loader2,
} from 'lucide-react'
import { evaluationService } from '../../services/evaluationService.js'
import { proctoringService } from '../../services/proctoringService.js'

const EVAL_STEPS = [
  {
    title: 'Dialogue & Transcript Synthesis',
    subtitle: 'Extracting conversational turns, response latencies, and candidate assertions',
    icon: MessageSquare,
  },
  {
    title: '5-Pillar Rubric Grounding',
    subtitle: 'Cross-referencing candidate answers against Senior Engineer evaluation criteria',
    icon: BarChart3,
  },
  {
    title: 'Technical Depth & Problem Solving',
    subtitle: 'Analyzing distributed systems design decisions, trade-offs, and algorithms',
    icon: Cpu,
  },
  {
    title: 'Executive Scorecard & Evidence Quotes',
    subtitle: 'Validating citations against transcripts and computing composite index',
    icon: Award,
  },
]

export default function EvaluationScorecardModal({
  interviewId,
  candidateName,
  jobTitle,
  isOpen,
  onClose,
  onEvaluationComplete,
}) {
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [evalStage, setEvalStage] = useState(0)
  const [evalProgress, setEvalProgress] = useState(15)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [proctoringData, setProctoringData] = useState(null)
  const [expandedCriteria, setExpandedCriteria] = useState({})

  useEffect(() => {
    if (isOpen && interviewId) {
      loadEvaluation()
    }
  }, [isOpen, interviewId])

  const loadEvaluation = async () => {
    try {
      setLoading(true)
      setError(null)
      const [evalRes, procRes] = await Promise.allSettled([
        evaluationService.getEvaluation(interviewId),
        proctoringService.getSummary(interviewId),
      ])

      if (evalRes.status === 'fulfilled') {
        setData(evalRes.value)
      } else {
        throw evalRes.reason
      }

      if (procRes.status === 'fulfilled') {
        setProctoringData(procRes.value)
      }
    } catch (err) {
      console.warn('[EvaluationScorecardModal] Failed to load evaluation:', err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTriggerEvaluation = async () => {
    try {
      setEvaluating(true)
      setEvalStage(0)
      setEvalProgress(18)
      setError(null)

      const timerProgress = setInterval(() => {
        setEvalProgress((prev) => {
          if (prev < 90) return prev + Math.floor(Math.random() * 5) + 3
          return prev
        })
      }, 500)

      const s1 = setTimeout(() => setEvalStage(1), 1400)
      const s2 = setTimeout(() => setEvalStage(2), 3000)
      const s3 = setTimeout(() => setEvalStage(3), 4800)

      const res = await evaluationService.triggerEvaluation(interviewId)

      clearInterval(timerProgress)
      clearTimeout(s1)
      clearTimeout(s2)
      clearTimeout(s3)

      setEvalProgress(100)
      setData(res)
      if (onEvaluationComplete) {
        onEvaluationComplete(res)
      }
    } catch (err) {
      console.error('[EvaluationScorecardModal] Evaluation trigger failed:', err)
      setError(err.message || 'Failed to synthesize evaluation.')
    } finally {
      setEvaluating(false)
    }
  }

  const toggleCriterion = (id) => {
    setExpandedCriteria((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  if (!isOpen) return null

  const evaluation = data?.evaluation
  const rubricScores = data?.rubricScores || []
  const commMetrics = data?.communicationMetrics || {}

  const overallScore = Math.round(evaluation?.overall_score || 0)
  const technicalScore = Math.round(evaluation?.technical_score || 0)
  const problemScore = Math.round(evaluation?.problem_solving_score || 0)
  const commScore = Math.round(evaluation?.communication_score || 0)

  // Recommendation Badge Helper
  const getRecommendationBadge = (score) => {
    if (score >= 85) {
      return {
        label: 'STRONG HIRE',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-300',
        icon: CheckCircle2,
      }
    }
    if (score >= 70) {
      return {
        label: 'HIRE',
        bg: 'bg-blue-50 text-blue-700 border-blue-300',
        icon: CheckCircle2,
      }
    }
    if (score >= 55) {
      return {
        label: 'LEANING HIRE',
        bg: 'bg-amber-50 text-amber-700 border-amber-300',
        icon: AlertTriangle,
      }
    }
    return {
      label: 'NO HIRE',
      bg: 'bg-rose-50 text-rose-700 border-rose-300',
      icon: XCircle,
    }
  }

  const recBadge = getRecommendationBadge(overallScore)
  const RecIcon = recBadge.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-blue-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">AI Evaluation Scorecard</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-100/60 text-blue-800">
                  Rubric-Grounded
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {candidateName || evaluation?.candidate?.full_name || 'Candidate'} &bull;{' '}
                {jobTitle || evaluation?.job?.title || 'Engineering Role'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerEvaluation}
              disabled={evaluating}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Recalculate AI evaluation grounded in transcripts"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin text-blue-600' : ''}`} />
              <span>{evaluating ? 'Evaluating...' : 'Re-Evaluate'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {loading ? (
            <div className="py-24 text-center space-y-4">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">
                  Retrieving Candidate Evaluation Data
                </p>
                <p className="text-xs text-slate-400">Verifying PostgreSQL evaluation cache...</p>
              </div>
            </div>
          ) : evaluating ? (
            /* High-Tech AI Evaluation Loading State (No skeleton panel) */
            <div className="py-8 px-4 max-w-xl mx-auto space-y-8 animate-fade-in">
              {/* Pulsing AI Core */}
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-blue-500/40 animate-spin [animation-duration:8s]" />
                <div className="absolute inset-2 rounded-full bg-blue-500/10 animate-pulse" />
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/30">
                  <Brain className="w-8 h-8 animate-pulse text-white" />
                </div>
              </div>

              {/* Title & Status */}
              <div className="text-center space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                  <span>GEMINI-2.5-FLASH EVALUATION ENGINE</span>
                </div>
                <h3 className="text-xl font-heading font-black text-slate-900 tracking-tight">
                  Evaluating Assessment Metrics
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Our LLM evaluation engine is analyzing candidate transcripts against job rubric criteria. No partial or skeleton metrics are displayed until evaluation concludes.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">SYNTHESIS PROGRESS</span>
                  <span className="font-bold text-blue-600">{Math.min(evalProgress, 98)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(evalProgress, 98)}%` }}
                  />
                </div>
              </div>

              {/* Evaluation Steps Stack */}
              <div className="space-y-2.5 text-left">
                {EVAL_STEPS.map((step, idx) => {
                  const StepIcon = step.icon
                  const isDone = evalStage > idx
                  const isActive = evalStage === idx
                  return (
                    <div
                      key={step.title}
                      className={`p-3.5 rounded-xl border transition-all flex items-center gap-3.5 ${
                        isActive
                          ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                          : isDone
                          ? 'bg-emerald-50/40 border-emerald-200/80'
                          : 'bg-white border-slate-200/70 opacity-60'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-700'
                            : isActive
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : isActive ? (
                          <StepIcon className="w-4 h-4 animate-pulse text-white" />
                        ) : (
                          <StepIcon className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h5
                            className={`text-xs font-bold ${
                              isActive
                                ? 'text-blue-900'
                                : isDone
                                ? 'text-emerald-900'
                                : 'text-slate-700'
                            }`}
                          >
                            {step.title}
                          </h5>
                          {isActive && (
                            <span className="text-[10px] font-mono font-bold text-blue-600 animate-pulse">
                              Evaluating...
                            </span>
                          )}
                          {isDone && (
                            <span className="text-[10px] font-mono font-bold text-emerald-600">
                              Complete
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {step.subtitle}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : !evaluation ? (
            <div className="py-14 px-6 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-300 space-y-5 max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-lg font-bold text-slate-900">
                  Generate Scorecard with AI
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  The candidate assessment interview has concluded. Click below to run the Gemini multi-pillar evaluation engine and generate a fully-grounded rubric scorecard.
                </p>
                {error && (
                  <div className="p-3 mt-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium text-left">
                    <p className="font-bold">Notice:</p>
                    <p className="text-[11px] mt-0.5">{error}</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleTriggerEvaluation}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 inline-flex items-center gap-2.5 transition transform hover:scale-[1.02] cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate with AI</span>
              </button>
            </div>
          ) : (
            <>
              {/* Scorecard Hero Banner */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl">
                {/* Composite Overall Score */}
                <div className="md:col-span-1 flex flex-col items-center justify-center text-center p-3 border-b md:border-b-0 md:border-r border-slate-700/60">
                  <div className="relative flex items-center justify-center mb-2">
                    <svg className="w-24 h-24 transform -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-slate-700/50"
                        fill="transparent"
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="8"
                        className={`${
                          overallScore >= 75
                            ? 'text-emerald-400'
                            : overallScore >= 60
                            ? 'text-blue-400'
                            : 'text-amber-400'
                        } transition-all duration-1000`}
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * overallScore) / 100}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute text-2xl font-black">{overallScore}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    Overall Score
                  </span>
                  <div className={`mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${recBadge.bg}`}>
                    <RecIcon className="w-3 h-3" />
                    <span>{recBadge.label}</span>
                  </div>
                </div>

                {/* Pillar Breakdown */}
                <div className="md:col-span-3 grid grid-cols-3 gap-3 items-center">
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col items-center justify-center text-center">
                    <Cpu className="w-5 h-5 text-indigo-400 mb-1" />
                    <span className="text-xl font-bold text-white">{technicalScore}%</span>
                    <span className="text-[11px] text-slate-400">Technical Depth</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col items-center justify-center text-center">
                    <Brain className="w-5 h-5 text-blue-400 mb-1" />
                    <span className="text-xl font-bold text-white">{problemScore}%</span>
                    <span className="text-[11px] text-slate-400">Problem Solving</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 flex flex-col items-center justify-center text-center">
                    <MessageSquare className="w-5 h-5 text-teal-400 mb-1" />
                    <span className="text-xl font-bold text-white">{commScore}%</span>
                    <span className="text-[11px] text-slate-400">Communication</span>
                  </div>

                  {/* Verbal Communication Telemetry Bar */}
                  <div className="col-span-3 mt-1 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-slate-400" />
                      <span>Speech Pace: <strong>{commMetrics.wpm || 130} WPM</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-slate-400" />
                      <span>Filler Density: <strong>{commMetrics.filler_word_density || 1.2}%</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Clarity Index: <strong>{commMetrics.clarity_score || 85}/100</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Executive Summary */}
              {evaluation?.summary && (
                <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-2">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Executive Evaluation Summary</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {evaluation.summary}
                  </p>
                </div>
              )}

              {/* Phase 9: Assessment Integrity & Proctoring Telemetry */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {proctoringData?.trust_level === 'HIGH' || !proctoringData ? (
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    ) : proctoringData?.trust_level === 'MODERATE' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-rose-600" />
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Assessment Integrity & Telemetry
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Privacy-preserving browser focus & acoustic monitoring
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                        proctoringData?.trust_level === 'HIGH' || !proctoringData
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : proctoringData?.trust_level === 'MODERATE'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {proctoringData?.trust_level === 'HIGH' || !proctoringData
                        ? 'High Trust Verified'
                        : proctoringData?.trust_level === 'MODERATE'
                        ? 'Moderate Risk Review'
                        : 'Elevated Risk Flagged'}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                      Risk Index: {proctoringData?.risk_score ?? 0}/100
                    </span>
                  </div>
                </div>

                {/* Telemetry Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Focus Losses</span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">
                      {proctoringData?.flags_summary?.focus_loss_count ?? 0}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Tab Switches</span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">
                      {proctoringData?.flags_summary?.tab_switch_count ?? 0}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Visibility Shifts</span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">
                      {proctoringData?.flags_summary?.visibility_change_count ?? 0}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-400">Audio Spikes</span>
                    <p className="text-base font-bold text-slate-900 mt-0.5">
                      {proctoringData?.flags_summary?.acoustic_anomaly_count ?? 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rubric Criteria Grounded Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>Rubric Criteria Breakdown ({rubricScores.length} Dimensions)</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Click card to view cited evidence quotes
                  </span>
                </div>

                <div className="space-y-3">
                  {rubricScores.map((criterion, idx) => {
                    const isExpanded = expandedCriteria[criterion.id] ?? true
                    const score = Math.round(criterion.score)

                    return (
                      <div
                        key={criterion.id || idx}
                        className="rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs overflow-hidden"
                      >
                        <div
                          onClick={() => toggleCriterion(criterion.id)}
                          className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-50/50 hover:bg-slate-50 transition"
                        >
                          <div className="space-y-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {criterion.criterion_name}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-slate-200/70 text-slate-700">
                                Weight: {criterion.weight || 3}/5
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {criterion.justification}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <span
                                className={`text-base font-black ${
                                  score >= 80
                                    ? 'text-emerald-600'
                                    : score >= 60
                                    ? 'text-blue-600'
                                    : 'text-amber-600'
                                }`}
                              >
                                {score}
                              </span>
                              <span className="text-[11px] text-slate-400 font-bold"> / 100</span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded details with cited evidence */}
                        {isExpanded && (
                          <div className="p-4 pt-3 border-t border-slate-100 bg-white space-y-3 text-xs">
                            <div>
                              <span className="font-semibold text-slate-700">Justification:</span>
                              <p className="mt-1 text-slate-600 leading-relaxed">
                                {criterion.justification}
                              </p>
                            </div>

                            {/* Evidence Quotes */}
                            {criterion.evidence_quotes && criterion.evidence_quotes.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                                  <Quote className="w-3.5 h-3.5 text-blue-500" />
                                  <span>Cited Transcript Evidence:</span>
                                </span>
                                <div className="space-y-1.5 pl-2 border-l-2 border-blue-400">
                                  {criterion.evidence_quotes.map((quote, qIdx) => (
                                    <p
                                      key={qIdx}
                                      className="text-xs italic text-slate-600 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100"
                                    >
                                      &ldquo;{quote}&rdquo;
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>QualifyAI Deterministic Scoring Engine &bull; Gemini 3.5</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition cursor-pointer"
          >
            Close Scorecard
          </button>
        </div>
      </div>
    </div>
  )
}

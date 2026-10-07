import React, { useState, useEffect } from 'react'
import {
  Trophy,
  Users,
  TrendingUp,
  Award,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Briefcase,
  ChevronDown,
  RefreshCw,
  Search,
  ExternalLink,
  Cpu,
  Brain,
  MessageSquare,
  FileText,
  Filter,
} from 'lucide-react'
import { reportService } from '../../services/reportService.js'
import { jobService } from '../../services/jobService.js'
import EvaluationScorecardModal from '../evaluation/EvaluationScorecardModal.jsx'

export default function CohortLeaderboardView({ selectedJob, onSelectJob }) {
  const [jobs, setJobs] = useState([])
  const [activeJobId, setActiveJobId] = useState(selectedJob?.id || '')
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [recommendationFilter, setRecommendationFilter] = useState('ALL')

  // Scorecard modal state
  const [scorecardState, setScorecardState] = useState({
    isOpen: false,
    interviewId: null,
    candidateName: '',
    jobTitle: '',
  })

  // 1. Fetch available jobs
  const fetchJobs = async () => {
    try {
      const data = await jobService.listJobs()
      setJobs(data || [])
      if ((!activeJobId || !data.some((j) => j.id === activeJobId)) && data && data.length > 0) {
        setActiveJobId(data[0].id)
      }
    } catch (err) {
      console.error('[CohortLeaderboard] Error fetching jobs:', err)
    }
  }

  // 2. Fetch cohort analytics
  const fetchCohortAnalytics = async (jobId) => {
    const targetJobId = jobId || activeJobId
    if (!targetJobId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await reportService.getCohortAnalytics(targetJobId)
      setAnalytics(data)
    } catch (err) {
      console.error('[CohortLeaderboard] Error loading analytics:', err)
      setError(err.message || 'Failed to load cohort analytics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    if (activeJobId) {
      fetchCohortAnalytics(activeJobId)
    }
  }, [activeJobId])

  const activeJob = jobs.find((j) => j.id === activeJobId) || analytics?.job || selectedJob

  // Filter candidates
  const leaderboard = analytics?.leaderboard || []
  const filteredLeaderboard = leaderboard.filter((item) => {
    const matchesSearch =
      item.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.email?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesFilter =
      recommendationFilter === 'ALL' || item.recommendation === recommendationFilter

    return matchesSearch && matchesFilter
  })

  const metrics = analytics?.metrics || {
    total_candidates: 0,
    total_assessed: 0,
    average_score: 0,
    top_score: 0,
    hire_rate_percentage: 0,
  }

  return (
    <div className="space-y-6">
      {/* View Header & Requisition Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Cohort Ranking & Leaderboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Executive Analytics
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Comparative technical performance, integrity trust indices, and hiring committee rankings.
          </p>
        </div>

        {/* Requisition Dropdown */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={activeJobId}
              onChange={(e) => {
                setActiveJobId(e.target.value)
                if (onSelectJob) {
                  const matched = jobs.find((j) => j.id === e.target.value)
                  if (matched) onSelectJob(matched)
                }
              }}
              className="appearance-none pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[220px]"
            >
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.department || 'Eng'})
                </option>
              ))}
            </select>
            <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
          </div>

          <button
            onClick={() => fetchCohortAnalytics(activeJobId)}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            title="Refresh Leaderboard Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Assessed Cohort Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">Cohort Volume</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {metrics.total_assessed}
            <span className="text-xs font-normal text-slate-400"> / {metrics.total_candidates} total</span>
          </div>
          <p className="text-[11px] text-slate-500">Completed interviews</p>
        </div>

        {/* Average Score Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">Average Score</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {metrics.average_score}
            <span className="text-xs font-normal text-slate-400"> / 100</span>
          </div>
          <p className="text-[11px] text-slate-500">Benchmark across cohort</p>
        </div>

        {/* Top Score Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">Top Candidate</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {metrics.top_score}
            <span className="text-xs font-normal text-slate-400"> / 100</span>
          </div>
          <p className="text-[11px] text-slate-500">Cohort high performance</p>
        </div>

        {/* Hire Recommendation Rate Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-mono uppercase tracking-wider">Hire Rate</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{metrics.hire_rate_percentage}%</div>
          <p className="text-[11px] text-slate-500">Recommendation threshold</p>
        </div>
      </div>

      {/* Leaderboard Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6">
        {/* Table Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search candidate by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={recommendationFilter}
              onChange={(e) => setRecommendationFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="ALL">All Recommendations</option>
              <option value="STRONG_HIRE">Strong Hire</option>
              <option value="HIRE">Hire</option>
              <option value="LEANING_HIRE">Leaning Hire</option>
              <option value="NO_HIRE">No Hire</option>
              <option value="PENDING">Pending Assessment</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500">Synthesizing cohort leaderboard ranking...</p>
          </div>
        ) : filteredLeaderboard.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No candidate results matching filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Rank</th>
                  <th className="px-5 py-3.5">Candidate</th>
                  <th className="px-5 py-3.5">Composite Score</th>
                  <th className="px-5 py-3.5">Pillars Breakdown</th>
                  <th className="px-5 py-3.5">Recommendation</th>
                  <th className="px-5 py-3.5">Integrity</th>
                  <th className="px-5 py-3.5 text-right">Scorecard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredLeaderboard.map((c) => {
                  const hasScore = c.overall_score !== null

                  return (
                    <tr key={c.candidate_id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Rank Column */}
                      <td className="px-5 py-4">
                        {c.rank === 1 ? (
                          <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-950 font-black flex items-center justify-center text-xs shadow-xs border border-amber-300">
                            1
                          </span>
                        ) : c.rank === 2 ? (
                          <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-800 font-black flex items-center justify-center text-xs shadow-xs border border-slate-300">
                            2
                          </span>
                        ) : c.rank === 3 ? (
                          <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-700 to-amber-600 text-amber-100 font-black flex items-center justify-center text-xs shadow-xs border border-amber-600">
                            3
                          </span>
                        ) : c.rank ? (
                          <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs">
                            {c.rank}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* Candidate Column */}
                      <td className="px-5 py-4 font-bold text-slate-900">
                        <div>{c.full_name}</div>
                        <div className="text-[11px] font-normal text-slate-400">{c.email}</div>
                      </td>

                      {/* Composite Score Column */}
                      <td className="px-5 py-4">
                        {hasScore ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-base font-black ${
                                c.overall_score >= 80
                                  ? 'text-emerald-600'
                                  : c.overall_score >= 60
                                  ? 'text-blue-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {Math.round(c.overall_score)}
                            </span>
                            <span className="text-[11px] text-slate-400">/ 100</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Pending</span>
                        )}
                      </td>

                      {/* Pillars Breakdown Column */}
                      <td className="px-5 py-4">
                        {hasScore ? (
                          <div className="flex items-center gap-2 text-[10px] font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200" title="Technical Depth">
                              Tech: {Math.round(c.technical_score || 0)}%
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200" title="Problem Solving">
                              Prob: {Math.round(c.problem_solving_score || 0)}%
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200" title="Communication">
                              Comm: {Math.round(c.communication_score || 0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Recommendation Column */}
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            c.recommendation === 'STRONG_HIRE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : c.recommendation === 'HIRE'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : c.recommendation === 'LEANING_HIRE'
                              ? 'bg-amber-50 text-amber-700 border-amber-300'
                              : c.recommendation === 'NO_HIRE'
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {c.recommendation.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Integrity Column */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            c.trust_level === 'HIGH'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : c.trust_level === 'MODERATE'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {c.trust_level === 'HIGH' ? (
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                          )}
                          <span>{c.trust_level}</span>
                        </span>
                      </td>

                      {/* Actions Column */}
                      <td className="px-5 py-4 text-right">
                        {c.interview_id ? (
                          <button
                            onClick={() =>
                              setScorecardState({
                                isOpen: true,
                                interviewId: c.interview_id,
                                candidateName: c.full_name,
                                jobTitle: activeJob?.title || 'Technical Role',
                              })
                            }
                            className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Scorecard</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No Session</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Candidate Scorecard Modal */}
      <EvaluationScorecardModal
        isOpen={scorecardState.isOpen}
        interviewId={scorecardState.interviewId}
        candidateName={scorecardState.candidateName}
        jobTitle={scorecardState.jobTitle}
        onClose={() => {
          setScorecardState({
            isOpen: false,
            interviewId: null,
            candidateName: '',
            jobTitle: '',
          })
          if (activeJobId) fetchCohortAnalytics(activeJobId)
        }}
        onEvaluationComplete={() => {
          if (activeJobId) fetchCohortAnalytics(activeJobId)
        }}
      />
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import {
  Users,
  UserPlus,
  Mail,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Briefcase,
  ChevronDown,
  Sparkles,
  Shield,
  Layers,
  Calendar,
  Award,
  Lock,
} from 'lucide-react'
import { candidateService } from '../../services/candidateService.js'
import { jobService } from '../../services/jobService.js'
import EvaluationScorecardModal from '../evaluation/EvaluationScorecardModal.jsx'

export default function CandidateCohortManager({ selectedJob, onSelectJob }) {
  const [jobs, setJobs] = useState([])
  const [activeJobId, setActiveJobId] = useState(selectedJob?.id || '')
  const [candidates, setCandidates] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [copiedTokenId, setCopiedTokenId] = useState(null)

  // Evaluation Scorecard Modal State
  const [evalModalState, setEvalModalState] = useState({
    isOpen: false,
    interviewId: null,
    candidateName: '',
    jobTitle: '',
  })

  // In-memory cohort cache for instant 0ms switching
  const cohortCacheRef = useRef(new Map())

  // Sync selectedJob prop if updated externally
  useEffect(() => {
    if (selectedJob?.id && selectedJob.id !== activeJobId) {
      setActiveJobId(selectedJob.id)
    }
  }, [selectedJob?.id])

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteExpiryDays, setInviteExpiryDays] = useState(7)
  const [inviteDurationMinutes, setInviteDurationMinutes] = useState(30)
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false)
  const [inviteModalError, setInviteModalError] = useState('')
  const [generatedInviteLink, setGeneratedInviteLink] = useState('')

  // 1. Fetch available jobs
  const fetchJobs = async () => {
    try {
      const data = await jobService.listJobs()
      setJobs(data || [])
      if ((!activeJobId || !data.some((j) => j.id === activeJobId)) && data && data.length > 0) {
        setActiveJobId(data[0].id)
      }
    } catch (err) {
      console.error('Error fetching jobs:', err)
    }
  }

  // 2. Fetch candidates for active job with optimistic caching
  const fetchCandidates = async (jobId, forceRefresh = false) => {
    const targetJobId = jobId || activeJobId
    if (!targetJobId) {
      setIsLoading(false)
      return
    }

    if (forceRefresh) {
      cohortCacheRef.current.delete(targetJobId)
    }

    // Check memory cache first for instant feedback
    if (cohortCacheRef.current.has(targetJobId)) {
      setCandidates(cohortCacheRef.current.get(targetJobId))
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }

    setError('')
    try {
      const data = await candidateService.listCandidates(targetJobId)
      const list = data || []
      cohortCacheRef.current.set(targetJobId, list)
      setCandidates(list)
    } catch (err) {
      console.error('Error fetching candidates:', err)
      if (!cohortCacheRef.current.has(targetJobId)) {
        setError(err.message || 'Failed to load candidates.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    if (activeJobId) {
      fetchCandidates(activeJobId)
    }
  }, [activeJobId])

  // 3. Real-time background sync & window focus listener for live acceptance KPI updates
  useEffect(() => {
    if (!activeJobId) return

    const pollInterval = setInterval(() => {
      // Silently poll candidate cohort every 5s so KPI cards and status update live
      candidateService
        .listCandidates(activeJobId)
        .then((data) => {
          if (data && Array.isArray(data)) {
            cohortCacheRef.current.set(activeJobId, data)
            setCandidates(data)
          }
        })
        .catch(() => {})
    }, 5000)

    const handleWindowFocus = () => {
      fetchCandidates(activeJobId, true)
    }
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      clearInterval(pollInterval)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [activeJobId])

  const activeJob = jobs.find((j) => j.id === activeJobId) || selectedJob

  // Helper: candidate has accepted the invitation or entered assessment
  const isCandidateAccepted = (c) => {
    const inv = c.invitation
    if (!inv) return false
    return (
      inv.status === 'ACCEPTED' ||
      inv.status === 'COMPLETED' ||
      Boolean(inv.accepted_at) ||
      Boolean(c.interview) ||
      c.application_status === 'INTERVIEWED'
    )
  }

  // Helper: candidate has completed assessment
  const isCandidateCompleted = (c) => {
    return (
      c.interview?.status === 'COMPLETED' ||
      c.interview?.status === 'EVALUATED' ||
      c.invitation?.status === 'COMPLETED' ||
      c.application_status === 'INTERVIEWED'
    )
  }

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    const isCompleted = isCandidateCompleted(c)
    const isAccepted = isCandidateAccepted(c)

    const matchesQuery =
      c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'INVITED' && c.invitation && !isAccepted) ||
      (statusFilter === 'ACCEPTED' && isAccepted) ||
      (statusFilter === 'COMPLETED' && isCompleted) ||
      c.application_status === statusFilter

    return matchesQuery && matchesStatus
  })

  // Handle invitation link copying
  const handleCopyLink = (token, candidateId) => {
    const origin = window.location.origin
    const inviteUrl = `${origin}/invite/${token}`
    navigator.clipboard.writeText(inviteUrl)
    setCopiedTokenId(candidateId)
    setTimeout(() => setCopiedTokenId(null), 2500)
  }

  // Handle creating candidate and issuing invitation
  const handleSendInvite = async (e) => {
    e.preventDefault()
    if (!inviteName.trim() || !inviteEmail.trim() || !activeJobId) {
      setInviteModalError('Name and valid email are required.')
      return
    }

    setIsSubmittingInvite(true)
    setInviteModalError('')

    try {
      // 1. Add candidate
      const candidate = await candidateService.addCandidate(activeJobId, {
        fullName: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        phone: invitePhone.trim() || null,
      })

      // 2. Generate secure tokenized invitation
      const invitation = await candidateService.createInvitation(
        activeJobId,
        candidate.id,
        Number(inviteExpiryDays) || 7,
        Number(inviteDurationMinutes) || 30
      )

      const origin = window.location.origin
      setGeneratedInviteLink(`${origin}/invite/${invitation.token}`)

      // Refresh list
      fetchCandidates(activeJobId)
    } catch (err) {
      console.error('Error inviting candidate:', err)
      setInviteModalError(err.message || 'Failed to invite candidate.')
    } finally {
      setIsSubmittingInvite(false)
    }
  }

  const resetModalState = () => {
    setShowInviteModal(false)
    setInviteName('')
    setInviteEmail('')
    setInvitePhone('')
    setInviteModalError('')
    setGeneratedInviteLink('')
  }

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[10px] font-bold">
              ACTIVE COHORT PIPELINE
            </span>
            {activeJob && (
              <span className="text-slate-400 text-xs font-mono">
                {activeJob.department || 'Engineering'} • {activeJob.seniority || 'SENIOR'}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-heading font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            {activeJob ? activeJob.title : 'Select a Job Requisition'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tokenized candidate invitations, assessment staging, and secure entrance links.
          </p>
        </div>

        {/* Job Switcher Dropdown & Action */}
        <div className="flex items-center gap-3">
          {jobs.length > 0 && (
            <div className="relative">
              <select
                value={activeJobId}
                onChange={(e) => setActiveJobId(e.target.value)}
                className="pl-3.5 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} ({j.seniority || 'MID'})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          )}

          <button
            onClick={() => fetchCandidates(activeJobId, true)}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
            title="Refresh Cohort Data (Bypass Cache)"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowInviteModal(true)}
            disabled={!activeJobId}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-md flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Invite Candidate
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Talent</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{candidates.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Assigned to position</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Pending Invites</span>
            <Mail className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {candidates.filter((c) => c.invitation && !isCandidateAccepted(c)).length}
          </div>
          <div className="text-[11px] text-indigo-600 font-medium mt-1">Awaiting candidate action</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Accepted Links</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {candidates.filter((c) => isCandidateAccepted(c)).length}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {candidates.filter((c) => isCandidateAccepted(c) && !isCandidateCompleted(c)).length} staged &bull; {candidates.filter(isCandidateCompleted).length} concluded
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Completed Assessments</span>
            <Shield className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {candidates.filter(isCandidateCompleted).length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Links concluded</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidates by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          {['ALL', 'APPLIED', 'INVITED', 'ACCEPTED', 'COMPLETED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                statusFilter === status
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between text-red-700 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchCandidates(activeJobId)}
            className="underline font-semibold hover:text-red-900 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Candidates Table */}
      {isLoading ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Loading candidate cohort from PostgreSQL...</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="py-16 px-6 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-semibold text-slate-900">No Candidates in Cohort Yet</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Invite software engineers to take the AI technical interview. Each candidate receives a unique, tokenized access link.
            </p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 inline-flex items-center gap-2 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Invite Candidate Now
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Candidate</th>
                  <th className="px-5 py-3.5">Application Status</th>
                  <th className="px-5 py-3.5">Assessment & Score</th>
                  <th className="px-5 py-3.5">Accepted / Invitation Link</th>
                  <th className="px-5 py-3.5">Token Expiry</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredCandidates.map((c) => {
                  const inv = c.invitation
                  const hasToken = Boolean(inv?.token)
                  const hasInterview = Boolean(c.interview)
                  const evalData = c.interview?.evaluations?.[0]
                  const hasScore = typeof evalData?.overall_score === 'number'
                  const isAssessmentCompleted = isCandidateCompleted(c)
                  const isAccepted = isCandidateAccepted(c)
                  const isExpired =
                    inv?.status === 'EXPIRED' ||
                    (inv?.expires_at && new Date(inv.expires_at) < new Date() && !isAssessmentCompleted && !isAccepted)

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-900 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-700 font-bold flex items-center justify-center shrink-0 border border-blue-200">
                          {c.full_name
                            ?.split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase() || 'CA'}
                        </div>
                        <div>
                          <div>{c.full_name}</div>
                          <div className="text-[11px] font-normal text-slate-400">{c.email}</div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            c.application_status === 'INTERVIEWED' || isAssessmentCompleted
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : c.application_status === 'INVITED'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {isAssessmentCompleted ? 'INTERVIEWED' : c.application_status || 'APPLIED'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {hasInterview ? (
                          <div className="flex items-center gap-2">
                            {hasScore ? (
                              <button
                                onClick={() =>
                                  setEvalModalState({
                                    isOpen: true,
                                    interviewId: c.interview.id,
                                    candidateName: c.full_name,
                                    jobTitle: activeJob?.title || 'Technical Role',
                                  })
                                }
                                className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                title="Click to view full Rubric Scorecard"
                              >
                                <Award className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Score: {Math.round(evalData.overall_score)}/100</span>
                              </button>
                            ) : c.interview.status === 'COMPLETED' ? (
                              <button
                                onClick={() =>
                                  setEvalModalState({
                                    isOpen: true,
                                    interviewId: c.interview.id,
                                    candidateName: c.full_name,
                                    jobTitle: activeJob?.title || 'Technical Role',
                                  })
                                }
                                className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                <span>Completed &bull; Evaluate</span>
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {c.interview.status}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Not started</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {hasToken ? (
                          isAssessmentCompleted ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300"
                                title="Single-use assessment has concluded. Invitation link is permanently deactivated."
                              >
                                <Lock className="w-3 h-3 text-slate-400" />
                                DEACTIVATED
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium italic">
                                Link Concluded
                              </span>
                            </div>
                          ) : isExpired ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <Clock className="w-3 h-3 text-rose-500" />
                                EXPIRED
                              </span>
                            </div>
                          ) : isAccepted ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                ACCEPTED
                              </span>
                              <button
                                onClick={() => handleCopyLink(inv.token, c.id)}
                                className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                                title="Copy secure link"
                              >
                                {copiedTokenId === c.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-700">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-500" />
                                    <span>Copy Link</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                LINK ACTIVE
                              </span>
                              <button
                                onClick={() => handleCopyLink(inv.token, c.id)}
                                className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                                title="Copy secure link"
                              >
                                {copiedTokenId === c.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-700">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-500" />
                                    <span>Copy Link</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )
                        ) : (
                          <span className="text-slate-400 text-xs italic">No invitation issued</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-slate-500 font-mono text-[11px]">
                        {inv?.expires_at ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(inv.expires_at).toLocaleDateString()}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasInterview && (
                            <button
                              onClick={() =>
                                setEvalModalState({
                                  isOpen: true,
                                  interviewId: c.interview.id,
                                  candidateName: c.full_name,
                                  jobTitle: activeJob?.title || 'Technical Role',
                                })
                              }
                              className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                              title="Open AI Evaluation Scorecard"
                            >
                              <Award className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Scorecard</span>
                            </button>
                          )}
                          {isAssessmentCompleted ? (
                            <span className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-medium border border-slate-200">
                              Assessment Ended
                            </span>
                          ) : hasToken ? (
                            <a
                              href={`/invite/${inv.token}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition"
                            >
                              <span>Open Staging</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          ) : (
                            <button
                              onClick={async () => {
                                try {
                                  await candidateService.createInvitation(activeJobId, c.id, 7, inviteDurationMinutes)
                                  cohortCacheRef.current.delete(activeJobId)
                                  fetchCandidates(activeJobId)
                                } catch (e) {
                                  setError(e.message)
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold transition cursor-pointer"
                            >
                              Issue Invite
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Candidate Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Invite Candidate</h3>
                  <p className="text-xs text-slate-500">Issue secure tokenized assessment link</p>
                </div>
              </div>
              <button
                onClick={resetModalState}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {generatedInviteLink ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Invitation Successfully Generated!</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Share this unique entrance link with <strong>{inviteName}</strong>. The candidate will be guided through microphone setup and enter the AI interview.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Tokenized Link</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteLink}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 select-all"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInviteLink)
                        setCopiedTokenId('modal')
                        setTimeout(() => setCopiedTokenId(null), 2500)
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shrink-0 flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {copiedTokenId === 'modal' ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={resetModalState}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="space-y-4">
                {inviteModalError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{inviteModalError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Connor"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="sarah@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Phone (Optional)</label>
                    <input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={invitePhone}
                      onChange={(e) => setInvitePhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Link Validity</label>
                    <select
                      value={inviteExpiryDays}
                      onChange={(e) => setInviteExpiryDays(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      <option value="3">3 Days</option>
                      <option value="7">7 Days (Standard)</option>
                      <option value="14">14 Days</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Interview Duration</label>
                  <select
                    value={inviteDurationMinutes}
                    onChange={(e) => setInviteDurationMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={resetModalState}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingInvite}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-md flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingInvite ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Generating Link...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        <span>Issue Invitation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Candidate Rubric Evaluation Scorecard Modal */}
      <EvaluationScorecardModal
        isOpen={evalModalState.isOpen}
        interviewId={evalModalState.interviewId}
        candidateName={evalModalState.candidateName}
        jobTitle={evalModalState.jobTitle}
        onClose={() => {
          setEvalModalState({
            isOpen: false,
            interviewId: null,
            candidateName: '',
            jobTitle: '',
          })
          if (activeJobId) {
            cohortCacheRef.current.delete(activeJobId)
            fetchCandidates(activeJobId)
          }
        }}
        onEvaluationComplete={() => {
          if (activeJobId) {
            cohortCacheRef.current.delete(activeJobId)
            fetchCandidates(activeJobId)
          }
        }}
      />
    </div>
  )
}

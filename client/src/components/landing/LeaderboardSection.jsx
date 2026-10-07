import React, { useState, useEffect, useRef } from 'react'
import { Filter, Download, ShieldCheck, AlertCircle, ChevronRight, Check, Trophy, Sparkles, UserCheck } from 'lucide-react'
import BorderGlow from '../common/BorderGlow.jsx'
import TextType from '../common/TextType.jsx'
import CountUp from '../common/CountUp.jsx'

const ALL_CANDIDATES = [
  {
    id: 1,
    initials: 'AC',
    name: 'Alex Chen',
    email: 'alex.chen@example.com',
    role: 'Senior Backend',
    score: 92,
    percentile: 'Top 3%',
    pillar: 'Concurrency & Goroutines',
    integrity: 'Low Risk',
    riskLevel: 'low',
    cadence: '142 WPM',
    highlight: 'Flawless channel deadlock prevention & raft consensus mechanics.',
    badgeColor: 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
  },
  {
    id: 2,
    initials: 'MP',
    name: 'Maya Patel',
    email: 'm.patel@devbox.io',
    role: 'Distributed Systems',
    score: 89,
    percentile: 'Top 7%',
    pillar: 'System Design (Raft)',
    integrity: 'Low Risk',
    riskLevel: 'low',
    cadence: '138 WPM',
    highlight: 'Accurately handled partial split-brain network partition failover.',
    badgeColor: 'bg-blue-500/10 text-blue-700 border-blue-300',
  },
  {
    id: 3,
    initials: 'SK',
    name: 'Sarah Koenig',
    email: 'sarah.k@cloudeng.com',
    role: 'Staff Infrastructure',
    score: 88,
    percentile: 'Top 9%',
    pillar: 'Kubernetes Operators',
    integrity: 'Low Risk',
    riskLevel: 'low',
    cadence: '135 WPM',
    highlight: 'Excellent CRD reconciliation loop design and failure recovery.',
    badgeColor: 'bg-indigo-500/10 text-indigo-700 border-indigo-300',
  },
  {
    id: 4,
    initials: 'DK',
    name: 'David Kim',
    email: 'davidk@domain.net',
    role: 'Fullstack Go',
    score: 78,
    percentile: 'Top 25%',
    pillar: 'REST / API Design',
    integrity: 'Focus Switched (4x)',
    riskLevel: 'flagged',
    cadence: '115 WPM',
    highlight: 'Good REST structure; flagged for 4 tab-switching events during system design.',
    badgeColor: 'bg-rose-500/10 text-rose-700 border-rose-300',
  },
]

export default function LeaderboardSection() {
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'top' | 'flagged'
  const [invitedList, setInvitedList] = useState({})
  const [selectedCandidate, setSelectedCandidate] = useState(ALL_CANDIDATES[0])
  const [inView, setInView] = useState(false)
  const leaderboardRef = useRef(null)

  useEffect(() => {
    const el = leaderboardRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setInView(true)
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const filteredCandidates = ALL_CANDIDATES.filter((c) => {
    if (filterMode === 'top') return c.score >= 88
    if (filterMode === 'flagged') return c.riskLevel === 'flagged'
    return true
  })

  const handleInvite = (id, e) => {
    e.stopPropagation()
    setInvitedList((prev) => ({ ...prev, [id]: true }))
  }

  return (
    <section id="leaderboard" className="py-24 bg-gradient-to-b from-white via-slate-50/60 to-white border-b border-slate-200/80 relative overflow-hidden bg-dot-pattern">
      {/* Background Ambient Orbs */}
      <div className="absolute top-1/3 left-10 w-96 h-96 bg-cyan-200/20 blur-3xl -z-10 rounded-full animate-float-slow pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-200/20 blur-3xl -z-10 rounded-full animate-float-reverse-slow pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold uppercase tracking-wider shadow-xs">
            <Trophy className="w-3.5 h-3.5 text-blue-600" />
            CALIBRATED TALENT CONSOLE
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-heading font-extrabold text-slate-900 tracking-tight leading-snug sm:leading-snug lg:leading-[1.3]">
            Recruiter Leaderboard &
            <span className="block mt-1 sm:mt-2 text-blue-600">
              <TextType
                text={['Cohort Calibration', 'Normalized Stack-Rankings', 'Reproducible Scorecards']}
                typingSpeed={38}
                deletingSpeed={22}
                pauseDuration={2000}
                showCursor={true}
                cursorCharacter="|"
                cursorClassName="text-blue-600 font-bold"
                className="inline-block text-blue-600"
              />
            </span>
          </h2>

          <p className="text-base text-slate-600 leading-relaxed">
            Instantly surface top-percentile engineering talent across hundreds of applicant screenings with objective, reproducible scoring.
          </p>
        </div>

        {/* Elevated Leaderboard Table Container with BorderGlow */}
        <div ref={leaderboardRef}>
          <BorderGlow
            glowColor="blue"
            backgroundColor="#ffffff"
            borderRadius={28}
            className="border border-slate-200/90 shadow-2xl max-w-6xl mx-auto"
          >
            {/* Active Requisition Top Bar */}
            <div className="p-6 sm:p-7 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-heading font-bold text-slate-900 text-base sm:text-lg">
                  Active Requisition: Staff Distributed Systems (L6)
                </h3>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                  <CountUp end={24} trigger={inView} duration={1.2} /> Evaluated
                </span>
              </div>

              {/* Filter Toggle Pills */}
              <div className="flex items-center gap-2 bg-slate-200/60 p-1 rounded-2xl border border-slate-300/80">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterMode === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All (24)
                </button>
                <button
                  onClick={() => setFilterMode('top')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterMode === 'top'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Top Tier ≥88
                </button>
                <button
                  onClick={() => setFilterMode('flagged')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    filterMode === 'flagged'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Review Flags
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/70 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                  <tr>
                    <th className="py-4 px-6">CANDIDATE</th>
                    <th className="py-4 px-6">ROLE TARGET</th>
                    <th className="py-4 px-6">COMPOSITE SCORE</th>
                    <th className="py-4 px-6">STRONGEST PILLAR</th>
                    <th className="py-4 px-6">INTEGRITY SIGNAL</th>
                    <th className="py-4 px-6 text-right">QUICK ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCandidates.map((cand, idx) => {
                    const isInvited = invitedList[cand.id]
                    const isSelected = selectedCandidate.id === cand.id
                    return (
                      <tr
                        key={cand.id}
                        onClick={() => setSelectedCandidate(cand)}
                        className={`cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50/70'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Candidate */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {cand.initials}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block text-sm flex items-center gap-2">
                                {cand.name}
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                                  {cand.percentile}
                                </span>
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {cand.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role Target */}
                        <td className="py-4 px-6 font-medium text-slate-700">
                          {cand.role}
                        </td>

                        {/* Composite Score with CountUp Animation */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className={`font-heading font-extrabold text-xl ${
                              cand.score >= 90
                                ? 'text-emerald-600'
                                : cand.score >= 80
                                ? 'text-blue-600'
                                : 'text-amber-600'
                            }`}>
                              <CountUp
                                end={cand.score}
                                trigger={inView}
                                duration={1.5}
                                delay={idx * 80}
                              />
                            </span>
                            <span className="text-xs text-slate-400 font-normal">/ 100</span>
                          </div>
                        </td>

                        {/* Strongest Pillar */}
                        <td className="py-4 px-6">
                          <span className="inline-block px-3 py-1 rounded-xl text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200/80">
                            {cand.pillar}
                          </span>
                        </td>

                        {/* Integrity Signal */}
                        <td className="py-4 px-6">
                          {cand.riskLevel === 'low' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Low Risk
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              {cand.integrity}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          {isInvited ? (
                            <span className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs">
                              <Check className="w-3.5 h-3.5" />
                              Invited!
                            </span>
                          ) : (
                            <button
                              onClick={(e) => handleInvite(cand.id, e)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-sm shadow-blue-500/20 transition-all transform hover:scale-105"
                            >
                              Invite to Team
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Selected Candidate Quick Diagnostic Bar */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-slate-50 text-slate-900 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                <div className="text-xs">
                  <span className="font-bold text-blue-900">
                    Quick Inspecting: {selectedCandidate.name} ({selectedCandidate.role})
                  </span>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    "{selectedCandidate.highlight}" • Speaking Cadence: {selectedCandidate.cadence}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-500">Click row to inspect details</span>
                <ChevronRight className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </BorderGlow>
        </div>
      </div>
    </section>
  )
}

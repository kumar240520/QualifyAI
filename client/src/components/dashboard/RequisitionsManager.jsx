import React, { useState, useEffect } from 'react'
import {
  Briefcase,
  Plus,
  Sparkles,
  Search,
  Filter,
  Layers,
  Award,
  Users,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sliders,
  RefreshCw,
} from 'lucide-react'
import { jobService } from '../../services/jobService.js'
import JobCreationModal from './JobCreationModal.jsx'

export default function RequisitionsManager({ onSelectJob }) {
  const [jobs, setJobs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchJobs = async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await jobService.listJobs()
      setJobs(data)
    } catch (err) {
      console.error('Error fetching jobs:', err)
      setError(err.message || 'Failed to load requisitions.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  const filteredJobs = jobs.filter(
    (job) =>
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.department && job.department.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleJobCreated = (newJob) => {
    fetchJobs()
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Job Requisitions & JD Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage active positions, extract competencies with Google Gemini, and calibrate rubrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchJobs}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-md flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            New Position Requisition
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Roles</span>
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{jobs.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Tenant-scoped positions</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Pipeline</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {jobs.filter((j) => j.status === 'ACTIVE' || j.status === 'DRAFT').length}
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Ready for assessment</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">JD AI Parsed</span>
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {jobs.filter((j) => j.job_requirements || j.has_requirements).length}
          </div>
          <div className="text-[11px] text-indigo-600 font-medium mt-1">Structured by Gemini</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Seniority Spread</span>
            <Award className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">Senior / Staff</div>
          <div className="text-[11px] text-slate-400 mt-1">Target competencies</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by position title or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-xs"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between text-red-700 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={fetchJobs} className="underline font-semibold hover:text-red-900">
            Try again
          </button>
        </div>
      )}

      {/* Requisitions List / Table */}
      {isLoading ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Loading requisitions from Supabase PostgreSQL...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="py-16 px-6 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
            <Briefcase className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-semibold text-slate-900">No Job Requisitions Found</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Create your first requisition, paste the raw job description, and let Google Gemini extract core competencies automatically.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 inline-flex items-center gap-2 transition"
          >
            <Sparkles className="w-4 h-4" />
            Create Position Requisition
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredJobs.map((job) => {
            const reqs = job.job_requirements
            const skillsList = reqs?.skills || []

            return (
              <div
                key={job.id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-200 hover:shadow-md transition group flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition">
                      {job.title}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                      {job.seniority || 'MID'}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${
                        job.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      {job.department || 'Engineering'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                    {reqs?.experience_years && (
                      <span className="flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-slate-400" />
                        {reqs.experience_years}+ Yrs Exp
                      </span>
                    )}
                  </div>

                  {/* Extracted Skills Pills */}
                  {skillsList.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {skillsList.slice(0, 5).map((s, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60 font-medium"
                        >
                          {typeof s === 'string' ? s : s.name}
                        </span>
                      ))}
                      {skillsList.length > 5 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200 font-medium">
                          +{skillsList.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <button
                    onClick={() => onSelectJob?.(job, 'rubric')}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                    Rubric Matrix
                  </button>
                  <button
                    onClick={() => onSelectJob?.(job, 'candidates')}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>Candidates</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <JobCreationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onJobCreated={handleJobCreated}
      />
    </div>
  )
}

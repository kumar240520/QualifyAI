import React, { useState } from 'react'
import {
  X,
  Sparkles,
  Briefcase,
  Layers,
  Award,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Cpu,
  ArrowRight,
  Loader2,
  FileText,
  Sliders,
} from 'lucide-react'
import { jobService } from '../../services/jobService.js'
import { rubricService } from '../../services/rubricService.js'
import { validateJobCreation } from '../../utils/validators.js'
import { normalizeApiError } from '../../utils/errorNormalizer.js'

const SENIORITY_LEVELS = [
  { value: 'JUNIOR', label: 'Junior (0-2 yrs)' },
  { value: 'MID', label: 'Mid-Level (3-5 yrs)' },
  { value: 'SENIOR', label: 'Senior (5-8 yrs)' },
  { value: 'STAFF', label: 'Staff Engineer (8+ yrs)' },
  { value: 'LEAD', label: 'Technical Lead (10+ yrs)' },
]

const SAMPLE_JD = `Role: Senior Distributed Systems Engineer
Department: Core Infrastructure

About the Role:
We are looking for a Senior Distributed Systems Engineer to design, build, and scale our globally distributed, low-latency microservices pipeline. You will be responsible for building high-throughput consensus protocols, resilient fault-tolerant storage systems, and real-time streaming infrastructure.

Key Responsibilities:
- Architect, build, and maintain mission-critical distributed data storage and consensus systems.
- Optimize Raft and Paxos implementations for extreme throughput and sub-millisecond p99 latency.
- Collaborate with platform security and DevOps teams to orchestrate high-availability Kubernetes deployments.
- Conduct deep post-mortems and implement automated self-healing mechanisms for cluster failovers.

Required Skills & Qualifications:
- 5+ years of production experience in Go, Rust, or modern C++.
- Deep expertise in distributed consensus protocols (Raft, Paxos, Multi-Paxos).
- Proven track record with distributed event buses (Apache Kafka, Redpanda) and distributed storage (PostgreSQL, Cassandra).
- Extensive practical experience in concurrency, lock-free data structures, and memory management.
- Strong grounding in Linux kernel internals, networking primitives (TCP/IP, gRPC, HTTP/2).

Nice to Have:
- Experience with eBPF profiling and Linux cgroups.
- Open-source contributions to CNCF or Apache distributed infrastructure projects.`

export default function JobCreationModal({ isOpen, onClose, onJobCreated }) {
  const [step, setStep] = useState(1) // 1: Input, 2: AI Parsing, 3: Review Extracted
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('Core Infrastructure')
  const [seniority, setSeniority] = useState('SENIOR')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  // Extracted Requirements state
  const [createdJob, setCreatedJob] = useState(null)
  const [extractedData, setExtractedData] = useState(null)
  const [skills, setSkills] = useState([])
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCategory, setNewSkillCategory] = useState('Core')
  const [newSkillLevel, setNewSkillLevel] = useState('Required')

  if (!isOpen) return null

  const handleUseSample = () => {
    setTitle('Senior Distributed Systems Engineer')
    setDepartment('Core Infrastructure')
    setSeniority('SENIOR')
    setDescription(SAMPLE_JD)
    setFieldErrors({})
    setError('')
  }

  const handleStartParsing = async (e) => {
    e.preventDefault()

    const validation = validateJobCreation({
      title,
      description,
      department,
      seniority,
    })

    if (!validation.isValid) {
      setFieldErrors(validation.errors)
      setError('Please provide all required fields to proceed.')
      return
    }

    setFieldErrors({})
    setError('')
    setIsLoading(true)
    setStep(2)

    try {
      // Step A: Create the Job Requisition in Database
      const job = await jobService.createJob({
        title: title.trim(),
        description: description.trim(),
        department: department.trim(),
        seniority,
      })
      setCreatedJob(job)

      // Step B: Trigger AI JD Parsing via Gemini Orchestrator
      const parsedReqs = await jobService.parseJobDescription(job.id, description.trim())
      setExtractedData(parsedReqs)
      setSkills(parsedReqs.skills || [])
      setStep(3)
    } catch (err) {
      console.error('JD Parsing Error:', err)
      const normalized = normalizeApiError(err, 'Failed to parse Job Description with AI. Please try again.')
      setError(normalized.message)
      if (normalized.fields) {
        setFieldErrors(normalized.fields)
      }
      setStep(1)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddSkill = (e) => {
    e.preventDefault()
    if (!newSkillName.trim()) return

    const newSkill = {
      name: newSkillName.trim(),
      category: newSkillCategory,
      level: newSkillLevel,
    }
    setSkills([...skills, newSkill])
    setNewSkillName('')
  }

  const handleRemoveSkill = (indexToRemove) => {
    setSkills(skills.filter((_, idx) => idx !== indexToRemove))
  }

  const handleFinalize = async () => {
    setIsLoading(true)
    setError('')
    try {
      if (createdJob?.id) {
        await jobService.updateRequirements(createdJob.id, {
          skills,
          responsibilities: extractedData?.responsibilities || [],
          technical_requirements: extractedData?.technical_requirements || [],
          role_context: extractedData?.role_context || '',
          experience_years: extractedData?.experience_years || 5,
        })

        // Generate evaluation criteria only. Gemini creates interview questions at runtime.
        try {
          await rubricService.generateRubric(createdJob.id)
        } catch (genErr) {
          console.warn('[JobCreationModal] Automatic rubric synthesis notice:', genErr.message)
        }
      }
      onJobCreated?.(createdJob)
      onClose()
    } catch (err) {
      const normalized = normalizeApiError(err, 'Failed to finalize requisition. Please try again.')
      setError(normalized.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {step === 1 && 'Create Job Requisition'}
                {step === 2 && 'AI JD Intelligence in Progress'}
                {step === 3 && 'Calibrate Extracted Requirements'}
              </h2>
              <p className="text-xs text-slate-500">
                {step === 1 && 'Define position scope & upload raw job description'}
                {step === 2 && 'Gemini is extracting competencies, seniority, and criteria'}
                {step === 3 && 'Review and fine-tune AI-extracted skills and benchmarks'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading && step === 2}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Job Details & JD Input */}
          {step === 1 && (
            <form onSubmit={handleStartParsing} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Distributed Systems Engineer"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      if (fieldErrors.title) {
                        setFieldErrors((prev) => ({ ...prev, title: null }))
                      }
                    }}
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                      fieldErrors.title
                        ? 'border-red-400 ring-2 ring-red-400/20'
                        : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                  />
                  {fieldErrors.title && (
                    <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.title}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Core Infrastructure"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Target Seniority Level
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {SENIORITY_LEVELS.map((lvl) => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setSeniority(lvl.value)}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border text-center transition ${
                        seniority === lvl.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {lvl.value}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Raw Job Description (Text) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleUseSample}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Fill with Sample Systems JD
                  </button>
                </div>
                <textarea
                  rows={8}
                  required
                  placeholder="Paste complete job description, technical requirements, responsibilities, and expected tech stack here..."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    if (fieldErrors.description) {
                      setFieldErrors((prev) => ({ ...prev, description: null }))
                    }
                  }}
                  className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 font-mono leading-relaxed text-xs transition ${
                    fieldErrors.description
                      ? 'border-red-400 ring-2 ring-red-400/20'
                      : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                />
                {fieldErrors.description && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.description}</p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium shadow-md shadow-blue-500/20 flex items-center gap-2 transition"
                >
                  <Sparkles className="w-4 h-4" />
                  Parse & Extract with AI
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Live AI Parsing Animation */}
          {step === 2 && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/25 animate-pulse">
                  <Cpu className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -inset-1 rounded-2xl border-2 border-blue-400/30 animate-spin border-t-transparent" />
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-semibold text-slate-900">
                  Google Gemini JD Intelligence Engine
                </h3>
                <p className="text-sm text-slate-500">
                  Extracting required competencies, responsibilities, and expected seniority benchmarks into structured schema...
                </p>
              </div>

              <div className="w-full max-w-sm space-y-2 text-left bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2.5 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Job Requisition Persisted to PostgreSQL</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-blue-600 font-medium animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing Tech Stack via Gemini Orchestrator...</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-400">
                  <div className="w-4 h-4 rounded-full border border-slate-300" />
                  <span>Synthesizing Multi-Dimensional Rubric</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Extracted Requirements Review & Calibration */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Context Summary Banner */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-blue-950">
                    AI Extraction Successful ({skills.length} Technical Competencies Identified)
                  </h4>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    {extractedData?.role_context ||
                      'Requisition analyzed against standard industry seniority benchmarks.'}
                  </p>
                </div>
              </div>

              {/* Skills Grid */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Extracted Competencies & Tech Stack
                  </label>
                  <span className="text-xs text-slate-400">
                    {skills.filter((s) => s.level === 'Required').length} Required •{' '}
                    {skills.filter((s) => s.level !== 'Required').length} Preferred
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {skills.map((skill, idx) => (
                    <div
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border shadow-xs transition ${
                        skill.level === 'Required'
                          ? 'bg-blue-50/90 text-blue-700 border-blue-200'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="font-semibold">{skill.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600">
                        {skill.category || 'Tech'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(idx)}
                        className="text-slate-400 hover:text-red-500 ml-1 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Custom Skill Row */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom skill (e.g. Raft Consensus)"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={newSkillLevel}
                    onChange={(e) => setNewSkillLevel(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
                  >
                    <option value="Required">Required</option>
                    <option value="Preferred">Preferred</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-medium hover:bg-slate-800 transition flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>

              {/* Responsibilities & Technical Requirements Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Core Responsibilities ({extractedData?.responsibilities?.length || 0})
                  </label>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 max-h-40 overflow-y-auto space-y-2">
                    {(extractedData?.responsibilities || []).map((resp, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <span>{resp}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Technical Specifications ({extractedData?.technical_requirements?.length || 0})
                  </label>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 max-h-40 overflow-y-auto space-y-2">
                    {(extractedData?.technical_requirements || []).map((tech, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <Award className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                        <span>{tech}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  ← Edit Raw Description
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalize}
                    disabled={isLoading}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-medium shadow-md flex items-center gap-2 transition"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm & Save Requisition
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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

const BACKGROUND_OPTIONS = [
  { value: 'TECHNICAL', label: 'Technical', desc: 'Engineering, programming, architecture, data infrastructure, and specialist technical competencies' },
  { value: 'NON_TECHNICAL', label: 'Non-Technical', desc: 'Business reasoning, management, communication, sales, marketing, operations, and behavioral competencies' },
]

const AVAILABLE_QUESTION_TYPES = [
  { id: 'MULTIPLE_CHOICE', label: 'Multiple Choice (Single Select)', desc: 'Candidate selects exactly one option from several choices' },
  { id: 'MULTI_SELECT', label: 'Multiple Select', desc: 'Candidate selects one or more valid options with partial credit' },
  { id: 'TRUE_FALSE', label: 'True / False', desc: 'Binary choice assertion and fact evaluation' },
  { id: 'SHORT_ANSWER', label: 'Short Answer', desc: 'Brief, concise conceptual responses (1–3 sentences)' },
  { id: 'DESCRIPTIVE', label: 'Descriptive / Open-Ended', desc: 'In-depth architectural, strategic, and trade-off reasoning' },
  { id: 'FILL_IN_THE_BLANK', label: 'Fill in the Blank', desc: 'Missing keyword, syntax element, or formula value' },
  { id: 'CODING_CHALLENGE', label: 'Coding Challenge', desc: 'Hands-on programming problem with description and language editor' },
  { id: 'PREDICT_CODE_OUTPUT', label: 'Predict Code Output', desc: 'Technical code snippet analysis to determine output or state' },
  { id: 'DEBUGGING', label: 'Debugging / Find Error', desc: 'Identify defective code, root cause explanation, and correction' },
  { id: 'COMPLETE_THE_CODE', label: 'Complete the Code', desc: 'Incomplete code snippet with missing expressions or blocks to fill' },
  { id: 'ARRANGE_ORDER', label: 'Arrange in Correct Order', desc: 'Reorderable workflow, lifecycle, or algorithm sequence steps' },
  { id: 'SELECT_MOST_APPROPRIATE', label: 'Select Best Option', desc: 'Situational judgment scenario with multiple valid courses of action' },
  { id: 'SLIDER_SCALE', label: 'Slider / Numeric Scale', desc: 'Quantitative rating or scale with configurable bounds and step' },
  { id: 'MATCHING_PAIRS', label: 'Matching / Pairing', desc: 'Match related concepts between two sets of items' },
  { id: 'NUMERICAL_APTITUDE', label: 'Numerical / Aptitude', desc: 'Quantitative reasoning, calculations, units, and step methodology' },
]

const DIFFICULTY_OPTIONS = [
  { value: 'EASY', label: 'Easy (Foundational)' },
  { value: 'MEDIUM', label: 'Medium (Standard)' },
  { value: 'HARD', label: 'Hard (Staff / Principal)' },
]

export default function JobCreationModal({ isOpen, onClose, onJobCreated, jobToEdit = null }) {
  const [step, setStep] = useState(1) // 1: Input, 2: AI Parsing, 3: Review Extracted
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('Core Infrastructure')
  const [seniority, setSeniority] = useState('SENIOR')
  const [backgroundType, setBackgroundType] = useState('TECHNICAL')
  const [customBackground, setCustomBackground] = useState('')
  const [allowedQuestionTypes, setAllowedQuestionTypes] = useState([
    'MULTIPLE_CHOICE',
    'MULTI_SELECT',
    'SHORT_ANSWER',
    'DESCRIPTIVE',
    'CODING_CHALLENGE',
  ])
  const [customQuestionTypes, setCustomQuestionTypes] = useState([])
  const [newCustomTypeInput, setNewCustomTypeInput] = useState('')
  const [askAboutProjects, setAskAboutProjects] = useState(true)
  const [targetDifficulty, setTargetDifficulty] = useState('MEDIUM')
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

  React.useEffect(() => {
    if (!isOpen) return
    if (jobToEdit) {
      setTitle(jobToEdit.title || '')
      setDepartment(jobToEdit.department || 'Engineering')
      setSeniority(jobToEdit.seniority || 'MID')
      setBackgroundType(jobToEdit.background_type || 'TECHNICAL')
      setCustomBackground(jobToEdit.custom_background || '')
      setAllowedQuestionTypes(
        Array.isArray(jobToEdit.allowed_question_types) && jobToEdit.allowed_question_types.length > 0
          ? jobToEdit.allowed_question_types
          : ['MULTIPLE_CHOICE', 'SHORT_ANSWER', 'DESCRIPTIVE']
      )
      setCustomQuestionTypes(Array.isArray(jobToEdit.custom_question_types) ? jobToEdit.custom_question_types : [])
      setAskAboutProjects(jobToEdit.ask_about_projects ?? true)
      setTargetDifficulty(jobToEdit.target_difficulty || 'MEDIUM')
      setDescription(jobToEdit.description || '')
      setStep(1)
      setCreatedJob(jobToEdit)
    } else {
      setTitle('')
      setDepartment('Core Infrastructure')
      setSeniority('SENIOR')
      setBackgroundType('TECHNICAL')
      setCustomBackground('')
      setAllowedQuestionTypes([
        'MULTIPLE_CHOICE',
        'MULTI_SELECT',
        'SHORT_ANSWER',
        'DESCRIPTIVE',
        'CODING_CHALLENGE',
      ])
      setCustomQuestionTypes([])
      setAskAboutProjects(true)
      setTargetDifficulty('MEDIUM')
      setDescription('')
      setStep(1)
      setCreatedJob(null)
    }
    setFieldErrors({})
    setError('')
  }, [isOpen, jobToEdit])

  if (!isOpen) return null

  const handleUseSample = () => {
    setTitle('Senior Distributed Systems Engineer')
    setDepartment('Core Infrastructure')
    setSeniority('SENIOR')
    setBackgroundType('TECHNICAL')
    setCustomBackground('')
    setAllowedQuestionTypes(['SHORT_ANSWER', 'DESCRIPTIVE', 'MULTIPLE_CHOICE', 'SCENARIO'])
    setAskAboutProjects(true)
    setTargetDifficulty('MEDIUM')
    setDescription(SAMPLE_JD)
    setFieldErrors({})
    setError('')
  }

  const handleBackgroundChange = (newBg) => {
    setBackgroundType(newBg)
    if (newBg === 'TECHNICAL') {
      setAskAboutProjects(true)
    }
    if (fieldErrors.custom_background) {
      setFieldErrors((prev) => ({ ...prev, custom_background: null }))
    }
  }

  const toggleQuestionType = (typeId) => {
    if (allowedQuestionTypes.includes(typeId)) {
      if (allowedQuestionTypes.length === 1 && customQuestionTypes.length === 0) {
        setFieldErrors((prev) => ({
          ...prev,
          allowed_question_types: 'At least one question type must remain selected.',
        }))
        return
      }
      setAllowedQuestionTypes(allowedQuestionTypes.filter((t) => t !== typeId))
    } else {
      setAllowedQuestionTypes([...allowedQuestionTypes, typeId])
      setFieldErrors((prev) => ({ ...prev, allowed_question_types: null }))
    }
  }

  const handleAddCustomType = (e) => {
    e?.preventDefault()
    const clean = newCustomTypeInput.trim()
    if (!clean) return
    if (!customQuestionTypes.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setCustomQuestionTypes([...customQuestionTypes, clean])
      setFieldErrors((prev) => ({ ...prev, allowed_question_types: null }))
    }
    setNewCustomTypeInput('')
  }

  const handleRemoveCustomType = (typeToRemove) => {
    const nextCustom = customQuestionTypes.filter((t) => t !== typeToRemove)
    setCustomQuestionTypes(nextCustom)
    if (nextCustom.length === 0 && allowedQuestionTypes.length === 0) {
      setFieldErrors((prev) => ({
        ...prev,
        allowed_question_types: 'At least one question type must remain selected.',
      }))
    }
  }

  const handleStartParsing = async (e) => {
    e.preventDefault()

    const validation = validateJobCreation({
      title,
      description,
      department,
      seniority,
      background_type: backgroundType,
      custom_background: customBackground,
      allowed_question_types: [...allowedQuestionTypes, ...customQuestionTypes],
    })

    if (!validation.isValid) {
      setFieldErrors(validation.errors)
      setError('Please review highlighted configuration errors before proceeding.')
      return
    }

    setFieldErrors({})
    setError('')
    setIsLoading(true)
    setStep(2)

    try {
      if (jobToEdit?.id) {
        const updated = await jobService.updateJob(jobToEdit.id, {
          title: title.trim(),
          description: description.trim(),
          department: department.trim(),
          seniority,
          background_type: backgroundType,
          custom_background: backgroundType === 'CUSTOM' ? customBackground.trim() : null,
          allowed_question_types: allowedQuestionTypes,
          custom_question_types: customQuestionTypes,
          ask_about_projects: askAboutProjects,
          target_difficulty: targetDifficulty,
        })
        setCreatedJob(updated)
        onJobCreated?.(updated)
        onClose()
        return
      }

      // Step A: Create the Job Requisition in Database with complete configuration
      const job = await jobService.createJob({
        title: title.trim(),
        description: description.trim(),
        department: department.trim(),
        seniority,
        background_type: backgroundType,
        custom_background: backgroundType === 'CUSTOM' ? customBackground.trim() : null,
        allowed_question_types: allowedQuestionTypes,
        custom_question_types: customQuestionTypes,
        ask_about_projects: askAboutProjects,
        target_difficulty: targetDifficulty,
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

              {/* Background Selection (Requirement 1) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Job Background <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BACKGROUND_OPTIONS.map((bg) => (
                    <button
                      key={bg.value}
                      type="button"
                      onClick={() => handleBackgroundChange(bg.value)}
                      className={`p-3 text-left rounded-xl border transition ${
                        backgroundType === bg.value
                          ? 'bg-blue-50/70 border-blue-600 ring-1 ring-blue-600/30'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${backgroundType === bg.value ? 'text-blue-700' : 'text-slate-800'}`}>
                          {bg.label}
                        </span>
                        {backgroundType === bg.value && (
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{bg.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Custom Background Input (appears only when Custom is selected) */}
                {backgroundType === 'CUSTOM' && (
                  <div className="mt-2.5">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Custom Background Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Finance, Human Resources, Operations, Product Management"
                      value={customBackground}
                      onChange={(e) => {
                        setCustomBackground(e.target.value)
                        if (fieldErrors.custom_background) {
                          setFieldErrors((prev) => ({ ...prev, custom_background: null }))
                        }
                      }}
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
                        fieldErrors.custom_background
                          ? 'border-red-400 ring-2 ring-red-400/20'
                          : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                    />
                    {fieldErrors.custom_background && (
                      <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.custom_background}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Target Seniority & Difficulty Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Target Seniority Level
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {SENIORITY_LEVELS.map((lvl) => (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() => setSeniority(lvl.value)}
                        className={`px-2 py-2 text-[11px] font-medium rounded-xl border text-center transition ${
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Assessment Difficulty (Requirement 9)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DIFFICULTY_OPTIONS.map((diff) => (
                      <button
                        key={diff.value}
                        type="button"
                        onClick={() => setTargetDifficulty(diff.value)}
                        className={`px-2 py-2 text-xs font-medium rounded-xl border text-center transition ${
                          targetDifficulty === diff.value
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {diff.value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Allowed Question Types (Requirement 2) & Custom Options (Addition 1) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800">
                      Permitted Question Types <span className="text-red-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      The AI will strictly only ask question types selected here.
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    {allowedQuestionTypes.length + customQuestionTypes.length} Active
                  </span>
                </div>

                {fieldErrors.allowed_question_types && (
                  <p className="text-xs text-red-600 font-medium">{fieldErrors.allowed_question_types}</p>
                )}

                {/* Predefined Types Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_QUESTION_TYPES.map((type) => {
                    const isSelected = allowedQuestionTypes.includes(type.id)
                    return (
                      <div
                        key={type.id}
                        onClick={() => toggleQuestionType(type.id)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-300 text-blue-900 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by parent onClick
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 pointer-events-none"
                        />
                        <div>
                          <div className="text-xs font-semibold">{type.label}</div>
                          <div className="text-[10px] text-slate-500 leading-tight">{type.desc}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Recruiter-Defined Custom Question Options (Addition 1) */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Recruiter-Defined Custom Question Options / Formats
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. System Design Architecture, Pitch Scenario, Budget Walkthrough"
                      value={newCustomTypeInput}
                      onChange={(e) => setNewCustomTypeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCustomType()
                        }
                      }}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomType}
                      disabled={!newCustomTypeInput.trim()}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg disabled:opacity-50 flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Custom
                    </button>
                  </div>

                  {customQuestionTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {customQuestionTypes.map((customType) => (
                        <span
                          key={customType}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium"
                        >
                          {customType}
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomType(customType)}
                            className="p-0.5 hover:text-indigo-900 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Ask About Projects / Relevant Experience Toggle (Requirement 7) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-800">
                    Ask About Projects / Relevant Experience
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {backgroundType === 'TECHNICAL'
                      ? 'AI will probe candidate system architecture, challenges, trade-offs, and contributions.'
                      : 'AI will adapt inquiry to relevant campaigns, commercial initiatives, or leadership milestones.'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAskAboutProjects(true)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg border transition ${
                      askAboutProjects
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Enabled
                  </button>
                  <button
                    type="button"
                    onClick={() => setAskAboutProjects(false)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg border transition ${
                      !askAboutProjects
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Disabled
                  </button>
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

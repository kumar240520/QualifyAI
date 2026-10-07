import React, { useState, useEffect } from 'react'
import {
  Sliders,
  Sparkles,
  Award,
  Layers,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Loader2,
  FileCheck,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react'
import { rubricService } from '../../services/rubricService.js'

export default function RubricMatrixView({ job, onBack, onProceedToInvitations }) {
  const [rubric, setRubric] = useState(null)
  const [criteria, setCriteria] = useState([])
  const [questions, setQuestions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [expandedCriterionId, setExpandedCriterionId] = useState(null)
  const [questionFilter, setQuestionFilter] = useState('ALL')

  // New Question Form state
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [newQuestionText, setNewQuestionText] = useState('')
  const [newQuestionType, setNewQuestionType] = useState('TECHNICAL')
  const [newQuestionDifficulty, setNewQuestionDifficulty] = useState('MEDIUM')
  const [newQuestionConcepts, setNewQuestionConcepts] = useState('')

  const fetchRubricAndQuestions = async () => {
    if (!job?.id) return
    setIsLoading(true)
    setError('')
    try {
      // 1. Fetch Rubric
      try {
        const rubricData = await rubricService.getRubric(job.id)
        if (rubricData) {
          setRubric(rubricData)
          setCriteria(rubricData.rubric_criteria || [])
        }
      } catch (err) {
        // If rubric does not exist yet, we will offer automatic AI synthesis
        setRubric(null)
        setCriteria([])
      }

      // 2. Fetch Questions
      try {
        const questionsData = await rubricService.getQuestions(job.id)
        setQuestions(questionsData || [])
      } catch (err) {
        setQuestions([])
      }
    } catch (err) {
      console.error('Error fetching rubric details:', err)
      setError(err.message || 'Failed to load rubric.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRubricAndQuestions()
  }, [job?.id])

  const handleGenerateWithAI = async () => {
    setIsGenerating(true)
    setError('')
    setSuccessMessage('')
    try {
      // 1. Generate Rubric
      const generatedRubric = await rubricService.generateRubric(job.id)
      setRubric(generatedRubric)
      setCriteria(generatedRubric.rubric_criteria || [])

      // 2. Generate Question Pool
      const generatedQuestions = await rubricService.generateQuestions(job.id)
      setQuestions(generatedQuestions)

      setSuccessMessage('Google Gemini has successfully calibrated the 5-pillar rubric and synthesized targeted interview questions!')
    } catch (err) {
      console.error('AI Rubric Generation Error:', err)
      setError(err.message || 'Failed to generate rubric and questions with Gemini.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleWeightChange = (index, newWeight) => {
    const updated = [...criteria]
    updated[index].weight = Number(newWeight)
    setCriteria(updated)
  }

  const handleAddCriterion = () => {
    const newCrit = {
      name: 'New Custom Competency',
      description: 'Custom evaluation benchmark',
      weight: 3,
      expected_competency: 'Expected candidate signals',
      evaluation_guidance: {
        level1: 'Fails to explain core concepts or provides incorrect statements.',
        level3: 'Accurately explains standard implementation details and trade-offs.',
        level5: 'Demonstrates deep systems mastery, edge-case anticipation, and production battle scars.',
      },
    }
    setCriteria([...criteria, newCrit])
  }

  const handleRemoveCriterion = (index) => {
    setCriteria(criteria.filter((_, i) => i !== index))
  }

  const handleSaveRubric = async () => {
    setIsSaving(true)
    setError('')
    setSuccessMessage('')
    try {
      await rubricService.updateRubric(job.id, criteria)
      setSuccessMessage('Rubric matrix calibrated and saved to database successfully!')
    } catch (err) {
      setError(err.message || 'Failed to save rubric.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddCustomQuestion = async (e) => {
    e.preventDefault()
    if (!newQuestionText.trim()) return

    try {
      const conceptsArray = newQuestionConcepts
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)

      const created = await rubricService.createQuestion(job.id, {
        question_text: newQuestionText.trim(),
        type: newQuestionType,
        difficulty: newQuestionDifficulty,
        metadata: {
          expectedConcepts: conceptsArray,
          topic: job.department || 'Technical Architecture',
        },
      })

      setQuestions([created, ...questions])
      setNewQuestionText('')
      setNewQuestionConcepts('')
      setShowAddQuestion(false)
    } catch (err) {
      setError(err.message || 'Failed to add question.')
    }
  }

  const handleDeleteQuestion = async (questionId) => {
    try {
      await rubricService.deleteQuestion(job.id, questionId)
      setQuestions(questions.filter((q) => q.id !== questionId))
    } catch (err) {
      setError(err.message || 'Failed to delete question.')
    }
  }

  const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 1), 0)

  const filteredQuestions = questions.filter((q) => {
    if (questionFilter === 'ALL') return true
    return q.type === questionFilter
  })

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
            >
              ← Back to Requisitions
            </button>
            <span className="text-slate-300">•</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono font-bold uppercase">
              {job?.seniority || 'SENIOR'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-blue-600" />
            <span>Rubric Matrix: {job?.title}</span>
          </h1>
          <p className="text-xs text-slate-500">
            Define 5-pillar objective benchmarks (1–5 scale) and calibrate targeted interview question roadmaps.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleGenerateWithAI}
            disabled={isGenerating}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-2 transition"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{criteria.length === 0 ? 'Synthesize Rubric with Gemini' : 'Re-Calibrate with AI'}</span>
          </button>
          {criteria.length > 0 && (
            <button
              onClick={handleSaveRubric}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save Rubric</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Loading rubric matrix and criteria...</p>
        </div>
      ) : criteria.length === 0 ? (
        /* Empty State / Trigger AI Synthesis */
        <div className="py-16 px-6 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
            <Sliders className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-slate-900">No Rubric Matrix Calibrated Yet</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Google Gemini can automatically synthesize a 5-pillar objective scoring rubric (1–5 scale benchmarks) and generate targeted interview questions based on the parsed job description.
            </p>
          </div>
          <button
            onClick={handleGenerateWithAI}
            disabled={isGenerating}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 inline-flex items-center gap-2 transition"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Synthesize 5-Pillar Rubric & Question Bank</span>
          </button>
        </div>
      ) : (
        /* Calibrated Rubric View */
        <div className="space-y-8">
          {/* SECTION 1: 5-PILLAR EVALUATION CRITERIA MATRIX */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Evaluation Criteria Matrix ({criteria.length} Pillars)
                </h2>
                <p className="text-xs text-slate-500">
                  Each pillar defines specific grading benchmarks used by the AI Evaluator during transcript analysis.
                </p>
              </div>
              <button
                onClick={handleAddCriterion}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Pillar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {criteria.map((crit, idx) => {
                const guidance = crit.evaluation_guidance || {}
                const weightPercent = totalWeight > 0 ? Math.round((crit.weight / totalWeight) * 100) : 20
                const isExpanded = expandedCriterionId === idx

                return (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4 transition hover:border-slate-300"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center border border-blue-100">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={crit.name}
                            onChange={(e) => {
                              const updated = [...criteria]
                              updated[idx].name = e.target.value
                              setCriteria(updated)
                            }}
                            className="font-bold text-sm text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition px-1"
                          />
                        </div>
                        <input
                          type="text"
                          value={crit.description || ''}
                          onChange={(e) => {
                            const updated = [...criteria]
                            updated[idx].description = e.target.value
                            setCriteria(updated)
                          }}
                          placeholder="Brief description of competency focus..."
                          className="text-xs text-slate-500 w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition px-1"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Weight Slider / Selector */}
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                          <span className="text-[11px] font-medium text-slate-500">Weight:</span>
                          <select
                            value={crit.weight || 1}
                            onChange={(e) => handleWeightChange(idx, e.target.value)}
                            className="bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-800 px-2 py-0.5"
                          >
                            <option value={1}>1x (Low)</option>
                            <option value={2}>2x</option>
                            <option value={3}>3x (Medium)</option>
                            <option value={4}>4x</option>
                            <option value={5}>5x (Critical)</option>
                          </select>
                          <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            {weightPercent}%
                          </span>
                        </div>

                        {/* Expand Benchmarks Button */}
                        <button
                          type="button"
                          onClick={() => setExpandedCriterionId(isExpanded ? null : idx)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                          title="Toggle 1-3-5 Level Benchmarks"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {/* Delete Criterion */}
                        <button
                          type="button"
                          onClick={() => handleRemoveCriterion(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                          title="Delete Criterion"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* 1–3–5 SCORING BENCHMARK ACCORDION */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-rose-700">
                            <span>Level 1: Novice / Weak</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-rose-100/80 rounded">0-59</span>
                          </div>
                          <p className="text-xs text-rose-950 leading-relaxed">
                            {guidance.level1 || 'Superficial answers, confusion of core abstractions, or inability to answer.'}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-blue-700">
                            <span>Level 3: Competent</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-100/80 rounded">70-84</span>
                          </div>
                          <p className="text-xs text-blue-950 leading-relaxed">
                            {guidance.level3 || 'Solid functional understanding, handles standard implementation patterns and trade-offs.'}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700">
                            <span>Level 5: Mastery</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-100/80 rounded">95-100</span>
                          </div>
                          <p className="text-xs text-emerald-950 leading-relaxed">
                            {guidance.level5 || 'Architectural mastery, deep edge-case intuition, trade-off depth, production war stories.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* SECTION 2: SYNTHESIZED QUESTION BANK POOL */}
          <div className="space-y-4 pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Targeted Interview Question Pool ({questions.length} Questions)
                </h2>
                <p className="text-xs text-slate-500">
                  AI questions generated by Gemini and grounded directly in the calibrated rubric dimensions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Type Filter Pills */}
                <div className="flex flex-wrap items-center p-1 bg-slate-100 rounded-xl text-xs gap-1">
                  {[
                    { key: 'ALL', label: 'All' },
                    { key: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
                    { key: 'CODE_OUTPUT', label: 'Code Output' },
                    { key: 'CODE_WRITING', label: 'Coding' },
                    { key: 'SQL', label: 'SQL' },
                    { key: 'SCENARIO', label: 'Scenario' },
                    { key: 'TRUE_FALSE', label: 'True/False' },
                    { key: 'TECHNICAL', label: 'Technical' },
                  ].map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setQuestionFilter(t.key)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                        questionFilter === t.key
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowAddQuestion(true)}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Question
                </button>
              </div>
            </div>

            {/* Custom Question Form */}
            {showAddQuestion && (
              <form onSubmit={handleAddCustomQuestion} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Add Custom Interview Question</h4>
                  <button type="button" onClick={() => setShowAddQuestion(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    ✕
                  </button>
                </div>
                <textarea
                  rows={2}
                  required
                  placeholder="Enter technical interview question prompt..."
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={newQuestionType}
                    onChange={(e) => setNewQuestionType(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700"
                  >
                    <option value="MULTIPLE_CHOICE">Multiple Choice (MCQ)</option>
                    <option value="CODE_OUTPUT">Code Output Prediction</option>
                    <option value="CODE_WRITING">Code Implementation</option>
                    <option value="SQL">SQL Query</option>
                    <option value="SCENARIO">System Incident / Scenario</option>
                    <option value="TRUE_FALSE">True / False</option>
                    <option value="TECHNICAL">Technical Deep-Dive</option>
                    <option value="SYSTEM_DESIGN">System Design</option>
                    <option value="PROBLEM_SOLVING">Problem Solving</option>
                  </select>
                  <select
                    value={newQuestionDifficulty}
                    onChange={(e) => setNewQuestionDifficulty(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Expected concepts (comma separated)..."
                    value={newQuestionConcepts}
                    onChange={(e) => setNewQuestionConcepts(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddQuestion(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-600 hover:bg-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                  >
                    Save to Question Pool
                  </button>
                </div>
              </form>
            )}

            {/* Questions List */}
            <div className="grid grid-cols-1 gap-3">
              {filteredQuestions.map((q, idx) => {
                const meta = q.metadata || {}
                const concepts = meta.expected_concepts || meta.expectedConcepts || []
                const options = Array.isArray(meta.options) ? meta.options : []
                const codeSnippet = meta.code_snippet || meta.code || null
                const language = meta.language || 'javascript'
                const correctAnswer = meta.correct_answer || ''

                const typeBadgeColors = {
                  MULTIPLE_CHOICE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                  CODE_OUTPUT: 'bg-amber-50 text-amber-700 border-amber-200',
                  CODE_WRITING: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  SQL: 'bg-cyan-50 text-cyan-700 border-cyan-200',
                  SCENARIO: 'bg-purple-50 text-purple-700 border-purple-200',
                  TRUE_FALSE: 'bg-blue-50 text-blue-700 border-blue-200',
                  TECHNICAL: 'bg-slate-100 text-slate-700 border-slate-200',
                }

                return (
                  <div
                    key={q.id || idx}
                    className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition"
                  >
                    <div className="space-y-2.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${typeBadgeColors[q.type] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {q.type.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                            q.difficulty === 'HARD'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : q.difficulty === 'MEDIUM'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {q.difficulty}
                        </span>
                        {correctAnswer && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Key: {correctAnswer}
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                        {q.question_text}
                      </p>

                      {/* Code Snippet Preview */}
                      {codeSnippet && (
                        <div className="rounded-lg bg-slate-900 p-3 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-36 border border-slate-800">
                          <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider">{language} Snippet:</div>
                          <pre>{codeSnippet}</pre>
                        </div>
                      )}

                      {/* Multiple Choice Options Preview */}
                      {options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {options.map((opt, oIdx) => (
                            <div key={oIdx} className="text-[11px] p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700">
                              {typeof opt === 'string' ? opt : opt.label || JSON.stringify(opt)}
                            </div>
                          ))}
                        </div>
                      )}

                      {concepts.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-slate-400 font-medium">Expected Signals:</span>
                          {concepts.map((concept, cIdx) => (
                            <span
                              key={cIdx}
                              className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100 font-medium"
                            >
                              {concept}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition shrink-0 cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* SECTION 3: FOOTER ACTIONS */}
          <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={onBack}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              ← Back to Requisitions
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveRubric}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
              >
                {isSaving ? 'Saving...' : 'Save Draft Rubric'}
              </button>
              <button
                onClick={() => onProceedToInvitations?.(job)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition"
              >
                <span>Proceed to Candidate Invitations</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

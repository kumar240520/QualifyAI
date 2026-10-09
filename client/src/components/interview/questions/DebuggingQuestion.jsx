import React, { useState } from 'react'
import { Send, Loader2, Bug, Code2, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function DebuggingQuestion({
  question,
  value = null,
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const codeSnippet = question.codeSnippet || `// Defective snippet\nfunction calculateAverage(items) {\n  let sum = 0;\n  for (let i = 0; i <= items.length; i++) {\n    sum += items[i];\n  }\n  return sum / items.length;\n}`
  const initialExplanation = typeof value === 'string' ? value : value?.bugExplanation || value?.text || ''
  const initialCorrection = value?.correctedCode || ''

  const [explanation, setExplanation] = useState(initialExplanation)
  const [correctedCode, setCorrectedCode] = useState(initialCorrection)
  const [activeTab, setActiveTab] = useState('both') // 'both' | 'explanation' | 'fix'

  const lines = codeSnippet.split('\n')

  const handleExplanationChange = (e) => {
    const val = e.target.value
    setExplanation(val)
    onChange({
      bugExplanation: val,
      correctedCode,
      text: `Bug: ${val}${correctedCode ? ` | Fix:\n${correctedCode}` : ''}`,
      inputMethod: 'debugging',
    })
  }

  const handleCorrectionChange = (e) => {
    const val = e.target.value
    setCorrectedCode(val)
    onChange({
      bugExplanation: explanation,
      correctedCode: val,
      text: `Bug: ${explanation}${val ? ` | Fix:\n${val}` : ''}`,
      inputMethod: 'debugging',
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!explanation.trim() && !correctedCode.trim()) return
    if (isSubmitting || isAiSpeaking) return

    onSubmit({
      bugExplanation: explanation.trim(),
      correctedCode: correctedCode.trim(),
      text: `Bug Identified: ${explanation.trim()}${correctedCode.trim() ? `\n\nProposed Correction:\n${correctedCode.trim()}` : ''}`,
      inputMethod: 'debugging',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      {/* Code Snippet Viewer with Line Numbers */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/80 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2 text-rose-400">
            <Bug className="w-3.5 h-3.5" />
            <span className="uppercase text-[11px] font-bold">
              {question.language || 'Code'} with Bug / Defect
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-sans">
            Identify the defect & propose the fix
          </span>
        </div>

        <div className="flex bg-slate-900 max-h-[220px] overflow-y-auto font-mono text-xs leading-relaxed">
          <div className="select-none py-3 px-3 text-right bg-slate-950/40 text-slate-600 border-r border-slate-800/80 w-10 shrink-0">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <pre className="p-3 text-slate-200 overflow-x-auto flex-1 font-mono">
            <code>{codeSnippet}</code>
          </pre>
        </div>
      </div>

      {/* Answer Form: Bug Explanation + Correction */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Defect Analysis Input */}
        <div className="rounded-2xl bg-white border border-slate-200/90 p-3.5 shadow-2xs flex flex-col gap-2">
          <label className="text-[11px] font-mono font-bold text-slate-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>1. WHAT IS THE BUG & WHY DOES IT OCCUR?</span>
          </label>
          <textarea
            value={explanation}
            onChange={handleExplanationChange}
            disabled={isSubmitting || isAiSpeaking}
            rows={3}
            placeholder="Explain the defect, off-by-one boundary, null pointer, concurrency race, or logic error..."
            className="w-full bg-slate-50/70 rounded-xl p-2.5 text-xs text-slate-800 border border-slate-200 outline-none focus:border-blue-500 resize-none font-sans leading-relaxed"
          />
        </div>

        {/* Correction Code / Diff */}
        <div className="rounded-2xl bg-white border border-slate-200/90 p-3.5 shadow-2xs flex flex-col gap-2">
          <label className="text-[11px] font-mono font-bold text-slate-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>2. CORRECTED CODE OR FIX (OPTIONAL/RECOMMENDED)</span>
          </label>
          <textarea
            value={correctedCode}
            onChange={handleCorrectionChange}
            disabled={isSubmitting || isAiSpeaking}
            rows={3}
            placeholder="// Paste corrected line(s) or solution here..."
            className="w-full bg-slate-900 rounded-xl p-2.5 text-xs text-emerald-300 border border-slate-800 outline-none focus:border-emerald-500 resize-none font-mono leading-relaxed"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-slate-500 font-sans">
          Provide your defect analysis and click submit.
        </span>
        <button
          type="submit"
          disabled={(!explanation.trim() && !correctedCode.trim()) || isSubmitting || isAiSpeaking}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-xs shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>Submit Debugging Solution</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}

import React, { useState } from 'react'
import { Calculator, Send, Loader2, Hash, FileText } from 'lucide-react'

export default function NumericalAptitudeQuestion({
  question,
  value = null,
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const config = question.numericalConfig || {}
  const unit = config.unit || ''
  const precision = typeof config.precision === 'number' ? config.precision : 2

  const initialNum = value?.numericAnswer !== undefined
    ? String(value.numericAnswer)
    : (typeof value === 'number' ? String(value) : (typeof value === 'string' ? value : ''))
  const initialSteps = value?.workingSteps || ''

  const [numValue, setNumValue] = useState(initialNum)
  const [workingSteps, setWorkingSteps] = useState(initialSteps)
  const [showWorking, setShowWorking] = useState(false)

  const handleNumChange = (e) => {
    const val = e.target.value
    setNumValue(val)
    onChange({
      numericAnswer: val ? Number(val) : null,
      workingSteps,
      text: `${val}${unit ? ` ${unit}` : ''}${workingSteps ? ` (Work: ${workingSteps})` : ''}`,
      inputMethod: 'numerical',
    })
  }

  const handleStepsChange = (e) => {
    const steps = e.target.value
    setWorkingSteps(steps)
    onChange({
      numericAnswer: numValue ? Number(numValue) : null,
      workingSteps: steps,
      text: `${numValue}${unit ? ` ${unit}` : ''}${steps ? ` (Work: ${steps})` : ''}`,
      inputMethod: 'numerical',
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!numValue.trim() || isSubmitting || isAiSpeaking) return

    const parsed = Number(numValue.trim())
    onSubmit({
      numericAnswer: isNaN(parsed) ? numValue.trim() : parsed,
      workingSteps: workingSteps.trim(),
      text: `${numValue.trim()}${unit ? ` ${unit}` : ''}${workingSteps.trim() ? `\n\nWorking Steps:\n${workingSteps.trim()}` : ''}`,
      inputMethod: 'numerical',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 w-full">
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <Calculator className="w-3.5 h-3.5 text-blue-600" />
          <span>QUANTITATIVE & NUMERICAL APTITUDE</span>
        </div>
        {unit && <span>Expected Unit: {unit}</span>}
      </div>

      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col gap-3">
        {/* Numeric Answer Field */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 font-sans flex items-center justify-between">
            <span>Final Numeric Answer:</span>
            {precision !== null && (
              <span className="text-[10px] text-slate-400 font-mono">
                Round to {precision} decimal places if applicable
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                step="any"
                value={numValue}
                onChange={handleNumChange}
                disabled={isSubmitting || isAiSpeaking}
                placeholder="Enter calculated number (e.g. 42, 3.14, 1500)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
            {unit && (
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 font-mono text-xs font-bold text-slate-700 shrink-0">
                {unit}
              </div>
            )}
          </div>
        </div>

        {/* Optional Working / Step-by-Step Scratchpad */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowWorking(!showWorking)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition font-medium cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{showWorking ? 'Hide' : 'Add'} Working / Step-by-Step Formula (Optional)</span>
          </button>

          {showWorking && (
            <div className="mt-2 animate-fade-in">
              <textarea
                value={workingSteps}
                onChange={handleStepsChange}
                disabled={isSubmitting || isAiSpeaking}
                rows={3}
                placeholder="Show your equations, intermediate steps, or methodology for partial credit..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-sans resize-none outline-none focus:border-blue-500 focus:bg-white leading-relaxed"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-slate-500 font-sans">
          Enter your final numerical value and click submit.
        </span>

        <button
          type="submit"
          disabled={!numValue.trim() || isSubmitting || isAiSpeaking}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-xs shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>Submit Answer</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}

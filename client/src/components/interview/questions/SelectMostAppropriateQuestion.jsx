import React, { useState } from 'react'
import { Send, Loader2, CheckCircle2, Circle, HelpCircle, Layers } from 'lucide-react'

export default function SelectMostAppropriateQuestion({
  question,
  value = null,
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const options = question.options && question.options.length > 0
    ? question.options
    : [
        { id: 'opt-a', key: 'A', label: 'Action A: Immediate mitigation & rollback' },
        { id: 'opt-b', key: 'B', label: 'Action B: Route traffic to secondary region' },
        { id: 'opt-c', key: 'C', label: 'Action C: Debug active instance in isolation' },
        { id: 'opt-d', key: 'D', label: 'Action D: Notify executive stakeholder team' },
      ]

  const selectedId = value?.selectedOptionId || (typeof value === 'string' ? value : null)
  const initialRationale = value?.rationale || ''
  const [rationale, setRationale] = useState(initialRationale)

  const handleSelect = (opt) => {
    if (isSubmitting || isAiSpeaking) return
    onChange({
      selectedOptionId: opt.id,
      label: opt.label,
      key: opt.key,
      rationale,
      text: `${opt.key ? `${opt.key}: ` : ''}${opt.label}${rationale ? ` (Rationale: ${rationale})` : ''}`,
      inputMethod: 'selection',
    })
  }

  const handleRationaleChange = (e) => {
    const r = e.target.value
    setRationale(r)
    if (selectedId) {
      const matched = options.find((o) => o.id === selectedId) || options[0]
      onChange({
        selectedOptionId: matched.id,
        label: matched.label,
        key: matched.key,
        rationale: r,
        text: `${matched.key ? `${matched.key}: ` : ''}${matched.label}${r ? ` (Rationale: ${r})` : ''}`,
        inputMethod: 'selection',
      })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedId || isSubmitting || isAiSpeaking) return
    const matched = options.find((o) => o.id === selectedId) || options[0]
    onSubmit({
      selectedOptionId: matched.id,
      label: matched.label,
      key: matched.key,
      rationale: rationale.trim(),
      text: `${matched.key ? `${matched.key}: ` : ''}${matched.label}${rationale.trim() ? `\n\nDecision Rationale:\n${rationale.trim()}` : ''}`,
      inputMethod: 'selection',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 w-full">
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span>SELECT THE MOST APPROPRIATE ACTION / SOLUTION</span>
        </div>
        <span>{options.length} options evaluated</span>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {options.map((opt, idx) => {
          const isSelected = selectedId === opt.id || selectedId === opt.label
          const badgeKey = opt.key || String.fromCharCode(65 + idx)

          return (
            <button
              key={opt.id || idx}
              type="button"
              onClick={() => handleSelect(opt)}
              disabled={isSubmitting || isAiSpeaking}
              className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/90 border-blue-500 shadow-sm ring-1 ring-blue-500'
                  : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs hover:border-slate-300'
              }`}
            >
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {badgeKey}
              </div>

              <div className="flex-1 text-[15px] sm:text-base text-slate-800 font-sans leading-relaxed break-words pt-0.5">
                {opt.label}
              </div>

              {isSelected ? (
                <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
              )}
            </button>
          )
        })}
      </div>

      {/* Decision Rationale */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        <label className="text-[11px] font-mono font-bold text-slate-700 block mb-1.5">
          DECISION RATIONALE (OPTIONAL / RECOMMENDED):
        </label>
        <textarea
          value={rationale}
          onChange={handleRationaleChange}
          disabled={isSubmitting || isAiSpeaking}
          rows={2}
          placeholder="Briefly state why this course of action is optimal given the scenario trade-offs..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-sans resize-none outline-none focus:border-blue-500 focus:bg-white leading-relaxed"
        />
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-slate-500 font-sans">
          Select the most appropriate path and click submit.
        </span>

        <button
          type="submit"
          disabled={!selectedId || isSubmitting || isAiSpeaking}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-xs shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>Submit Decision</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}

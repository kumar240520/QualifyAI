import React from 'react'
import { CheckSquare, Square, Send, Loader2, Mic } from 'lucide-react'

export default function MultiSelectQuestion({
  question,
  value = [],
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const options = question.options && question.options.length > 0
    ? question.options
    : [
        { id: 'opt-1', key: '1', label: 'Option 1' },
        { id: 'opt-2', key: '2', label: 'Option 2' },
        { id: 'opt-3', key: '3', label: 'Option 3' },
        { id: 'opt-4', key: '4', label: 'Option 4' },
      ]

  const selectedIds = Array.isArray(value?.selectedOptionIds)
    ? value.selectedOptionIds
    : Array.isArray(value)
    ? value
    : []

  const handleToggle = (opt) => {
    if (isSubmitting || isAiSpeaking) return
    let updated = []
    if (selectedIds.includes(opt.id)) {
      updated = selectedIds.filter((id) => id !== opt.id)
    } else {
      updated = [...selectedIds, opt.id]
    }

    const selectedLabels = options
      .filter((o) => updated.includes(o.id))
      .map((o) => o.label)

    onChange({
      selectedOptionIds: updated,
      labels: selectedLabels,
      text: selectedLabels.join(', '),
    })
  }

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (selectedIds.length === 0 || isSubmitting || isAiSpeaking) return
    const selectedLabels = options
      .filter((o) => selectedIds.includes(o.id))
      .map((o) => o.label)

    onSubmit({
      selectedOptionIds: selectedIds,
      labels: selectedLabels,
      text: selectedLabels.join(', '),
      inputMethod: 'multi_select',
    })
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between px-1">
        <span>SELECT ALL THAT APPLY</span>
        <span className="font-semibold text-blue-600">
          {selectedIds.length} of {options.length} selected
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {options.map((opt, idx) => {
          const isSelected = selectedIds.includes(opt.id)
          const badgeKey = opt.key || String.fromCharCode(65 + idx)

          return (
            <button
              key={opt.id || idx}
              type="button"
              onClick={() => handleToggle(opt)}
              disabled={isSubmitting || isAiSpeaking}
              className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/90 border-blue-500 shadow-sm ring-1 ring-blue-500'
                  : 'bg-white hover:bg-slate-50/90 border-slate-200/90 shadow-2xs hover:border-slate-300'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs sm:text-sm shrink-0 transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {badgeKey}
              </div>

              <div className="flex-1 text-[15px] sm:text-base text-slate-800 leading-relaxed font-sans break-words pt-0.5">
                {opt.label}
              </div>

              <div className="shrink-0 pt-1">
                {isSelected ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5 text-slate-300" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span className="text-[11px] text-slate-600">
            Select one or more options above or speak your answers.
          </span>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={selectedIds.length === 0 || isSubmitting || isAiSpeaking}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Confirm ({selectedIds.length})</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

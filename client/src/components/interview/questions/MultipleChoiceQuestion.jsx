import React, { useState, useEffect } from 'react'
import { CheckCircle2, Circle, Send, Loader2, Mic, Sparkles } from 'lucide-react'

export default function MultipleChoiceQuestion({
  question,
  value = null,
  candidateSpeech = '',
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const options = question.options && question.options.length > 0
    ? question.options
    : [
        { id: 'opt-a', key: 'A', label: 'Option A' },
        { id: 'opt-b', key: 'B', label: 'Option B' },
        { id: 'opt-c', key: 'C', label: 'Option C' },
        { id: 'opt-d', key: 'D', label: 'Option D' },
      ]

  const selectedId = value?.selectedOptionId || (typeof value === 'string' ? value : null)

  // Auto-match if candidate spoke their answer (e.g. "Option B" or "B")
  useEffect(() => {
    const textToCheck = (typeof candidateSpeech === 'string' && candidateSpeech.trim())
      ? candidateSpeech.trim()
      : (typeof value === 'string' ? value.trim() : '')

    if (textToCheck && !selectedId) {
      const lower = textToCheck.toLowerCase()
      const match = options.find((opt, idx) => {
        const key = (opt.key || String.fromCharCode(65 + idx)).toLowerCase()
        return (
          lower === key ||
          lower === `option ${key}` ||
          lower.startsWith(`option ${key}`) ||
          lower.endsWith(`option ${key}`) ||
          lower.includes(`option ${key}`) ||
          opt.label.toLowerCase().includes(lower)
        )
      })
      if (match) {
        onChange({
          selectedOptionId: match.id,
          label: match.label,
          key: match.key,
          text: match.label,
        })
      }
    }
  }, [candidateSpeech, value, options, selectedId])

  const handleSelect = (opt) => {
    if (isSubmitting || isAiSpeaking) return
    onChange({
      selectedOptionId: opt.id,
      label: opt.label,
      key: opt.key,
      text: opt.label,
    })
  }

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!selectedId || isSubmitting || isAiSpeaking) return
    const matched = options.find((o) => o.id === selectedId) || options[0]
    onSubmit({
      selectedOptionId: matched.id,
      label: matched.label,
      key: matched.key,
      text: `${matched.key ? `${matched.key}: ` : ''}${matched.label}`,
      inputMethod: 'selection',
    })
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <span>SELECT ONE OPTION</span>
        </div>
        <span>{options.length} choices available</span>
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
              className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/90 border-blue-500 shadow-sm ring-1 ring-blue-500'
                  : 'bg-white hover:bg-slate-50/90 border-slate-200/90 shadow-2xs hover:border-slate-300'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {badgeKey}
              </div>

              <div className="flex-1 text-xs sm:text-sm text-slate-800 leading-snug pt-0.5 font-sans">
                {opt.label}
              </div>

              <div className="shrink-0 pt-0.5">
                {isSelected ? (
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300" />
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
            Click an option above or speak your choice aloud.
          </span>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedId || isSubmitting || isAiSpeaking}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>AI Analyzing Response...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Confirm Selection</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

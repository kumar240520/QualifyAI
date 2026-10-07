import React from 'react'
import { Check, X, Send, Loader2, Mic } from 'lucide-react'

export default function BooleanQuestion({
  question,
  value = null,
  candidateSpeech = '',
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const isYesNo = /yes|no/i.test(question.text) || question.metadata?.booleanType === 'YES_NO'
  const trueLabel = isYesNo ? 'YES' : 'TRUE'
  const falseLabel = isYesNo ? 'NO' : 'FALSE'

  const selectedValue = typeof value === 'string' ? value : value?.value || null

  const handleSelect = (choice) => {
    if (isSubmitting || isAiSpeaking) return
    onChange({
      value: choice,
      text: choice,
      inputMethod: 'boolean',
    })
  }

  // Auto-match spoken True/False or Yes/No
  React.useEffect(() => {
    const textToCheck = (typeof candidateSpeech === 'string' && candidateSpeech.trim())
      ? candidateSpeech.trim().toLowerCase()
      : (typeof value === 'string' ? value.trim().toLowerCase() : '')

    if (textToCheck && !selectedValue) {
      if (textToCheck.includes('true') || textToCheck === 'yes' || textToCheck.includes('yes')) {
        handleSelect(trueLabel)
      } else if (textToCheck.includes('false') || textToCheck === 'no' || textToCheck.includes('no')) {
        handleSelect(falseLabel)
      }
    }
  }, [candidateSpeech, value, selectedValue, trueLabel, falseLabel])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!selectedValue || isSubmitting || isAiSpeaking) return
    onSubmit({
      value: selectedValue,
      text: selectedValue,
      inputMethod: 'boolean',
    })
  }

  return (
    <div className="flex flex-col gap-3.5 w-full">
      <div className="text-[11px] font-mono text-slate-500 uppercase px-1">
        CHOOSE TRUE OR FALSE
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {/* True / Yes Button */}
        <button
          type="button"
          onClick={() => handleSelect(trueLabel)}
          disabled={isSubmitting || isAiSpeaking}
          className={`py-6 px-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
            selectedValue === trueLabel
              ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-500 text-emerald-900'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              selectedValue === trueLabel
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="font-heading font-extrabold text-sm sm:text-base tracking-wide">
            {trueLabel}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Press {trueLabel[0]} or click
          </span>
        </button>

        {/* False / No Button */}
        <button
          type="button"
          onClick={() => handleSelect(falseLabel)}
          disabled={isSubmitting || isAiSpeaking}
          className={`py-6 px-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
            selectedValue === falseLabel
              ? 'bg-rose-50 border-rose-500 shadow-sm ring-2 ring-rose-500 text-rose-900'
              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              selectedValue === falseLabel
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </div>
          <span className="font-heading font-extrabold text-sm sm:text-base tracking-wide">
            {falseLabel}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Press {falseLabel[0]} or click
          </span>
        </button>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span className="text-[11px] text-slate-600">
            Click an option above or say &quot;{trueLabel}&quot; or &quot;{falseLabel}&quot; aloud.
          </span>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedValue || isSubmitting || isAiSpeaking}
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
              <span>Confirm {selectedValue || 'Answer'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

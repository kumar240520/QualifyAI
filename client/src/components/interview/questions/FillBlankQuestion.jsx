import React from 'react'
import { Send, Loader2, Mic, CornerDownLeft } from 'lucide-react'

export default function FillBlankQuestion({
  question,
  value = '',
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const textValue = typeof value === 'string' ? value : value?.text || ''

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (textValue.trim() && !isSubmitting && !isAiSpeaking) {
        onSubmit({
          text: textValue.trim(),
          inputMethod: 'fill_blank',
        })
      }
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (textValue.trim() && !isSubmitting && !isAiSpeaking) {
      onSubmit({
        text: textValue.trim(),
        inputMethod: 'fill_blank',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
        <div className="text-[11px] font-mono text-slate-500 uppercase">
          COMPLETE THE STATEMENT
        </div>

        <div className="relative">
          <input
            type="text"
            value={textValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting || isAiSpeaking}
            placeholder={
              isAiSpeaking
                ? 'AI Interviewer speaking... please listen.'
                : 'Enter the missing term, keyword, or value...'
            }
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 font-mono transition-all disabled:opacity-60"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span className="flex items-center gap-1 font-mono">
            <CornerDownLeft className="w-3 h-3 text-slate-400" />
            <span>Press Enter to submit answer</span>
          </span>
          {textValue && (
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={isSubmitting || isAiSpeaking}
              className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span className="text-[11px] text-slate-600">
            Type your answer above, or say the missing term aloud.
          </span>
        </div>

        <button
          type="submit"
          disabled={!textValue.trim() || isSubmitting || isAiSpeaking}
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
              <span>Submit Answer</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

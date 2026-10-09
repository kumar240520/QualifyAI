import React, { useRef, useEffect } from 'react'
import { Send, Loader2, Mic, CornerDownLeft } from 'lucide-react'

export default function DescriptiveQuestion({
  question,
  value = '',
  candidateSpeech = '',
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
  placeholder = 'Type your technical answer here, or speak into your microphone...',
}) {
  const textareaRef = useRef(null)
  const textValue = typeof value === 'string' ? value : value?.text || ''

  // Auto-resize textarea height as content expands
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 120), 280)}px`
  }, [textValue])

  // Sync spoken transcript into textarea when candidate speaks
  useEffect(() => {
    if (candidateSpeech && typeof candidateSpeech === 'string' && candidateSpeech.trim()) {
      const clean = candidateSpeech.trim()
      if (clean !== textValue.trim()) {
        onChange({ text: clean, inputMethod: 'voice_text' })
      }
    }
  }, [candidateSpeech])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (textValue.trim() && !isSubmitting && !isAiSpeaking) {
        onSubmit({
          text: textValue.trim(),
          inputMethod: 'text',
        })
      }
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (textValue.trim() && !isSubmitting && !isAiSpeaking) {
      onSubmit({
        text: textValue.trim(),
        inputMethod: 'text',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <div className="relative rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all p-3.5 sm:p-4">
        <textarea
          ref={textareaRef}
          value={textValue}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting || isAiSpeaking}
          placeholder={
            isAiSpeaking
              ? 'AI Interviewer is speaking... please listen.'
              : placeholder
          }
          className="w-full text-[15px] sm:text-base text-slate-800 placeholder-slate-400 bg-transparent resize-none focus:outline-none leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed font-sans min-h-[120px]"
        />

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-mono">
              <CornerDownLeft className="w-3 h-3 text-slate-400" />
              <span>Enter to submit</span>
            </span>
            <span>•</span>
            <span className="font-mono">Shift + Enter for new line</span>
          </div>

          <div className="flex items-center gap-2">
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange('')}
                disabled={isSubmitting || isAiSpeaking}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                Clear
              </button>
            )}
            <span className="font-mono">{value.length} characters</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span className="text-[11px] text-slate-600">
            Voice is active — speak naturally anytime, or type above.
          </span>
        </div>

        <button
          type="submit"
          disabled={!value.trim() || isSubmitting || isAiSpeaking}
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

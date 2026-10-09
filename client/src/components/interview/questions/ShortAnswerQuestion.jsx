import React, { useState, useEffect, useRef } from 'react'
import { Send, Loader2, Mic, MessageSquare, CornerDownLeft } from 'lucide-react'

export default function ShortAnswerQuestion({
  question,
  value = '',
  candidateSpeech = '',
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const inputRef = useRef(null)
  const textValue = typeof value === 'string' ? value : value?.text || ''

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
          inputMethod: 'short_answer',
        })
      }
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (textValue.trim() && !isSubmitting && !isAiSpeaking) {
      onSubmit({
        text: textValue.trim(),
        inputMethod: 'short_answer',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
          <span>CONCISE RESPONSE (1–3 SENTENCES)</span>
        </div>
        <span className={`font-mono text-xs ${textValue.length > 500 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
          {textValue.length}/500 chars
        </span>
      </div>

      <div className="relative rounded-2xl bg-white border border-slate-200/90 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all p-3.5">
        <textarea
          ref={inputRef}
          value={textValue}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting || isAiSpeaking}
          placeholder="Type your brief, direct answer here (or speak aloud into your microphone)..."
          rows={3}
          className="w-full bg-transparent resize-none border-none outline-none text-slate-800 text-[15px] sm:text-base placeholder:text-slate-400 leading-relaxed font-sans"
        />

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
          <div className="flex items-center gap-1.5 text-[11px] font-sans text-slate-500">
            <Mic className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span className="text-emerald-700 font-medium">Mic is ON by default</span>
            <span className="text-slate-400 hidden sm:inline">• Press Enter to submit</span>
          </div>

          <button
            type="submit"
            disabled={!textValue.trim() || isSubmitting || isAiSpeaking}
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
      </div>
    </form>
  )
}

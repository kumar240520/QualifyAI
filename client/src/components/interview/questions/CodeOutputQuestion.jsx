import React, { useState } from 'react'
import { Send, Loader2, Copy, Check, Terminal, CornerDownLeft, Mic } from 'lucide-react'

export default function CodeOutputQuestion({
  question,
  value = '',
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const [copied, setCopied] = useState(false)
  const codeSnippet = question.codeSnippet || `// Sample snippet\nconst numbers = [1, 2, 3];\nconsole.log(numbers.map(n => n * 2));`
  const textValue = typeof value === 'string' ? value : value?.predictedOutput || value?.text || ''

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (textValue.trim() && !isSubmitting && !isAiSpeaking) {
        onSubmit({
          predictedOutput: textValue.trim(),
          text: textValue.trim(),
          inputMethod: 'code_output',
        })
      }
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (textValue.trim() && !isSubmitting && !isAiSpeaking) {
      onSubmit({
        predictedOutput: textValue.trim(),
        text: textValue.trim(),
        inputMethod: 'code_output',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      {/* Code Snippet Viewer */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/60 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span className="uppercase text-[11px] text-slate-300">
              {question.language || 'JavaScript'} Snippet
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] hover:text-white transition cursor-pointer text-slate-400"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="p-4 overflow-x-auto font-mono text-xs leading-relaxed max-h-48 text-emerald-300">
          <pre>{codeSnippet}</pre>
        </div>
      </div>

      {/* Prediction Input Box */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
        <div className="text-[11px] font-mono text-slate-500 uppercase">
          PREDICTED OUTPUT
        </div>
        <textarea
          value={textValue}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSubmitting || isAiSpeaking}
          placeholder="Enter the expected console / return output..."
          rows={2}
          className="w-full text-xs sm:text-sm font-mono text-slate-900 placeholder-slate-400 bg-slate-50 rounded-xl p-3 border border-slate-200 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 leading-relaxed resize-none disabled:opacity-60"
        />

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1 font-mono">
            <CornerDownLeft className="w-3 h-3 text-slate-400" />
            <span>Enter to submit output</span>
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
            Type output above or state it aloud.
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
              <span>Submit Output</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

import React, { useState } from 'react'
import { Send, Loader2, Code2, RotateCcw } from 'lucide-react'

export default function CompleteCodeQuestion({
  question,
  value = '',
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const initialCode =
    question.codeSnippet ||
    `// Fill in the missing implementation\nfunction processData(items) {\n  /* YOUR CODE HERE */\n}`

  const codeValue = typeof value === 'string' ? (value || initialCode) : value?.code || value?.text || initialCode

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.target
      const start = target.selectionStart
      const end = target.selectionEnd
      const updated = codeValue.substring(0, start) + '  ' + codeValue.substring(end)
      onChange(updated)
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2
      }, 0)
    }
  }

  const handleReset = () => {
    onChange(initialCode)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (codeValue.trim() && !isSubmitting && !isAiSpeaking) {
      onSubmit({
        code: codeValue.trim(),
        completedCode: codeValue.trim(),
        text: codeValue.trim(),
        language: question.language || 'javascript',
        inputMethod: 'code_completion',
      })
    }
  }

  const linesCount = codeValue.split('\n').length

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <div className="rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/80 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <span className="uppercase text-[11px] text-emerald-300 font-bold">
              Complete the Missing Code ({question.language || 'JavaScript'})
            </span>
          </div>

          <button
            type="button"
            onClick={handleReset}
            disabled={isSubmitting || isAiSpeaking}
            className="flex items-center gap-1 text-[11px] hover:text-white transition cursor-pointer text-slate-400 disabled:opacity-60"
            title="Reset to initial snippet"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="flex bg-slate-900 min-h-[180px] max-h-[300px] overflow-y-auto font-mono text-xs leading-relaxed">
          <div className="select-none py-3.5 px-3 text-right bg-slate-950/40 text-slate-600 border-r border-slate-800/80 w-10 shrink-0">
            {Array.from({ length: Math.max(linesCount, 8) }).map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          <textarea
            value={codeValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting || isAiSpeaking}
            spellCheck="false"
            autoCapitalize="off"
            autoComplete="off"
            className="flex-1 bg-transparent p-3.5 text-emerald-300 border-none outline-none font-mono resize-none leading-relaxed placeholder:text-slate-600"
            placeholder="// Complete the missing statements or blocks..."
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-mono text-slate-500">
          Tab key indents by 2 spaces • Complete the missing code and submit
        </span>

        <button
          type="submit"
          disabled={!codeValue.trim() || isSubmitting || isAiSpeaking}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-xs shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>Submit Completed Code</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}

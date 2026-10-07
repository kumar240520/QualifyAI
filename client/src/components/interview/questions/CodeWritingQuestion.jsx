import React, { useState } from 'react'
import { Send, Loader2, Code2, RotateCcw, Mic } from 'lucide-react'

export default function CodeWritingQuestion({
  question,
  value = '',
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const initialCode =
    question.codeSnippet ||
    `// Implement your solution in ${question.language || 'JavaScript'}\nfunction solution(input) {\n  // Your code here\n  return null;\n}`

  const codeValue = typeof value === 'string' ? (value || initialCode) : value?.code || initialCode

  const handleKeyDown = (e) => {
    // Support Tab key indentation inside code editor
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
        language: question.language || 'javascript',
        text: codeValue.trim(),
        inputMethod: 'code',
      })
    }
  }

  const linesCount = codeValue.split('\n').length

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <div className="rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 overflow-hidden shadow-sm">
        {/* Editor Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/80 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span className="uppercase text-[11px] text-cyan-300 font-bold">
              {question.language || 'JavaScript'} Editor
            </span>
          </div>

          <button
            type="button"
            onClick={handleReset}
            disabled={isSubmitting || isAiSpeaking}
            className="flex items-center gap-1 text-[11px] hover:text-white transition cursor-pointer text-slate-400 disabled:opacity-60"
            title="Reset to template"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        {/* Editor Code Area with Line Numbers */}
        <div className="flex bg-slate-900 min-h-[180px] max-h-[300px] overflow-y-auto font-mono text-xs leading-relaxed">
          {/* Line Numbers Column */}
          <div className="select-none py-3.5 px-3 text-right bg-slate-950/40 text-slate-600 border-r border-slate-800/80 w-10 shrink-0">
            {Array.from({ length: Math.max(linesCount, 8) }).map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Text Area Code Editor */}
          <textarea
            value={codeValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting || isAiSpeaking}
            rows={Math.max(linesCount, 8)}
            spellCheck="false"
            className="flex-1 p-3.5 bg-transparent text-emerald-300 placeholder-slate-600 focus:outline-none resize-none leading-relaxed font-mono whitespace-pre overflow-x-auto disabled:opacity-60"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span className="text-[11px] text-slate-600">
            Write code above. You can also explain your logic aloud while coding.
          </span>
        </div>

        <button
          type="submit"
          disabled={!codeValue.trim() || isSubmitting || isAiSpeaking}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting Code...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Submit Solution</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

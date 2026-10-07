import React from 'react'
import { Database, Send, Loader2, RotateCcw, Mic } from 'lucide-react'

export default function SQLQuestion({
  question,
  value = '',
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const initialSql =
    question.codeSnippet ||
    `-- Write your SQL query below\nSELECT \nFROM \nWHERE \nLIMIT 10;`

  const sqlValue = typeof value === 'string' ? (value || initialSql) : value?.sqlQuery || initialSql

  const handleInsertKeyword = (kw) => {
    onChange(sqlValue + ' ' + kw + ' ')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (sqlValue.trim() && !isSubmitting && !isAiSpeaking) {
      onSubmit({
        sqlQuery: sqlValue.trim(),
        text: sqlValue.trim(),
        inputMethod: 'sql',
      })
    }
  }

  const keywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT']

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <div className="rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 overflow-hidden shadow-sm">
        {/* SQL Header Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-950/80 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="uppercase text-[11px] text-emerald-300 font-bold">
              PostgreSQL Query Editor
            </span>
          </div>

          <button
            type="button"
            onClick={() => onChange(initialSql)}
            disabled={isSubmitting || isAiSpeaking}
            className="flex items-center gap-1 text-[11px] hover:text-white transition cursor-pointer text-slate-400 disabled:opacity-60"
            title="Reset to template"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        {/* Quick Keywords Bar */}
        <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono">
          <span className="text-slate-500 uppercase mr-1">Snippets:</span>
          {keywords.map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => handleInsertKeyword(kw)}
              disabled={isSubmitting || isAiSpeaking}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer disabled:opacity-50"
            >
              {kw}
            </button>
          ))}
        </div>

        {/* Text Area SQL Editor */}
        <textarea
          value={sqlValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={isSubmitting || isAiSpeaking}
          rows={6}
          spellCheck="false"
          placeholder="SELECT * FROM table..."
          className="w-full p-4 bg-transparent text-emerald-300 placeholder-slate-600 focus:outline-none resize-none leading-relaxed font-mono text-xs whitespace-pre disabled:opacity-60 min-h-[140px]"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
            <Mic className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <span className="text-[11px] text-slate-600">
            Write your query above, or explain your query strategy aloud.
          </span>
        </div>

        <button
          type="submit"
          disabled={!sqlValue.trim() || isSubmitting || isAiSpeaking}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting Query...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Submit Query</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

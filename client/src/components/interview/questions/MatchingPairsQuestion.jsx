import React, { useState } from 'react'
import { Link2, Send, Loader2, RotateCcw, CheckCircle2 } from 'lucide-react'

export default function MatchingPairsQuestion({
  question,
  value = null,
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const leftItems = (question.leftItems && question.leftItems.length > 0)
    ? question.leftItems
    : [
        { id: 'l1', text: 'Item 1' },
        { id: 'l2', text: 'Item 2' },
        { id: 'l3', text: 'Item 3' },
      ]

  const rightItems = (question.rightItems && question.rightItems.length > 0)
    ? question.rightItems
    : [
        { id: 'r1', text: 'Match A' },
        { id: 'r2', text: 'Match B' },
        { id: 'r3', text: 'Match C' },
      ]

  // Mapping state: { [leftId]: rightId }
  const [matches, setMatches] = useState(() => {
    if (value?.pairs && Array.isArray(value.pairs)) {
      const init = {}
      value.pairs.forEach((p) => {
        if (p.leftId && p.rightId) init[p.leftId] = p.rightId
      })
      return init
    }
    return {}
  })

  const handlePairChange = (leftId, rightId) => {
    if (isSubmitting || isAiSpeaking) return
    const updated = { ...matches, [leftId]: rightId }
    setMatches(updated)

    const pairs = Object.entries(updated).map(([lId, rId]) => {
      const leftObj = leftItems.find((l) => l.id === lId)
      const rightObj = rightItems.find((r) => r.id === rId)
      return {
        leftId: lId,
        rightId: rId,
        leftText: leftObj?.text || lId,
        rightText: rightObj?.text || rId,
      }
    })

    onChange({
      pairs,
      text: pairs.map((p) => `(${p.leftText} -> ${p.rightText})`).join(', '),
      inputMethod: 'matching',
    })
  }

  const handleReset = () => {
    setMatches({})
    onChange({ pairs: [], text: '', inputMethod: 'matching' })
  }

  const matchedCount = Object.keys(matches).filter((k) => matches[k]).length
  const allMatched = matchedCount === leftItems.length

  const handleSubmit = (e) => {
    e.preventDefault()
    if (matchedCount === 0 || isSubmitting || isAiSpeaking) return

    const pairs = Object.entries(matches).map(([lId, rId]) => {
      const leftObj = leftItems.find((l) => l.id === lId)
      const rightObj = rightItems.find((r) => r.id === rId)
      return {
        leftId: lId,
        rightId: rId,
        leftText: leftObj?.text || lId,
        rightText: rightObj?.text || rId,
      }
    })

    onSubmit({
      pairs,
      text: pairs.map((p) => `(${p.leftText} -> ${p.rightText})`).join(', '),
      inputMethod: 'matching',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 w-full">
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <Link2 className="w-3.5 h-3.5 text-blue-600" />
          <span>MATCH PAIRS ({matchedCount} OF {leftItems.length} PAIRED)</span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={isSubmitting || isAiSpeaking}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Clear Pairs</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {leftItems.map((left, idx) => {
          const selectedRightId = matches[left.id] || ''

          return (
            <div
              key={left.id || idx}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                selectedRightId
                  ? 'bg-blue-50/50 border-blue-300'
                  : 'bg-white border-slate-200/90 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-2.5 flex-1">
                <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 font-mono font-bold text-xs sm:text-sm flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="text-[15px] sm:text-base font-semibold text-slate-800 font-sans leading-relaxed break-words">
                  {left.text}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 sm:max-w-xs w-full">
                <select
                  value={selectedRightId}
                  onChange={(e) => handlePairChange(left.id, e.target.value)}
                  disabled={isSubmitting || isAiSpeaking}
                  aria-label={`Select match for ${left.text}`}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">-- Choose matching item --</option>
                  {rightItems.map((right) => (
                    <option key={right.id} value={right.id}>
                      {right.text}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-[11px] text-slate-500 font-sans">
          Select the corresponding match for each left-hand item.
        </span>

        <button
          type="submit"
          disabled={matchedCount === 0 || isSubmitting || isAiSpeaking}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-xs shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>Submit Pairs ({matchedCount}/{leftItems.length})</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}

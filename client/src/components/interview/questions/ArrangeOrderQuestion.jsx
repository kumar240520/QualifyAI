import React, { useState, useEffect } from 'react'
import { ArrowUp, ArrowDown, Send, Loader2, RotateCcw, ListOrdered, GripVertical } from 'lucide-react'

export default function ArrangeOrderQuestion({
  question,
  value = null,
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  const rawList = Array.isArray(question?.items) && question.items.length > 0
    ? question.items
    : (Array.isArray(question?.options) && question.options.length > 0 ? question.options : [])

  const initialItems = React.useMemo(() => {
    return rawList.map((item, idx) => {
      if (typeof item === 'string') {
        return { id: `item-${idx + 1}`, label: item.trim() }
      }
      return {
        id: item?.id || `item-${idx + 1}`,
        label: String(item?.label || item?.text || item || '').trim(),
      }
    })
  }, [question?.id, question?.items, question?.options])

  const [items, setItems] = useState(() => {
    if (value?.orderedItems && Array.isArray(value.orderedItems) && value.orderedItems.length > 0) {
      return value.orderedItems
    }
    return initialItems
  })

  // Synchronize when question identity changes
  useEffect(() => {
    if (value?.orderedItems && Array.isArray(value.orderedItems) && value.orderedItems.length > 0) {
      setItems(value.orderedItems)
    } else {
      setItems(initialItems)
    }
  }, [question?.id, initialItems])

  // Sync internal items up to parent on change
  const updateItems = (newItems) => {
    setItems(newItems)
    onChange({
      orderedItems: newItems,
      orderedIds: newItems.map((item) => item.id),
      items: newItems.map((item) => item.label),
      text: newItems.map((item, idx) => `${idx + 1}. ${item.label}`).join(' -> '),
      inputMethod: 'ordering',
    })
  }

  const moveUp = (index) => {
    if (index === 0 || isSubmitting || isAiSpeaking) return
    const newItems = [...items]
    const temp = newItems[index - 1]
    newItems[index - 1] = newItems[index]
    newItems[index] = temp
    updateItems(newItems)
  }

  const moveDown = (index) => {
    if (index === items.length - 1 || isSubmitting || isAiSpeaking) return
    const newItems = [...items]
    const temp = newItems[index + 1]
    newItems[index + 1] = newItems[index]
    newItems[index] = temp
    updateItems(newItems)
  }

  const handleReset = () => {
    updateItems(initialItems)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isSubmitting || isAiSpeaking || items.length === 0) return
    onSubmit({
      orderedItems: items,
      orderedIds: items.map((item) => item.id),
      items: items.map((item) => item.label),
      text: items.map((item, idx) => `${idx + 1}. ${item.label}`).join(' -> '),
      inputMethod: 'ordering',
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
          <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
          <span>ARRANGE IN CORRECT SEQUENTIAL ORDER (TOP TO BOTTOM)</span>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isSubmitting || isAiSpeaking}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Order</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-sm text-slate-500 font-sans">
          No sequence items available for this question.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item, idx) => (
            <div
              key={item.id || idx}
              className="flex items-start sm:items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all"
            >
              {/* Position badge */}
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold text-xs sm:text-sm flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                {idx + 1}
              </div>

              {/* Item text */}
              <div className="flex-1 text-[15px] sm:text-base text-slate-800 font-sans leading-relaxed break-words pt-0.5 sm:pt-0">
                {item.label}
              </div>

              {/* Reordering action buttons */}
              <div className="flex items-center gap-1 shrink-0 pt-0.5 sm:pt-0">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0 || isSubmitting || isAiSpeaking}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-600 cursor-pointer"
                  title="Move item up"
                  aria-label={`Move ${item.label} up`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === items.length - 1 || isSubmitting || isAiSpeaking}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-slate-600 cursor-pointer"
                  title="Move item down"
                  aria-label={`Move ${item.label} down`}
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-[11px] text-slate-500 font-sans">
          Use the arrow buttons to position steps in chronological order.
        </span>

        <button
          type="submit"
          disabled={items.length === 0 || isSubmitting || isAiSpeaking}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium text-xs shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <span>Submit Sequence</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
  )
}

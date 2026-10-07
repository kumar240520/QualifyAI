import React, { useEffect, useRef } from 'react'
import { MessageSquare, Cpu, Loader2, X, Check } from 'lucide-react'
import { isThoughtOrMetaPlanning } from '../../utils/questionNormalizer.js'

export default function ConversationStream({
  transcripts = [],
  candidateName = 'You',
  candidateInterimText = '',
  isSubmitting = false,
  isOpen = false,
  onClose = null,
}) {
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcripts, candidateInterimText, isSubmitting])

  const filteredTranscripts = transcripts.filter(
    (t) => !isThoughtOrMetaPlanning(t.content)
  )

  const content = (
    <div className="flex flex-col h-full overflow-hidden bg-white rounded-3xl border border-slate-200/90 shadow-xs">
      {/* Stream Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span className="font-heading font-extrabold text-xs sm:text-sm text-slate-800 tracking-tight">
            Conversation Stream
          </span>
          <span className="text-xs font-sans px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 font-semibold tracking-normal">
            {filteredTranscripts.length} turns
          </span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            title="Close conversation view"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {filteredTranscripts.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 text-slate-400 space-y-2">
            <Cpu className="w-7 h-7 text-blue-500 animate-pulse" />
            <p className="text-xs font-medium text-slate-600">
              Interview conversation will appear here.
            </p>
            <p className="text-[11px] text-slate-400 max-w-xs">
              Every spoken and written exchange between you and the AI Evaluator is securely recorded in real time.
            </p>
          </div>
        ) : (
          filteredTranscripts.map((t, idx) => {
            const isAI = t.speaker === 'AI'
            return (
              <div
                key={t.id || idx}
                className={`flex flex-col ${isAI ? 'items-start' : 'items-end'} space-y-1`}
              >
                <div className="flex items-center gap-1.5 text-xs font-sans text-slate-400 px-1 tracking-normal">
                  <span className="font-semibold text-slate-600">
                    {isAI ? 'QualifyAI Evaluator' : candidateName}
                  </span>
                  <span>•</span>
                  <span>
                    {t.created_at
                       ? new Date(t.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Just now'}
                  </span>
                  {!isAI && (
                    <span className="text-emerald-600 font-semibold ml-0.5 flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Sent
                    </span>
                  )}
                </div>

                <div
                  className={`max-w-[88%] sm:max-w-[82%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-2xs ${
                    isAI
                      ? 'bg-slate-50 text-slate-800 border border-slate-200/90 rounded-tl-xs'
                      : 'bg-blue-600 text-white rounded-tr-xs'
                  }`}
                >
                  {t.content}
                </div>
              </div>
            )
          })
        )}

        {/* Interim Speech Transcription Bubble */}
        {candidateInterimText && (
          <div className="flex flex-col items-end space-y-1 animate-pulse">
            <div className="flex items-center gap-1.5 text-xs font-sans text-blue-600 px-1 tracking-normal">
              <span className="font-semibold">{candidateName}</span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-blue-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                <span>Speaking...</span>
              </span>
            </div>
            <div className="max-w-[88%] sm:max-w-[82%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap bg-blue-500 text-white shadow-md border border-blue-400 rounded-tr-xs">
              {candidateInterimText}
            </div>
          </div>
        )}

        {/* AI Evaluating Indicator */}
        {isSubmitting && (
          <div className="flex flex-col items-start space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-sans text-slate-400 px-1 tracking-normal">
              <span className="font-semibold text-slate-600">QualifyAI Evaluator</span>
              <span>•</span>
              <span>Evaluating</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 text-slate-600 border border-slate-200 text-xs flex items-center gap-2 shadow-2xs font-sans tracking-normal">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>Analyzing candidate response & formulating next question...</span>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>
    </div>
  )

  // If used as drawer/modal
  if (onClose) {
    if (!isOpen) return null
    return (
      <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs flex items-center justify-end p-4 sm:p-6 animate-fade-in">
        <div className="w-full max-w-lg h-[90vh] shadow-2xl">
          {content}
        </div>
      </div>
    )
  }

  return content
}

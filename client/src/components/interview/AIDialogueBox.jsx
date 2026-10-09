import React from 'react'
import { Volume2 } from 'lucide-react'

/**
 * AIDialogueBox - Dedicated AI Dialogue & Spoken Script Component
 * Positioned on the left side of the interview room, directly below the AI animation/voice orb.
 * Displays only the AI's spoken conversational script, streaming word-by-word.
 */
export default function AIDialogueBox({
  liveAiSpeech = '',
  isAiSpeaking = false,
  className = '',
}) {
  const hasContent = Boolean(liveAiSpeech && liveAiSpeech.trim())

  return (
    <div
      id="ai-dialogue-box"
      data-testid="ai-dialogue-box"
      className={`w-full shrink-0 p-3.5 sm:p-4 rounded-2xl border text-xs flex items-start gap-2.5 shadow-2xs transition-all duration-300 animate-fade-in ${
        hasContent || isAiSpeaking
          ? 'bg-gradient-to-r from-blue-50/95 via-indigo-50/90 to-slate-50 border-blue-200/90 text-blue-950 shadow-xs'
          : 'bg-slate-50/80 border-slate-200/80 text-slate-500'
      } ${className}`}
      aria-live="polite"
    >
      <div
        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs transition-colors ${
          hasContent || isAiSpeaking
            ? 'bg-blue-100 text-blue-700'
            : 'bg-slate-200/70 text-slate-500'
        }`}
      >
        <Volume2
          className={`w-3.5 h-3.5 ${
            isAiSpeaking ? 'animate-pulse text-blue-600' : hasContent ? 'text-blue-600' : 'text-slate-400'
          }`}
        />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
          {isAiSpeaking ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping shrink-0" />
              <span className="text-blue-700 font-semibold">AI Interviewer Speaking Aloud</span>
            </>
          ) : hasContent ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-slate-700 font-semibold">AI Spoken Dialogue</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
              <span className="text-slate-500 font-normal">AI Dialogue Standby</span>
            </>
          )}
        </div>

        <p
          data-testid="ai-dialogue-text"
          className={`text-xs sm:text-[13px] leading-relaxed font-sans italic font-medium break-words max-h-24 sm:max-h-32 overflow-y-auto pr-1 ${
            hasContent ? 'text-slate-800' : 'text-slate-400 font-normal'
          }`}
        >
          {hasContent
            ? `\u201C${liveAiSpeech.trim()}\u201D`
            : isAiSpeaking
            ? 'Interviewer is speaking...'
            : 'AI spoken dialogue will stream here as the interviewer speaks.'}
        </p>
      </div>
    </div>
  )
}

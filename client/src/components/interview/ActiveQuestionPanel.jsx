import React, { useState, useEffect, useRef } from 'react'
import { Sparkles, HelpCircle, Code2, Database, CheckSquare, Layers, Award, Terminal, Volume2 } from 'lucide-react'

export default function ActiveQuestionPanel({
  question,
  sequence = 0,
  turnIndex = 0,
  roomStartupCountdown = 0,
  criterionName = null,
  liveAiSpeech = '',
  isAiSpeaking = false,
}) {
  const diffColors = {
    EASY: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
    HARD: 'bg-purple-50 text-purple-700 border-purple-200',
  }

  const typeConfig = {
    MULTIPLE_CHOICE: { label: 'Multiple Choice', icon: CheckSquare, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    MULTI_SELECT: { label: 'Multi-Select', icon: CheckSquare, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    FILL_IN_THE_BLANK: { label: 'Fill in the Blank', icon: HelpCircle, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
    CODE_OUTPUT: { label: 'Output Prediction', icon: Terminal, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    CODE_WRITING: { label: 'Code Implementation', icon: Code2, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    SQL: { label: 'SQL Query', icon: Database, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    TRUE_FALSE: { label: 'True / False', icon: HelpCircle, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    SCENARIO: { label: 'System Scenario', icon: Layers, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    BEHAVIORAL: { label: 'Behavioral & Experience', icon: Award, color: 'text-violet-600 bg-violet-50 border-violet-200' },
    DESCRIPTIVE: { label: 'Technical Discussion', icon: Sparkles, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  }

  const currentType = typeConfig[question?.type] || typeConfig.DESCRIPTIVE
  const TypeIcon = currentType.icon

  // Target text is strictly the real technical question prompt
  const targetText = question?.text || ''

  return (
    <div className="relative p-5 rounded-3xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden space-y-3">
      {/* Decorative top accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500" />

      {/* Meta Header with Clean Modern Typography & Status Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-sans font-semibold text-slate-800 text-xs bg-slate-100/90 px-3 py-1 rounded-xl border border-slate-200/90 tracking-normal shadow-2xs">
            Question #{sequence !== undefined ? sequence + 1 : turnIndex + 1}
          </span>

          <span
            className={`font-sans font-semibold text-xs px-3 py-1 rounded-xl border tracking-normal shadow-2xs ${
              diffColors[question?.difficulty] || diffColors.MEDIUM
            }`}
          >
            {question?.difficulty ? (question.difficulty.charAt(0) + question.difficulty.slice(1).toLowerCase()) : 'Medium'} Difficulty
          </span>

          <span
            className={`flex items-center gap-1.5 font-sans font-semibold text-xs px-3 py-1 rounded-xl border tracking-normal shadow-2xs ${currentType.color}`}
          >
            <TypeIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{currentType.label}</span>
          </span>

          {/* Live Dynamic Speech / Question State Indicator */}
          {isAiSpeaking ? (
            <span className="flex items-center gap-1.5 font-sans font-semibold text-xs px-3 py-1 rounded-xl border tracking-normal shadow-2xs bg-blue-50 text-blue-700 border-blue-200 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping shrink-0" />
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span>AI Speaking...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-sans font-semibold text-xs px-3 py-1 rounded-xl border tracking-normal shadow-2xs bg-emerald-50 text-emerald-700 border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>Active Question</span>
            </span>
          )}
        </div>

        {criterionName && (
          <span className="text-xs font-sans font-medium text-slate-600 bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-xl tracking-normal truncate max-w-[240px] shadow-2xs" title={criterionName}>
            Pillar: <strong className="font-semibold text-slate-800">{criterionName}</strong>
          </span>
        )}
      </div>

      {/* Active Question Prompt Display (Instantly Synchronized with Spoken Delivery) */}
      <div className="space-y-3">
        {roomStartupCountdown > 0 ? (
          <div className="flex items-center gap-2.5 text-blue-600 font-semibold text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping shrink-0" />
            <span>
              Initializing AI Evaluator ({roomStartupCountdown}s)... The interview will begin shortly.
            </span>
          </div>
        ) : (
          <>
            <h2
              key={question?.id || sequence}
              className="text-base sm:text-lg md:text-[19px] font-sans font-bold text-slate-900 leading-relaxed tracking-normal animate-fade-in"
            >
              {targetText || 'Loading active question...'}
            </h2>

            {/* Live Spoken Transcript (What the AI says displayed clearly on the right title bar) */}
            {(isAiSpeaking || liveAiSpeech) && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/95 via-indigo-50/90 to-slate-50 border border-blue-200/90 text-blue-950 text-xs flex items-start gap-2.5 shadow-2xs animate-fade-in">
                <Volume2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="text-[10px] font-mono font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                    <span>AI Interviewer Speaking Aloud</span>
                  </div>
                  <p className="text-xs sm:text-[13px] text-slate-800 leading-relaxed font-sans italic font-medium">
                    &ldquo;{liveAiSpeech || question?.spoken_lead_in || targetText}&rdquo;
                  </p>
                </div>
              </div>
            )}

            {/* Room Rules & Guidelines (Rendered on Question 0 & Opening) */}
            {question?.metadata?.room_rules && question.metadata.room_rules.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-50/95 border border-slate-200 text-slate-700 text-xs space-y-2 shadow-2xs">
                <div className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>QualifyAI Interview Guidelines</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                  {question.metadata.room_rules.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}


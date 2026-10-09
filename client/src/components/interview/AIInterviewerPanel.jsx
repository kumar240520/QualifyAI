import React from 'react'
import VoiceOrbVisualizer from './VoiceOrbVisualizer.jsx'
import AIDialogueBox from './AIDialogueBox.jsx'

/**
 * AIInterviewerPanel - Unified Left-Side AI Presence Panel
 * Houses the central Voice Orb Visualizer (AI animation) and the
 * dedicated AI Dialogue Box directly beneath it.
 */
export default function AIInterviewerPanel({
  conversationState = 'LISTENING',
  audioLevel = 0,
  isMuted = false,
  language = 'en-IN',
  preventInterruption = true,
  onTogglePreventInterruption,
  onToggleMute,
  onChangeLanguage,
  onReconnect,
  onOpenConversation,
  unreadTurnsCount = 0,
  silenceNudgeText = null,
  liveAiSpeech = '',
  isAiSpeaking = false,
}) {
  const speakingState = isAiSpeaking || conversationState === 'SPEAKING'

  return (
    <div
      id="ai-interviewer-card"
      data-testid="ai-interviewer-card"
      className="flex flex-col justify-between p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-2xs relative overflow-hidden h-full min-h-[360px] sm:min-h-[420px]"
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/40 via-indigo-50/15 to-white pointer-events-none" />

      {/* Top Presence & Animation & Controls: Animated Voice Orb and Microphone Controls */}
      <div className="flex-1 min-h-0 flex flex-col justify-between w-full z-10">
        <VoiceOrbVisualizer
          conversationState={conversationState}
          audioLevel={audioLevel}
          isMuted={isMuted}
          language={language}
          preventInterruption={preventInterruption}
          onTogglePreventInterruption={onTogglePreventInterruption}
          onToggleMute={onToggleMute}
          onChangeLanguage={onChangeLanguage}
          onReconnect={onReconnect}
          onOpenConversation={onOpenConversation}
          unreadTurnsCount={unreadTurnsCount}
          silenceNudgeText={silenceNudgeText}
          contained={true}
        />
      </div>

      {/* Visually Contained Directly Below Animation and Controls: Streaming AI Dialogue Box */}
      <div className="w-full pt-3 z-10 shrink-0">
        <AIDialogueBox
          liveAiSpeech={liveAiSpeech}
          isAiSpeaking={speakingState}
        />
      </div>
    </div>
  )
}

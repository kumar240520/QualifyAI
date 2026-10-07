import React from 'react'
import VoiceOrbVisualizer from './VoiceOrbVisualizer.jsx'

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
}) {
  return (
    <div className="h-full flex flex-col justify-center overflow-hidden">
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
      />
    </div>
  )
}

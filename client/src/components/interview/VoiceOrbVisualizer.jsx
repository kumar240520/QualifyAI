import React, { useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  RotateCw,
  Languages,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'

/**
 * Next-Generation AI Interviewer Voice Orb Visualizer
 * Core visual identity for QualifyAI live voice assessment.
 * Features state-reactive HTML5 Canvas animations responding to live audio amplitude.
 */
export default function VoiceOrbVisualizer({
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
  contained = false,
}) {
  const canvasRef = useRef(null)

  // Fluid multi-harmonic canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId
    let phase = 0

    // Check user's motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const baseRadius = 66

      phase += prefersReducedMotion ? 0.01 : 0.035
      const pulseMagnitude = audioLevel * (prefersReducedMotion ? 15 : 44)

      // Color palettes tailored for each conversational state
      let primaryColor = 'rgba(37, 99, 235, ' // Blue 600 (LISTENING)
      let secondaryColor = 'rgba(79, 70, 229, ' // Indigo 600
      let coreColor = 'rgba(99, 102, 241, ' // Indigo 500

      if (conversationState === 'STARTING') {
        primaryColor = 'rgba(14, 165, 233, ' // Sky 500
        secondaryColor = 'rgba(56, 189, 248, '
        coreColor = 'rgba(2, 132, 199, '
      } else if (conversationState === 'SPEAKING') {
        primaryColor = 'rgba(147, 51, 234, ' // Purple 600
        secondaryColor = 'rgba(219, 39, 119, ' // Pink 600
        coreColor = 'rgba(168, 85, 247, '
      } else if (conversationState === 'THINKING') {
        primaryColor = 'rgba(99, 102, 241, ' // Indigo 500
        secondaryColor = 'rgba(129, 140, 248, '
        coreColor = 'rgba(79, 70, 229, '
      } else if (isMuted || conversationState === 'MUTED') {
        primaryColor = 'rgba(225, 29, 72, ' // Rose 600
        secondaryColor = 'rgba(244, 63, 94, '
        coreColor = 'rgba(190, 18, 60, '
      } else if (conversationState === 'DISCONNECTED') {
        primaryColor = 'rgba(100, 116, 139, ' // Slate 500
        secondaryColor = 'rgba(148, 163, 184, '
        coreColor = 'rgba(71, 85, 105, '
      }

      // Outer Glow Ring 1 (Ethereal Expanding Halo)
      ctx.beginPath()
      const r1 = baseRadius + pulseMagnitude * 1.6 + Math.sin(phase) * 7
      ctx.arc(centerX, centerY, Math.max(15, r1), 0, Math.PI * 2)
      ctx.strokeStyle = `${primaryColor} 0.18)`
      ctx.lineWidth = 4
      ctx.stroke()

      // Outer Glow Ring 2 (Harmonic Counter-Wave)
      ctx.beginPath()
      const r2 = baseRadius + pulseMagnitude * 1.1 + Math.cos(phase * 1.3) * 6
      ctx.arc(centerX, centerY, Math.max(15, r2), 0, Math.PI * 2)
      ctx.strokeStyle = `${secondaryColor} 0.28)`
      ctx.lineWidth = 3
      ctx.stroke()

      // Rotating Accent Arcs for THINKING and SPEAKING
      if (conversationState === 'THINKING' || conversationState === 'SPEAKING') {
        ctx.beginPath()
        const startAngle = phase * 1.4
        ctx.arc(centerX, centerY, baseRadius + 22, startAngle, startAngle + Math.PI * 0.75)
        ctx.strokeStyle = `${primaryColor} 0.5)`
        ctx.lineWidth = 2.5
        ctx.stroke()

        ctx.beginPath()
        const startAngle2 = -phase * 1.1 + Math.PI
        ctx.arc(centerX, centerY, baseRadius + 22, startAngle2, startAngle2 + Math.PI * 0.6)
        ctx.strokeStyle = `${secondaryColor} 0.4)`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Core Glowing Radial Orb
      ctx.beginPath()
      const coreR = baseRadius + pulseMagnitude * 0.4
      ctx.arc(centerX, centerY, Math.max(10, coreR), 0, Math.PI * 2)
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        6,
        centerX,
        centerY,
        coreR + 30
      )
      gradient.addColorStop(0, `${coreColor} 0.85)`)
      gradient.addColorStop(0.55, `${primaryColor} 0.45)`)
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = gradient
      ctx.fill()

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [audioLevel, conversationState, isMuted])

  // Clear visual state descriptors
  const stateConfig = {
    STARTING: {
      title: 'Preparing your interview...',
      subtitle: 'Calibrating audio environment',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500 animate-ping',
    },
    LISTENING: {
      title: audioLevel > 0.05 ? 'Listening to you...' : 'Listening...',
      subtitle: 'Speak naturally into microphone',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500',
    },
    SPEAKING: {
      title: 'AI Interviewer',
      subtitle: 'Speaking question aloud...',
      badge: 'bg-purple-50 text-purple-700 border-purple-200',
      dot: 'bg-purple-500 animate-pulse',
    },
    THINKING: {
      title: 'Analyzing your response...',
      subtitle: 'Evaluating & preparing next step',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      dot: 'bg-indigo-500 animate-spin',
    },
    MUTED: {
      title: 'Microphone muted',
      subtitle: 'Click below to unmute anytime',
      badge: 'bg-rose-50 text-rose-700 border-rose-200',
      dot: 'bg-rose-500',
    },
    DISCONNECTED: {
      title: 'Voice connection interrupted',
      subtitle: 'Interview session is safe. Reconnecting...',
      badge: 'bg-amber-50 text-amber-800 border-amber-200',
      dot: 'bg-amber-500',
    },
  }

  const currentDescriptor = stateConfig[conversationState] || stateConfig.LISTENING

  return (
    <div
      className={
        contained
          ? 'flex flex-col items-center justify-between w-full h-full relative z-10'
          : 'flex flex-col items-center justify-between p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-2xs relative overflow-hidden h-full min-h-[320px] sm:min-h-[360px]'
      }
    >
      {/* Background ambient lighting */}
      {!contained && (
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/40 via-indigo-50/15 to-white pointer-events-none" />
      )}

      {/* Top Presence Badge with Clean Sans Typography & Balanced Letter Spacing */}
      <div className="w-full flex items-center justify-between z-10">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-sans font-semibold tracking-normal shadow-2xs ${currentDescriptor.badge}`}
        >
          <span className="flex h-2 w-2 relative">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentDescriptor.dot}`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${currentDescriptor.dot}`}
            />
          </span>
          <span>{currentDescriptor.title}</span>
        </div>

        {/* Conversation Stream Button */}
        {onOpenConversation && (
          <button
            onClick={onOpenConversation}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-sans font-medium text-slate-700 transition cursor-pointer shadow-2xs tracking-normal"
            title="Open conversation message stream"
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>Chat ({unreadTurnsCount})</span>
          </button>
        )}
      </div>

      {/* Central Interactive Orb */}
      <div className="relative flex flex-col items-center justify-center my-auto py-1 z-10">
        <div className="relative flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={280}
            height={280}
            className="w-48 h-48 sm:w-56 sm:h-56"
          />

          {/* Center Floating Icon Badge */}
          <div className="absolute flex flex-col items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-white/95 border border-slate-200/90 backdrop-blur-xs flex items-center justify-center shadow-lg">
              {conversationState === 'SPEAKING' ? (
                <Volume2 className="w-7 h-7 text-purple-600 animate-pulse" />
              ) : conversationState === 'THINKING' ? (
                <Sparkles className="w-7 h-7 text-indigo-600 animate-pulse" />
              ) : isMuted || conversationState === 'MUTED' ? (
                <MicOff className="w-7 h-7 text-rose-600" />
              ) : (
                <Mic className="w-7 h-7 text-blue-600" />
              )}
            </div>
          </div>
        </div>

        {/* Subtitle guidance text below orb */}
        <div className="text-center mt-2 space-y-0.5">
          <div className="text-xs font-bold text-slate-800 tracking-tight">
            {currentDescriptor.subtitle}
          </div>
          {silenceNudgeText && (
            <div className="text-xs font-sans text-amber-700 animate-pulse font-medium tracking-normal">
              {silenceNudgeText}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Audio Toolbar */}
      <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-3 z-10 border-t border-slate-100">
        {/* Mic Toggle Button */}
        <button
          onClick={onToggleMute}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs border cursor-pointer ${
            conversationState === 'SPEAKING'
              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 active:scale-[0.98]'
              : isMuted
              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 active:scale-[0.98]'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 active:scale-[0.98]'
          }`}
          title={
            conversationState === 'SPEAKING'
              ? 'AI is speaking. Click to unmute and speak now'
              : isMuted
              ? 'Click to Unmute Microphone'
              : 'Click to Mute Microphone'
          }
        >
          {conversationState === 'SPEAKING' || isMuted ? (
            <>
              <MicOff className="w-3.5 h-3.5 text-rose-600" />
              <span>Unmute Mic</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5 text-blue-600" />
              <span>Mute Mic</span>
            </>
          )}
        </button>

        {/* Accent / Speech Language Toggle */}
        {onChangeLanguage && (
          <button
            onClick={() => onChangeLanguage(language === 'en-IN' ? 'en-US' : 'en-IN')}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Toggle Accent / Language Profile"
          >
            <Languages className="w-3.5 h-3.5 text-indigo-600" />
            <span>{language === 'en-IN' ? 'English (IN)' : 'English (US)'}</span>
          </button>
        )}

        {/* Prevent AI Interruption Shield Toggle */}
        {onTogglePreventInterruption && (
          <button
            onClick={onTogglePreventInterruption}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs border cursor-pointer ${
              preventInterruption
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title={
              preventInterruption
                ? 'Interruption Protection is ON: Background noise or room echo will not interrupt AI speech'
                : 'Interruption Protection is OFF: Speaking while AI talks will interrupt the AI'
            }
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${preventInterruption ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span>{preventInterruption ? 'Protected Audio' : 'Allow Barge-in'}</span>
          </button>
        )}

        {/* Reconnect Voice Button */}
        {conversationState === 'DISCONNECTED' && onReconnect && (
          <button
            onClick={onReconnect}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border border-blue-500 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs animate-pulse"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Reconnect Voice</span>
          </button>
        )}
      </div>
    </div>
  )
}

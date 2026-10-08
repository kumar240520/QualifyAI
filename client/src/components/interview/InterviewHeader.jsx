import React, { useState, useEffect } from 'react'
import { Sparkles, ShieldCheck, ShieldAlert, PhoneOff, Clock, AlertTriangle, X, CheckCircle2 } from 'lucide-react'

export default function InterviewHeader({
  jobTitle = 'Technical Assessment',
  seniority = 'SENIOR',
  sequence = 0,
  remainingSeconds = 0,
  totalDurationMinutes = 0,
  coveredCriteriaCount = 0,
  totalCriteriaCount = 0,
  isConnected = true,
  warningsCount = 0,
  maxWarnings = 3,
  onEndInterview,
  isCompleted = false,
}) {
  const [showConfirmEnd, setShowConfirmEnd] = useState(false)
  const [localSeconds, setLocalSeconds] = useState(remainingSeconds)

  // Sync and tick authoritative timer
  useEffect(() => {
    setLocalSeconds(remainingSeconds)
  }, [remainingSeconds])

  useEffect(() => {
    if (isCompleted || localSeconds <= 0) return
    const timer = setInterval(() => {
      setLocalSeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [isCompleted, localSeconds])

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const totalSecs = Math.max(1, (totalDurationMinutes || 0) * 60)
  const elapsedSecs = Math.max(0, totalSecs - localSeconds)
  const timeProgressPercent = Math.min(100, Math.round((elapsedSecs / totalSecs) * 100))
  const isTimeCritical = localSeconds <= 300 // < 5 mins

  return (
    <>
      <header className="h-16 px-4 sm:px-6 border-b border-slate-200/90 bg-white flex items-center justify-between shrink-0 z-20">
        {/* Left: Brand + Role Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 text-white shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>

          <div>
            <div className="font-heading font-extrabold text-xs sm:text-sm tracking-tight text-slate-900 flex items-center gap-2">
              <span className="truncate max-w-[200px] sm:max-w-xs">{jobTitle}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-lg font-sans font-semibold bg-blue-50 border border-blue-200 text-blue-700 shrink-0 tracking-normal">
                {seniority}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-sans font-medium tracking-normal hidden sm:block">
              QualifyAI Live Assessment
            </div>
          </div>
        </div>

        {/* Center: Authoritative Time Remaining & Coverage Progress */}
        <div className="hidden md:flex flex-col items-center gap-1.5 min-w-[220px]">
          <div className="flex items-center justify-between w-full text-xs font-sans font-medium text-slate-700 tracking-normal">
            <div className="flex items-center gap-1.5 font-semibold">
              <Clock className={`w-3.5 h-3.5 ${isTimeCritical ? 'text-rose-600 animate-pulse' : 'text-blue-600'}`} />
              <span className={isTimeCritical ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                {formatTime(localSeconds)} remaining
              </span>
            </div>
            <span className="text-slate-500 font-medium">
              {totalCriteriaCount > 0
                ? `${coveredCriteriaCount}/${totalCriteriaCount} Pillars Assessed`
                : `Question #${sequence + 1}`}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                isTimeCritical
                  ? 'bg-gradient-to-r from-amber-500 to-rose-600'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600'
              }`}
              style={{ width: `${timeProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Right: Badges & End Control */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs font-sans font-medium text-slate-700 shadow-2xs tracking-normal">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected ? 'bg-emerald-500 shadow-xs shadow-emerald-400/50' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span className="hidden sm:inline font-semibold">
              {isConnected ? 'AI Active' : 'Connecting...'}
            </span>
          </div>

          {/* Proctoring Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-200/90 text-xs font-sans font-semibold text-emerald-800 shadow-2xs tracking-normal">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="hidden lg:inline">Proctoring Active</span>
          </div>

          {/* Warnings Counter: Always visible per proctoring policy */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-sans font-bold border transition-all tracking-normal shadow-2xs ${
              warningsCount === 0
                ? 'bg-slate-50 border-slate-200/90 text-slate-700'
                : warningsCount === 1
                ? 'bg-amber-50 border-amber-300 text-amber-900 animate-pulse'
                : warningsCount === 2
                ? 'bg-orange-50 border-orange-300 text-orange-900 animate-pulse'
                : 'bg-rose-100 border-rose-300 text-rose-900'
            }`}
            title={`Security Warnings: ${warningsCount} of ${maxWarnings}`}
          >
            <ShieldAlert
              className={`w-3.5 h-3.5 shrink-0 ${
                warningsCount === 0 ? 'text-slate-400' : warningsCount >= 3 ? 'text-rose-600' : 'text-amber-600'
              }`}
            />
            <span>Warnings: {warningsCount} / {maxWarnings}</span>
          </div>

          {/* End Assessment Button */}
          {!isCompleted && (
            <button
              onClick={() => setShowConfirmEnd(true)}
              className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 text-xs font-sans font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs tracking-normal"
              title="End Assessment"
            >
              <PhoneOff className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">End Assessment</span>
            </button>
          )}
        </div>
      </header>

      {/* Confirmation Modal */}
      {showConfirmEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-heading font-extrabold text-slate-900 tracking-tight">
                Conclude Assessment Early?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-sans leading-relaxed">
                Are you sure you want to conclude this live technical assessment? Your submitted answers up to Question #{sequence + 1} will be submitted to the recruiting team for final evaluation.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirmEnd(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-sans font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Continue Assessment
              </button>
              <button
                onClick={() => {
                  setShowConfirmEnd(false)
                  if (onEndInterview) onEndInterview()
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-sans font-semibold transition cursor-pointer shadow-sm shadow-rose-600/30"
              >
                End & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

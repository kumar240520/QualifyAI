import React, { useState } from 'react'
import {
  Monitor,
  Laptop,
  Copy,
  Check,
  ShieldAlert,
  Keyboard,
  Camera,
  Mic,
  Maximize2,
} from 'lucide-react'

export default function DesktopRequiredScreen({ detectedType = 'Mobile Device' }) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch (e) {
      // Fallback
      const input = document.createElement('input')
      input.value = window.location.href
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      <div className="max-w-lg w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6 text-center">
        {/* Device Icon Graphic */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-blue-500/10 blur-xl"></div>
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <Monitor className="w-10 h-10" />
          </div>
        </div>

        {/* Header & Main Requirement Notice */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Desktop Required ({detectedType} Detected)</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Desktop or Laptop Computer Required
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed font-normal">
            Please open this interview link on a desktop or laptop computer. QualifyAI interviews are currently supported on desktop devices only. Open the invitation on your PC or laptop to continue.
          </p>
        </div>

        {/* Why Desktop is Mandatory */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-left space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span>Interview Environment Prerequisites</span>
          </h3>
          <ul className="text-xs text-slate-300 space-y-2">
            <li className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Front-facing webcam for identity verification</span>
            </li>
            <li className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Working microphone for voice responses</span>
            </li>
            <li className="flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Full physical keyboard for coding and answer inputs</span>
            </li>
            <li className="flex items-center gap-2">
              <Maximize2 className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Full-screen lockdown proctoring environment</span>
            </li>
          </ul>
        </div>

        {/* Action: Copy Invitation Link */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleCopyLink}
            type="button"
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Link Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Interview Link to Open on Desktop</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-400">
            ✓ Your invitation token has <strong>not</strong> been consumed or expired. Reopening on your desktop or laptop will allow you to complete the assessment.
          </p>
        </div>
      </div>
    </div>
  )
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const proctoringService = {
  /**
   * Batch ingest proctoring events
   */
  async recordEvents(interviewId, token, events) {
    if (!interviewId || !token || !events || events.length === 0) return null

    try {
      const res = await fetch(`${API_BASE_URL}/interviews/${interviewId}/proctoring/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, events }),
      })
      const data = await res.json()
      return data.data
    } catch (err) {
      console.warn('[ProctoringService.recordEvents] Telemetry transmit error:', err.message)
      return null
    }
  },

  /**
   * Fetch proctoring summary and integrity risk assessment
   */
  async getSummary(interviewId) {
    const res = await fetch(`${API_BASE_URL}/interviews/${interviewId}/proctoring/summary`, {
      method: 'GET',
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch proctoring summary.')
    }
    return data.data
  },

  /**
   * Comprehensive Assessment Integrity & Telemetry Tracker
   * Enforces 5-warning security lockdown:
   * - Tab Switching & Window Focus Loss
   * - Fullscreen Exit Detection
   * - Copy, Cut & Paste Interception
   * - Screenshot & Screen Capture Interception (PrtScn, Win+Shift+S, Cmd+Shift+3/4/5)
   * - Developer Tools & Right-Click Context Menu Blocking
   * - Automatic termination callback upon reaching maxWarnings (5)
   */
  createTracker(interviewId, { token, onWarning, onTerminate, maxWarnings = 3 } = {}) {
    let buffer = []
    let flushInterval = null
    let blurStartTime = null
    let warningsCount = 0
    let isTerminated = false
    let flushInFlight = null
    const warningsHistory = []
    const lastViolationTimestamps = {}

    const recordEvent = (eventType, severity = 'LOW', metadata = {}, isWarning = false) => {
      buffer.push({
        event_id: crypto.randomUUID(),
        event_type: eventType,
        severity,
        is_warning: isWarning,
        metadata: {
          ...metadata,
        },
        timestamp_ms: Date.now(),
      })
    }

    const flush = async () => {
      if (flushInFlight) return flushInFlight
      if (buffer.length === 0 || !interviewId || !token) return null
      const batch = buffer.splice(0)
      flushInFlight = (async () => {
        const result = await proctoringService.recordEvents(interviewId, token, batch)
        if (!result) {
          buffer.unshift(...batch)
          return null
        }
        if (Number.isFinite(Number(result.warningCount))) warningsCount = Number(result.warningCount)
        for (const warning of result.warnings || []) {
          const sourceEvent = batch.find((item) => item.event_id === warning.eventId)
          const violationRecord = {
            id: warning.eventId || `warn-${Date.now()}-${warning.count}`,
            warningNumber: warning.count,
            maxWarnings,
            type: warning.type,
            reason: warning.reason,
            severity: warning.severity,
            timestamp: new Date().toISOString(),
            metadata: sourceEvent?.metadata || {},
          }
          warningsHistory.push(violationRecord)
          onWarning?.({
            count: warning.count,
            maxWarnings,
            violation: violationRecord,
            message: `Warning ${warning.count} of ${maxWarnings}: ${warning.reason}`,
          })
        }
        if (result.terminated && !isTerminated) {
          isTerminated = true
          onTerminate?.({
            reason: `Maximum warning threshold reached (${warningsCount}/${maxWarnings}).`,
            count: warningsCount,
            maxWarnings,
            history: [...warningsHistory],
          })
        }
        return result
      })().finally(() => { flushInFlight = null })
      return flushInFlight
    }

    const triggerViolation = (type, reason, severity = 'MEDIUM', meta = {}) => {
      if (isTerminated) return

      const now = Date.now()
      const lastTime = lastViolationTimestamps[type] || 0
      // 1.5 second cooldown per violation type to avoid cascading multiple triggers from a single action (e.g. Alt-Tab)
      if (now - lastTime < 1500) {
        return
      }
      lastViolationTimestamps[type] = now

      recordEvent(type, severity, {
        violationType: type,
        reason,
        maxWarnings,
        ...meta,
      }, true)
      void flush()
    }

    // 1. Tab switch / Visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurStartTime = Date.now()
        triggerViolation('TAB_SWITCH', 'Switched browser tabs or minimized assessment window.', 'HIGH', {
          state: 'HIDDEN',
        })
      } else {
        const durationMs = blurStartTime ? Date.now() - blurStartTime : 0
        recordEvent('VISIBILITY_CHANGE', 'LOW', {
          state: 'VISIBLE',
          duration_away_ms: durationMs,
        })
        blurStartTime = null
      }
    }

    // 2. Window Blur (clicking outside browser or multi-monitor focus loss)
    const handleWindowBlur = () => {
      // A hidden tab already records TAB_SWITCH. Avoid counting the same action again as focus loss.
      if (document.hidden) return
      triggerViolation('FOCUS_LOSS', 'Assessment window lost focus. Keep the window active.', 'MEDIUM', {
        userAgent: navigator.userAgent,
      })
    }

    // 3. Fullscreen exit detection
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        triggerViolation('FULLSCREEN_EXIT', 'Exited fullscreen mode. Fullscreen lockdown is mandatory.', 'HIGH')
      }
    }

    // 4. Clipboard protection: Copy, Cut, Paste
    const handleCopy = (e) => {
      e.preventDefault()
      triggerViolation('CLIPBOARD_ATTEMPT', 'Copying content is strictly disabled during the assessment.', 'HIGH', {
        action: 'COPY',
      })
    }

    const handleCut = (e) => {
      e.preventDefault()
      triggerViolation('CLIPBOARD_ATTEMPT', 'Cutting content is strictly disabled during the assessment.', 'HIGH', {
        action: 'CUT',
      })
    }

    const handlePaste = (e) => {
      e.preventDefault()
      triggerViolation('CLIPBOARD_ATTEMPT', 'Pasting external content is strictly disabled.', 'HIGH', {
        action: 'PASTE',
      })
    }

    // 5. Context menu protection (Right-click)
    const handleContextMenu = (e) => {
      e.preventDefault()
      triggerViolation('RIGHT_CLICK', 'Right-click context menu is disabled during the assessment.', 'MEDIUM')
    }

    // 6. Keyboard protection (Screenshots, DevTools, Copy/Paste shortcuts)
    const handleKeyDown = (e) => {
      // A. Screenshots and Screen Snipping
      const isPrtScn = e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.key === 'Snapshot'
      const isWinSnipping = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S')
      const isMacScreenshot = e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)

      if (isPrtScn || isWinSnipping || isMacScreenshot) {
        e.preventDefault()
        e.stopPropagation()
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('')
          }
        } catch (_) {}
        triggerViolation('SCREENSHOT_ATTEMPT', 'Screen capture and screenshots are strictly prohibited.', 'HIGH', {
          key: e.key,
          code: e.code,
        })
        return
      }

      // B. Clipboard keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+X, Meta+C, Meta+V, Meta+X)
      if ((e.ctrlKey || e.metaKey) && ['c', 'C', 'v', 'V', 'x', 'X'].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        triggerViolation('CLIPBOARD_ATTEMPT', `Clipboard shortcut (Ctrl+${e.key.toUpperCase()}) is disabled.`, 'HIGH', {
          key: e.key,
        })
        return
      }

      // Shift+Insert or Ctrl+Insert clipboard operations
      if ((e.ctrlKey || e.shiftKey) && e.key === 'Insert') {
        e.preventDefault()
        e.stopPropagation()
        triggerViolation('CLIPBOARD_ATTEMPT', 'Clipboard Insert shortcut is disabled.', 'HIGH')
        return
      }

      // C. Developer Tools & View Source shortcuts
      if (e.key === 'F12') {
        e.preventDefault()
        e.stopPropagation()
        triggerViolation('DEVTOOLS_ATTEMPT', 'Developer Tools (F12) are disabled.', 'HIGH')
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        triggerViolation('DEVTOOLS_ATTEMPT', 'Developer inspection shortcut is disabled.', 'HIGH', {
          key: e.key,
        })
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault()
        e.stopPropagation()
        triggerViolation('DEVTOOLS_ATTEMPT', 'View Source shortcut is disabled.', 'HIGH')
        return
      }
    }

    // Register active proctoring listeners
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('blur', handleWindowBlur)
      document.addEventListener('fullscreenchange', handleFullscreenChange)
      window.addEventListener('copy', handleCopy, true)
      window.addEventListener('cut', handleCut, true)
      window.addEventListener('paste', handlePaste, true)
      window.addEventListener('contextmenu', handleContextMenu, true)
      window.addEventListener('keydown', handleKeyDown, true)

      flushInterval = setInterval(flush, 6000)
    }

    return {
      recordAcousticAnomaly: (decibelLevel) => {
      recordEvent('ACOUSTIC_ANOMALY', 'MEDIUM', { decibelLevel }, false)
      },
      triggerViolation,
      getWarningsCount: () => warningsCount,
      getWarningsHistory: () => [...warningsHistory],
      flush,
      destroy: () => {
        if (typeof window !== 'undefined') {
          document.removeEventListener('visibilitychange', handleVisibilityChange)
          window.removeEventListener('blur', handleWindowBlur)
          document.removeEventListener('fullscreenchange', handleFullscreenChange)
          window.removeEventListener('copy', handleCopy, true)
          window.removeEventListener('cut', handleCut, true)
          window.removeEventListener('paste', handlePaste, true)
          window.removeEventListener('contextmenu', handleContextMenu, true)
          window.removeEventListener('keydown', handleKeyDown, true)
          if (flushInterval) clearInterval(flushInterval)
        }
        flush()
      },
    }
  },
}

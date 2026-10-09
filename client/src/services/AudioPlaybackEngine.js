/**
 * Enterprise Audio Playback Engine for QualifyAI
 *
 * Single authoritative audio engine for interviewer speech playback.
 * Guarantees:
 * - One persistent AudioContext across the entire interview session
 * - Deterministic FIFO audio queue
 * - Strict PCM16 little-endian decoding with frame alignment
 * - No pitch modification (native 1.0x rate) for stable vocal identity
 * - Seamless block boundary chaining with micro-fades to eliminate metallic/crackling clicks
 * - Loudness safety headroom guard to eliminate digital clipping
 * - Sequence validation (drops duplicates, out-of-order, and stale chunks)
 * - Comprehensive audio observability diagnostics
 */

const DEFAULT_BLOCK_MS = 120
const DEFAULT_PREBUFFER_MS = 200
const SAFETY_BUFFER_SECONDS = 0.05

// Persistent singleton AudioContext holder across browser session
let _sharedAudioContext = null

export function getSharedAudioContext(AudioContextClass = null) {
  if (typeof window === 'undefined') return null
  if (!_sharedAudioContext || _sharedAudioContext.state === 'closed') {
    const CtxClass = AudioContextClass || window.AudioContext || window.webkitAudioContext
    if (CtxClass) {
      _sharedAudioContext = new CtxClass()
    }
  }
  return _sharedAudioContext
}

function decodeBase64(base64) {
  if (
    typeof base64 !== 'string' ||
    !base64 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
  ) {
    throw new Error('Audio payload is not valid base64.')
  }
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export class AudioPlaybackEngine {
  constructor({
    onPlaybackStart = () => {},
    onPlaybackComplete = () => {},
    onPlaybackProgress = () => {},
    onError = () => {},
    AudioContextClass = null,
    blockMs = DEFAULT_BLOCK_MS,
    prebufferMs = DEFAULT_PREBUFFER_MS,
    playbackRate = 1.0, // Strictly 1.0x native rate to preserve stable human pitch & formants
  } = {}) {
    this.AudioContextClass = AudioContextClass
    this.onPlaybackStart = onPlaybackStart
    this.onPlaybackComplete = onPlaybackComplete
    this.onPlaybackProgress = onPlaybackProgress
    this.onError = onError
    this.blockMs = blockMs
    this.prebufferSeconds = prebufferMs / 1000
    this.playbackRate = playbackRate
    this.audioContext = null
    this.vocalChain = null
    this.resumePromise = null
    this.playbackStartTime = 0
    this.progressTimer = null
    this.state = 'IDLE' // 'IDLE' | 'PLAYING' | 'DRAINING' | 'PAUSED' | 'ERROR' | 'DESTROYED'
    this.turnId = null
    this.turnSequence = null
    this.isFirstBufferOfTurn = true
    this.streamComplete = false
    this.playbackStarted = false
    this.playbackCompletionSent = false
    this.isDestroyed = false
    this.enqueueChain = Promise.resolve()
    this.formats = null
    this.lastSequence = 0
    this.carryBytes = new Uint8Array(0)
    this.pendingChannels = []
    this.pendingFrames = 0
    this.queue = []
    this.queueSeconds = 0
    this.activeSources = new Set()
    this.scheduledUntil = 0
    this.underrunOpen = false
    this.stats = this._newStats()
    this.eventLog = []
  }

  _newStats() {
    return {
      encoding: null,
      sampleRate: 0,
      channels: 0,
      bitDepth: 0,
      byteOrder: null,
      chunksReceived: 0,
      bytesReceived: 0,
      framesReceived: 0,
      decodedFrames: 0,
      decodedBytes: 0,
      calculatedDurationSeconds: 0,
      duplicateChunks: 0,
      missingChunks: 0,
      outOfOrderChunks: 0,
      rejectedChunks: 0,
      serverDiagnosticsMismatches: 0,
      underruns: 0,
      maxQueueDepth: 0,
    }
  }

  _logEvent(name, detail = {}) {
    const event = {
      event: name,
      timestamp: Date.now(),
      turnId: this.turnId,
      state: this.state,
      ...detail,
    }
    this.eventLog.push(event)
    if (this.eventLog.length > 100) {
      this.eventLog.shift()
    }
  }

  /**
   * Initializes or resumes the single persistent AudioContext
   */
  async initialize() {
    if (this.isDestroyed) throw new Error('Audio playback engine has been destroyed.')

    if (!this.audioContext || this.audioContext.state === 'closed') {
      const CtxClass =
        this.AudioContextClass ||
        (typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null)
      if (!CtxClass) throw new Error('Web Audio is unavailable in this environment.')

      this.audioContext = getSharedAudioContext(CtxClass) || new CtxClass()
      this.audioContext.addEventListener?.('statechange', () => {
        this._logEvent('audio_context_state', { audioContextState: this.audioContext?.state })
        if (this.audioContext?.state === 'suspended' && this.state === 'PLAYING') {
          this.state = 'PAUSED'
        }
      })
    }

    if (this.audioContext.state === 'suspended') {
      this.resumePromise ||= this.audioContext.resume()
      try {
        await this.resumePromise
      } finally {
        this.resumePromise = null
      }
    }

    if (this.audioContext.state !== 'running') {
      console.warn(`[AudioPlaybackEngine] AudioContext is ${this.audioContext.state}. Attaching one-time gesture resume listener.`)
      if (typeof window !== 'undefined') {
        const resumeOnInteraction = () => {
          this.audioContext?.resume().then(() => {
            console.log('[AudioPlaybackEngine] AudioContext successfully resumed via user interaction.')
          }).catch(() => {})
          window.removeEventListener('click', resumeOnInteraction, true)
          window.removeEventListener('keydown', resumeOnInteraction, true)
          window.removeEventListener('touchstart', resumeOnInteraction, true)
        }
        window.addEventListener('click', resumeOnInteraction, { capture: true, once: true })
        window.addEventListener('keydown', resumeOnInteraction, { capture: true, once: true })
        window.addEventListener('touchstart', resumeOnInteraction, { capture: true, once: true })
      }
    }
    return this.audioContext
  }

  /**
   * Starts a new audio turn. Flushes previous audio sources cleanly.
   */
  beginTurn(turnId, sequence = null) {
    if (turnId != null && this.turnId === turnId) return
    this.flush()
    this.turnId = turnId ?? `audio-turn-${Date.now()}`
    this.turnSequence = sequence
    this.isFirstBufferOfTurn = true
    this.streamComplete = false
    this.playbackStarted = false
    this.playbackCompletionSent = false
    this.formats = null
    this.lastSequence = 0
    this.carryBytes = new Uint8Array(0)
    this.pendingChannels = []
    this.pendingFrames = 0
    this.state = 'IDLE'
    this.stats = this._newStats()
    this._logEvent('audio_started', { turnId: this.turnId, sequence })
  }

  /**
   * Enqueue a validated PCM audio chunk
   */
  enqueue(payload) {
    this.enqueueChain = this.enqueueChain
      .then(async () => {
        if (this.isDestroyed || this.streamComplete) return
        // Reject stale turn audio or older sequence chunks
        if (payload?.audioTurnId != null && payload.audioTurnId !== this.turnId) {
          this._logEvent('audio_stale', { receivedTurnId: payload.audioTurnId, currentTurnId: this.turnId })
          return
        }
        if (
          typeof payload?.questionSequence === 'number' &&
          typeof this.turnSequence === 'number' &&
          payload.questionSequence < this.turnSequence
        ) {
          this._logEvent('audio_stale_sequence', {
            receivedSequence: payload.questionSequence,
            currentSequence: this.turnSequence,
          })
          return
        }

        await this.initialize()

        const sequence = Number(payload?.audioSequence ?? payload?.chunkIndex)
        if (Number.isInteger(sequence) && sequence > 0) {
          if (sequence <= this.lastSequence) {
            if (sequence === this.lastSequence) {
              this.stats.duplicateChunks++
              this._logEvent('audio_dropped', { reason: 'duplicate', sequence })
              console.warn(`[AudioPlaybackEngine] Duplicate audio chunk ${sequence}; dropped.`)
            } else {
              this.stats.outOfOrderChunks++
              this._logEvent('audio_dropped', { reason: 'out_of_order', sequence, lastSequence: this.lastSequence })
              console.warn(`[AudioPlaybackEngine] Out-of-order audio chunk ${sequence}; last accepted ${this.lastSequence}; dropped.`)
            }
            return
          }
          if (sequence > this.lastSequence + 1) {
            const missing = sequence - this.lastSequence - 1
            this.stats.missingChunks += missing
            this._logEvent('audio_sequence_error', { missing, expected: this.lastSequence + 1, received: sequence })
            console.warn(`[AudioPlaybackEngine] Missing ${missing} audio chunk(s): expected ${this.lastSequence + 1}, received ${sequence}.`)
          }
          this.lastSequence = sequence
        }

        const format = this._parseFormat(payload)
        if (this.formats && !this._sameFormat(this.formats, format)) {
          this._logEvent('audio_format_error', { expected: this.formats, received: format })
          throw new Error(`PCM format changed within audio turn (${JSON.stringify(this.formats)} -> ${JSON.stringify(format)}).`)
        }
        this.formats ||= format

        const bytes = decodeBase64(payload.data)
        if (payload.diagnostics) {
          const bytesPerFrame = format.channels * (format.bitDepth / 8)
          const receivedFrames = Math.floor(bytes.length / bytesPerFrame)
          const reportedBytes = Number(payload.diagnostics.bytes)
          const reportedFrames = Number(payload.diagnostics.completeFrames)
          if (
            (Number.isFinite(reportedBytes) && reportedBytes !== bytes.length) ||
            (Number.isFinite(reportedFrames) && reportedFrames !== receivedFrames)
          ) {
            this.stats.serverDiagnosticsMismatches++
            throw new Error(
              `Server/browser audio byte mismatch for chunk ${sequence || '(unsequenced)'}: server reported ${reportedBytes} bytes/${reportedFrames} frames, browser decoded ${bytes.length} bytes/${receivedFrames} frames.`
            )
          }
        }

        this.stats.chunksReceived++
        this.stats.bytesReceived += bytes.byteLength
        this._recordFormat(format)
        this._observePotentialUnderrun()

        const completeBytes = this._joinCarry(bytes)
        this._decodeCompleteFrames(completeBytes, format)
        this._makeBuffers(false)
        this._schedule()

        this._logEvent('audio_received', { sequence, bytes: bytes.length, queueDepth: this.queue.length })
      })
      .catch((error) => {
        this.stats.rejectedChunks++
        this.state = 'ERROR'
        this._logEvent('audio_dropped', { error: error.message })
        this.onError(error)
        console.error('[AudioPlaybackEngine] Audio chunk rejected:', error.message)
      })
    return this.enqueueChain
  }

  _parseFormat(payload) {
    const mimeType = String(payload?.mimeType || 'audio/pcm;rate=24000')
    if (!/^audio\/pcm(?:;|$)/i.test(mimeType)) {
      throw new Error(`Unsupported audio MIME type: ${mimeType || '(missing)'}.`)
    }
    const mimeRate = mimeType.match(/(?:^|;)\s*rate=(\d+)/i)
    const sampleRate = Number(mimeRate?.[1] || payload?.sampleRate || 24000)
    const channels = Number(payload?.channels || 1)
    const bitDepth = Number(payload?.bitDepth || 16)
    const byteOrder = String(payload?.byteOrder || payload?.endianness || 'le').toLowerCase()

    if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
      throw new Error(`Invalid PCM sample rate: ${sampleRate}.`)
    }
    if (!Number.isInteger(channels) || channels < 1 || channels > 2) {
      throw new Error(`Unsupported PCM channel count: ${channels}.`)
    }
    if (bitDepth !== 16) {
      throw new Error(`Unsupported PCM bit depth: ${bitDepth}.`)
    }
    if (!['little-endian', 'le'].includes(byteOrder)) {
      throw new Error(`Unsupported PCM byte order: ${byteOrder || '(missing)'}.`)
    }
    return { mimeType: `audio/pcm;rate=${sampleRate}`, encoding: 'signed-integer PCM', sampleRate, channels, bitDepth, byteOrder: 'little-endian' }
  }

  _sameFormat(left, right) {
    return (
      left.sampleRate === right.sampleRate &&
      left.channels === right.channels &&
      left.bitDepth === right.bitDepth &&
      left.byteOrder === right.byteOrder
    )
  }

  _recordFormat(format) {
    this.stats.encoding = format.encoding
    this.stats.sampleRate = format.sampleRate
    this.stats.channels = format.channels
    this.stats.bitDepth = format.bitDepth
    this.stats.byteOrder = format.byteOrder
  }

  _joinCarry(bytes) {
    if (!this.carryBytes.length) return bytes
    const joined = new Uint8Array(this.carryBytes.length + bytes.length)
    joined.set(this.carryBytes)
    joined.set(bytes, this.carryBytes.length)
    this.carryBytes = new Uint8Array(0)
    return joined
  }

  _decodeCompleteFrames(bytes, format) {
    const bytesPerFrame = format.channels * (format.bitDepth / 8)
    const usableBytes = bytes.length - (bytes.length % bytesPerFrame)
    this.carryBytes = bytes.slice(usableBytes)
    if (!usableBytes) return

    const frames = usableBytes / bytesPerFrame
    if (!this.pendingChannels.length) {
      this.pendingChannels = Array.from({ length: format.channels }, () => new Float32Array(0))
    }
    const decoded = Array.from({ length: format.channels }, () => new Float32Array(frames))
    const view = new DataView(bytes.buffer, bytes.byteOffset, usableBytes)

    for (let frame = 0; frame < frames; frame++) {
      for (let channel = 0; channel < format.channels; channel++) {
        const offset = (frame * format.channels + channel) * 2
        const value = view.getInt16(offset, true)
        decoded[channel][frame] = value < 0 ? value / 32768 : value / 32767
      }
    }

    this.pendingChannels = this.pendingChannels.map((prior, channel) => {
      const combined = new Float32Array(prior.length + frames)
      combined.set(prior)
      combined.set(decoded[channel], prior.length)
      return combined
    })

    this.pendingFrames += frames
    this.stats.framesReceived += frames
    this.stats.decodedFrames += frames
    this.stats.decodedBytes += usableBytes
    this.stats.calculatedDurationSeconds = this.stats.decodedFrames / format.sampleRate
  }

  _makeBuffers(flush) {
    if (!this.formats || !this.pendingFrames) return
    const targetFrames = Math.max(1, Math.round((this.formats.sampleRate * this.blockMs) / 1000))

    while (this.pendingFrames >= targetFrames || (flush && this.pendingFrames > 0)) {
      const frameCount = Math.min(targetFrames, this.pendingFrames)
      const isLastBuffer = flush && (this.pendingFrames - frameCount === 0)
      const isFirstBuffer = this.isFirstBufferOfTurn
      this.isFirstBufferOfTurn = false

      const audioBuffer = this.audioContext.createBuffer(this.formats.channels, frameCount, this.formats.sampleRate)

      this.pendingChannels.forEach((samples, channel) => {
        const slice = samples.subarray(0, frameCount)

        // Only apply smooth micro-fades at the extreme edges of the audio stream:
        // - Ramp up on the very first buffer of the turn from zero silence (eliminates DC offset click)
        // - Ramp down on the final buffer when flushing stream to zero silence
        // Continuous PCM buffers within the stream are completely unaltered linear PCM.
        if (isFirstBuffer) {
          const fadeLen = Math.min(48, Math.floor(frameCount / 4))
          for (let k = 0; k < fadeLen; k++) {
            const factor = 0.5 * (1 - Math.cos((Math.PI * k) / fadeLen))
            slice[k] *= factor
          }
        }
        if (isLastBuffer) {
          const fadeLen = Math.min(48, Math.floor(frameCount / 4))
          for (let k = 0; k < fadeLen; k++) {
            const factor = 0.5 * (1 - Math.cos((Math.PI * k) / fadeLen))
            slice[frameCount - 1 - k] *= factor
          }
        }

        audioBuffer.copyToChannel(slice, channel)
        this.pendingChannels[channel] = samples.slice(frameCount)
      })

      this.pendingFrames -= frameCount
      this.queue.push(audioBuffer)
      this.queueSeconds += audioBuffer.duration
      this.stats.maxQueueDepth = Math.max(this.stats.maxQueueDepth, this.queue.length)
    }
  }

  _observePotentialUnderrun() {
    if (this.state !== 'PLAYING' || this.streamComplete || this.underrunOpen || !this.audioContext) return
    const currentTime = this.audioContext.currentTime
    if (this.scheduledUntil > 0 && this.scheduledUntil <= currentTime) {
      this.underrunOpen = true
      this.stats.underruns++
      this._logEvent('audio_underrun', {
        queueDepth: this.queue.length,
        scheduledUntil: this.scheduledUntil,
        currentTime,
        lagMs: Math.round((currentTime - this.scheduledUntil) * 1000),
      })
      console.warn('[AudioPlaybackEngine] AUDIO UNDERRUN', {
        queueDepth: this.queue.length,
        scheduledUntil: this.scheduledUntil,
        currentTime,
        lagMs: Math.round((currentTime - this.scheduledUntil) * 1000),
      })
    }
  }

  _schedule() {
    if (!this.audioContext || this.audioContext.state !== 'running') return
    if (!this.queue.length) {
      this._maybeCompletePlayback()
      return
    }

    if (!this.playbackStarted && this.queueSeconds < this.prebufferSeconds && !this.streamComplete) {
      return
    }

    const now = this.audioContext.currentTime
    if (this.playbackStarted && this.scheduledUntil > 0 && this.scheduledUntil <= now && !this.underrunOpen) {
      this.underrunOpen = true
      this.stats.underruns++
      this._logEvent('audio_underrun', { currentTime: now, scheduledUntil: this.scheduledUntil })
    }

    if (!this.playbackStarted) {
      this.playbackStarted = true
      this.state = 'PLAYING'
      this._startProgressTracker()
      this.onPlaybackStart({ turnId: this.turnId })
    }

    while (this.queue.length) {
      const buffer = this.queue.shift()
      this.queueSeconds = Math.max(0, this.queueSeconds - buffer.duration)
      const source = this.audioContext.createBufferSource()
      source.buffer = buffer

      // Set native playback rate (1.0)
      const rate = this.playbackRate || 1.0
      if (source.playbackRate) {
        if (typeof source.playbackRate.setValueAtTime === 'function') {
          source.playbackRate.setValueAtTime(rate, this.audioContext.currentTime)
        } else {
          source.playbackRate.value = rate
        }
      }

      const chain = this._ensureVocalWarmthChain()
      if (chain?.input) {
        source.connect(chain.input)
      } else {
        source.connect(this.audioContext.destination)
      }

      const effectiveDuration = buffer.duration / rate
      const currentTime = this.audioContext.currentTime
      // Seamless timeline tile: attach exactly at scheduledUntil if ahead of clock
      const hasActiveTimeline = this.scheduledUntil > currentTime + 0.005
      const startAt = hasActiveTimeline ? this.scheduledUntil : Math.max(currentTime + SAFETY_BUFFER_SECONDS, this.scheduledUntil)

      source.start(startAt)
      this.scheduledUntil = startAt + effectiveDuration
      this.activeSources.add(source)

      source.onended = () => {
        this.activeSources.delete(source)
        try { source.disconnect() } catch (_) {}
        this._maybeCompletePlayback()
      }
      this.underrunOpen = false
    }
  }

  _ensureVocalWarmthChain() {
    if (!this.audioContext || this.audioContext.state === 'closed') return null
    if (typeof this.audioContext.createBiquadFilter !== 'function' || typeof this.audioContext.createGain !== 'function') {
      return null
    }
    if (this.vocalChain) return this.vocalChain

    try {
      // 1. Studio Anti-Harshness Filter (Gentle Butterworth lowpass at 8.5kHz)
      // Removes out-of-band high frequency quantization hash while preserving natural vocal presence
      const lowpass = this.audioContext.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.setValueAtTime(8500, this.audioContext.currentTime)
      lowpass.Q.setValueAtTime(0.707, this.audioContext.currentTime)

      // 2. Chest Resonance / Vocal Body Subtle Warmth (180Hz, +1.2dB)
      const bodyBoost = this.audioContext.createBiquadFilter()
      bodyBoost.type = 'peaking'
      bodyBoost.frequency.setValueAtTime(180, this.audioContext.currentTime)
      bodyBoost.Q.setValueAtTime(0.9, this.audioContext.currentTime)
      bodyBoost.gain.setValueAtTime(1.2, this.audioContext.currentTime)

      // 3. Sibilance De-Harshness (3400Hz, -1.0dB)
      const deHarsh = this.audioContext.createBiquadFilter()
      deHarsh.type = 'peaking'
      deHarsh.frequency.setValueAtTime(3400, this.audioContext.currentTime)
      deHarsh.Q.setValueAtTime(1.0, this.audioContext.currentTime)
      deHarsh.gain.setValueAtTime(-1.0, this.audioContext.currentTime)

      // 4. Output Headroom Guard Gain (0.95 = -0.45 dBFS safe peak)
      const gainNode = this.audioContext.createGain()
      gainNode.gain.setValueAtTime(0.95, this.audioContext.currentTime)

      lowpass.connect(bodyBoost)
      bodyBoost.connect(deHarsh)
      deHarsh.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      this.vocalChain = { input: lowpass, lowpass, bodyBoost, deHarsh, gainNode }
      return this.vocalChain
    } catch (err) {
      console.warn('[AudioPlaybackEngine] Vocal warmth chain fallback:', err.message)
      return null
    }
  }

  async completeStream() {
    await this.enqueueChain
    if (this.carryBytes.length) {
      this.carryBytes = new Uint8Array(0)
      this.state = 'ERROR'
      const error = new Error('Audio stream ended with an incomplete PCM sample frame.')
      this._logEvent('audio_format_error', { error: error.message })
      this.onError(error)
      throw error
    }
    this.streamComplete = true
    this._makeBuffers(true)

    // Soft micro fade-out at the absolute concluding edge of the stream to eliminate DC offset pop
    const targetSource = Array.from(this.activeSources).pop()
    const targetBuf = targetSource?.buffer || this.queue[this.queue.length - 1]
    if (targetBuf && typeof targetBuf.getChannelData === 'function') {
      const frameCount = targetBuf.length
      const fadeLen = Math.min(48, Math.floor(frameCount / 4))
      for (let ch = 0; ch < targetBuf.numberOfChannels; ch++) {
        const data = targetBuf.getChannelData(ch)
        for (let k = 0; k < fadeLen; k++) {
          const factor = 0.5 * (1 - Math.cos((Math.PI * k) / fadeLen))
          data[frameCount - 1 - k] *= factor
        }
      }
    }

    this.state = this.playbackStarted ? 'DRAINING' : 'IDLE'
    this._schedule()
    this._maybeCompletePlayback()
  }

  enqueueAudioBuffer(buffer, turnId = 'diagnostic-audio') {
    this.beginTurn(turnId)
    if (!this.audioContext || this.audioContext.state !== 'running') {
      throw new Error('Initialize the audio playback engine before enqueuing an AudioBuffer.')
    }
    this.queue.push(buffer)
    this.queueSeconds += buffer.duration
    this.stats.maxQueueDepth = Math.max(this.stats.maxQueueDepth, this.queue.length)
    this._schedule()
  }

  completeAudioBufferStream() {
    return this.completeStream()
  }

  _startProgressTracker() {
    this._stopProgressTracker()
    this.playbackStartTime = this.audioContext?.currentTime || 0
    this.progressTimer = setInterval(() => {
      if ((this.state !== 'PLAYING' && this.state !== 'DRAINING') || !this.audioContext) {
        this._stopProgressTracker()
        return
      }
      const now = this.audioContext.currentTime
      const elapsed = Math.max(0, now - this.playbackStartTime)
      const total = Math.max(0.1, this.scheduledUntil - this.playbackStartTime)
      const rawProgress = Math.min(1.0, elapsed / total)
      // While audio chunks are still streaming from the server, do not report 100% completion prematurely
      const progress = this.streamComplete ? rawProgress : Math.min(0.88, rawProgress * 0.88)
      if (typeof this.onPlaybackProgress === 'function') {
        this.onPlaybackProgress({
          progress,
          isStreamComplete: this.streamComplete,
          elapsed,
          total,
          turnId: this.turnId,
        })
      }

      // Handover watchdog: When server has completed stream and audio playback has finished (now >= scheduledUntil + 0.1s),
      // ensure completion is triggered cleanly without hanging on asynchronous source.onended.
      // If streamComplete has NOT been sent, only force complete after an 8.0s network timeout.
      if (this.streamComplete && this.scheduledUntil > 0 && now >= this.scheduledUntil + 0.1) {
        this._maybeCompletePlayback(true)
      } else if (
        this.playbackStarted &&
        !this.streamComplete &&
        this.scheduledUntil > 0 &&
        now >= this.scheduledUntil + 8.0 &&
        !this.queue.length &&
        !this.pendingFrames
      ) {
        this.streamComplete = true
        this._maybeCompletePlayback(true)
      }
    }, 60)
    if (typeof this.progressTimer?.unref === 'function') {
      this.progressTimer.unref()
    }
  }

  _stopProgressTracker() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer)
      this.progressTimer = null
    }
  }

  _maybeCompletePlayback(force = false) {
    if (force) {
      this.streamComplete = true
    }
    if (
      !this.streamComplete ||
      this.playbackCompletionSent ||
      (!force && (this.queue.length || this.pendingFrames || this.activeSources.size))
    ) {
      return
    }

    if (force && this.activeSources.size) {
      this.activeSources.forEach((src) => {
        try { src.stop?.() } catch (_) {}
        try { src.disconnect() } catch (_) {}
      })
      this.activeSources.clear()
    }

    this._stopProgressTracker()
    if (typeof this.onPlaybackProgress === 'function') {
      const total = Math.max(0.1, this.scheduledUntil - this.playbackStartTime)
      this.onPlaybackProgress({
        progress: 1.0,
        elapsed: total,
        total,
        turnId: this.turnId,
      })
    }
    this.playbackCompletionSent = true
    this.state = 'IDLE'
    this._logEvent('audio_completed', { turnId: this.turnId })
    this.onPlaybackComplete({
      turnId: this.turnId,
      scheduledUntil: this.scheduledUntil,
      currentTime: this.audioContext?.currentTime || 0,
      stats: { ...this.stats },
    })
  }

  async pause() {
    if (this.audioContext?.state === 'running') {
      await this.audioContext.suspend()
      this.state = 'PAUSED'
    }
  }

  async resume() {
    await this.initialize()
    if (this.state === 'PAUSED') this.state = 'PLAYING'
    this._schedule()
  }

  flush() {
    this._stopProgressTracker()
    const now = this.audioContext?.currentTime || 0
    for (const source of this.activeSources) {
      try { source.stop(now) } catch (_) {}
      try { source.disconnect() } catch (_) {}
    }
    this.activeSources.clear()
    this.queue = []
    this.queueSeconds = 0
    this.pendingChannels = []
    this.pendingFrames = 0
    this.carryBytes = new Uint8Array(0)
    this.scheduledUntil = now
    this.underrunOpen = false
    this.streamComplete = false
    this.playbackStarted = false
    this.playbackCompletionSent = false
    this.isFirstBufferOfTurn = true
    this.turnSequence = null
    if (!this.isDestroyed) this.state = 'IDLE'
  }

  stop() {
    this.flush()
    this.state = 'IDLE'
  }

  async destroy() {
    this._stopProgressTracker()
    this.stop()
    this.isDestroyed = true
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close()
    }
    this.audioContext = null
    this.vocalChain = null
    this.state = 'DESTROYED'
  }

  getState() {
    const context = this.audioContext
    return {
      state: this.state,
      turnId: this.turnId,
      streamComplete: this.streamComplete,
      queueDepth: this.queue.length,
      queueDurationMs: Math.round(this.queueSeconds * 1000),
      scheduledUntil: this.scheduledUntil,
      currentTime: context?.currentTime || 0,
      activeSources: this.activeSources.size,
      audioContextState: context?.state || 'uninitialized',
      audioContextSampleRate: context?.sampleRate || 0,
      format: this.formats ? { ...this.formats } : null,
      stats: { ...this.stats },
      eventLog: [...this.eventLog],
    }
  }
}

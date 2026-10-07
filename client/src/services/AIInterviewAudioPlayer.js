const DEFAULT_BLOCK_MS = 100
const DEFAULT_PREBUFFER_MS = 160
const SAFETY_BUFFER_SECONDS = 0.06

function decodeBase64(base64) {
  if (typeof base64 !== 'string' || !base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error('Audio payload is not valid base64.')
  }
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export class AIInterviewAudioPlayer {
  constructor({
    onPlaybackStart = () => {},
    onPlaybackComplete = () => {},
    onError = () => {},
    AudioContextClass = null,
    blockMs = DEFAULT_BLOCK_MS,
    prebufferMs = DEFAULT_PREBUFFER_MS,
  } = {}) {
    this.AudioContextClass = AudioContextClass
    this.onPlaybackStart = onPlaybackStart
    this.onPlaybackComplete = onPlaybackComplete
    this.onError = onError
    this.blockMs = blockMs
    this.prebufferSeconds = prebufferMs / 1000
    this.audioContext = null
    this.resumePromise = null
    this.state = 'IDLE'
    this.turnId = null
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

  async initialize() {
    if (this.isDestroyed) throw new Error('Audio player has been destroyed.')
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = this.AudioContextClass || window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) throw new Error('Web Audio is unavailable in this browser.')
      this.audioContext = new AudioContextClass()
      this.audioContext.addEventListener?.('statechange', () => {
        if (this.audioContext?.state === 'suspended' && this.state === 'PLAYING') this.state = 'PAUSED'
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
    if (this.audioContext.state !== 'running') throw new Error(`AudioContext is ${this.audioContext.state}.`)
    return this.audioContext
  }

  beginTurn(turnId) {
    if (turnId != null && this.turnId === turnId) return
    this.flush()
    this.turnId = turnId ?? `audio-turn-${Date.now()}`
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
  }

  enqueue(payload) {
    this.enqueueChain = this.enqueueChain.then(async () => {
      if (this.isDestroyed || this.streamComplete) return
      if (payload?.audioTurnId != null && payload.audioTurnId !== this.turnId) return
      await this.initialize()

      const sequence = Number(payload?.audioSequence ?? payload?.chunkIndex)
      if (Number.isInteger(sequence) && sequence > 0) {
        if (sequence <= this.lastSequence) {
          if (sequence === this.lastSequence) {
            this.stats.duplicateChunks++
            console.warn(`[AIInterviewAudioPlayer] Duplicate audio chunk ${sequence}; dropped.`)
          } else {
            this.stats.outOfOrderChunks++
            console.warn(`[AIInterviewAudioPlayer] Out-of-order audio chunk ${sequence}; last accepted ${this.lastSequence}; dropped.`)
          }
          return
        }
        if (sequence > this.lastSequence + 1) {
          const missing = sequence - this.lastSequence - 1
          this.stats.missingChunks += missing
          console.warn(`[AIInterviewAudioPlayer] Missing ${missing} audio chunk(s): expected ${this.lastSequence + 1}, received ${sequence}.`)
        }
        this.lastSequence = sequence
      }

      const format = this._parseFormat(payload)
      if (this.formats && !this._sameFormat(this.formats, format)) {
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
          throw new Error(`Server/browser audio byte mismatch for chunk ${sequence || '(unsequenced)'}: server reported ${reportedBytes} bytes/${reportedFrames} frames, browser decoded ${bytes.length} bytes/${receivedFrames} frames.`)
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
    }).catch((error) => {
      this.stats.rejectedChunks++
      this.state = 'ERROR'
      this.onError(error)
      console.error('[AIInterviewAudioPlayer] Audio chunk rejected:', error.message)
    })
    return this.enqueueChain
  }

  _parseFormat(payload) {
    const mimeType = String(payload?.mimeType || '')
    if (!/^audio\/pcm(?:;|$)/i.test(mimeType)) throw new Error(`Unsupported audio MIME type: ${mimeType || '(missing)'}.`)
    const mimeRate = mimeType.match(/(?:^|;)\s*rate=(\d+)/i)
    const sampleRate = Number(mimeRate?.[1] || payload.sampleRate)
    const channels = Number(payload.channels)
    const bitDepth = Number(payload.bitDepth)
    const byteOrder = String(payload.byteOrder || payload.endianness || '').toLowerCase()
    if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error(`Invalid PCM sample rate: ${sampleRate}.`)
    if (!Number.isInteger(channels) || channels < 1 || channels > 2) throw new Error(`Unsupported PCM channel count: ${channels}.`)
    if (bitDepth !== 16) throw new Error(`Unsupported PCM bit depth: ${bitDepth}.`)
    if (!['little-endian', 'le'].includes(byteOrder)) throw new Error(`Unsupported PCM byte order: ${byteOrder || '(missing)'}.`)
    return { mimeType, encoding: 'signed-integer PCM', sampleRate, channels, bitDepth, byteOrder: 'little-endian' }
  }

  _sameFormat(left, right) {
    return left.sampleRate === right.sampleRate && left.channels === right.channels && left.bitDepth === right.bitDepth && left.byteOrder === right.byteOrder
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
    if (!this.pendingChannels.length) this.pendingChannels = Array.from({ length: format.channels }, () => new Float32Array(0))
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
      const audioBuffer = this.audioContext.createBuffer(this.formats.channels, frameCount, this.formats.sampleRate)
      this.pendingChannels.forEach((samples, channel) => {
        audioBuffer.copyToChannel(samples.subarray(0, frameCount), channel)
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
      console.warn('[AIInterviewAudioPlayer] AUDIO UNDERRUN', {
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
    if (!this.playbackStarted && this.queueSeconds < this.prebufferSeconds && !this.streamComplete) return
    const now = this.audioContext.currentTime
    if (this.playbackStarted && this.scheduledUntil > 0 && this.scheduledUntil <= now && !this.underrunOpen) {
      this.underrunOpen = true
      this.stats.underruns++
      console.warn('[AIInterviewAudioPlayer] AUDIO UNDERRUN', {
        queueDepth: this.queue.length,
        scheduledUntil: this.scheduledUntil,
        currentTime: now,
        lagMs: Math.round((now - this.scheduledUntil) * 1000),
      })
    }
    if (!this.playbackStarted) {
      this.playbackStarted = true
      this.state = 'PLAYING'
      this.onPlaybackStart({ turnId: this.turnId })
    }

    while (this.queue.length) {
      const buffer = this.queue.shift()
      this.queueSeconds = Math.max(0, this.queueSeconds - buffer.duration)
      const source = this.audioContext.createBufferSource()
      source.buffer = buffer
      source.connect(this.audioContext.destination)
      const startAt = Math.max(this.audioContext.currentTime + SAFETY_BUFFER_SECONDS, this.scheduledUntil)
      source.start(startAt)
      this.scheduledUntil = startAt + buffer.duration
      this.activeSources.add(source)
      source.onended = () => {
        this.activeSources.delete(source)
        try { source.disconnect() } catch (_) {}
        this._maybeCompletePlayback()
      }
      this.underrunOpen = false
    }
  }

  async completeStream() {
    await this.enqueueChain
    if (this.carryBytes.length) {
      this.carryBytes = new Uint8Array(0)
      this.state = 'ERROR'
      const error = new Error('Audio stream ended with an incomplete PCM sample frame.')
      this.onError(error)
      throw error
    }
    this.streamComplete = true
    this._makeBuffers(true)
    this.state = this.playbackStarted ? 'DRAINING' : 'IDLE'
    this._schedule()
    this._maybeCompletePlayback()
  }

  enqueueAudioBuffer(buffer, turnId = 'diagnostic-audio') {
    this.beginTurn(turnId)
    if (!this.audioContext || this.audioContext.state !== 'running') {
      throw new Error('Initialize the audio player before enqueuing an AudioBuffer.')
    }
    this.queue.push(buffer)
    this.queueSeconds += buffer.duration
    this.stats.maxQueueDepth = Math.max(this.stats.maxQueueDepth, this.queue.length)
    this._schedule()
  }

  completeAudioBufferStream() {
    return this.completeStream()
  }

  _maybeCompletePlayback() {
    if (!this.streamComplete || this.queue.length || this.pendingFrames || this.activeSources.size || this.playbackCompletionSent) return
    this.playbackCompletionSent = true
    this.state = 'IDLE'
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
    if (!this.isDestroyed) this.state = 'IDLE'
  }

  stop() {
    this.flush()
    this.state = 'IDLE'
  }

  async destroy() {
    this.stop()
    this.isDestroyed = true
    if (this.audioContext && this.audioContext.state !== 'closed') await this.audioContext.close()
    this.audioContext = null
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
    }
  }
}

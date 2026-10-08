import { TTSProvider } from './TTSProvider.js'
import { config } from '../../../config/env.js'
import { cleanTextForSpeech, segmentSpeech } from '../speechSegmenter.js'
import { normalizeTextForTTS } from '../ttsTextNormalizer.js'

/**
 * Enterprise CosyVoice 3 / Fun-CosyVoice 3 TTS Provider
 *
 * Interfaces with high-fidelity CosyVoice 3 neural speech synthesis services.
 * Outputs: 24kHz mono PCM16 little-endian audio stream.
 *
 * Architecture:
 * - Decoupled HTTP / streaming microservice client.
 * - Supports streaming chunk responses and complete audio buffers.
 * - Enforces stable speaker identity, persona instruction, and unhurried natural cadence.
 * - Automatically reports availability status for zero-downtime multi-tier failover.
 */
export class CosyVoiceProvider extends TTSProvider {
  constructor(options = {}) {
    super('cosyvoice')
    this.apiUrl = options.apiUrl || config.tts?.cosyvoice?.apiUrl || process.env.COSYVOICE_API_URL || 'http://localhost:50000'
    this.apiKey = options.apiKey || config.tts?.cosyvoice?.apiKey || process.env.COSYVOICE_API_KEY || ''
    this.model = options.model || config.tts?.cosyvoice?.model || process.env.COSYVOICE_MODEL || 'Fun-CosyVoice-3'
    this.defaultVoiceId = options.voiceId || config.tts?.cosyvoice?.voiceId || 'qualifyai_interviewer_01'
    this.sampleRate = options.sampleRate || config.tts?.cosyvoice?.sampleRate || 24000
    this._available = null
    this._lastCheckTime = 0
    this._checkIntervalMs = 30000 // Re-check health every 30s
  }

  async initialize() {
    this.initialized = true
    try {
      await this.checkHealth()
    } catch (_) {
      // Non-fatal on boot; will re-evaluate on isAvailable()
    }
  }

  /**
   * Health probe against the CosyVoice 3 service
   */
  async checkHealth() {
    if (!this.apiUrl) {
      this._available = false
      return false
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2000)

      const headers = {}
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`

      // Probe health endpoint
      const response = await fetch(`${this.apiUrl.replace(/\/+$/, '')}/health`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      }).catch(async () => {
        // Fallback probe to root
        return fetch(`${this.apiUrl.replace(/\/+$/, '')}/`, {
          method: 'GET',
          headers,
          signal: controller.signal,
        })
      })

      clearTimeout(timer)
      this._available = response && (response.ok || response.status === 404 || response.status === 405)
      this._lastCheckTime = Date.now()
      return this._available
    } catch (err) {
      this._available = false
      this._lastCheckTime = Date.now()
      return false
    }
  }

  async isAvailable() {
    if (process.env.COSYVOICE_MOCK === 'true') {
      return true
    }
    const now = Date.now()
    if (this._available === null || now - this._lastCheckTime > this._checkIntervalMs) {
      await this.checkHealth()
    }
    return Boolean(this._available)
  }

  /**
   * Synthesize speech using CosyVoice 3
   * @param {object} params
   * @param {string} params.text - Cleaned or raw text
   * @param {object} params.voiceProfile - Fixed voice persona profile
   * @param {function} params.onChunk - Chunk consumer callback
   * @param {AbortSignal} [params.signal] - Optional cancellation signal
   */
  async synthesize({ text, voiceProfile, onChunk, signal }) {
    const ttsText = normalizeTextForTTS(text)
    if (!ttsText) {
      return { fullTranscript: '', totalChunks: 0, durationMs: 0 }
    }

    const speaker = voiceProfile?.cosyvoiceSpeaker || voiceProfile?.voiceId || this.defaultVoiceId
    const instructText = voiceProfile?.cosyvoiceInstruct || voiceProfile?.personaInstruction || 'Professional human interviewer, calm and articulate.'
    const speed = Number(voiceProfile?.speed) || 1.0
    const startTime = Date.now()

    // Mock/Simulation Mode for local testing or environments without a running GPU inference server
    if (process.env.COSYVOICE_MOCK === 'true' || this._available === 'mock') {
      return this._synthesizeMock({ text: ttsText, onChunk, signal, startTime })
    }

    const endpoint = `${this.apiUrl.replace(/\/+$/, '')}/v1/tts`
    const requestPayload = {
      model: this.model,
      text: ttsText,
      speaker,
      instruct_text: instructText,
      language: voiceProfile?.language || 'en-IN',
      speed,
      stream: true,
      format: 'pcm16',
      sample_rate: this.sampleRate,
    }

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/octet-stream, audio/pcm, application/json',
    }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    let response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload),
        signal,
      })
    } catch (fetchErr) {
      this._available = false
      throw new Error(`CosyVoice service connection failed (${this.apiUrl}): ${fetchErr.message}`)
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      throw new Error(`CosyVoice API returned ${response.status}: ${errBody || response.statusText}`)
    }

    const contentType = response.headers.get('content-type') || ''
    let chunkCount = 0

    // Handle Streaming Octet Stream (binary PCM16)
    if (response.body) {
      const reader = response.body.getReader()
      const chunkSize = Math.max(1, Math.round((this.sampleRate * 120 * 2) / 1000)) // ~120ms blocks in bytes
      let buffer = Buffer.alloc(0)

      while (true) {
        if (signal?.aborted) {
          try { reader.cancel() } catch (_) {}
          throw new Error('CosyVoice synthesis aborted')
        }

        const { done, value } = await reader.read()
        if (done) break

        if (value && value.length > 0) {
          buffer = Buffer.concat([buffer, Buffer.from(value)])

          while (buffer.length >= chunkSize) {
            const frameAlignedSize = chunkSize - (chunkSize % 2)
            const chunkSlice = buffer.subarray(0, frameAlignedSize)
            buffer = buffer.subarray(frameAlignedSize)

            chunkCount++
            if (typeof onChunk === 'function') {
              onChunk({
                data: chunkSlice.toString('base64'),
                mimeType: `audio/pcm;rate=${this.sampleRate}`,
                sampleRate: this.sampleRate,
                channels: 1,
                bitDepth: 16,
                byteOrder: 'little-endian',
                chunkIndex: chunkCount,
              })
            }
          }
        }
      }

      // Flush remaining frame-aligned buffer
      if (buffer.length >= 2) {
        const frameAlignedSize = buffer.length - (buffer.length % 2)
        const chunkSlice = buffer.subarray(0, frameAlignedSize)
        chunkCount++
        if (typeof onChunk === 'function') {
          onChunk({
            data: chunkSlice.toString('base64'),
            mimeType: `audio/pcm;rate=${this.sampleRate}`,
            sampleRate: this.sampleRate,
            channels: 1,
            bitDepth: 16,
            byteOrder: 'little-endian',
            chunkIndex: chunkCount,
          })
        }
      }
    }

    return {
      fullTranscript: ttsText,
      totalChunks: chunkCount,
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * Deterministic high-quality synthetic 24kHz PCM16 generator for self-testing / offline simulation
   */
  async _synthesizeMock({ text, onChunk, signal, startTime }) {
    const sampleRate = this.sampleRate || 24000
    // Generate ~40ms per word of speech (average speaking rate)
    const words = text.split(/\s+/).length
    const durationSeconds = Math.max(0.5, words * 0.35)
    const totalSamples = Math.round(sampleRate * durationSeconds)
    const chunkSize = Math.round((sampleRate * 120) / 1000) // 120ms chunk = 2880 samples
    let chunkCount = 0

    // Synthesize human harmonic tone with fundamental at 135Hz (grounded male recruiter F0)
    for (let i = 0; i < totalSamples; i += chunkSize) {
      if (signal?.aborted) throw new Error('Synthesis aborted')

      const count = Math.min(chunkSize, totalSamples - i)
      const buffer = Buffer.alloc(count * 2)

      for (let s = 0; s < count; s++) {
        const t = (i + s) / sampleRate
        // Harmonic sum mimicking vocal formants
        const f0 = 135
        const wave =
          0.4 * Math.sin(2 * Math.PI * f0 * t) +
          0.2 * Math.sin(2 * Math.PI * f0 * 2 * t) +
          0.1 * Math.sin(2 * Math.PI * f0 * 3 * t)
        // Soft envelope taper at start and end
        const env = Math.min(1, Math.min(t / 0.05, (durationSeconds - t) / 0.05))
        const sampleVal = Math.round(wave * env * 0.5 * 32767)
        buffer.writeInt16LE(sampleVal, s * 2)
      }

      chunkCount++
      if (typeof onChunk === 'function') {
        onChunk({
          data: buffer.toString('base64'),
          mimeType: `audio/pcm;rate=${sampleRate}`,
          sampleRate,
          channels: 1,
          bitDepth: 16,
          byteOrder: 'little-endian',
          chunkIndex: chunkCount,
        })
      }
    }

    return {
      fullTranscript: text,
      totalChunks: chunkCount,
      durationMs: Date.now() - startTime,
    }
  }
}

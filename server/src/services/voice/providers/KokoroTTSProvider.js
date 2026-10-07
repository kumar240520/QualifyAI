import { TTSProvider } from './TTSProvider.js'
import { cleanTextForSpeech, segmentSpeech } from '../speechSegmenter.js'

/**
 * Local High-Fidelity Kokoro-82M TTS Provider (ONNX)
 * Generates natural 24kHz Grade-A voice audio locally as a reliable fallback.
 */
export class KokoroTTSProvider extends TTSProvider {
  constructor() {
    super('kokoro_local')
    this.ttsInstance = null
    this.isLoading = false
    this.modelId = 'onnx-community/Kokoro-82M-ONNX'
  }

  async initialize() {
    // Lazy-load when first needed to keep startup fast
    this.initialized = true
  }

  async _ensureModel() {
    if (this.ttsInstance) return this.ttsInstance
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise((r) => setTimeout(r, 100))
      }
      return this.ttsInstance
    }

    this.isLoading = true
    try {
      console.log('[KokoroTTSProvider] Loading Kokoro-82M ONNX model...')
      const { KokoroTTS } = await import('kokoro-js')
      this.ttsInstance = await KokoroTTS.from_pretrained(this.modelId, { dtype: 'q8' })
      console.log('[KokoroTTSProvider] Kokoro-82M model loaded successfully.')
      return this.ttsInstance
    } catch (err) {
      console.error('[KokoroTTSProvider] Failed to load Kokoro model:', err)
      throw err
    } finally {
      this.isLoading = false
    }
  }

  async isAvailable() {
    try {
      return Boolean(this.ttsInstance || true)
    } catch (_) {
      return false
    }
  }

  /**
   * Synthesize text to 24kHz PCM16 audio chunks
   * Segments long text into sentence units to maintain consistent style conditioning and prevent metallic decay
   */
  async synthesize({ text, voiceProfile, onChunk, signal }) {
    const cleanedText = cleanTextForSpeech(text)
    if (!cleanedText) {
      return { fullTranscript: '', totalChunks: 0, durationMs: 0 }
    }

    const segments = segmentSpeech(cleanedText)
    if (!segments || segments.length === 0) {
      return { fullTranscript: '', totalChunks: 0, durationMs: 0 }
    }

    const tts = await this._ensureModel()
    const voice = voiceProfile?.kokoroVoice || 'af_heart'
    const startTime = Date.now()

    if (signal?.aborted) {
      throw new Error('Synthesis aborted')
    }

    console.log(`[KokoroTTSProvider] Synthesizing ${segments.length} prosodic segment(s) with voice "${voice}": "${cleanedText.substring(0, 40)}..."`)

    const sampleRate = 24000
    // Natural 200ms human conversational breathing pause between sentences
    const pauseSamples = Math.round(sampleRate * 0.20)
    const pauseBuffer = new Float32Array(pauseSamples)
    const collectedSlices = []

    for (let sIdx = 0; sIdx < segments.length; sIdx++) {
      if (signal?.aborted) {
        throw new Error('Synthesis aborted')
      }
      const segText = segments[sIdx].trim()
      if (!segText) continue

      const result = await tts.generate(segText, { voice })
      const segAudio = result.audio
      if (segAudio && segAudio.length > 0) {
        // Micro-fade boundaries of each sentence (48 samples) to prevent inter-sentence clicks
        const fadeLen = Math.min(48, Math.floor(segAudio.length / 4))
        for (let k = 0; k < fadeLen; k++) {
          const factor = 0.5 * (1 - Math.cos((Math.PI * k) / fadeLen))
          segAudio[k] *= factor
          segAudio[segAudio.length - 1 - k] *= factor
        }
        collectedSlices.push(segAudio)

        // Insert conversational breathing pause between sentences (except after the final sentence)
        if (sIdx < segments.length - 1) {
          collectedSlices.push(pauseBuffer)
        }
      }
    }

    if (collectedSlices.length === 0) {
      return { fullTranscript: cleanedText, totalChunks: 0, durationMs: Date.now() - startTime }
    }

    // Concatenate all slices into a unified Float32Array
    const totalSamples = collectedSlices.reduce((acc, s) => acc + s.length, 0)
    const float32Data = new Float32Array(totalSamples)
    let offset = 0
    for (const slice of collectedSlices) {
      float32Data.set(slice, offset)
      offset += slice.length
    }

    // 1. Peak Normalization & Headroom Guard (-1.0 dBFS / ~0.92 peak target)
    // Prevents harsh digital clipping and flat-topping distortion during vowel formants
    let maxPeak = 0
    for (let k = 0; k < float32Data.length; k++) {
      const abs = Math.abs(float32Data[k])
      if (abs > maxPeak) maxPeak = abs
    }
    const targetPeak = 0.92
    const gain = maxPeak > targetPeak ? targetPeak / maxPeak : 1.0

    // 2. Micro-fade onset and offset of full stream (64 samples) to prevent DC step clicks
    const fadeLen = Math.min(64, Math.floor(float32Data.length / 4))
    if (fadeLen > 0) {
      for (let k = 0; k < fadeLen; k++) {
        const factor = 0.5 * (1 - Math.cos((Math.PI * k) / fadeLen))
        float32Data[k] *= factor
        float32Data[float32Data.length - 1 - k] *= factor
      }
    }

    const chunkSize = Math.max(1, Math.round(sampleRate / 10))
    let chunkCount = 0

    for (let i = 0; i < float32Data.length; i += chunkSize) {
      if (signal?.aborted) break

      const slice = float32Data.subarray(i, Math.min(i + chunkSize, float32Data.length))
      const pcmBytes = Buffer.allocUnsafe(slice.length * 2)

      for (let j = 0; j < slice.length; j++) {
        const s = Math.max(-1, Math.min(1, slice[j] * gain))
        pcmBytes.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7FFF, j * 2)
      }

      const base64Chunk = pcmBytes.toString('base64')
      chunkCount++

      if (typeof onChunk === 'function') {
        onChunk({
          data: base64Chunk,
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
      fullTranscript: cleanedText,
      totalChunks: chunkCount,
      durationMs: Date.now() - startTime,
    }
  }
}

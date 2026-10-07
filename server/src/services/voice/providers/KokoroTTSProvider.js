import { TTSProvider } from './TTSProvider.js'
import { cleanTextForSpeech } from '../speechSegmenter.js'

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
   */
  async synthesize({ text, voiceProfile, onChunk, signal }) {
    const cleanedText = cleanTextForSpeech(text)
    if (!cleanedText) {
      return { fullTranscript: '', totalChunks: 0, durationMs: 0 }
    }

    const tts = await this._ensureModel()
    const voice = voiceProfile?.kokoroVoice || 'af_heart'
    const startTime = Date.now()

    if (signal?.aborted) {
      throw new Error('Synthesis aborted')
    }

    console.log(`[KokoroTTSProvider] Synthesizing speech with voice "${voice}": "${cleanedText.substring(0, 40)}..."`)
    const result = await tts.generate(cleanedText, { voice })

    if (signal?.aborted) {
      throw new Error('Synthesis aborted')
    }

    const float32Data = result.audio
    const sampleRate = result.sampling_rate || 24000

    if (!float32Data || float32Data.length === 0) {
      return { fullTranscript: cleanedText, totalChunks: 0, durationMs: Date.now() - startTime }
    }

    // Chunk size: ~2400 samples (100ms per chunk at 24kHz)
    const chunkSize = 2400
    let chunkCount = 0

    for (let i = 0; i < float32Data.length; i += chunkSize) {
      if (signal?.aborted) break

      const slice = float32Data.subarray(i, Math.min(i + chunkSize, float32Data.length))
      const int16Array = new Int16Array(slice.length)

      for (let j = 0; j < slice.length; j++) {
        const s = Math.max(-1, Math.min(1, slice[j]))
        int16Array[j] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }

      const base64Chunk = Buffer.from(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength).toString('base64')
      chunkCount++

      if (typeof onChunk === 'function') {
        onChunk({
          data: base64Chunk,
          mimeType: `audio/pcm;rate=${sampleRate}`,
          sampleRate,
          channels: 1,
          bitDepth: 16,
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

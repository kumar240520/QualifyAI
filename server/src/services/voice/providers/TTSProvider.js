/**
 * Base TTS Provider Interface
 * All TTS implementations (GeminiLive, Kokoro, REST fallback) implement this contract.
 */
export class TTSProvider {
  constructor(name) {
    if (!name) throw new Error('TTSProvider must have a name')
    this.name = name
    this.initialized = false
  }

  /**
   * Initialize provider resources (models, connections, credentials)
   */
  async initialize() {
    this.initialized = true
  }

  /**
   * Check if provider is healthy and available for synthesis
   */
  async isAvailable() {
    return this.initialized
  }

  /**
   * Synthesize text to speech
   * @param {object} params
   * @param {string} params.text - Cleaned text to synthesize
   * @param {object} params.voiceProfile - Voice profile configuration
   * @param {function} params.onChunk - Callback invoked for each audio chunk with its encoded bytes and actual format metadata.
   * @param {AbortSignal} [params.signal] - Optional cancellation signal
   * @returns {Promise<{ fullTranscript: string, totalChunks: number, durationMs: number }>}
   */
  async synthesize({ text, voiceProfile, onChunk, signal }) {
    throw new Error(`TTSProvider '${this.name}' must implement synthesize()`)
  }

}

import { GeminiLiveTTSProvider } from './GeminiLiveTTSProvider.js'
import { KokoroTTSProvider } from './KokoroTTSProvider.js'
import { DEFAULT_VOICE_PROFILE, getVoiceProfile } from '../voiceProfile.js'

/**
 * Enterprise TTS Manager
 * Orchestrates multi-tier voice synthesis with automatic failover:
 * Tier 1: Google Gemini Live Native Audio (24kHz, ~3s latency, warm human recruiter)
 * Tier 2: Kokoro-82M ONNX Local Audio (24kHz, Grade-A offline fallback)
 */
export class TTSManager {
  constructor() {
    this.providers = new Map()
    this.fallbackChain = ['gemini_live', 'kokoro_local']
    this._initialized = false
  }

  async initialize() {
    if (this._initialized) return

    const gemini = new GeminiLiveTTSProvider()
    await gemini.initialize()
    this.registerProvider(gemini)

    const kokoro = new KokoroTTSProvider()
    await kokoro.initialize()
    this.registerProvider(kokoro)

    this._initialized = true
    console.log('[TTSManager] Initialized with providers:', Array.from(this.providers.keys()))
  }

  registerProvider(provider) {
    this.providers.set(provider.name, provider)
  }

  getProvider(name) {
    return this.providers.get(name)
  }

  /**
   * Synthesize text with automatic failover across providers
   * 
   * @param {object} params
   * @param {string} params.text - Spoken text
   * @param {object} [params.voiceProfile] - Voice profile (defaults to Sarah)
   * @param {function} params.onChunk - Audio chunk consumer
   * @param {string} [params.preferredProvider] - Optional preferred provider
   * @param {number} [params.timeoutMs=12000] - Timeout per attempt
   */
  async synthesize({
    text,
    voiceProfile = DEFAULT_VOICE_PROFILE,
    onChunk,
    preferredProvider = null,
    timeoutMs = 12000,
  }) {
    if (!this._initialized) {
      await this.initialize()
    }

    const profile = typeof voiceProfile === 'string' ? getVoiceProfile(voiceProfile) : voiceProfile || DEFAULT_VOICE_PROFILE

    const chain = preferredProvider
      ? [preferredProvider, ...this.fallbackChain.filter((p) => p !== preferredProvider)]
      : this.fallbackChain

    let lastError = null

    for (const providerName of chain) {
      const provider = this.getProvider(providerName)
      if (!provider) continue

      try {
        const isAvailable = await provider.isAvailable()
        if (!isAvailable) {
          console.warn(`[TTSManager] Provider "${providerName}" is not available, skipping.`)
          continue
        }

        console.log(`[TTSManager] Attempting speech synthesis via "${providerName}"...`)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        try {
          const result = await provider.synthesize({
            text,
            voiceProfile: profile,
            onChunk,
            signal: controller.signal,
          })

          clearTimeout(timer)
          return {
            providerUsed: providerName,
            ...result,
          }
        } catch (synthErr) {
          clearTimeout(timer)
          throw synthErr
        }
      } catch (err) {
        lastError = err
        console.warn(`[TTSManager] Provider "${providerName}" failed:`, err.message || err)
        // Continue to next provider in fallback chain
      }
    }

    throw new Error(`All TTS providers failed. Last error: ${lastError?.message || 'Unknown error'}`)
  }
}

export const ttsManager = new TTSManager()

import { CosyVoiceProvider } from './CosyVoiceProvider.js'
import { GeminiLiveTTSProvider } from './GeminiLiveTTSProvider.js'
import { KokoroTTSProvider } from './KokoroTTSProvider.js'
import { DEFAULT_VOICE_PROFILE, getVoiceProfile } from '../voiceProfile.js'
import { ttsPhraseCache } from '../ttsPhraseCache.js'
import { normalizeTextForTTS } from '../ttsTextNormalizer.js'
import { config } from '../../../config/env.js'

/**
 * Enterprise Multi-Tier TTS Manager
 *
 * Orchestrates voice synthesis across tiered providers with automatic failover:
 * Tier 1: CosyVoice 3 (Alibaba Fun-CosyVoice 3 - 24kHz ultra-realistic conversational recruiter)
 * Tier 2: Google Gemini Live Native Audio (24kHz native audio model)
 * Tier 3: Kokoro-82M ONNX Local Synthesis (24kHz resilient offline fallback)
 *
 * Includes:
 * - Common phrase caching for zero-latency repetitive responses
 * - Pronunciation normalization via ttsTextNormalizer
 * - Observability metrics for latency and quality diagnostics
 */
export class TTSManager {
  constructor(options = {}) {
    this.providers = new Map()
    const primary = options.primaryProvider || config.tts?.provider || 'cosyvoice'
    const fallback = options.fallbackProvider || config.tts?.fallbackProvider || 'gemini_live'

    // Build fallback chain ensuring primary is first, followed by fallbacks
    const allProviders = [primary, fallback, 'kokoro_local', 'gemini_live', 'cosyvoice']
    this.fallbackChain = [...new Set(allProviders)]
    this._initialized = false
    this.metrics = {
      requests: 0,
      cacheHits: 0,
      providerSuccessCount: {},
      providerFailureCount: {},
      latencies: [],
    }
  }

  async initialize() {
    if (this._initialized) return

    // 1. CosyVoice 3 Provider
    const cosyvoice = new CosyVoiceProvider()
    await cosyvoice.initialize()
    this.registerProvider(cosyvoice)

    // Pre-warm phrase cache with canonical filler & closing phrases in background for 0ms retrieval
    ttsPhraseCache
      .prewarm({ provider: cosyvoice, voiceProfile: DEFAULT_VOICE_PROFILE })
      .catch((err) => {
        console.warn('[TTSManager] Prewarming phrase cache notice:', err.message)
      })

    // 2. Gemini Live TTS Provider
    const gemini = new GeminiLiveTTSProvider()
    await gemini.initialize()
    this.registerProvider(gemini)

    // 3. Kokoro-82M Local ONNX Provider
    const kokoro = new KokoroTTSProvider()
    await kokoro.initialize()
    this.registerProvider(kokoro)

    this._initialized = true
    console.log('[TTSManager] Initialized with providers:', Array.from(this.providers.keys()))
  }

  registerProvider(provider) {
    this.providers.set(provider.name, provider)
    if (!this.metrics.providerSuccessCount[provider.name]) {
      this.metrics.providerSuccessCount[provider.name] = 0
      this.metrics.providerFailureCount[provider.name] = 0
    }
  }

  getProvider(name) {
    return this.providers.get(name)
  }

  /**
   * Synthesize text with automatic failover across providers and phrase caching
   *
   * @param {object} params
   * @param {string} params.text - Input prompt/question
   * @param {object} [params.voiceProfile] - Voice profile (defaults to DEFAULT_VOICE_PROFILE)
   * @param {function} params.onChunk - Audio chunk consumer
   * @param {string} [params.preferredProvider] - Preferred provider override
   * @param {number} [params.timeoutMs=12000] - Timeout per provider attempt
   */
  async synthesize({
    text,
    voiceProfile = DEFAULT_VOICE_PROFILE,
    onChunk,
    onTextDelta = null,
    preferredProvider = null,
    timeoutMs = 60000,
  }) {
    if (!this._initialized) {
      await this.initialize()
    }

    const profile =
      typeof voiceProfile === 'string'
        ? getVoiceProfile(voiceProfile)
        : voiceProfile || DEFAULT_VOICE_PROFILE

    const normalizedText = normalizeTextForTTS(text)
    if (!normalizedText) {
      return { fullTranscript: '', totalChunks: 0, durationMs: 0, providerUsed: 'none' }
    }

    this.metrics.requests++
    const requestStartTime = Date.now()

    // 1. Check Phrase Cache for frequently used phrases
    const cached = ttsPhraseCache.get({ voiceProfile: profile, text: normalizedText })
    if (cached && cached.chunks.length > 0) {
      this.metrics.cacheHits++
      console.log(`[TTSManager] Phrase cache hit for: "${normalizedText.substring(0, 30)}..."`)

      // Deliver cached chunks to consumer
      for (const chunk of cached.chunks) {
        if (typeof onChunk === 'function') {
          onChunk({ ...chunk })
        }
      }
      if (typeof onTextDelta === 'function') {
        onTextDelta(cached.fullTranscript)
      }

      const latencyMs = Date.now() - requestStartTime
      this._recordLatency(latencyMs)
      return {
        providerUsed: 'phrase_cache',
        fullTranscript: cached.fullTranscript,
        totalChunks: cached.totalChunks,
        durationMs: cached.durationMs,
        latencyMs,
      }
    }

    // 2. Multi-tier Provider Synthesis
    const chain = preferredProvider
      ? [preferredProvider, ...this.fallbackChain.filter((p) => p !== preferredProvider)]
      : this.fallbackChain

    let lastError = null

    for (const providerName of chain) {
      const provider = this.getProvider(providerName)
      if (!provider) continue

      const collectedChunks = []
      try {
        const isAvailable = await provider.isAvailable()
        if (!isAvailable) {
          console.log(`[TTSManager] Provider "${providerName}" is not available, skipping to next fallback.`)
          continue
        }

        console.log(`[TTSManager] Synthesizing speech via provider "${providerName}"...`)
        const controller = new AbortController()
        const effectiveTimeoutMs = Math.max(timeoutMs || 60000, Math.ceil(normalizedText.length * 200))
        let timer = setTimeout(() => controller.abort(), effectiveTimeoutMs)

        const chunkInterceptor = (chunk) => {
          // Reset watchdog: as long as audio chunks are streaming, keep connection alive!
          clearTimeout(timer)
          timer = setTimeout(() => controller.abort(), 45000)

          collectedChunks.push(chunk)
          if (typeof onChunk === 'function') {
            onChunk(chunk)
          }
        }

        try {
          const result = await provider.synthesize({
            text: normalizedText,
            voiceProfile: profile,
            onChunk: chunkInterceptor,
            onTextDelta,
            signal: controller.signal,
          })

          clearTimeout(timer)
          const latencyMs = Date.now() - requestStartTime
          this._recordLatency(latencyMs)
          this.metrics.providerSuccessCount[providerName] =
            (this.metrics.providerSuccessCount[providerName] || 0) + 1

          // Cache concise phrases (< 160 chars) for instant replay
          if (normalizedText.length <= 160 && collectedChunks.length > 0) {
            ttsPhraseCache.set(
              { voiceProfile: profile, text: normalizedText },
              {
                chunks: collectedChunks,
                fullTranscript: result.fullTranscript || normalizedText,
                durationMs: result.durationMs,
              }
            )
          }

          return {
            providerUsed: providerName,
            latencyMs,
            ...result,
          }
        } catch (synthErr) {
          clearTimeout(timer)
          throw synthErr
        }
      } catch (err) {
        lastError = err
        this.metrics.providerFailureCount[providerName] =
          (this.metrics.providerFailureCount[providerName] || 0) + 1
        console.warn(`[TTSManager] Provider "${providerName}" failed:`, err.message || err)

        // If this provider already delivered audio chunks to the client,
        // NEVER failover to another provider that starts streaming from chunk 0,
        // because that causes chopped words and duplicated speech!
        if (collectedChunks.length > 0) {
          console.warn(`[TTSManager] Provider "${providerName}" delivered ${collectedChunks.length} chunks before closing. Returning partial stream safely.`)
          return {
            providerUsed: providerName,
            fullTranscript: normalizedText,
            totalChunks: collectedChunks.length,
            durationMs: Date.now() - requestStartTime,
            isPartial: true,
          }
        }
        // Continue to next tier in fallback chain
      }
    }

    throw new Error(`All TTS providers failed. Last error: ${lastError?.message || 'Unknown error'}`)
  }

  _recordLatency(latencyMs) {
    this.metrics.latencies.push(latencyMs)
    if (this.metrics.latencies.length > 50) {
      this.metrics.latencies.shift()
    }
  }

  getMetrics() {
    const latencies = this.metrics.latencies
    const avgLatency =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0

    return {
      totalRequests: this.metrics.requests,
      cacheHits: this.metrics.cacheHits,
      avgLatencyMs: avgLatency,
      cacheStats: ttsPhraseCache.getStats(),
      providerSuccesses: { ...this.metrics.providerSuccessCount },
      providerFailures: { ...this.metrics.providerFailureCount },
    }
  }
}

export const ttsManager = new TTSManager()

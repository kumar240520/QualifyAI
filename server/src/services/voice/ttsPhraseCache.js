import crypto from 'crypto'

/**
 * Enterprise In-Memory TTS Phrase Cache
 * Stores synthesized 24kHz PCM chunks for common conversational interview phrases.
 * Key structure: SHA256(voiceId + language + style + text + modelVersion)
 */
export class TTSPhraseCache {
  constructor({ maxEntries = 200 } = {}) {
    this.cache = new Map() // key -> { chunks: Array, totalChunks, durationMs, createdAt }
    this.maxEntries = maxEntries
    this.stats = {
      hits: 0,
      misses: 0,
      entries: 0,
    }
  }

  /**
   * Generates deterministic cache key for a given voice profile, text, and model.
   * Requirement #20: cacheKey = provider + model + voiceId + voiceProfileVersion + language + text
   */
  generateKey({ voiceProfile, text, modelVersion = 'cosyvoice-v3', provider = 'cosyvoice' }) {
    const prov = provider || voiceProfile?.provider || 'cosyvoice'
    const model = modelVersion || voiceProfile?.cosyvoiceModel || 'cosyvoice-v3'
    const voiceId = voiceProfile?.voiceId || voiceProfile?.id || 'qualifyai_interviewer_01'
    const version = voiceProfile?.version || 'v1'
    const language = voiceProfile?.language || 'en-IN'
    const cleanText = (text || '').trim().toLowerCase()

    const raw = `${prov}::${model}::${voiceId}::${version}::${language}::${cleanText}`
    return crypto.createHash('sha256').update(raw).digest('hex')
  }

  /**
   * Check if a phrase is cached
   */
  has(params) {
    const key = this.generateKey(params)
    return this.cache.has(key)
  }

  /**
   * Get cached audio chunks
   */
  get(params) {
    const key = this.generateKey(params)
    const entry = this.cache.get(key)
    if (entry) {
      this.stats.hits++
      // LRU refresh
      this.cache.delete(key)
      this.cache.set(key, entry)
      return {
        cached: true,
        chunks: entry.chunks.map((c) => ({ ...c })), // Shallow copy
        fullTranscript: entry.fullTranscript,
        totalChunks: entry.totalChunks,
        durationMs: entry.durationMs,
      }
    }
    this.stats.misses++
    return null
  }

  /**
   * Set cached audio chunks for a phrase
   */
  set(params, { chunks, fullTranscript, durationMs }) {
    if (!chunks || !chunks.length) return
    const key = this.generateKey(params)

    if (this.cache.size >= this.maxEntries) {
      // Evict oldest (first key in map)
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      chunks: chunks.map((c) => ({ ...c })),
      fullTranscript,
      totalChunks: chunks.length,
      durationMs: durationMs || 0,
      createdAt: Date.now(),
    })
    this.stats.entries = this.cache.size
  }

  /**
   * Clear cache (e.g. when voice configuration changes)
   */
  clear() {
    this.cache.clear()
    this.stats.entries = 0
  }

  getStats() {
    return {
      ...this.stats,
      entries: this.cache.size,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1) + '%'
        : '0.0%',
    }
  }

  /**
   * Pre-synthesizes and caches canonical interview phrases so that fillers and closings return in < 1ms
   */
  async prewarm({ provider, voiceProfile }) {
    if (!provider || typeof provider.synthesize !== 'function') return
    const profile = voiceProfile || { voiceId: 'qualifyai_interviewer_01', language: 'en-IN', provider: 'cosyvoice', version: 'v1' }

    for (const phrase of CANONICAL_INTERVIEW_PHRASES) {
      if (!this.has({ voiceProfile: profile, text: phrase })) {
        const collectedChunks = []
        try {
          const result = await provider.synthesize({
            text: phrase,
            voiceProfile: profile,
            onChunk: (chunk) => collectedChunks.push(chunk),
          })
          if (collectedChunks.length > 0) {
            const entryData = {
              chunks: collectedChunks,
              fullTranscript: result.fullTranscript || phrase,
              durationMs: result.durationMs,
            }
            this.set({ voiceProfile: profile, text: phrase }, entryData)
            try {
              const { normalizeTextForTTS } = await import('./ttsTextNormalizer.js')
              const normalized = normalizeTextForTTS(phrase)
              if (normalized && normalized !== phrase) {
                this.set({ voiceProfile: profile, text: normalized }, entryData)
              }
            } catch (_) {}
          }
        } catch (err) {
          console.warn(`[TTSPhraseCache] Prewarming skipped for phrase "${phrase.slice(0, 20)}...":`, err.message)
        }
      }
    }
  }
}

export const CANONICAL_INTERVIEW_PHRASES = [
  // Filler 1 phrases (after 15s silence)
  "Whenever you're ready, you can answer. I'm still here.",
  "Whenever you are ready, you can answer. I am still here.",
  "I am here, you can just answer it. You can answer it in your own way.",
  "I'm here, you can just answer it. You can answer it in your own way.",
  "Take your time, I am here. You can just answer it in your own way.",
  "Take your time, I'm here. You can just answer it in your own way.",
  // Filler 2 phrases (after another 15s silence)
  "Take your time. You can answer whenever you're ready.",
  "Take your time. You can answer whenever you are ready.",
  "Whenever you're ready, feel free to answer, or we can move forward.",
  "Whenever you are ready, feel free to answer, or we can move forward.",
  "I am still here. Feel free to answer in your own words, or we can move to the next question.",
  "I'm still here. Feel free to answer in your own words, or we can move to the next question.",
  // Closing phrases (after 3 consecutive unanswered questions)
  "We have not received a response across three consecutive questions. This interview session has now concluded. Thank you for your time.",
  "We have not received a response after three questions, so we will conclude here. Thank you for your time.",
]

export const ttsPhraseCache = new TTSPhraseCache()

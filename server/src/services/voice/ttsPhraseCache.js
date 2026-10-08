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
   * Generates deterministic cache key for a given voice profile, text, and model
   */
  generateKey({ voiceProfile, text, modelVersion = 'cosyvoice-v3' }) {
    const voiceId = voiceProfile?.voiceId || voiceProfile?.id || 'qualifyai_interviewer_01'
    const language = voiceProfile?.language || 'en-IN'
    const style = voiceProfile?.style || 'professional_conversational'
    const cleanText = (text || '').trim().toLowerCase()

    const raw = `${voiceId}::${language}::${style}::${cleanText}::${modelVersion}`
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
}

export const ttsPhraseCache = new TTSPhraseCache()

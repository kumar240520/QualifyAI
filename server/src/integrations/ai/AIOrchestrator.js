import { GeminiProvider } from './GeminiProvider.js'

/**
 * Enterprise AI Orchestration Layer for QualifyAI
 * 
 * Enforces rate limiting, caching, latency monitoring, schema validation,
 * and decoupling of business logic from specific AI vendors.
 */
export class AIOrchestrator {
  constructor(defaultProvider = null) {
    this.provider = defaultProvider || new GeminiProvider()
    this.cache = new Map() // In-memory LRU-like cache for deterministic prompts
    this.maxCacheSize = 200
    this.activeRequests = 0
    this.maxConcurrency = 8
  }

  setProvider(provider) {
    this.provider = provider
  }

  isReady() {
    return this.provider && this.provider.isConfigured()
  }

  getStatus() {
    return {
      ready: this.isReady(),
      provider: this.provider.name,
      activeRequests: this.activeRequests,
      cacheEntries: this.cache.size,
    }
  }

  /**
   * Concurrency-controlled execution wrapper
   */
  async _executeWithThrottle(fn) {
    while (this.activeRequests >= this.maxConcurrency) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    this.activeRequests += 1
    const startTime = Date.now()

    try {
      const result = await fn()
      const latencyMs = Date.now() - startTime
      return { ...result, latencyMs }
    } finally {
      this.activeRequests = Math.max(0, this.activeRequests - 1)
    }
  }

  /**
   * Generate text via orchestrator
   */
  async generateText(params) {
    if (!this.isReady()) {
      throw new Error(`AI Provider [${this.provider.name}] is not configured.`)
    }

    return this._executeWithThrottle(() => this.provider.generateText(params))
  }

  /**
   * Generate validated structured JSON
   */
  async generateStructured(params) {
    if (!this.isReady()) {
      throw new Error(`AI Provider [${this.provider.name}] is not configured.`)
    }

    // Check deterministic cache if enabled
    const cacheKey = params.cacheKey || (params.prompt && params.schema ? `${params.prompt}_${JSON.stringify(params.schema)}` : null)
    if (cacheKey && this.cache.has(cacheKey)) {
      return {
        data: this.cache.get(cacheKey),
        fromCache: true,
        provider: this.provider.name,
      }
    }

    const result = await this._executeWithThrottle(() => this.provider.generateStructured(params))

    // Store in cache
    if (cacheKey && result?.data) {
      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value
        this.cache.delete(firstKey)
      }
      this.cache.set(cacheKey, result.data)
    }

    return result
  }

  /**
   * Analyze candidate answer
   */
  async analyzeAnswer(params) {
    return this._executeWithThrottle(() => this.provider.analyzeAnswer(params))
  }

  /**
   * Generate adaptive interview question
   */
  async generateQuestion(params) {
    return this._executeWithThrottle(() => this.provider.generateQuestion(params))
  }
}

// Global Singleton Export
export const aiOrchestrator = new AIOrchestrator()

import { apiFetch } from './apiClient.js'

/**
 * Client service for AI Model Benchmarking & Evaluation (Phase 14)
 */
export const benchmarkService = {
  /**
   * List benchmark runs for active tenant
   */
  async listBenchmarks(params = {}) {
    const query = new URLSearchParams()
    if (params.limit) query.set('limit', params.limit)
    if (params.offset) query.set('offset', params.offset)
    const qs = query.toString() ? `?${query.toString()}` : ''

    const res = await apiFetch(`/api/model-benchmarks${qs}`)
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to fetch benchmark runs.')
    }
    return json.data
  },

  /**
   * Trigger a new model benchmark evaluation run
   */
  async runBenchmark(payload) {
    const res = await apiFetch('/api/model-benchmarks/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to run model benchmark.')
    }
    return json.data
  },

  /**
   * Get detailed benchmark metrics and sample comparisons
   */
  async getBenchmark(id) {
    const res = await apiFetch(`/api/model-benchmarks/${id}`)
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to fetch benchmark report.')
    }
    return json.data
  },

  /**
   * Delete benchmark run
   */
  async deleteBenchmark(id) {
    const res = await apiFetch(`/api/model-benchmarks/${id}`, {
      method: 'DELETE',
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to delete benchmark run.')
    }
    return json.data
  },
}

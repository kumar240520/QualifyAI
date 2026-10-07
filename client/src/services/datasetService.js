import { apiFetch } from './apiClient.js'

/**
 * Client service for AI Training Dataset Management (Phase 13)
 */
export const datasetService = {
  /**
   * List datasets for active tenant
   */
  async listDatasets(params = {}) {
    const query = new URLSearchParams()
    if (params.limit) query.set('limit', params.limit)
    if (params.offset) query.set('offset', params.offset)
    const qs = query.toString() ? `?${query.toString()}` : ''

    const res = await apiFetch(`/api/datasets${qs}`)
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to fetch datasets.')
    }
    return json.data
  },

  /**
   * Generate/Extract a new AI training dataset
   */
  async generateDataset(payload) {
    const res = await apiFetch('/api/datasets/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to synthesize dataset.')
    }
    return json.data
  },

  /**
   * Get dataset details
   */
  async getDataset(id) {
    const res = await apiFetch(`/api/datasets/${id}`)
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to fetch dataset details.')
    }
    return json.data
  },

  /**
   * Get paginated samples for a dataset
   */
  async getDatasetSamples(id, params = {}) {
    const query = new URLSearchParams()
    if (params.limit) query.set('limit', params.limit)
    if (params.offset) query.set('offset', params.offset)
    const qs = query.toString() ? `?${query.toString()}` : ''

    const res = await apiFetch(`/api/datasets/${id}/samples${qs}`)
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to fetch dataset samples.')
    }
    return json.data
  },

  /**
   * Download formatted dataset file
   */
  async downloadDataset(id, fallbackFilename = 'qualifyai_dataset.jsonl') {
    const res = await apiFetch(`/api/datasets/${id}/download`)
    if (!res.ok) {
      throw new Error('Failed to download dataset file.')
    }

    const disposition = res.headers.get('content-disposition')
    let filename = fallbackFilename
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/)
      if (match && match[1]) filename = match[1]
    }

    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  },

  /**
   * Delete dataset
   */
  async deleteDataset(id) {
    const res = await apiFetch(`/api/datasets/${id}`, {
      method: 'DELETE',
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Failed to delete dataset.')
    }
    return json.data
  },
}

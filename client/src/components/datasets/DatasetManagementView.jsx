import React, { useState, useEffect } from 'react'
import {
  Database,
  Download,
  Plus,
  Trash2,
  Eye,
  ShieldCheck,
  Sparkles,
  Layers,
  X,
  FileCode,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { datasetService } from '../../services/datasetService.js'

export default function DatasetManagementView() {
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Generate Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    datasetType: 'HYBRID',
    format: 'GEMINI_JSONL',
    minScore: 70,
  })

  // Sample Preview Drawer state
  const [previewDataset, setPreviewDataset] = useState(null)
  const [samples, setSamples] = useState([])
  const [samplesLoading, setSamplesLoading] = useState(false)

  useEffect(() => {
    loadDatasets()
  }, [])

  const loadDatasets = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await datasetService.listDatasets()
      setDatasets(data.datasets || [])
    } catch (err) {
      setError(err.message || 'Failed to load datasets.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    try {
      setGenerateLoading(true)
      setError(null)
      await datasetService.generateDataset({
        name: formData.name.trim() || undefined,
        description: formData.description.trim() || undefined,
        datasetType: formData.datasetType,
        format: formData.format,
        filterConfig: {
          minScore: Number(formData.minScore),
        },
      })
      setShowGenerateModal(false)
      setSuccessMsg('Training dataset successfully synthesized and anonymized!')
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadDatasets()
    } catch (err) {
      setError(err.message || 'Dataset generation failed.')
    } finally {
      setGenerateLoading(false)
    }
  }

  const handleDownload = async (dataset) => {
    try {
      const ext = dataset.format === 'ALPACA_JSON' ? 'json' : 'jsonl'
      await datasetService.downloadDataset(dataset.id, `${dataset.name}.${ext}`)
    } catch (err) {
      setError(err.message || 'Failed to download dataset file.')
    }
  }

  const handleDelete = async (datasetId) => {
    if (!window.confirm('Are you sure you want to delete this dataset? This action cannot be undone.')) return
    try {
      await datasetService.deleteDataset(datasetId)
      setDatasets((prev) => prev.filter((d) => d.id !== datasetId))
      if (previewDataset?.id === datasetId) {
        setPreviewDataset(null)
        setSamples([])
      }
    } catch (err) {
      setError(err.message || 'Failed to delete dataset.')
    }
  }

  const handlePreviewSamples = async (dataset) => {
    try {
      setPreviewDataset(dataset)
      setSamplesLoading(true)
      const data = await datasetService.getDatasetSamples(dataset.id, { limit: 20 })
      setSamples(data.samples || [])
    } catch (err) {
      setError(err.message || 'Failed to fetch samples.')
    } finally {
      setSamplesLoading(false)
    }
  }

  // Aggregate stats
  const totalSamples = datasets.reduce((acc, d) => acc + (d.sample_count || 0), 0)

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              Phase 13 Architecture
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% PII Scrubbed
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            AI Training & Fine-Tuning Datasets
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Extract, anonymize, and format conversation turns into high-fidelity fine-tuning datasets for specialized QualifyAI models.
          </p>
        </div>

        <button
          onClick={() => setShowGenerateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition shadow-sm hover:shadow"
        >
          <Plus className="w-4 h-4" />
          Generate Dataset
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Datasets
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{datasets.length}</div>
          <div className="mt-1 text-xs text-slate-500">Active tenant repositories</div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Instruction Samples
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-slate-900">{totalSamples}</div>
          <div className="mt-1 text-xs text-slate-500">Supervised prompt-response pairs</div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Privacy Compliance
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600">100% Scrubbed</div>
          <div className="mt-1 text-xs text-slate-500">Algorithmic PII neutralization</div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Target Formats
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-lg font-bold text-slate-900">Gemini & OpenAI</div>
          <div className="mt-1 text-xs text-slate-500">Plus Alpaca & ChatML JSONL</div>
        </div>
      </div>

      {/* Datasets Table */}
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Training Repositories</h2>
            <p className="text-xs text-slate-500">Supervised fine-tuning files generated from assessment data</p>
          </div>
          <span className="text-xs text-slate-500">{datasets.length} datasets found</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-sm">Loading dataset repositories...</span>
          </div>
        ) : datasets.length === 0 ? (
          <div className="p-12 text-center">
            <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">No training datasets yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Generate your first dataset from candidate interview transcripts and evaluation scoring benchmarks.
            </p>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Generate Dataset
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-6">Dataset Name</th>
                  <th className="py-3 px-6">Domain Type</th>
                  <th className="py-3 px-6">Format</th>
                  <th className="py-3 px-6 text-center">Samples</th>
                  <th className="py-3 px-6">Created At</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {datasets.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-semibold text-slate-900">{d.name}</div>
                          {d.description && <div className="text-xs text-slate-500 font-normal">{d.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {d.dataset_type}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                        {d.format}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="font-semibold text-slate-800">{d.sample_count}</span>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500">
                      {new Date(d.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handlePreviewSamples(d)}
                          title="Preview Samples"
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(d)}
                          title="Download Dataset"
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(d.id)}
                          title="Delete Dataset"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate Dataset Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-lg">Generate AI Training Dataset</h3>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Dataset Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. qualifyai_staff_interview_v1"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Distributed systems and cryptographic engineering rubric pairs"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Domain Type
                  </label>
                  <select
                    value={formData.datasetType}
                    onChange={(e) => setFormData({ ...formData, datasetType: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="HYBRID">Hybrid (Dialogue + Scoring)</option>
                    <option value="INTERVIEWER_POLICY">Interviewer Policy (Follow-ups)</option>
                    <option value="EVALUATOR_SCORING">Evaluator Scoring (Benchmarks)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Export Format
                  </label>
                  <select
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="GEMINI_JSONL">Google Gemini JSONL</option>
                    <option value="OPENAI_JSONL">OpenAI JSONL</option>
                    <option value="ALPACA_JSON">Stanford Alpaca JSON</option>
                    <option value="CHATML_JSONL">ChatML JSONL</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    Minimum Evaluation Score Filter
                  </label>
                  <span className="text-xs font-bold text-indigo-600">{formData.minScore}/100</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.minScore}
                  onChange={(e) => setFormData({ ...formData, minScore: Number(e.target.value) })}
                  className="w-full accent-indigo-600"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Only interviews with overall score ≥ {formData.minScore} are extracted to preserve gold-standard quality.
                </p>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  All candidate names, emails, credentials, and company identifiers will be automatically sanitized with PII redactions.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {generateLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Synthesize Dataset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sample Preview Drawer */}
      {previewDataset && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="bg-white max-w-2xl w-full h-full p-6 shadow-2xl flex flex-col space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
                    {previewDataset.format}
                  </span>
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> PII Scrubbed
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-lg mt-1">{previewDataset.name}</h3>
              </div>
              <button
                onClick={() => setPreviewDataset(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Showing preview of instruction-tuning prompt/response pairs ({samples.length} loaded):
            </div>

            {samplesLoading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs">Loading training samples...</span>
              </div>
            ) : samples.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No samples found in this dataset.
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                {samples.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                        Sample #{idx + 1} • {s.task_type}
                      </span>
                      <span className="text-slate-400">Score: {s.quality_score}/100</span>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-500 uppercase text-[10px] mb-1">
                        Input Prompt
                      </div>
                      <pre className="p-3 bg-white rounded-lg border border-slate-200/60 font-mono text-[11px] text-slate-800 whitespace-pre-wrap overflow-x-auto">
                        {s.input_prompt}
                      </pre>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-500 uppercase text-[10px] mb-1">
                        Target Output
                      </div>
                      <pre className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 font-mono text-[11px] text-indigo-900 whitespace-pre-wrap overflow-x-auto">
                        {s.target_output}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

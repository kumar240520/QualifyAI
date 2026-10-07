import { useEffect, useRef, useState } from 'react'
import { AIInterviewAudioPlayer } from '../services/AIInterviewAudioPlayer.js'

function inspectWavHeader(arrayBuffer) {
  const view = new DataView(arrayBuffer)
  const readId = (offset) => String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3))
  if (arrayBuffer.byteLength < 12 || readId(0) !== 'RIFF' || readId(8) !== 'WAVE') throw new Error('Selected file is not a RIFF/WAVE audio file.')
  let format = null
  let dataBytes = null
  for (let offset = 12; offset + 8 <= arrayBuffer.byteLength;) {
    const id = readId(offset)
    const size = view.getUint32(offset + 4, true)
    const contentOffset = offset + 8
    if (contentOffset + size > arrayBuffer.byteLength) throw new Error(`WAV ${id} chunk extends beyond the file.`)
    if (id === 'fmt ' && size >= 16) {
      format = {
        encodingCode: view.getUint16(contentOffset, true),
        channels: view.getUint16(contentOffset + 2, true),
        sampleRate: view.getUint32(contentOffset + 4, true),
        bitDepth: view.getUint16(contentOffset + 14, true),
      }
    }
    if (id === 'data') dataBytes = size
    offset = contentOffset + size + (size % 2)
  }
  if (!format || dataBytes == null) throw new Error('WAV file is missing a format or data chunk.')
  return { ...format, dataBytes }
}

export default function AudioDiagnosticsPage() {
  const playerRef = useRef(null)
  const diagnosticsRef = useRef(null)
  const [diagnostics, setDiagnostics] = useState(null)
  const [status, setStatus] = useState('Choose the saved Gemini WAV or a known-good speech WAV.')
  const [error, setError] = useState('')

  useEffect(() => {
    const player = new AIInterviewAudioPlayer({
      onPlaybackStart: () => setStatus('Playing through AIInterviewAudioPlayer…'),
      onPlaybackComplete: (report) => {
        setStatus('Playback finished. Listen for crackling, distortion, gaps, or repeated audio.')
        const result = { ...diagnosticsRef.current, playerStats: report.stats, audioContextSampleRate: playerRef.current?.audioContext?.sampleRate }
        diagnosticsRef.current = result
        setDiagnostics(result)
      },
      onError: (playbackError) => setError(playbackError.message),
    })
    playerRef.current = player
    return () => { player.destroy().catch(() => {}) }
  }, [])

  async function playWav(file) {
    if (!file) return
    setError('')
    setDiagnostics(null)
    setStatus(`Decoding ${file.name}…`)
    try {
      const player = playerRef.current
      const context = await player.initialize()
      const bytes = await file.arrayBuffer()
      const sourceFormat = inspectWavHeader(bytes)
      const audioBuffer = await context.decodeAudioData(bytes.slice(0))
      const turnId = `diagnostic-wav-${Date.now()}`
      player.enqueueAudioBuffer(audioBuffer, turnId)
      await player.completeAudioBufferStream()
      const inputDiagnostics = {
        source: file.name,
        sourceFormat,
        channels: audioBuffer.numberOfChannels,
        decodedBufferSampleRate: audioBuffer.sampleRate,
        bitDepth: 'decoded float32 AudioBuffer',
        frames: audioBuffer.length,
        durationSeconds: audioBuffer.duration,
        audioContextSampleRate: context.sampleRate,
      }
      diagnosticsRef.current = inputDiagnostics
      setDiagnostics(inputDiagnostics)
    } catch (playbackError) {
      setError(playbackError.message || String(playbackError))
      setStatus('Playback failed.')
    }
  }

  async function playSavedGemini() {
    try {
      const response = await fetch('/audio-diagnostics/gemini-native-test.wav')
      if (!response.ok) throw new Error('Run the Gemini capture script first; the saved sample is not available.')
      const sample = await response.blob()
      await playWav(new File([sample], 'gemini-native-test.wav', { type: 'audio/wav' }))
    } catch (playbackError) {
      setError(playbackError.message || String(playbackError))
      setStatus('Could not load the saved Gemini audio sample.')
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '48px auto', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#172033' }}>
      <h1>TEST AI VOICE</h1>
      <p>Static audio playback isolation. This page uses one AIInterviewAudioPlayer and one persistent AudioContext. It does not start interview logic or connect to scoring.</p>
      <label style={{ display: 'block', margin: '24px 0 12px', fontWeight: 600 }} htmlFor="wav-input">Play a known-good speech WAV or captured Gemini WAV</label>
      <input id="wav-input" type="file" accept="audio/wav,.wav" onChange={(event) => playWav(event.target.files?.[0])} />
      <button type="button" onClick={playSavedGemini} style={{ display: 'block', marginTop: 12, padding: '8px 14px' }}>Play saved Gemini sample through this player</button>
      <p><a href="/audio-diagnostics/gemini-native-test.wav">Saved native Gemini sample</a> (available after running the capture script).</p>
      <p aria-live="polite">{status}</p>
      {error && <pre style={{ color: '#b42318', whiteSpace: 'pre-wrap' }}>{error}</pre>}
      {diagnostics && <pre style={{ padding: 16, background: '#f3f5f9', borderRadius: 8, whiteSpace: 'pre-wrap' }}>{JSON.stringify(diagnostics, null, 2)}</pre>}
      <hr />
      <h2>Gemini native isolation</h2>
      <p>Capture the exact production model and voice with <code>npm run capture:voice</code> from <code>server</code>; set <code>VOICE_CAPTURE_SECONDS=30</code> or <code>60</code> for the longer samples. Load a saved WAV here and compare it with a known-good speech WAV through the same player and browser output.</p>
      <p>Human listening is required to score clarity, prosody, naturalness, and stability. The diagnostics below describe the decoded buffer; they cannot confirm perceived audio quality.</p>
      <h2>Human voice quality score</h2>
      <p>Listen on normal headphones to a short, 30-second, 60-second, and contextual interview sample. Rate each item from 1 to 10; scores are saved in this browser only.</p>
      <VoiceQualityScore />
    </main>
  )
}

const VOICE_SCORE_ITEMS = [
  ['cleanliness', 'Audio cleanliness'],
  ['clarity', 'Speech clarity'],
  ['prosody', 'Prosody'],
  ['naturalness', 'Naturalness'],
  ['latency', 'Latency'],
  ['stability', 'Stability'],
  ['conversation', 'Conversational quality'],
]

function VoiceQualityScore() {
  const [scores, setScores] = useState(() => {
    try { return JSON.parse(localStorage.getItem('qualifyai:voice-quality-score') || '{}') } catch (_) { return {} }
  })
  const [saved, setSaved] = useState(false)
  const meetsThresholds = Number(scores.cleanliness) >= 9 && Number(scores.clarity) >= 9 && Number(scores.naturalness) >= 8 && Number(scores.stability) >= 9

  function saveScores(event) {
    event.preventDefault()
    localStorage.setItem('qualifyai:voice-quality-score', JSON.stringify({ ...scores, savedAt: new Date().toISOString() }))
    setSaved(true)
  }

  return (
    <form onSubmit={saveScores} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', padding: 16, border: '1px solid #dce2ec', borderRadius: 8 }}>
      {VOICE_SCORE_ITEMS.map(([key, label]) => (
        <label key={key} style={{ display: 'grid', gap: 4 }}>
          {label}
          <select value={scores[key] || ''} onChange={(event) => { setScores((prior) => ({ ...prior, [key]: Number(event.target.value) || '' })); setSaved(false) }} required>
            <option value="">Rate 1–10</option>
            {Array.from({ length: 10 }, (_, index) => <option value={index + 1} key={index}>{index + 1}</option>)}
          </select>
        </label>
      ))}
      <button type="submit" style={{ gridColumn: '1 / -1', width: 'fit-content', padding: '8px 14px' }}>Save voice score</button>
      <p style={{ gridColumn: '1 / -1', margin: 0 }} aria-live="polite">{saved ? (meetsThresholds ? 'Score meets the minimum targets. Human confirmation of zero audible artifacts is still required.' : 'Score saved, but one or more minimum targets are not met.') : 'Targets: cleanliness ≥9, clarity ≥9, naturalness ≥8, stability ≥9.'}</p>
    </form>
  )
}

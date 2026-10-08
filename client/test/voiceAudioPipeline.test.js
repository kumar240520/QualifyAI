import test from 'node:test'
import assert from 'node:assert/strict'
import { AIInterviewAudioPlayer } from '../src/services/AIInterviewAudioPlayer.js'

class FakeAudioContext {
  constructor() {
    this.state = 'running'
    this.sampleRate = 48000
    this.currentTime = 0
    this.destination = {}
    this.sources = []
    this.buffers = []
  }

  async resume() { this.state = 'running' }
  async suspend() { this.state = 'suspended' }
  async close() { this.state = 'closed' }

  createBuffer(channels, length, sampleRate) {
    const buffer = {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      channelData: Array.from({ length: channels }, () => new Float32Array(length)),
      copyToChannel(data, index) { this.channelData[index].set(data) },
    }
    this.buffers.push(buffer)
    return buffer
  }

  createBufferSource() {
    const source = {
      connect() {},
      disconnect() {},
      start(time) { this.startTime = time },
      stop() {},
    }
    this.sources.push(source)
    return source
  }
}

function makePlayer(options = {}) {
  return new AIInterviewAudioPlayer({ AudioContextClass: FakeAudioContext, ...options })
}

function pcmBase64(samples) {
  const bytes = Buffer.alloc(samples.length * 2)
  samples.forEach((sample, index) => bytes.writeInt16LE(sample, index * 2))
  return bytes.toString('base64')
}

function chunk(data, audioSequence, overrides = {}) {
  return {
    data,
    audioSequence,
    audioTurnId: 'test-turn-1',
    mimeType: 'audio/pcm;rate=24000',
    sampleRate: 24000,
    channels: 1,
    bitDepth: 16,
    byteOrder: 'little-endian',
    ...overrides,
  }
}

test('decodes PCM16 little-endian and preserves the declared sample rate', async () => {
  const player = makePlayer()
  player.beginTurn('test-turn-1')
  await player.enqueue(chunk(pcmBase64([-32768, 0, 32767]), 1, { sampleRate: 8000, mimeType: 'audio/pcm;rate=8000' }))
  assert.deepEqual(Array.from(player.pendingChannels[0]), [-1, 0, 1])
  assert.equal(player.getState().stats.sampleRate, 8000)
  assert.equal(player.getState().stats.framesReceived, 3)
})

test('deinterleaves declared stereo PCM without mixing the channels', async () => {
  const player = makePlayer()
  player.beginTurn('test-turn-1')
  await player.enqueue(chunk(pcmBase64([32767, -32768, 0, 16384]), 1, { channels: 2 }))
  assert.deepEqual(Array.from(player.pendingChannels[0]), [1, 0])
  assert.equal(player.pendingChannels[1][0], -1)
  assert.ok(Math.abs(player.pendingChannels[1][1] - (16384 / 32767)) < 1e-7)
  assert.equal(player.getState().stats.channels, 2)
})

test('accumulates partial frames across chunks and emits blocks near 100ms', async () => {
  const player = makePlayer({ blockMs: 100 })
  player.beginTurn('test-turn-1')
  const bytes = Buffer.from(pcmBase64(new Array(2400).fill(1000)), 'base64')
  await player.enqueue(chunk(bytes.subarray(0, 959).toString('base64'), 1))
  await player.enqueue(chunk(bytes.subarray(959).toString('base64'), 2))
  assert.equal(player.getState().stats.framesReceived, 2400)
  assert.equal(player.getState().stats.decodedBytes, 4800)
  assert.equal(player.queue.length, 1)
  assert.equal(player.queue[0].length, 2400)
  assert.ok(Math.abs(player.getState().stats.calculatedDurationSeconds - 0.1) < 1e-9)
})

test('reports missing, duplicate, and out-of-order sequence numbers', async () => {
  const player = makePlayer()
  player.beginTurn('test-turn-1')
  const data = pcmBase64(new Array(10).fill(10))
  await player.enqueue(chunk(data, 1))
  await player.enqueue(chunk(data, 3))
  await player.enqueue(chunk(data, 3))
  await player.enqueue(chunk(data, 2))
  const stats = player.getState().stats
  assert.equal(stats.missingChunks, 1)
  assert.equal(stats.duplicateChunks, 1)
  assert.equal(stats.outOfOrderChunks, 1)
})

test('flushes the final short block and reports completion only after sources drain', async () => {
  const reports = []
  const player = makePlayer({ onPlaybackComplete: (report) => reports.push(report) })
  player.beginTurn('test-turn-1')
  await player.enqueue(chunk(pcmBase64(new Array(720).fill(200)), 1)) // 30ms
  await player.completeStream()
  assert.equal(player.audioContext.sources.length, 1)
  assert.equal(reports.length, 0)
  player.audioContext.sources[0].onended()
  assert.equal(reports.length, 1)
  assert.equal(reports[0].stats.chunksReceived, 1)
  assert.equal(player.getState().audioContextSampleRate, 48000)
})

test('a stream ending mid-sample is rejected with an explicit frame error', async () => {
  const errors = []
  const player = makePlayer({ onError: (error) => errors.push(error) })
  player.beginTurn('test-turn-1')
  const data = Buffer.from([0x01]).toString('base64')
  await player.enqueue(chunk(data, 1))
  await assert.rejects(player.completeStream(), /incomplete PCM sample frame/)
  assert.match(errors[0].message, /incomplete PCM sample frame/)
})

test('rejects unknown formats instead of guessing a sample rate or byte order', async () => {
  const player = makePlayer()
  player.beginTurn('test-turn-1')
  await player.enqueue(chunk(pcmBase64([1]), 1, { mimeType: 'audio/mpeg' }))
  assert.equal(player.getState().stats.rejectedChunks, 1)
  assert.equal(player.getState().state, 'ERROR')
})

test('compares server byte/frame diagnostics with browser-decoded chunks', async () => {
  const player = makePlayer()
  player.beginTurn('test-turn-1')
  await player.enqueue(chunk(pcmBase64([1, 2]), 1, { diagnostics: { bytes: 6, completeFrames: 3 } }))
  const stats = player.getState().stats
  assert.equal(stats.serverDiagnosticsMismatches, 1)
  assert.equal(stats.rejectedChunks, 1)
  assert.equal(stats.chunksReceived, 0)
})

test('emits onPlaybackProgress with progress advancing to 1.0 upon stream completion', async () => {
  const progressReports = []
  const player = makePlayer({
    onPlaybackProgress: (report) => progressReports.push(report),
  })
  player.beginTurn('test-turn-sync')
  await player.enqueue(chunk(pcmBase64(new Array(4800).fill(100)), 1))
  await player.completeStream()

  // Drain active sources
  player.activeSources.forEach((src) => src.onended?.())

  assert.ok(progressReports.length > 0, 'Should have received at least one progress report')
  const finalReport = progressReports[progressReports.length - 1]
  assert.equal(finalReport.progress, 1.0)
  assert.equal(finalReport.turnId, 'test-turn-sync')
})

test('progressive script reveals words sequentially synchronized with playback progress', () => {
  const script = 'Welcome to QualifyAI. I will be your autonomous AI interviewer for today.'
  const words = script.split(/\s+/)
  const getRevealedText = (progress) => {
    const count = progress >= 0.98
      ? words.length
      : Math.min(words.length, Math.max(1, Math.ceil(progress * words.length)))
    return words.slice(0, count).join(' ')
  }

  // At 0% progress -> only the opening word is revealed
  assert.equal(getRevealedText(0), 'Welcome')

  // At 25% progress -> roughly a quarter of the script
  assert.equal(getRevealedText(0.25), 'Welcome to QualifyAI.')

  // At 50% progress -> half the script
  assert.equal(getRevealedText(0.50), 'Welcome to QualifyAI. I will be')

  // At 100% progress -> full script revealed
  assert.equal(getRevealedText(1.0), script)
})

test('AudioPlaybackEngine force completion watchdog completes playback and drains sources cleanly', async () => {
  let completed = false
  const player = makePlayer({
    onPlaybackComplete: () => {
      completed = true
    },
  })

  player.beginTurn('test-turn-1')
  await player.enqueue(chunk(pcmBase64(new Array(12000).fill(50)), 1))
  assert.equal(player.state, 'PLAYING')
  assert.ok(player.activeSources.size > 0)

  // Force completion (simulates watchdog when audio finished without streamComplete packet)
  player._maybeCompletePlayback(true)
  assert.equal(completed, true)
  assert.equal(player.state, 'IDLE')
  assert.equal(player.activeSources.size, 0)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { AudioPlaybackEngine } from '../../client/src/services/AudioPlaybackEngine.js'
import { validatePcm16Chunk } from '../src/services/voice/voiceGateway.js'

class MockAudioContext {
  constructor() {
    this.state = 'running'
    this.sampleRate = 24000
    this.currentTime = 0
    this.destination = {}
    this.createdSources = []
  }

  createBuffer(channels, length, sampleRate) {
    const channelData = Array.from({ length: channels }, () => new Float32Array(length))
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      copyToChannel(src, channelIndex) {
        channelData[channelIndex].set(src)
      },
      getChannelData(channelIndex) {
        return channelData[channelIndex]
      },
    }
  }

  createBufferSource() {
    const source = {
      buffer: null,
      playbackRate: {
        value: 1.0,
        setValueAtTime: (val) => { source.playbackRate.value = val },
      },
      startTime: null,
      stoppedTime: null,
      ended: false,
      connect: () => {},
      disconnect: () => {},
      start: (time) => { source.startTime = time },
      stop: (time) => { source.stoppedTime = time },
      onended: null,
    }
    this.createdSources.push(source)
    return source
  }

  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { setValueAtTime: () => {} },
      Q: { setValueAtTime: () => {} },
      gain: { setValueAtTime: () => {} },
      connect: () => {},
    }
  }

  createGain() {
    return {
      gain: { setValueAtTime: () => {} },
      connect: () => {},
    }
  }

  async resume() {
    this.state = 'running'
  }

  async close() {
    this.state = 'closed'
  }
}

test('Audio Pipeline & Voice Synchronization Test Suite', async (t) => {
  await t.test('A. Audio Format & Frame Alignment Tests', async (tSub) => {
    await tSub.test('Decodes valid 24kHz PCM16 little-endian audio payload correctly', () => {
      // 4 frames = 8 bytes: samples [1000, -1000, 2000, -2000]
      const buf = Buffer.alloc(8)
      buf.writeInt16LE(1000, 0)
      buf.writeInt16LE(-1000, 2)
      buf.writeInt16LE(2000, 4)
      buf.writeInt16LE(-2000, 6)
      const base64Data = buf.toString('base64')

      const validated = validatePcm16Chunk({
        data: base64Data,
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        byteOrder: 'little-endian',
      })

      assert.equal(validated.sampleRate, 24000)
      assert.equal(validated.channels, 1)
      assert.equal(validated.bitDepth, 16)
      assert.equal(validated.byteOrder, 'little-endian')
      assert.equal(validated.diagnostics.bytes, 8)
      assert.equal(validated.diagnostics.completeFrames, 4)
      assert.equal(validated.diagnostics.trailingBytes, 0)
      assert.equal(validated.diagnostics.estimatedDurationSeconds, 4 / 24000)
    })

    await tSub.test('Rejects non-frame-aligned odd byte audio payloads without allowPartialFrame', () => {
      const oddBuf = Buffer.alloc(7) // 7 bytes is not divisible by 2 bytes/frame
      const base64Data = oddBuf.toString('base64')
      assert.throws(
        () => validatePcm16Chunk({
          data: base64Data,
          mimeType: 'audio/pcm;rate=24000',
          sampleRate: 24000,
          channels: 1,
          bitDepth: 16,
          byteOrder: 'little-endian',
        }),
        /frame aligned/
      )
    })

    await tSub.test('Rejects malformed non-base64 audio strings', () => {
      assert.throws(
        () => validatePcm16Chunk({
          data: '!!!not-valid-base64@@@',
          mimeType: 'audio/pcm;rate=24000',
          sampleRate: 24000,
          channels: 1,
          bitDepth: 16,
          byteOrder: 'little-endian',
        }),
        /base64/
      )
    })

    await tSub.test('Safely defaults missing sampleRate and mimeType in AudioPlaybackEngine._parseFormat', () => {
      const engine = new AudioPlaybackEngine({ AudioContextClass: MockAudioContext })
      const parsed = engine._parseFormat({
        data: Buffer.alloc(4).toString('base64'),
        // No mimeType or sampleRate provided
      })
      assert.equal(parsed.sampleRate, 24000, 'Must safely default to 24000Hz')
      assert.equal(parsed.channels, 1)
      assert.equal(parsed.bitDepth, 16)
      assert.equal(parsed.byteOrder, 'little-endian')
    })
  })

  await t.test('B. Audio Clarity & Buffer Continuity Tests (No 120ms Amplitude Dips)', async (tSub) => {
    await tSub.test('Contiguous PCM audio blocks within the stream preserve raw amplitudes with zero notches', async () => {
      const engine = new AudioPlaybackEngine({
        AudioContextClass: MockAudioContext,
        blockMs: 120,
      })
      await engine.initialize()
      engine.beginTurn('turn-continuity-1', 1)

      // Generate 240ms of continuous steady-state 24kHz audio (5760 samples = 11520 bytes)
      // All samples set to constant peak amplitude 0.75 (approx 24575 in int16)
      const sampleCount = 5760
      const byteBuf = Buffer.alloc(sampleCount * 2)
      for (let i = 0; i < sampleCount; i++) {
        byteBuf.writeInt16LE(24575, i * 2)
      }

      await engine.enqueue({
        audioTurnId: 'turn-continuity-1',
        questionSequence: 1,
        data: byteBuf.toString('base64'),
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        byteOrder: 'little-endian',
        audioSequence: 1,
      })

      await engine.completeStream()

      // The engine should have produced 2 buffers (120ms each = 2880 samples)
      assert.ok(engine.queue.length >= 1 || engine.activeSources.size >= 1)

      // Inspect created buffer sources
      const sources = engine.audioContext.createdSources
      assert.ok(sources.length >= 2, `Must schedule at least 2 consecutive blocks, got ${sources.length}`)

      const block1 = sources[0].buffer.getChannelData(0)
      const block2 = sources[1].buffer.getChannelData(0)

      // Block 1 should have a micro-fade-in at the absolute start (sample 0..47)
      assert.ok(block1[0] < 0.1, 'Sample 0 must smoothly ramp up from 0 to prevent DC click')
      assert.ok(block1[100] > 0.7, 'After first 48 samples, amplitude must be full unwindowed ~0.75')

      // CRITICAL VERIFICATION:
      // In the middle/end of Block 1 and start of Block 2, there must be ZERO cosine taper!
      // In the previous buggy code, block1[2879] was multiplied down to 0, producing metallic 8.33Hz notches.
      const endOfBlock1Sample = block1[block1.length - 1]
      const startOfBlock2Sample = block2[0]

      assert.ok(
        endOfBlock1Sample > 0.7,
        `End of Block 1 must NOT dip to 0! Expected ~0.75, got ${endOfBlock1Sample}`
      )
      assert.ok(
        startOfBlock2Sample > 0.7,
        `Start of Block 2 must NOT dip to 0! Expected ~0.75, got ${startOfBlock2Sample}`
      )

      // Block 2 end (final buffer of completeStream) should have micro-fade-out to zero
      const endOfBlock2Sample = block2[block2.length - 1]
      assert.ok(
        endOfBlock2Sample < 0.1,
        `Final sample of last block must smoothly ramp to 0 to prevent DC pop, got ${endOfBlock2Sample}`
      )
      await engine.destroy()
    })

    await tSub.test('Scheduled sources form an unbroken continuous timeline with zero gaps and zero overlap', async () => {
      const engine = new AudioPlaybackEngine({
        AudioContextClass: MockAudioContext,
        blockMs: 120,
      })
      await engine.initialize()
      engine.beginTurn('turn-timeline-1', 1)

      const sampleCount = 2880 * 3 // 3 blocks of 120ms
      const byteBuf = Buffer.alloc(sampleCount * 2)
      for (let i = 0; i < sampleCount; i++) byteBuf.writeInt16LE(10000, i * 2)

      await engine.enqueue({
        audioTurnId: 'turn-timeline-1',
        questionSequence: 1,
        data: byteBuf.toString('base64'),
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        byteOrder: 'little-endian',
        audioSequence: 1,
      })

      const sources = engine.audioContext.createdSources
      assert.equal(sources.length, 3)

      // Check timeline continuity: each source must start exactly when the previous finishes
      const s0Duration = sources[0].buffer.duration
      const s1Duration = sources[1].buffer.duration

      const diff01 = Math.abs(sources[1].startTime - (sources[0].startTime + s0Duration))
      const diff12 = Math.abs(sources[2].startTime - (sources[1].startTime + s1Duration))

      assert.ok(diff01 < 0.0001, `Source 1 start time must match Source 0 end time (diff: ${diff01})`)
      assert.ok(diff12 < 0.0001, `Source 2 start time must match Source 1 end time (diff: ${diff12})`)
      await engine.destroy()
    })
  })

  await t.test('C. Question Synchronization & Stale Audio Rejection Tests', async (tSub) => {
    await tSub.test('Rejects chunks belonging to superseded audio turns or older question sequences', async () => {
      const engine = new AudioPlaybackEngine({ AudioContextClass: MockAudioContext })
      await engine.initialize()

      // Activate Question 2 turn
      engine.beginTurn('turn-q2', 2)

      // Attempt to enqueue audio chunk from older Question 1 (sequence 1)
      const q1Buf = Buffer.alloc(2880 * 2)
      await engine.enqueue({
        audioTurnId: 'turn-q1', // Old turn ID
        questionSequence: 1, // Older sequence
        data: q1Buf.toString('base64'),
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        byteOrder: 'little-endian',
        audioSequence: 1,
      })

      // Must be dropped
      assert.equal(engine.stats.chunksReceived, 0, 'Stale chunk must not be processed into stats')
      assert.equal(engine.queue.length, 0, 'Stale chunk must not enter playback queue')
      assert.equal(engine.audioContext.createdSources.length, 0, 'No audio sources created for stale chunk')

      // Now enqueue valid chunk for Question 2 (sequence 2)
      await engine.enqueue({
        audioTurnId: 'turn-q2',
        questionSequence: 2,
        data: q1Buf.toString('base64'),
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        byteOrder: 'little-endian',
        audioSequence: 1,
      })

      assert.equal(engine.stats.chunksReceived, 1, 'Valid chunk for active question sequence must be accepted')
      await engine.destroy()
    })

    await tSub.test('flush() terminates all active sources and clears timeline immediately upon cancellation', async () => {
      const engine = new AudioPlaybackEngine({ AudioContextClass: MockAudioContext, prebufferMs: 100 })
      await engine.initialize()
      engine.beginTurn('turn-cancel-test', 3)

      const byteBuf = Buffer.alloc(2880 * 2)
      await engine.enqueue({
        audioTurnId: 'turn-cancel-test',
        questionSequence: 3,
        data: byteBuf.toString('base64'),
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        byteOrder: 'little-endian',
        audioSequence: 1,
      })

      assert.ok(engine.activeSources.size > 0)
      const source = Array.from(engine.activeSources)[0]

      // Cancel / flush audio immediately (e.g. candidate submitted answer or unmuted)
      engine.flush()

      assert.equal(engine.activeSources.size, 0, 'Active sources must be cleared')
      assert.equal(engine.queue.length, 0, 'Queue must be empty')
      assert.ok(source.stoppedTime !== null, 'Scheduled source must have been stopped')
      assert.equal(engine.state, 'IDLE')
      await engine.destroy()
    })

    await tSub.test('Rejects duplicate and out-of-order chunk sequences within a turn', async () => {
      const engine = new AudioPlaybackEngine({ AudioContextClass: MockAudioContext })
      await engine.initialize()
      engine.beginTurn('turn-seq-test', 1)

      const byteBuf = Buffer.alloc(2880 * 2)
      // Chunk 1
      await engine.enqueue({
        audioTurnId: 'turn-seq-test',
        questionSequence: 1,
        data: byteBuf.toString('base64'),
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        byteOrder: 'little-endian',
        audioSequence: 1,
      })
      assert.equal(engine.stats.chunksReceived, 1)

      // Duplicate Chunk 1
      await engine.enqueue({
        audioTurnId: 'turn-seq-test',
        questionSequence: 1,
        data: byteBuf.toString('base64'),
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        byteOrder: 'little-endian',
        audioSequence: 1,
      })
      assert.equal(engine.stats.duplicateChunks, 1, 'Duplicate chunk must be recorded and dropped')
      assert.equal(engine.stats.chunksReceived, 1, 'Chunks received must not increment for duplicate')

      // Chunk 2 (valid)
      await engine.enqueue({
        audioTurnId: 'turn-seq-test',
        questionSequence: 1,
        data: byteBuf.toString('base64'),
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        byteOrder: 'little-endian',
        audioSequence: 2,
      })
      assert.equal(engine.stats.chunksReceived, 2)

      // Out-of-order Chunk 1 again
      await engine.enqueue({
        audioTurnId: 'turn-seq-test',
        questionSequence: 1,
        data: byteBuf.toString('base64'),
        mimeType: 'audio/pcm;rate=24000',
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        byteOrder: 'little-endian',
        audioSequence: 1,
      })
      assert.equal(engine.stats.outOfOrderChunks, 1, 'Out of order chunk must be recorded and dropped')
      assert.equal(engine.stats.chunksReceived, 2)
      await engine.destroy()
    })
  })
})

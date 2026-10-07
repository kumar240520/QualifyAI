/**
 * Comprehensive Audio Pipeline Diagnostic & Regression Test
 * Validates PCM16 decoding, endianness, odd-byte carryover, sequential scheduling,
 * and interruption protection logic.
 */

// Mock Web Audio Context for Node test environment
class MockAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels
    this.length = length
    this.sampleRate = sampleRate
    this.duration = length / sampleRate
    this.channelData = new Float32Array(length)
  }
  copyToChannel(data) {
    this.channelData.set(data)
  }
}

class MockAudioBufferSourceNode {
  constructor(ctx) {
    this.context = ctx
    this.buffer = null
    this.startTime = 0
    this.isPlaying = false
    this.onended = null
  }
  connect(dest) {}
  start(time) {
    this.startTime = time
    this.isPlaying = true
  }
  stop() {
    this.isPlaying = false
    if (this.onended) this.onended()
  }
  disconnect() {}
}

class MockAudioContext {
  constructor() {
    this.sampleRate = 48000 // Native hardware output clock
    this.currentTime = 0
    this.destination = {}
    this.state = 'running'
  }
  createBuffer(channels, length, rate) {
    return new MockAudioBuffer(channels, length, rate)
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode(this)
  }
  async resume() {
    this.state = 'running'
  }
}

// Minimal reproduction of VoiceInterviewEngine audio pipeline methods
class TestableAudioEngine {
  constructor() {
    this.outputAudioContext = new MockAudioContext()
    this.scheduledTime = 0
    this.activeSources = []
    this.pcmByteCarryover = null
    this.isAiTurnActive = false
    this.preventAiInterruption = true
    this.conversationState = 'LISTENING'
    this.audioStats = {
      chunksReceived: 0,
      bytesReceived: 0,
      chunkSizes: [],
      chunkIntervals: [],
      lastChunkTimestamp: 0,
      droppedChunks: 0,
      duplicateChunks: 0,
      lastChunkIndex: -1,
    }
  }

  _decodePcm16Chunk(base64Data) {
    if (!base64Data) return null
    const binaryString = Buffer.from(base64Data, 'base64').toString('binary')
    const rawLen = binaryString.length
    if (rawLen === 0) return null

    const carryoverLen = this.pcmByteCarryover ? this.pcmByteCarryover.length : 0
    const totalLen = carryoverLen + rawLen

    const usableByteLen = totalLen - (totalLen % 2)
    const remainderLen = totalLen - usableByteLen

    const combinedBytes = new Uint8Array(usableByteLen)
    let destIdx = 0

    if (carryoverLen > 0) {
      for (let i = 0; i < carryoverLen && destIdx < usableByteLen; i++) {
        combinedBytes[destIdx++] = this.pcmByteCarryover[i]
      }
      this.pcmByteCarryover = null
    }

    const binaryCopyLimit = usableByteLen - destIdx
    for (let i = 0; i < binaryCopyLimit; i++) {
      combinedBytes[destIdx++] = binaryString.charCodeAt(i)
    }

    if (remainderLen > 0) {
      this.pcmByteCarryover = new Uint8Array(remainderLen)
      for (let i = 0; i < remainderLen; i++) {
        this.pcmByteCarryover[i] = binaryString.charCodeAt(binaryCopyLimit + i)
      }
    }

    if (usableByteLen < 2) return null

    const sampleCount = usableByteLen / 2
    const float32Array = new Float32Array(sampleCount)
    const dataView = new DataView(combinedBytes.buffer, combinedBytes.byteOffset, combinedBytes.byteLength)

    for (let i = 0; i < sampleCount; i++) {
      const int16 = dataView.getInt16(i * 2, true)
      float32Array[i] = int16 < 0 ? int16 / 32768.0 : int16 / 32767.0
    }

    return float32Array
  }

  playAiAudioChunk(chunkPayload) {
    const base64Data = typeof chunkPayload === 'string' ? chunkPayload : chunkPayload?.data
    if (!base64Data) return

    const chunkIndex = typeof chunkPayload === 'object' ? chunkPayload.chunkIndex : null
    const now = Date.now()

    this.audioStats.chunksReceived++
    if (typeof chunkIndex === 'number') {
      if (this.audioStats.lastChunkIndex >= 0) {
        if (chunkIndex === this.audioStats.lastChunkIndex) {
          this.audioStats.duplicateChunks++
          return
        } else if (chunkIndex < this.audioStats.lastChunkIndex) {
          this.audioStats.droppedChunks++
        }
      }
      this.audioStats.lastChunkIndex = chunkIndex
    }

    const float32Array = this._decodePcm16Chunk(base64Data)
    if (!float32Array || float32Array.length === 0) return

    this.audioStats.bytesReceived += float32Array.length * 2

    const audioBuffer = this.outputAudioContext.createBuffer(1, float32Array.length, 24000)
    audioBuffer.copyToChannel(float32Array)

    const JITTER_BUFFER_SEC = 0.08
    const currentTime = this.outputAudioContext.currentTime

    if (this.scheduledTime < currentTime) {
      this.scheduledTime = currentTime + JITTER_BUFFER_SEC
    }

    const source = this.outputAudioContext.createBufferSource()
    source.buffer = audioBuffer
    source.start(this.scheduledTime)

    this.scheduledTime += audioBuffer.duration
    this.activeSources.push(source)
    this.isAiTurnActive = true
    this.conversationState = 'SPEAKING'

    return {
      startTime: source.startTime,
      duration: audioBuffer.duration,
      endTime: this.scheduledTime,
    }
  }

  handleCandidateInterruptionSignal() {
    if (this.preventAiInterruption) {
      // Ignored! AI speech is protected
      return false
    }
    // Interrupted! Halt playback
    for (const s of this.activeSources) s.stop()
    this.activeSources = []
    this.isAiTurnActive = false
    this.conversationState = 'LISTENING'
    return true
  }
}

async function runTests() {
  console.log('🧪 Starting QualifyAI Audio Pipeline Test Suite...\n')

  const engine = new TestableAudioEngine()

  // --- TEST 1: PCM16 Little-Endian Float32 Normalization ---
  console.log('--- TEST 1: PCM16 Little-Endian Decoding & Normalization ---')
  // Create 4 known Int16 samples: 0, 16384 (0.5), -32768 (-1.0), 32767 (~1.0)
  const testBuffer = Buffer.alloc(8)
  testBuffer.writeInt16LE(0, 0)
  testBuffer.writeInt16LE(16384, 2)
  testBuffer.writeInt16LE(-32768, 4)
  testBuffer.writeInt16LE(32767, 6)

  const floatSamples = engine._decodePcm16Chunk(testBuffer.toString('base64'))
  console.log('Decoded Float32 samples:', Array.from(floatSamples))
  if (
    floatSamples.length === 4 &&
    Math.abs(floatSamples[0] - 0.0) < 0.001 &&
    Math.abs(floatSamples[1] - 0.5) < 0.001 &&
    Math.abs(floatSamples[2] - -1.0) < 0.001 &&
    Math.abs(floatSamples[3] - 1.0) < 0.001
  ) {
    console.log('✅ TEST 1 PASSED: Perfect Little-Endian Int16 -> Float32 conversion.\n')
  } else {
    throw new Error('TEST 1 FAILED: Incorrect PCM sample normalization')
  }

  // --- TEST 2: Odd-Byte Carryover Across Chunks ---
  console.log('--- TEST 2: Odd-Byte Carryover Across Chunk Boundaries ---')
  // Chunk A: 5 bytes (2 samples + 1 dangling byte)
  const chunkA = Buffer.from([0x00, 0x20, 0x00, 0x40, 0x55]) // 5 bytes
  const chunkB = Buffer.from([0x22, 0x00, 0x10]) // 3 bytes -> combines with 0x55 to make 2 more samples
  const decodedA = engine._decodePcm16Chunk(chunkA.toString('base64'))
  console.log(`Chunk A (5 bytes): produced ${decodedA.length} samples, carryover buffer has ${engine.pcmByteCarryover?.length} byte`)
  
  const decodedB = engine._decodePcm16Chunk(chunkB.toString('base64'))
  console.log(`Chunk B (3 bytes): produced ${decodedB.length} samples, carryover buffer has ${engine.pcmByteCarryover?.length || 0} bytes`)

  if (decodedA.length === 2 && decodedB.length === 2 && !engine.pcmByteCarryover) {
    console.log('✅ TEST 2 PASSED: Odd-byte chunk boundaries cleanly stitched without error or frame drop.\n')
  } else {
    throw new Error('TEST 2 FAILED: Odd-byte carryover failure')
  }

  // --- TEST 3: Jitter Buffer & Gap-Free Timeline Scheduling ---
  console.log('--- TEST 3: Jitter Buffer & Seamless Timeline Scheduling ---')
  // Simulate 5 chunks arriving with simulated network jitter:
  // Each chunk is 1920 bytes (40ms of 24kHz audio)
  const sampleChunk = Buffer.alloc(1920)
  for (let i = 0; i < 1920; i += 2) sampleChunk.writeInt16LE(1000, i)
  const b64Chunk = sampleChunk.toString('base64')

  engine.outputAudioContext.currentTime = 1.00 // Current player time = 1.00s

  const scheduledEvents = []
  for (let i = 1; i <= 5; i++) {
    const res = engine.playAiAudioChunk({ data: b64Chunk, chunkIndex: i })
    scheduledEvents.push(res)
    // Advance simulated clock with 25ms jitter (less than 40ms duration)
    engine.outputAudioContext.currentTime += 0.025
  }

  console.log('Scheduled 5 chunks on timeline:')
  for (let i = 0; i < scheduledEvents.length; i++) {
    console.log(`  Chunk #${i + 1}: start=${scheduledEvents[i].startTime.toFixed(4)}s, end=${scheduledEvents[i].endTime.toFixed(4)}s, duration=${scheduledEvents[i].duration.toFixed(4)}s`)
    if (i > 0) {
      const gap = scheduledEvents[i].startTime - scheduledEvents[i - 1].endTime
      if (Math.abs(gap) > 0.0001) {
        throw new Error(`TEST 3 FAILED: Audible gap of ${gap}s detected between chunks #${i} and #${i + 1}`)
      }
    }
  }
  console.log('✅ TEST 3 PASSED: Zero-gap continuous audio scheduling across all jitter-buffered chunks.\n')

  // --- TEST 4: Duplicate & Out-of-Order Chunk Detection ---
  console.log('--- TEST 4: Duplicate Chunk Detection ---')
  const initialChunksCount = engine.audioStats.chunksReceived
  // Re-send chunk #5
  engine.playAiAudioChunk({ data: b64Chunk, chunkIndex: 5 })
  console.log('Duplicate chunks detected:', engine.audioStats.duplicateChunks)
  if (engine.audioStats.duplicateChunks === 1) {
    console.log('✅ TEST 4 PASSED: Duplicate audio chunk detected and ignored.\n')
  } else {
    throw new Error('TEST 4 FAILED: Duplicate chunk was not caught')
  }

  // --- TEST 5: Interruption Protection Mode ---
  console.log('--- TEST 5: Interruption Protection Mode ---')
  engine.preventAiInterruption = true
  const interruptedProtected = engine.handleCandidateInterruptionSignal()
  console.log(`Interruption attempted with preventAiInterruption=true -> Was interrupted: ${interruptedProtected}`)

  engine.preventAiInterruption = false
  const interruptedUnprotected = engine.handleCandidateInterruptionSignal()
  console.log(`Interruption attempted with preventAiInterruption=false -> Was interrupted: ${interruptedUnprotected}`)

  if (!interruptedProtected && interruptedUnprotected) {
    console.log('✅ TEST 5 PASSED: "Prevent AI Interruption" protects audio queue from acoustic noise/echo.\n')
  } else {
    throw new Error('TEST 5 FAILED: Interruption protection mode behavior mismatch')
  }

  console.log('🎉 ALL 5 AUDIO PIPELINE REGRESSION TESTS PASSED CLEANLY!')
}

runTests().catch((err) => {
  console.error('Test suite failed:', err)
  process.exit(1)
})

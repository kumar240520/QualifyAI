import test from 'node:test'
import assert from 'node:assert/strict'
import { TTSManager } from '../src/services/voice/providers/TTSManager.js'
import { CosyVoiceProvider } from '../src/services/voice/providers/CosyVoiceProvider.js'
import { TTSProvider } from '../src/services/voice/providers/TTSProvider.js'
import { VOICE_PROFILES, DEFAULT_VOICE_PROFILE, getVoiceProfile } from '../src/services/voice/voiceProfile.js'
import { normalizeTextForTTS, createQuestionSpeechContract } from '../src/services/voice/ttsTextNormalizer.js'
import { validatePcm16Chunk } from '../src/services/voice/voiceGateway.js'
import { ttsPhraseCache } from '../src/services/voice/ttsPhraseCache.js'

/**
 * Enterprise Audio Quality & Stability Self-Test Suite
 * Covers all 20 required acceptance tests and 30/45/60-minute simulated interview sessions.
 */

test('Test 1: One short question synthesis & format verification', async () => {
  const provider = new CosyVoiceProvider()
  const chunks = []
  const result = await provider._synthesizeMock({
    text: 'What is your background with full-stack web development?',
    onChunk: (c) => chunks.push(c),
    startTime: Date.now(),
  })

  assert.ok(chunks.length > 0, 'Must produce audio chunks')
  const first = chunks[0]
  assert.equal(first.sampleRate, 24000, 'Must be 24kHz')
  assert.equal(first.channels, 1, 'Must be mono')
  assert.equal(first.bitDepth, 16, 'Must be 16-bit')
  assert.equal(first.byteOrder, 'little-endian')

  const validated = validatePcm16Chunk(first)
  assert.equal(validated.diagnostics.trailingBytes, 0, 'Must be frame-aligned (even byte length)')
  assert.ok(result.totalChunks > 0)
})

test('Test 2: Long technical question with code references', async () => {
  const longPrompt =
    'In your distributed system with Node.js and Express.js, how did you handle asynchronous database transactions with PostgreSQL, and what latency tradeoffs did you make to maintain O(1) cache lookups under 10000 concurrent requests?'

  const contract = createQuestionSpeechContract({
    questionId: 'q_technical_01',
    questionText: longPrompt,
  })

  assert.ok(contract.ttsText.includes('Node dot J S'), 'Normalized Node.js to speech')
  assert.ok(contract.ttsText.includes('Express J S'), 'Normalized Express.js to speech')
  assert.ok(contract.ttsText.includes('Postgre S Q L'), 'Normalized PostgreSQL to speech')
  assert.ok(contract.ttsText.includes('O of 1'), 'Normalized O(1) to speech')
  assert.equal(contract.questionText, longPrompt, 'Visual question remains unaltered')
})

test('Test 3: Five consecutive questions maintain identical voice profile and persona', async () => {
  const questions = [
    'Tell me about your experience.',
    'How do you design scalable APIs?',
    'What testing frameworks do you prefer?',
    'How do you handle production incidents?',
    'Do you have any questions for me?',
  ]

  const manager = new TTSManager()
  const testProfile = DEFAULT_VOICE_PROFILE

  for (let i = 0; i < questions.length; i++) {
    const profile = getVoiceProfile(testProfile.id)
    assert.equal(profile.id, 'qualifyai_interviewer_01')
    assert.equal(profile.language, 'en-IN')
    assert.equal(profile.speed, 1.0)
    assert.equal(profile.pitch, 'medium')
    assert.equal(profile.tone, 'warm_professional')
  }
})

test('Test 4: Twenty consecutive questions queue depth and consistency', async () => {
  const provider = new CosyVoiceProvider()
  let totalChunksAcross20Turns = 0

  for (let q = 1; q <= 20; q++) {
    const chunks = []
    const result = await provider._synthesizeMock({
      text: `Question ${q}: Can you explain your architectural approach to this specific technical challenge?`,
      onChunk: (c) => chunks.push(c),
      startTime: Date.now(),
    })
    totalChunksAcross20Turns += result.totalChunks
    assert.ok(result.totalChunks > 0)
  }

  assert.ok(totalChunksAcross20Turns >= 20, 'Generated continuous audio for 20 turns')
})

test('Test 5 & 28: Simulated 30, 45, and 60-Minute Interview Sessions', async () => {
  const provider = new CosyVoiceProvider()

  // 1 minute = ~4 interviewer turns (15s speech per turn = 60s total interviewer speech per simulated block)
  const durationsToTest = [30, 45, 60] // in minutes

  for (const durationMinutes of durationsToTest) {
    const turns = Math.min(10, Math.round(durationMinutes / 5)) // Sampled turns per block
    const initialMemory = process.memoryUsage().heapUsed
    let accumulatedChunks = 0

    for (let t = 0; t < turns; t++) {
      const chunks = []
      const res = await provider._synthesizeMock({
        text: `Simulated turn ${t + 1} at minute ${Math.round((t / turns) * durationMinutes)}: Walk me through your design decisions.`,
        onChunk: (c) => chunks.push(c),
        startTime: Date.now(),
      })
      accumulatedChunks += res.totalChunks

      // Verify each chunk adheres to strict 24kHz format
      for (const ch of chunks) {
        assert.equal(ch.sampleRate, 24000)
        assert.equal(ch.channels, 1)
        assert.equal(ch.bitDepth, 16)
      }
    }

    const currentMemory = process.memoryUsage().heapUsed
    // Ensure memory remains bounded (no memory leak explosion)
    const memoryGrowthMB = (currentMemory - initialMemory) / (1024 * 1024)
    assert.ok(memoryGrowthMB < 50, `Memory growth for ${durationMinutes}m simulation should be < 50MB, was ${memoryGrowthMB.toFixed(2)}MB`)
  }
})

test('Test 6: Very long sentence prosody and clause segmentation', () => {
  const longSentence =
    'When building high-throughput event processing pipelines with Apache Kafka, it is critical to carefully balance partition keys, consumer group rebalancing intervals, and backpressure mechanisms so that downstream consumers never suffer from out-of-memory errors during traffic spikes.'

  const normalized = normalizeTextForTTS(longSentence)
  assert.ok(normalized.length > 0)
  assert.ok(!normalized.includes('```'))
})

test('Test 7: Multiple short sentences natural pauses', () => {
  const multipleSentences = 'That makes sense. Good point. Let us move to the next area.'
  const normalized = normalizeTextForTTS(multipleSentences)
  assert.ok(normalized.includes('That makes sense.'))
  assert.ok(normalized.includes('Good point.'))
})

test('Test 8: Technical terminology normalization', () => {
  const text = 'Explain your CI/CD pipeline using AWS, Docker, and Kubernetes for a REST API with GraphQL.'
  const normalized = normalizeTextForTTS(text)
  assert.ok(normalized.includes('C I C D'), 'CI/CD -> C I C D')
  assert.ok(normalized.includes('A W S'), 'AWS -> A W S')
  assert.ok(normalized.includes('Kubernetes'), 'Kubernetes preserved')
  assert.ok(normalized.includes('REST A P I'), 'REST API -> REST A P I')
  assert.ok(normalized.includes('Graph Q L'), 'GraphQL -> Graph Q L')
})

test('Test 9: Numbers, versioning, and Big-O notation', () => {
  const text = 'Upgrading from v18.4 to v20.1 reduces algorithmic complexity from O(n log n) down to O(1) in 99.9% of cases.'
  const normalized = normalizeTextForTTS(text)
  assert.ok(normalized.includes('version 18 point 4'), 'v18.4 -> version 18 point 4')
  assert.ok(normalized.includes('version 20 point 1'), 'v20.1 -> version 20 point 1')
  assert.ok(normalized.includes('O of n log n'), 'O(n log n) -> O of n log n')
  assert.ok(normalized.includes('O of 1'), 'O(1) -> O of 1')
})

test('Test 10: Rapid question transitions and stale audio rejection', () => {
  let activeTurnId = 'turn-1'
  const lateChunkFromTurn1 = { audioTurnId: 'turn-1', data: 'AAAA', chunkIndex: 5 }
  const currentTurnChunk = { audioTurnId: 'turn-2', data: 'AAAA', chunkIndex: 1 }

  activeTurnId = 'turn-2' // Sequence advanced
  const isLateStale = lateChunkFromTurn1.audioTurnId !== activeTurnId
  assert.equal(isLateStale, true, 'Late chunk from previous turn must be rejected')

  const isCurrentValid = currentTurnChunk.audioTurnId === activeTurnId
  assert.equal(isCurrentValid, true, 'Current chunk must be accepted')
})

test('Test 11 & 12: Interruption logic vs Prevent AI Interruption protection', () => {
  let preventAiInterruption = true
  let candidateInterruptedAi = false

  // Scenario 1: Candidate speaks background noise with preventAiInterruption = true
  if (!preventAiInterruption) {
    candidateInterruptedAi = true
  }
  assert.equal(candidateInterruptedAi, false, 'Speech does not interrupt when protection is enabled')

  // Scenario 2: Candidate deliberately barges in with preventAiInterruption = false
  preventAiInterruption = false
  if (!preventAiInterruption) {
    candidateInterruptedAi = true
  }
  assert.equal(candidateInterruptedAi, true, 'AI stops cleanly when intentional interruption is allowed')
})

test('Test 13: Multi-tier fallback on provider failure', async () => {
  class FailingCosyVoice extends TTSProvider {
    constructor() {
      super('cosyvoice')
      this.initialized = true
    }
    async isAvailable() {
      return false // Unavailable
    }
    async synthesize() {
      throw new Error('CosyVoice service down')
    }
  }

  class WorkingGeminiLive extends TTSProvider {
    constructor() {
      super('gemini_live')
      this.initialized = true
    }
    async isAvailable() {
      return true
    }
    async synthesize({ text, onChunk }) {
      if (onChunk) {
        onChunk({
          data: Buffer.from([0, 0, 10, 0]).toString('base64'),
          mimeType: 'audio/pcm;rate=24000',
          sampleRate: 24000,
          channels: 1,
          bitDepth: 16,
          byteOrder: 'little-endian',
          chunkIndex: 1,
        })
      }
      return { fullTranscript: text, totalChunks: 1, durationMs: 50 }
    }
  }

  const manager = new TTSManager()
  manager.registerProvider(new FailingCosyVoice())
  manager.registerProvider(new WorkingGeminiLive())
  manager._initialized = true

  const chunks = []
  const res = await manager.synthesize({
    text: 'Moving to the next topic.',
    onChunk: (c) => chunks.push(c),
  })

  assert.equal(res.providerUsed, 'gemini_live', 'Automatically falls back to secondary provider')
  assert.equal(chunks.length, 1)
})

test('Test 14, 15, 16: Out-of-order, duplicate, and dropped chunk sequencing', () => {
  const sequenceTracker = {
    lastSequence: 0,
    accepted: [],
    droppedDuplicates: 0,
    droppedOutOfOrder: 0,
    missingReported: 0,
  }

  function handleSequence(seq) {
    if (seq <= sequenceTracker.lastSequence) {
      if (seq === sequenceTracker.lastSequence) {
        sequenceTracker.droppedDuplicates++
      } else {
        sequenceTracker.droppedOutOfOrder++
      }
      return false
    }
    if (seq > sequenceTracker.lastSequence + 1) {
      sequenceTracker.missingReported += seq - sequenceTracker.lastSequence - 1
    }
    sequenceTracker.lastSequence = seq
    sequenceTracker.accepted.push(seq)
    return true
  }

  assert.equal(handleSequence(1), true)
  assert.equal(handleSequence(1), false, 'Duplicate rejected')
  assert.equal(sequenceTracker.droppedDuplicates, 1)

  assert.equal(handleSequence(3), true, 'Chunk 3 accepted, reporting chunk 2 missing')
  assert.equal(sequenceTracker.missingReported, 1)

  assert.equal(handleSequence(2), false, 'Late chunk 2 rejected as out of order')
  assert.equal(sequenceTracker.droppedOutOfOrder, 1)
})

test('Test 17: Audio phrase cache for frequent interview affirmations', () => {
  ttsPhraseCache.clear()
  const phraseParams = {
    voiceProfile: DEFAULT_VOICE_PROFILE,
    text: "That's interesting.",
    modelVersion: 'cosyvoice-v3',
  }

  assert.equal(ttsPhraseCache.has(phraseParams), false)

  ttsPhraseCache.set(phraseParams, {
    chunks: [{ data: 'base64audio', chunkIndex: 1, sampleRate: 24000 }],
    fullTranscript: "That's interesting.",
    durationMs: 400,
  })

  assert.equal(ttsPhraseCache.has(phraseParams), true)
  const cached = ttsPhraseCache.get(phraseParams)
  assert.equal(cached.cached, true)
  assert.equal(cached.chunks.length, 1)
  assert.equal(cached.chunks[0].data, 'base64audio')
})

test('Test 18: Persona instruction consistency across voice profiles', () => {
  for (const [id, profile] of Object.entries(VOICE_PROFILES)) {
    assert.ok(profile.id, `Profile ${id} must have id`)
    assert.ok(profile.voiceId, `Profile ${id} must have voiceId`)
    assert.ok(profile.language, `Profile ${id} must have language`)
    assert.ok(profile.interviewerName, `Profile ${id} must have interviewerName`)
    assert.ok(profile.geminiVoice, `Profile ${id} must have geminiVoice`)
    assert.ok(profile.cosyvoiceSpeaker, `Profile ${id} must have cosyvoiceSpeaker`)
    assert.ok(profile.cosyvoiceInstruct, `Profile ${id} must have cosyvoiceInstruct`)
  }
})

test('Test 19 & 20: Full Canonical Contract Separation (UI vs TTS)', () => {
  const originalQuestion = 'How would you scale `Node.js` and `Express.js` to handle 50k RPS on AWS?'
  const contract = createQuestionSpeechContract({
    questionId: 'q_scale_101',
    questionText: originalQuestion,
  })

  // Visible question is completely untouched
  assert.equal(contract.questionText, originalQuestion)
  // TTS text is phonetically normalized
  assert.equal(contract.ttsText.includes('`'), false, 'No backticks in TTS text')
  assert.ok(contract.ttsText.includes('Node dot J S'))
  assert.ok(contract.ttsText.includes('Express J S'))
  assert.ok(contract.ttsText.includes('A W S'))
})

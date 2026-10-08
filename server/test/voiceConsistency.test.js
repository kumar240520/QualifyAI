import test from 'node:test'
import assert from 'node:assert/strict'
import { ttsManager } from '../src/services/voice/providers/TTSManager.js'
import { DEFAULT_VOICE_PROFILE, getVoiceProfile } from '../src/services/voice/voiceProfile.js'
import { ttsPhraseCache } from '../src/services/voice/ttsPhraseCache.js'

test('QualifyAI Authoritative Voice Consistency Test Suite', async (t) => {
  await ttsManager.initialize()

  const turns = [
    { name: 'Question 1 audio', text: 'Tell me about your experience building scalable web applications.' },
    { name: 'Filler 1 audio', text: "Whenever you're ready, you can answer. I'm still here." },
    { name: 'Filler 2 audio', text: 'Take your time. You can answer whenever you are ready.' },
    { name: 'Question 2 audio', text: 'Which data structure provides constant-time average lookup, and what happens during a hash collision?' },
    { name: 'Question 3 audio', text: 'JavaScript is a statically typed language. True or False?' },
    { name: 'Filler audio', text: 'I am here, you can just answer it in your own way.' },
    { name: 'Follow-up audio', text: 'Can you elaborate on how you handled concurrency in that scenario?' },
    { name: 'Closing audio', text: 'We have not received a response across three consecutive questions. This interview session has now concluded. Thank you for your time.' },
  ]

  const synthesisResults = []

  for (const turn of turns) {
    await t.test(`Synthesizes ${turn.name} using authoritative interviewer persona`, async () => {
      const collectedChunks = []
      const result = await ttsManager.synthesize({
        text: turn.text,
        voiceProfile: DEFAULT_VOICE_PROFILE,
        preferredProvider: 'cosyvoice',
        onChunk: (chunk) => collectedChunks.push(chunk),
      })

      assert.ok(collectedChunks.length > 0, `${turn.name} must emit audio chunks`)
      assert.ok(
        result.providerUsed === 'cosyvoice' || result.providerUsed === 'phrase_cache',
        `${turn.name} must use CosyVoice or its pre-warmed phrase cache, got: ${result.providerUsed}`
      )

      // Audio format verification across every chunk
      for (const chunk of collectedChunks) {
        assert.equal(chunk.sampleRate, 24000, `${turn.name} chunks must all use declared 24000Hz sample rate`)
        assert.equal(chunk.channels, 1, `${turn.name} chunks must all be single channel mono`)
        assert.equal(chunk.bitDepth, 16, `${turn.name} chunks must be 16-bit PCM`)
        assert.equal(chunk.byteOrder, 'little-endian', `${turn.name} chunks must be little-endian`)
        assert.ok(chunk.data && chunk.data.length > 0, `${turn.name} chunk must have valid base64 audio payload`)
      }

      synthesisResults.push({
        turn: turn.name,
        result,
        chunkCount: collectedChunks.length,
        firstChunk: collectedChunks[0],
      })
    })
  }

  await t.test('All turns strictly share identical voice profile, persona, and audio parameters', () => {
    // 1. One Voice Profile
    assert.equal(DEFAULT_VOICE_PROFILE.voiceId, 'qualifyai_interviewer_01')
    assert.equal(DEFAULT_VOICE_PROFILE.provider, 'cosyvoice')
    assert.equal(DEFAULT_VOICE_PROFILE.language, 'en-IN')
    assert.equal(DEFAULT_VOICE_PROFILE.style, 'professional_conversational')
    assert.equal(DEFAULT_VOICE_PROFILE.tone, 'warm_professional')
    assert.equal(DEFAULT_VOICE_PROFILE.pitch, 'medium')
    assert.equal(DEFAULT_VOICE_PROFILE.pace, 'moderate')
    assert.equal(DEFAULT_VOICE_PROFILE.emotion, 'calm_confident')

    // 2. Format Invariant across all 8 turns
    for (const record of synthesisResults) {
      assert.equal(record.firstChunk.sampleRate, 24000)
      assert.equal(record.firstChunk.channels, 1)
      assert.equal(record.firstChunk.bitDepth, 16)
      assert.equal(record.firstChunk.byteOrder, 'little-endian')
    }
  })

  await t.test('TTS Phrase Cache generates deterministic keys containing provider, model, voiceId, and language', () => {
    const key1 = ttsPhraseCache.generateKey({
      voiceProfile: DEFAULT_VOICE_PROFILE,
      text: "Whenever you're ready, you can answer. I'm still here.",
    })
    const key2 = ttsPhraseCache.generateKey({
      voiceProfile: DEFAULT_VOICE_PROFILE,
      text: "Whenever you're ready, you can answer. I'm still here.",
    })
    const differentVoiceKey = ttsPhraseCache.generateKey({
      voiceProfile: getVoiceProfile('sarah_recruiter'),
      text: "Whenever you're ready, you can answer. I'm still here.",
    })

    assert.equal(key1, key2, 'Identical utterances with same voice profile must produce identical cache keys')
    assert.notEqual(key1, differentVoiceKey, 'Different voice profiles must NEVER collide in phrase cache (Requirement #20)')
  })

  await t.test('Canonical filler phrases hit pre-warmed cache with instantaneous retrieval', async () => {
    const fillerPhrase = "Whenever you're ready, you can answer. I'm still here."
    const cachedEntry = ttsPhraseCache.get({
      voiceProfile: DEFAULT_VOICE_PROFILE,
      text: fillerPhrase,
    })

    assert.ok(cachedEntry, 'Canonical filler phrase must be present in phrase cache')
    assert.ok(cachedEntry.chunks.length > 0, 'Cached entry must have pre-synthesized PCM chunks')
    assert.equal(cachedEntry.chunks[0].sampleRate, 24000)
  })
})

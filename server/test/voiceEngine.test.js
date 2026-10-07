import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanTextForSpeech, segmentSpeech } from '../src/services/voice/speechSegmenter.js'
import { VOICE_PROFILES, DEFAULT_VOICE_PROFILE, getVoiceProfile } from '../src/services/voice/voiceProfile.js'
import { TTSProvider } from '../src/services/voice/providers/TTSProvider.js'
import { TTSManager } from '../src/services/voice/providers/TTSManager.js'

test('Speech Segmenter cleans markdown, code fences, and meta headers', () => {
  const input = `### Question 1: System Design
**Please explain** how you would design a REST API using \`Node.js\` and \`Express\`?
\`\`\`javascript
const app = express()
app.listen(3000)
\`\`\`
Ensure that \`x === y\` and \`a !== b\`.`

  const cleaned = cleanTextForSpeech(input)
  assert.ok(!cleaned.includes('###'), 'Headers should be removed')
  assert.ok(!cleaned.includes('**'), 'Bold asterisks should be removed')
  assert.ok(!cleaned.includes('```'), 'Code fences should be removed')
  assert.ok(!cleaned.includes('`'), 'Inline backticks should be removed')
  assert.ok(cleaned.includes('is strictly equal to'), '=== converted to spoken English')
  assert.ok(cleaned.includes('is not strictly equal to'), '!== converted to spoken English')
})

test('Speech Segmenter protects abbreviations and technical tokens from improper splitting', () => {
  const text = 'We need a service (e.g. auth service) running on Node.js v18.4 with Dr. Smith, approx. 500ms latency. Can you design this?'
  const segments = segmentSpeech(text)

  assert.equal(segments.length, 2, 'Should split into 2 sentences at the question mark, not on e.g., Dr., or decimals')
  assert.ok(segments[0].includes('e.g.'), 'e.g. preserved intact')
  assert.ok(segments[0].includes('Dr. Smith'), 'Dr. preserved intact')
  assert.ok(segments[1].endsWith('?'), 'Second segment ends with ?')
})

test('Voice Profiles correctly configure natural human recruiter voices', () => {
  assert.equal(DEFAULT_VOICE_PROFILE.id, 'sarah_recruiter')
  assert.equal(DEFAULT_VOICE_PROFILE.geminiVoice, 'Aoede', 'Sarah uses Aoede (top warm natural voice)')
  assert.equal(DEFAULT_VOICE_PROFILE.kokoroVoice, 'af_heart', 'Sarah uses af_heart for Kokoro')
  assert.equal('sampleRate' in DEFAULT_VOICE_PROFILE, false, 'The voice profile does not hardcode runtime audio format metadata')

  const michael = getVoiceProfile('michael_recruiter')
  assert.equal(michael.interviewerName, 'Michael')
  assert.equal(michael.geminiVoice, 'Charon')
  assert.equal(michael.gender, 'male')

  const fallback = getVoiceProfile('unknown_profile')
  assert.equal(fallback.id, 'sarah_recruiter', 'Unknown profile falls back to Sarah')
})

test('TTSManager coordinates fallback chain across providers', async () => {
  class MockFailingProvider extends TTSProvider {
    constructor() {
      super('gemini_live')
      this.initialized = true
    }
    async isAvailable() {
      return true
    }
    async synthesize() {
      throw new Error('Network quota exceeded')
    }
  }

  class MockWorkingProvider extends TTSProvider {
    constructor() {
      super('kokoro_local')
      this.initialized = true
    }
    async isAvailable() {
      return true
    }
    async synthesize({ text, onChunk }) {
      if (onChunk) {
        onChunk({ data: 'mock_base64_data', mimeType: 'audio/pcm;rate=24000', chunkIndex: 1 })
      }
      return { fullTranscript: text, totalChunks: 1, durationMs: 40 }
    }
  }

  const manager = new TTSManager()
  manager.registerProvider(new MockFailingProvider())
  manager.registerProvider(new MockWorkingProvider())
  manager._initialized = true

  const chunks = []
  const result = await manager.synthesize({
    text: 'Welcome to your technical assessment.',
    onChunk: (c) => chunks.push(c),
  })

  assert.equal(result.providerUsed, 'kokoro_local', 'Successfully fell back to kokoro_local when primary failed')
  assert.equal(chunks.length, 1)
  assert.equal(chunks[0].data, 'mock_base64_data')
})

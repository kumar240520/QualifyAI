import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { GoogleGenAI } from '@google/genai'
import { config } from '../src/config/env.js'
import { DEFAULT_VOICE_PROFILE } from '../src/services/voice/voiceProfile.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.resolve(__dirname, '../../client/public/audio-diagnostics')
const model = DEFAULT_VOICE_PROFILE.geminiModel
const voiceName = DEFAULT_VOICE_PROFILE.geminiVoice
const captureProfile = ['10', '30', '60'].includes(process.env.VOICE_CAPTURE_SECONDS) ? process.env.VOICE_CAPTURE_SECONDS : '10'
const testParagraphs = {
  10: 'I noticed you built a route planning project. What was the most difficult technical decision you made, and how did you evaluate the result?',
  30: 'I noticed you built a route planning project, and I would like to understand how you approached the harder engineering decisions. Could you walk me through how you represented road constraints, how you handled route updates when traffic changed, and what tradeoffs you made between response time and route quality? I am also curious how you tested the result with realistic journeys and what you would improve if you had another iteration.',
  60: 'I noticed you built a route planning project, and I would like to understand how you approached the harder engineering decisions. Start by describing the first version of the system and the problem it was meant to solve. Then tell me how you represented roads and travel times, what you did when traffic or road conditions changed, and how you decided which route to recommend. I am interested in one specific decision that took careful thought. What options did you consider, what evidence helped you choose, and what did you give up with that choice? Please also explain how the pieces of the system communicated, how you tested it with realistic journeys, and what happened when data was missing or delayed. If you had another month to work on the project, what would you improve first, and how would you know that the change made the experience better for people using it?'
}
const spokenText = testParagraphs[captureProfile]
const captureName = captureProfile === '10' ? 'gemini-native-test' : `gemini-native-test-${captureProfile}s`

if (!config.gemini.apiKey) throw new Error('GEMINI_API_KEY is required in server/.env for this capture.')

const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })
const chunks = []
const runtimeMessages = []
let transcript = ''
let captureStartedAt = Date.now()

let resolveCapture
let rejectCapture
let settled = false
const captureDone = new Promise((resolve, reject) => {
  resolveCapture = resolve
  rejectCapture = reject
})
let session
const timeout = setTimeout(() => {
  if (settled) return
  settled = true
  try { session?.close?.() } catch (_) {}
  rejectCapture(new Error('Gemini capture did not finish within 45 seconds.'))
}, 45000)

session = await ai.live.connect({
    model,
    config: {
      responseModalities: ['AUDIO'],
      thinkingConfig: { thinkingBudget: 0 },
      outputAudioTranscription: {},
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      systemInstruction: {
        parts: [{ text: `You are Sarah, a calm and attentive technical interviewer. Speak conversationally and naturally, with a professional tone. Speak only the supplied interview prompt.` }],
      },
    },
    callbacks: {
      onopen: () => {},
      onmessage: (msg) => {
        runtimeMessages.push({
          receivedAt: Date.now(),
          topLevelKeys: Object.keys(msg || {}),
          serverContentKeys: Object.keys(msg?.serverContent || {}),
          partKeys: (msg?.serverContent?.modelTurn?.parts || []).map((part) => Object.keys(part || {})),
        })
        if (msg.serverContent?.outputTranscription?.text) transcript += msg.serverContent.outputTranscription.text
        for (const part of msg.serverContent?.modelTurn?.parts || []) {
          if (part.inlineData?.mimeType?.startsWith('audio/')) {
            const data = part.inlineData.data
            if (typeof data !== 'string') continue
            const bytes = Buffer.from(data, 'base64')
            const rate = Number(part.inlineData.mimeType.match(/(?:^|;)\s*rate=(\d+)/i)?.[1]) || null
            chunks.push({ mimeType: part.inlineData.mimeType, base64Length: data.length, bytes, rate })
          }
          if (part.text) transcript += part.text
        }
        if (msg.serverContent?.turnComplete && !settled) {
          settled = true
          clearTimeout(timeout)
          try { session?.close?.() } catch (_) {}
          resolveCapture({ durationMs: Date.now() - captureStartedAt })
        }
      },
      onerror: (error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        rejectCapture(error instanceof Error ? error : new Error(JSON.stringify(error)))
      },
      onclose: () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolveCapture({ durationMs: Date.now() - captureStartedAt, closedBeforeTurnComplete: true })
      },
    },
})
captureStartedAt = Date.now()
session.sendClientContent({
  turns: [{ role: 'user', parts: [{ text: `Speak this exact interviewer prompt aloud in a natural, conversational voice: "${spokenText}"` }] }],
  turnComplete: true,
})
const result = await captureDone

if (!chunks.length) throw new Error('Gemini completed without returning audio chunks; no audio sample was saved.')
const mimeTypes = [...new Set(chunks.map((chunk) => chunk.mimeType))]
const sampleRates = [...new Set(chunks.map((chunk) => chunk.rate))]
const raw = Buffer.concat(chunks.map((chunk) => chunk.bytes))
const channels = 1
const bitDepth = 16
const bytesPerFrame = channels * bitDepth / 8
const frames = Math.floor(raw.length / bytesPerFrame)
const sampleRate = sampleRates.length === 1 ? sampleRates[0] : null
const durationSeconds = sampleRate ? frames / sampleRate : null
const wav = Buffer.alloc(44 + raw.length)
wav.write('RIFF', 0)
wav.writeUInt32LE(36 + raw.length, 4)
wav.write('WAVE', 8)
wav.write('fmt ', 12)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(channels, 22)
wav.writeUInt32LE(sampleRate || 0, 24)
wav.writeUInt32LE((sampleRate || 0) * bytesPerFrame, 28)
wav.writeUInt16LE(bytesPerFrame, 32)
wav.writeUInt16LE(bitDepth, 34)
wav.write('data', 36)
wav.writeUInt32LE(raw.length, 40)
raw.copy(wav, 44)

await mkdir(outputDir, { recursive: true })
await writeFile(path.join(outputDir, `${captureName}.pcm`), raw)
if (sampleRate && raw.length % bytesPerFrame === 0) await writeFile(path.join(outputDir, `${captureName}.wav`), wav)
const manifest = {
  model,
  voiceName,
  captureProfileSeconds: captureProfile,
  prompt: spokenText,
  transcript: transcript.trim(),
  capture: result,
  runtimeMessages,
  transport: 'Gemini Live SDK callback -> base64 inlineData.data -> JSON WebSocket text frame in production gateway',
  audioMessageType: 'serverContent.modelTurn.parts[].inlineData',
  firstAudioMessageShape: runtimeMessages.find((message) => message.partKeys.length)?.partKeys?.[0] || null,
  mimeTypes,
  sampleRates,
  channels,
  channelsEvidence: 'Gemini Live raw audio protocol expectation; inlineData contains no channel metadata.',
  bitDepth,
  bitDepthEvidence: 'Gemini Live raw audio protocol expectation; inlineData contains no sample-width metadata.',
  byteOrder: 'little-endian',
  byteOrderEvidence: 'Gemini Live raw audio protocol expectation.',
  container: 'raw PCM in Gemini inlineData; no audio container headers observed',
  chunkCount: chunks.length,
  base64CharactersByChunk: chunks.map(({ base64Length }) => base64Length),
  bytesByChunk: chunks.map(({ bytes }) => bytes.length),
  bytesTotal: raw.length,
  completeFrames: frames,
  trailingBytes: raw.length % bytesPerFrame,
  estimatedDurationSeconds: durationSeconds,
  sha256: createHash('sha256').update(raw).digest('hex'),
  humanListening: { status: 'not recorded; requires a listener on normal headphones', tests: ['10-second', '30-second', '60-second', 'contextual interview'] },
  voiceQualityScore: null,
  generatedAt: new Date().toISOString(),
}
await writeFile(path.join(outputDir, `${captureName}.json`), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ outputDir, captureName, model, voiceName, mimeTypes, sampleRates, chunkCount: chunks.length, bytes: raw.length, frames, durationSeconds, sha256: manifest.sha256 }, null, 2))

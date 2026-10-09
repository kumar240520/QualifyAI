import { GoogleGenAI } from '@google/genai'
import { TTSProvider } from './TTSProvider.js'
import { config } from '../../../config/env.js'
import { cleanTextForSpeech, segmentSpeech } from '../speechSegmenter.js'

/**
 * Enterprise Google Gemini Live Real-Time Native Audio Provider
 * Streams 24kHz PCM16 audio with expressive, warm human recruiter tones.
 */
export class GeminiLiveTTSProvider extends TTSProvider {
  constructor() {
    super('gemini_live')
    this.ai = null
    this.modelCandidate = 'models/gemini-2.5-flash-native-audio-latest'
  }

  async initialize() {
    if (!config.gemini?.apiKey) {
      console.warn('[GeminiLiveTTSProvider] GEMINI_API_KEY is not configured.')
      this.initialized = false
      return
    }
    this.ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })
    this.initialized = true
  }

  async isAvailable() {
    return Boolean(this.initialized && this.ai)
  }

  /**
   * Synthesizes text by establishing an ephemeral live connection turn
   * and streaming 24kHz PCM16 chunks through onChunk.
   */
  async synthesize({ text, voiceProfile, onChunk, onTextDelta, signal }) {
    if (!this.initialized || !this.ai) {
      throw new Error('GeminiLiveTTSProvider is not initialized')
    }

    const cleanedText = cleanTextForSpeech(text)
    if (!cleanedText) {
      return { fullTranscript: '', totalChunks: 0, durationMs: 0 }
    }

    const voiceName = voiceProfile?.geminiVoice || 'Aoede'
    const interviewerName = voiceProfile?.interviewerName || 'Sarah'
    const model = voiceProfile?.geminiModel || this.modelCandidate

    const startTime = Date.now()
    let chunkCount = 0
    let fullTranscript = ''

    const systemInstruction = `You are ${interviewerName}, a warm, highly professional senior technical interviewer at QualifyAI. Your vocal delivery must sound authentically human, welcoming, engaging, and articulate. Speak at an unhurried, relaxed pace with a warm, grounded pitch and natural conversational melody. Avoid fast speech, high-pitched tones, or metallic robotic delivery. Speak with comfortable pauses between clauses and warm, genuine inflection. Speak only the exact question or feedback provided. Never include internal thoughts, planning notes, or meta tags.`

    const segments = segmentSpeech(cleanedText)
    const structuredText = segments.join('\n\n')

    const promptText = segments.length > 1
      ? `Deliver the following interview message aloud to the candidate.
Speak at a relaxed, measured pace with a warm, grounded pitch (do not rush or use a high-pitched, metallic, or flat robotic tone).
Maintain consistent vocal warmth, natural conversational cadence, and engaging melody throughout, especially on the final sentence.
Delivery instructions:
- Speak slightly slower, at an unhurried, thoughtful tempo.
- Pause naturally between sentences as a thoughtful human interviewer does.
- Maintain full pitch variation, warm resonance, and vocal energy from the opening words through to the very last word.
- Deliver the ENTIRE message completely from start to finish without pausing indefinitely, stopping midway, or skipping any sentences.
- Do not rush or flatten your intonation on the final sentence.
- If the final sentence is a question, ask it with curious, inviting cadence.
- Do not add any preamble, meta notes, or commentary.

Message to deliver:
${structuredText}`
      : `Speak the following message aloud directly to the candidate at a calm, unhurried pace with a warm, grounded pitch and conversational inflection (avoid rushed or high-pitched delivery): "${cleanedText}". Deliver the entire message completely without stopping midway. Do NOT add any extra thoughts, preambles, or meta labels.`

    return new Promise((resolve, reject) => {
      let settled = false
      let session = null

      // Scaled overall timeout (at least 60s, scales with text length)
      const maxDurationMs = Math.max(60000, Math.ceil(cleanedText.length * 200))
      const hardTimeoutId = setTimeout(() => {
        if (!settled) {
          settled = true
          cleanupTimers()
          try { session?.close?.() } catch (_) {}
          reject(new Error(`Gemini Live TTS synthesis exceeded max duration of ${maxDurationMs}ms`))
        }
      }, maxDurationMs)

      // Sliding inactivity watchdog: resets on every audio chunk or text token received
      let inactivityTimer = null
      const resetInactivityWatchdog = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer)
        inactivityTimer = setTimeout(() => {
          if (!settled) {
            settled = true
            cleanupTimers()
            try { session?.close?.() } catch (_) {}
            if (chunkCount > 0) {
              resolve({
                fullTranscript: fullTranscript.trim() || cleanedText,
                totalChunks: chunkCount,
                durationMs: Date.now() - startTime,
              })
            } else {
              reject(new Error('Gemini Live TTS stream stalled (no audio chunks received for 45s)'))
            }
          }
        }, 45000)
      }
      resetInactivityWatchdog()

      const cleanupTimers = () => {
        clearTimeout(hardTimeoutId)
        if (inactivityTimer) {
          clearTimeout(inactivityTimer)
          inactivityTimer = null
        }
      }

      if (signal) {
        signal.addEventListener('abort', () => {
          if (!settled) {
            settled = true
            cleanupTimers()
            try { session?.close?.() } catch (_) {}
            reject(new Error('Gemini Live TTS synthesis aborted'))
          }
        })
      }

      this.ai.live.connect({
        model,
        config: {
          responseModalities: ['AUDIO'],
          thinkingConfig: { thinkingBudget: 0 },
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
        },
        callbacks: {
          onopen: () => {
            // Handshake open
          },
          onmessage: (msg) => {
            if (settled) return
            resetInactivityWatchdog()

            // Collect transcript if present and stream text deltas
            if (msg.serverContent?.outputTranscription?.text) {
              const deltaText = msg.serverContent.outputTranscription.text
              fullTranscript += deltaText
              if (typeof onTextDelta === 'function') {
                onTextDelta(deltaText)
              }
            }

            // Stream PCM audio chunks
            const parts = msg.serverContent?.modelTurn?.parts || []
            for (const part of parts) {
              if (part.thought) continue

              if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
                const rawMime = part.inlineData.mimeType
                const rateMatch = rawMime.match(/(?:^|;)\s*rate=(\d+)/i)
                const sampleRate = Number(rateMatch?.[1]) || 24000
                const mimeType = rawMime.includes('rate=') ? rawMime : `audio/pcm;rate=${sampleRate}`
                chunkCount++
                if (typeof onChunk === 'function') {
                  onChunk({
                    data: part.inlineData.data,
                    mimeType,
                    sampleRate,
                    channels: 1,
                    bitDepth: 16,
                    byteOrder: 'little-endian',
                    chunkIndex: chunkCount,
                  })
                }
              }

              if (part.text) {
                fullTranscript += part.text
                if (typeof onTextDelta === 'function') {
                  onTextDelta(part.text)
                }
              }
            }

            if (msg.serverContent?.turnComplete) {
              settled = true
              cleanupTimers()
              try { session?.close?.() } catch (_) {}
              resolve({
                fullTranscript: fullTranscript.trim() || cleanedText,
                totalChunks: chunkCount,
                durationMs: Date.now() - startTime,
              })
            }
          },
          onerror: (err) => {
            if (!settled) {
              settled = true
              cleanupTimers()
              try { session?.close?.() } catch (_) {}
              if (chunkCount > 0) {
                resolve({
                  fullTranscript: fullTranscript.trim() || cleanedText,
                  totalChunks: chunkCount,
                  durationMs: Date.now() - startTime,
                })
              } else {
                reject(err)
              }
            }
          },
          onclose: () => {
            if (!settled) {
              settled = true
              cleanupTimers()
              resolve({
                fullTranscript: fullTranscript.trim() || cleanedText,
                totalChunks: chunkCount,
                durationMs: Date.now() - startTime,
              })
            }
          },
        },
      }).then((s) => {
        session = s
        try {
          session.sendClientContent({
            turns: [
              {
                role: 'user',
                parts: [{ text: promptText }],
              },
            ],
            turnComplete: true,
          })
        } catch (err) {
          if (!settled) {
            settled = true
            cleanupTimers()
            reject(err)
          }
        }
      }).catch((err) => {
        if (!settled) {
          settled = true
          cleanupTimers()
          reject(err)
        }
      })
    })
  }
}

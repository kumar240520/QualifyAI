import { GoogleGenAI } from '@google/genai'
import { TTSProvider } from './TTSProvider.js'
import { config } from '../../../config/env.js'
import { cleanTextForSpeech } from '../speechSegmenter.js'

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
  async synthesize({ text, voiceProfile, onChunk, signal }) {
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

    const systemInstruction = `You are ${interviewerName}, a warm, highly professional senior technical interviewer at QualifyAI. Your speech must sound authentically human, welcoming, engaging, and articulate. Speak with natural conversational melody, varied cadence, and appropriate vocal inflection. Speak only the exact question or feedback provided. Never include internal thoughts, planning notes, or meta tags.`

    const promptText = `Speak the following message aloud to the candidate with natural human recruiter warmth and cadence: "${cleanedText}"`

    return new Promise((resolve, reject) => {
      let settled = false
      let session = null

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true
          try { session?.close?.() } catch (_) {}
          reject(new Error(`Gemini Live TTS synthesis timed out after 12000ms`))
        }
      }, 12000)

      if (signal) {
        signal.addEventListener('abort', () => {
          if (!settled) {
            settled = true
            clearTimeout(timeoutId)
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
                clearTimeout(timeoutId)
                reject(err)
              }
            }
          },
          onmessage: (msg) => {
            if (settled) return

            // Collect transcript if present
            if (msg.serverContent?.outputTranscription?.text) {
              fullTranscript += msg.serverContent.outputTranscription.text
            }

            // Stream PCM audio chunks
            const parts = msg.serverContent?.modelTurn?.parts || []
            for (const part of parts) {
              if (part.thought) continue

              if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
                chunkCount++
                if (typeof onChunk === 'function') {
                  onChunk({
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType,
                    sampleRate: 24000,
                    channels: 1,
                    bitDepth: 16,
                    chunkIndex: chunkCount,
                  })
                }
              }

              if (part.text) {
                fullTranscript += part.text
              }
            }

            if (msg.serverContent?.turnComplete) {
              settled = true
              clearTimeout(timeoutId)
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
              clearTimeout(timeoutId)
              try { session?.close?.() } catch (_) {}
              reject(err)
            }
          },
          onclose: () => {
            if (!settled) {
              settled = true
              clearTimeout(timeoutId)
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
      }).catch((err) => {
        if (!settled) {
          settled = true
          clearTimeout(timeoutId)
          reject(err)
        }
      })
    })
  }
}

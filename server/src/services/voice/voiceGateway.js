import { WebSocketServer } from 'ws'
import { GoogleGenAI } from '@google/genai'
import { getServiceSupabaseClient } from '../../integrations/supabaseClient.js'
import { interviewEngineService } from '../interview/interviewEngineService.js'
import { config } from '../../config/env.js'
import { DEFAULT_VOICE_PROFILE, getVoiceProfile } from './voiceProfile.js'
import { cleanTextForSpeech, segmentSpeech } from './speechSegmenter.js'
import { ttsManager } from './providers/TTSManager.js'

let _gatewayInstance = null

export function validatePcm16Chunk(chunk, { allowPartialFrame = false } = {}) {
  const mimeType = String(chunk?.mimeType || '')
  if (!/^audio\/pcm(?:;|$)/i.test(mimeType)) throw new Error(`Unsupported TTS MIME type: ${mimeType || '(missing)'}`)
  const rateInMime = mimeType.match(/(?:^|;)\s*rate=(\d+)/i)
  const sampleRate = Number(rateInMime ? rateInMime[1] : chunk.sampleRate)
  const channels = Number(chunk.channels)
  const bitDepth = Number(chunk.bitDepth)
  const byteOrder = String(chunk.byteOrder || '').toLowerCase()
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 96000) throw new Error(`Invalid TTS sample rate: ${sampleRate}`)
  if (![1, 2].includes(channels)) throw new Error(`Unsupported TTS channel count: ${channels}`)
  if (bitDepth !== 16) throw new Error(`Unsupported TTS bit depth: ${bitDepth}`)
  if (!['little-endian', 'le'].includes(byteOrder)) throw new Error(`Unsupported PCM byte order: ${byteOrder || '(missing)'}`)
  if (typeof chunk.data !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(chunk.data)) throw new Error('TTS audio is not valid base64 PCM data.')
  const bytes = Buffer.from(chunk.data, 'base64')
  const bytesPerFrame = 2 * channels
  if (!bytes.length || (!allowPartialFrame && bytes.length % bytesPerFrame !== 0)) throw new Error('TTS PCM data is not frame aligned.')
  const completeFrames = Math.floor(bytes.length / bytesPerFrame)
  return {
    ...chunk,
    mimeType,
    sampleRate,
    channels,
    bitDepth,
    byteOrder: 'little-endian',
    diagnostics: {
      bytes: bytes.length,
      completeFrames,
      trailingBytes: bytes.length % bytesPerFrame,
      estimatedDurationSeconds: completeFrames / sampleRate,
    },
  }
}

export function getVoiceGateway() {
  return _gatewayInstance
}

export function isThoughtOrMetaPlanning(text) {
  if (!text || typeof text !== 'string') return false
  const t = text.trim()
  if (!t) return false

  const patterns = [
    /^(I'm|I am) ready to (begin|start)/i,
    /^(I|I've|I have) (finalized|decided|planned|prepared|settled on)/i,
    /^I plan to (extend|transition|ask|start|begin|warmly)/i,
    /^The focus is on a (system design|scenario|warm welcome)/i,
    /^The goal is to set a solid foundation/i,
    /^I aim for a (professional|conversational)/i,
    /^I will (now )?(extend|begin|transition|start|provide|deliver a warm)/i,
    /^Let's (begin|start) with an introductory question\./i,
    /in a professional tone\. The goal is to/i,
    /conversational delivery\./i,
    /set a solid foundation for a detailed discussion/i,
    /^Thinking:/i,
    /^Thought:/i,
    /^Planning:/i,
    /^\*thinking\*/i,
    /^\[Thinking\]/i,
    /^\[System Note/i,
    /^Evaluator Note:/i,
  ]

  return patterns.some((p) => p.test(t))
}

export function isNudgeText(text) {
  if (!text || typeof text !== 'string') return false
  const t = text.trim()
  const nudgePatterns = [
    /take your time/i,
    /right here whenever/i,
    /right here when you/i,
    /no rush/i,
    /answer (me )?anytime/i,
    /you can answer/i,
    /whenever you('re| are) ready/i,
    /feel free to share/i,
    /feel free to walk me/i,
    /let me know if you('d| would) like to move/i,
    /take all the time you need/i,
    /i am right here/i,
    /i'm right here/i,
    /i'm listening/i,
    /i am listening/i,
  ]
  return nudgePatterns.some((p) => p.test(t))
}

export function isTerminationText(text) {
  if (!text || typeof text !== 'string') return false
  const t = text.trim()
  const patterns = [
    /we will conclude the assessment/i,
    /conclude the assessment session/i,
    /not receiving your responses/i,
    /aren't receiving your responses/i,
    /conclude the interview/i,
    /wrap up the assessment/i,
  ]
  return patterns.some((p) => p.test(t))
}

export function extractQuestionText(text) {
  if (!text || typeof text !== 'string') return ''
  const clean = text.replace(/\*\*.*?\*\*/g, '').replace(/^[A-Z\s]+:\s*/, '').trim()
  if (!clean) return ''

  const sentences = clean.split(/(?<=[.?!])\s+/).filter(Boolean)
  const questionSentences = sentences.filter((s) => {
    const st = s.trim()
    return (
      st.endsWith('?') ||
      /^(Could you|Can you|How would you|How do you|What is|What are|Why would|Please explain|Walk me through|Tell me about|Describe|Given that)/i.test(st)
    )
  })

  if (questionSentences.length > 0) {
    return questionSentences.join(' ').trim()
  }

  return sentences.length > 1 ? sentences[sentences.length - 1].trim() : clean
}

/**
 * Enterprise Google Gemini Live Realtime Voice Gateway
 * Bridges Candidate Web Audio API with Gemini Live Native Audio Sessions.
 */
export class VoiceGateway {
  constructor(server) {
    _gatewayInstance = this
    this.wss = new WebSocketServer({ noServer: true })
    this.activeSessions = new Map() // ws -> sessionContext

    // Attach upgrade handler to HTTP server
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url, `http://${request.headers.host}`)
      if (url.pathname === '/ws/voice-interview') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request)
        })
      }
    })

    this.wss.on('connection', (ws, request) => {
      this._handleConnection(ws, request)
    })

    console.log('🎙️ QualifyAI Real-Time Voice Gateway initialized on /ws/voice-interview')
  }

  /**
   * Health probe helper
   */
  isReady() {
    return {
      ready: Boolean(this.wss),
      activeSessions: this.activeSessions?.size || 0,
    }
  }

  /**
   * Broadcast an event packet to all active WebSocket clients belonging to a session or interview
   */
  broadcastToSession(sessionIdOrInterviewId, packet) {
    if (!sessionIdOrInterviewId || !packet) return
    const json = typeof packet === 'string' ? packet : JSON.stringify(packet)

    for (const [ws, ctx] of this.activeSessions.entries()) {
      if (
        (ctx.sessionId === sessionIdOrInterviewId || ctx.interviewId === sessionIdOrInterviewId) &&
        ws.readyState === 1
      ) {
        if (packet?.type === 'ai_question') {
          ctx.currentQuestionSequence = packet.question?.sequence ?? packet.sequence
          ctx.activeQuestion = packet.question
        }
        try {
          ws.send(json)
        } catch (err) {
          console.warn('[VoiceGateway] broadcastToSession send error:', err.message)
        }
      }
    }
  }

  /**
   * Deliver spoken audio turn directly to candidate for a given session
   */
  async speakPromptToSession(sessionIdOrInterviewId, textToSpeak, force = false) {
    if (!textToSpeak) return

    for (const [ws, ctx] of this.activeSessions.entries()) {
      if (
        (ctx.sessionId === sessionIdOrInterviewId || ctx.interviewId === sessionIdOrInterviewId) &&
        ws.readyState === 1
      ) {
        const cleanPrompt = cleanTextForSpeech(textToSpeak)
        if (!cleanPrompt) continue

        // Deduplication guard: ignore identical prompts delivered within 8 seconds unless forced (e.g. repeat request)
        if (!force && ctx.lastSpokenText === cleanPrompt && (Date.now() - (ctx.lastSpokenTime || 0)) < 8000) {
          console.log(`[VoiceGateway] Deduplicating identical spoken prompt within 8s for ${ctx.candidateName}: "${cleanPrompt.substring(0, 40)}..."`)
          return
        }
        ctx.lastSpokenText = cleanPrompt
        ctx.lastSpokenTime = Date.now()

        console.log(`[VoiceGateway] Spoken prompt delivery to ${ctx.candidateName}: "${cleanPrompt.substring(0, 50)}..."`)
        ctx.hasEmittedTurnForCurrentInput = false
        ctx.fallbackEmitted = false
        ctx.currentAITranscript = ''
        ctx.currentSpokenPrompt = cleanPrompt
        ctx.audioTurnSequence = (ctx.audioTurnSequence || 0) + 1
        ctx.audioTurnId = `${ctx.sessionId}-${ctx.audioTurnSequence}`
        ctx.currentAudioChunkIndex = 0
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'ai_audio_started', sessionId: ctx.sessionId, audioTurnId: ctx.audioTurnId }))
        }

        const interviewerName = ctx.voiceProfile?.interviewerName || 'Sarah'
        const segments = segmentSpeech(cleanPrompt)
        const structuredText = segments.join('\n\n')

        const promptInstruction = segments.length > 1
          ? `Deliver the following interview message aloud to candidate ${ctx.candidateName}.
Speak at a relaxed, measured pace with a warm, grounded pitch (do not rush or use a high-pitched, metallic, or flat robotic tone).
Maintain consistent vocal warmth, natural conversational cadence, and engaging melody throughout, especially on the final sentence.
Delivery instructions:
- Speak slightly slower, at an unhurried, thoughtful tempo.
- Pause naturally between sentences as a thoughtful human interviewer does.
- Maintain full pitch variation, warm resonance, and vocal energy from the opening words through to the very last word.
- Do not rush or flatten your intonation on the final sentence.
- If the final sentence is a question, ask it with curious, inviting cadence.
- Do not add any preamble, meta text, or commentary.

Message to speak:
${structuredText}`
          : `Speak the following message aloud directly to candidate ${ctx.candidateName} at a calm, unhurried pace with a warm, grounded pitch and conversational inflection (avoid rushed or high-pitched delivery): "${cleanPrompt}". Do NOT add any extra thoughts, preambles, or meta labels.`

        // If geminiSession is not connected (e.g. idle timeout disconnected it), quickly reconnect
        if (!ctx.geminiSession && !ctx.isConnectingGemini) {
          try {
            await this._initGeminiLiveSession(ctx, ws)
          } catch (_) {}
        }

        if (ctx.geminiSession?.sendClientContent) {
          if (ctx.turnWatchdog) clearTimeout(ctx.turnWatchdog)
          // 12-second watchdog: gives Gemini Live ample time to stream natural 24kHz audio
          ctx.turnWatchdog = setTimeout(async () => {
            if (!ctx.hasEmittedTurnForCurrentInput && ws.readyState === 1) {
              console.warn(`[VoiceGateway] Gemini Live question speech timeout (12s). Attempting secondary voice synthesis...`)
              await this._deliverFallbackAudioOrTurn(ctx, cleanPrompt, ws)
            }
          }, 12000)

          try {
            ctx.geminiSession.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{ text: promptInstruction }],
                },
              ],
              turnComplete: true,
            })
          } catch (err) {
            console.warn('[VoiceGateway] sendClientContent error in speakPromptToSession:', err.message)
            if (ctx.turnWatchdog) clearTimeout(ctx.turnWatchdog)
            await this._deliverFallbackAudioOrTurn(ctx, cleanPrompt, ws)
          }
        } else {
          // Gemini Live unavailable -> secondary TTS or resilient fallback turn
          await this._deliverFallbackAudioOrTurn(ctx, cleanPrompt, ws)
        }
      }
    }
  }

  /**
   * Resilient Fallback: Delivers local 24kHz audio (Kokoro) or client turn packet if all else fails
   */
  async _deliverFallbackAudioOrTurn(ctx, textToSpeak, ws) {
    if (!ws || ws.readyState !== 1) return
    const cleanPrompt = cleanTextForSpeech(textToSpeak)
    if (!cleanPrompt) return
    // Claim fallback before synthesis starts so a late Gemini packet cannot overlap it.
    ctx.fallbackEmitted = true
    if ((ctx.currentAudioChunkIndex || 0) > 0) {
      ctx.audioTurnSequence = (ctx.audioTurnSequence || 0) + 1
      ctx.audioTurnId = `${ctx.sessionId}-${ctx.audioTurnSequence}-recovery`
      ctx.currentAudioChunkIndex = 0
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ai_audio_started', sessionId: ctx.sessionId, audioTurnId: ctx.audioTurnId }))
    }
    const audioTurnId = ctx.audioTurnId

    try {
      console.log(`[VoiceGateway] Attempting secondary TTS fallback for "${cleanPrompt.substring(0, 40)}..."`)
      let streamedChunks = 0
      ctx.isAiSpeaking = true
      ctx.hasEmittedTurnForCurrentInput = true

      await ttsManager.synthesize({
        text: cleanPrompt,
        voiceProfile: ctx.voiceProfile || DEFAULT_VOICE_PROFILE,
        preferredProvider: 'kokoro_local',
        timeoutMs: 12000,
        onChunk: (chunk) => {
          streamedChunks++
          if (ws.readyState === 1) {
            try {
              const validated = validatePcm16Chunk(chunk)
              ws.send(JSON.stringify({
                type: 'ai_audio_chunk',
                data: validated.data,
                mimeType: validated.mimeType,
                audioTurnId,
                chunkIndex: chunk.chunkIndex || streamedChunks,
                audioSequence: chunk.chunkIndex || streamedChunks,
                sampleRate: validated.sampleRate,
                channels: validated.channels,
                bitDepth: validated.bitDepth,
                byteOrder: validated.byteOrder,
                diagnostics: validated.diagnostics,
                timestamp: Date.now(),
              }))
            } catch (formatError) {
              streamedChunks--
              console.warn('[VoiceGateway] Dropping invalid fallback PCM chunk:', formatError.message)
            }
          }
        },
      })

      if (streamedChunks > 0 && ws.readyState === 1) {
        ctx.isAiSpeaking = false
        ws.send(
          JSON.stringify({
            type: 'ai_transcript_complete',
            sessionId: ctx.sessionId,
            audioTurnId,
            eventId: `${ctx.sessionId}-fallback-voice-${Date.now()}`,
            fullTranscript: cleanPrompt,
            questionText: extractQuestionText(cleanPrompt) || cleanPrompt,
            isNudge: isNudgeText(cleanPrompt),
            isTermination: isTerminationText(cleanPrompt),
            questionSequence: ctx.currentQuestionSequence || 0,
            isFallback: false,
          })
        )
        ws.send(JSON.stringify({ type: 'ai_audio_stream_complete', sessionId: ctx.sessionId, audioTurnId, isFallback: false }))
        return
      }
    } catch (fallbackErr) {
      console.warn('[VoiceGateway] Kokoro/secondary TTS fallback failed:', fallbackErr.message)
    }

    // Tertiary: send browser SpeechSynthesis turn fallback
    await this._generateAIFallbackTurn(
      ctx,
      cleanPrompt,
      ws,
      getServiceSupabaseClient(),
      { id: ctx.interviewId },
      { full_name: ctx.candidateName },
      ctx.job || { title: 'Software Engineer' }
    )
  }

  /**
   * Resilient AI Turn Generator Fallback: delivers immediate fallback turn so candidate never hears silence.
   */
  async _generateAIFallbackTurn(ctx, textToSpeak, ws, supabase, interview, candidate, job) {
    if (!ws || ws.readyState !== 1) return
    ctx.hasEmittedTurnForCurrentInput = true
    ctx.fallbackEmitted = true

    const cleanedCompleted = (textToSpeak || '')
      .replace(/\*\*.*?\*\*/g, '')
      .replace(/^[#*]+\s*/gm, '')
      .replace(/^[A-Z\s]+:\s*/, '')
      .trim()

    if (!cleanedCompleted) return

    const isNudge = isNudgeText(cleanedCompleted)
    const isTermination = isTerminationText(cleanedCompleted)
    const questionText = isNudge || isTermination ? '' : extractQuestionText(cleanedCompleted)

    ws.send(
      JSON.stringify({
        type: 'ai_transcript_complete',
        sessionId: ctx.sessionId,
        eventId: `${ctx.sessionId}-fallback-${Date.now()}`,
        fullTranscript: cleanedCompleted,
        questionText: questionText || cleanedCompleted,
        isNudge,
        isTermination,
        isFallback: true,
        audioTurnId: ctx.audioTurnId,
        questionSequence: ctx.currentQuestionSequence || 0,
      })
    )
    ws.send(JSON.stringify({ type: 'ai_audio_stream_complete', sessionId: ctx.sessionId, audioTurnId: ctx.audioTurnId, isFallback: true, audioUnavailable: true }))
    console.log(`[VoiceGateway] Immediate fallback turn dispatched to ${candidate?.full_name || ctx.candidateName}: "${cleanedCompleted.substring(0, 60)}..."`)
  }

  /**
   * Handle incoming candidate WebSocket connection
   */
  async _handleConnection(ws, request) {
    const url = new URL(request.url, `http://${request.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invitation token is required.' }))
      ws.close(1008, 'Token missing')
      return
    }

    const supabase = getServiceSupabaseClient()

    try {
      // 1. Resolve invitation, job with requirements, and candidate
      const { data: invitation, error: invErr } = await supabase
        .from('invitations')
        .select('*, jobs(*, job_requirements(*)), candidates(*)')
        .eq('token', token)
        .single()

      if (invErr || !invitation) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid or non-existent invitation token.' }))
        ws.close(1008, 'Invalid token')
        return
      }

      if (invitation.status === 'COMPLETED' || invitation.status === 'CANCELLED' || invitation.status === 'TERMINATED') {
        ws.send(JSON.stringify({ type: 'error', message: 'This single-use assessment session has already been concluded. Re-access is terminated.' }))
        ws.close(1008, 'Session concluded')
        return
      }

      if (invitation.status === 'EXPIRED' || (invitation.expires_at && new Date(invitation.expires_at) < new Date())) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invitation link has expired.' }))
        ws.close(1008, 'Token expired')
        return
      }

      const job = invitation.jobs
      const candidate = invitation.candidates
      // The orchestrator owns session creation, duration, and the active question.
      const canonicalState = await interviewEngineService.startOrResumeSession({ token })
      const interview = canonicalState.interview
      const session = canonicalState.session

      // 5. Initialize active session context immediately
      const voiceProfile = DEFAULT_VOICE_PROFILE
      const sessionContext = {
        interviewId: interview.id,
        sessionId: session.id,
        token,
        geminiSession: null,
        candidateName: candidate.full_name,
        candidateTextBuffer: '',
        currentQuestionSequence: session.session_metadata?.current_question_sequence || 0,
        activeQuestion: session.session_metadata?.current_question || null,
        isAiSpeaking: false,
        preventAiInterruption: true, // Default: Prevent false interruption from background noise/speaker echo
        currentAudioChunkIndex: 0,
        audioTurnSequence: 0,
        audioTurnId: null,
        currentSpokenPrompt: null,
        job,
        voiceProfile,
      }
      this.activeSessions.set(ws, sessionContext)

      // 6. Handle Incoming WebSocket messages from Client
      ws.on('message', async (rawMessage) => {
        try {
          const packet = JSON.parse(rawMessage.toString())
          const ctx = this.activeSessions.get(ws)
          if (!ctx) return

          switch (packet.type) {
            case 'ai_audio_playback_complete': {
              if (packet.audioTurnId === ctx.audioTurnId) {
                ctx.lastPlaybackReport = packet.stats || null
                console.info('[VoiceGateway] Client playback complete', JSON.stringify({
                  sessionId: ctx.sessionId,
                  audioTurnId: packet.audioTurnId,
                  clientStats: packet.stats || null,
                }))
              }
              break
            }

            case 'set_prevent_interruption': {
              ctx.preventAiInterruption = Boolean(packet.enabled)
              console.log(`[VoiceGateway] Set preventAiInterruption = ${ctx.preventAiInterruption} for session ${ctx.sessionId}`)
              break
            }

            case 'audio_chunk': {
              // Candidate audio is transcribed in the browser and committed through the shared answer API.
              // Gemini Live is output-only so it cannot generate a competing question from raw audio.
              break
            }

            case 'candidate_interrupted': {
              // Candidate explicitly barged in (only honored if protection is disabled)
              if (ctx.preventAiInterruption !== false) {
                console.log('[VoiceGateway] Candidate interruption ignored (preventAiInterruption is active).')
                break
              }
              ctx.isAiSpeaking = false
              break
            }

            case 'repeat_question':
            case 'speak_question': {
              if (packet.text) {
                const textToSpeak = packet.text.trim()
                if (!textToSpeak) break
                const isForce = packet.type === 'repeat_question' || Boolean(packet.force)
                this.speakPromptToSession(ctx.sessionId, textToSpeak, isForce)
              }
              break
            }

            case 'candidate_transcript': {
              // Compatibility acknowledgement only. The REST answer pipeline is the single commit path.
              ws.send(JSON.stringify({ type: 'candidate_transcript_ack', questionId: packet.questionId, questionSequence: packet.questionSequence }))
              break
            }

            case 'trigger_nudge': {
              const nudgeIndex = packet.nudgeIndex || 1
              const nudgePrompt = nudgeIndex === 1
                ? `I am here, take your time. You can just tell me or submit when you are done.`
                : `Whenever you're ready, feel free to submit your solution, or we can move on to the next question.`

              this.speakPromptToSession(ctx.sessionId, nudgePrompt)
              break
            }

            case 'skip_unanswered_question': {
              // The canonical HTTP interview service owns unanswered transitions.
              break
            }

            case 'terminate_unanswered': {
              const termPrompt = `We haven't received a response, ${candidate.full_name}, so we'll conclude the assessment here. Thank you for your time and participation.`
              this.speakPromptToSession(ctx.sessionId, termPrompt)
              break
            }

            case 'candidate_entered_room':
            case 'start_session': {
              if (!ctx.hasGreeted) {
                ctx.hasGreeted = true
                const activeQuestion = session.session_metadata?.current_question
                if (activeQuestion?.spoken_lead_in || activeQuestion?.question_text) {
                  console.log(`[VoiceGateway] Candidate ${candidate.full_name} entered room. Speaking canonical question.`)
                  this.speakPromptToSession(ctx.sessionId, activeQuestion.spoken_lead_in || activeQuestion.question_text)
                }
              }
              break
            }

            case 'ping': {
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
              break
            }

            default:
              break
          }
        } catch (msgErr) {
          console.error('Error handling voice packet:', msgErr)
        }
      })

      ws.on('close', () => {
        sessionContext.isClosed = true
        if (sessionContext.turnWatchdog) {
          clearTimeout(sessionContext.turnWatchdog)
          sessionContext.turnWatchdog = null
        }
        if (sessionContext.geminiSession) {
          try {
            sessionContext.geminiSession.close?.()
          } catch (_) {}
          sessionContext.geminiSession = null
        }
        this.activeSessions.delete(ws)
      })

      // 7. Connect to Google Gemini Live Native Audio Session (with multi-model fallback)
      await this._initGeminiLiveSession(sessionContext, ws)
    } catch (connErr) {
      console.error('[VoiceGateway] Connection handler fatal error:', connErr)
      try {
        ws.send(JSON.stringify({ type: 'error', message: connErr.message }))
        ws.close(1011, 'Internal initialization error')
      } catch (_) {}
    }
  }

  /**
   * Connect or reconnect Gemini Live session for an active session context
   */
  async _initGeminiLiveSession(sessionContext, ws) {
    if (sessionContext.isConnectingGemini || sessionContext.geminiSession || sessionContext.isClosed) return
    sessionContext.isConnectingGemini = true

    try {
      const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })
      const candidateName = sessionContext.candidateName || 'Candidate'
      const voiceProfile = sessionContext.voiceProfile || DEFAULT_VOICE_PROFILE
      const interviewerName = voiceProfile.interviewerName || 'Sarah'

      const systemPrompt = `You are ${interviewerName}, a warm, highly professional senior technical interviewer at QualifyAI. Your vocal delivery must sound authentically human, welcoming, engaging, and articulate. Speak at an unhurried, relaxed pace with a warm, grounded pitch and natural conversational melody. Avoid fast speech, high-pitched tones, or metallic robotic delivery. Speak with comfortable pauses between clauses and warm, genuine inflection. Speak only the exact text in explicit speak requests to candidate ${candidateName}. Do not add unprompted questions, acknowledgements, greetings, or follow-ups. Do not react to background microphone audio. Never output internal thoughts, chain-of-thought tokens, or meta text.`

      let geminiSession = null
      const liveModels = [
        voiceProfile.geminiModel || 'models/gemini-2.5-flash-native-audio-latest',
        ...(voiceProfile.fallbackModels || []),
        'gemini-2.5-flash-native-audio-latest',
      ]
      const uniqueModels = [...new Set(liveModels)]

      for (const modelCandidate of uniqueModels) {
        try {
          console.log(`[VoiceGateway] Connecting to Gemini Live with model: ${modelCandidate}, voice: ${voiceProfile.geminiVoice}`)
          geminiSession = await ai.live.connect({
            model: modelCandidate,
            config: {
              responseModalities: ['AUDIO'],
              thinkingConfig: { thinkingBudget: 0 },
              outputAudioTranscription: {},
              inputAudioTranscription: {},
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: voiceProfile.geminiVoice || 'Aoede',
                  },
                },
              },
              systemInstruction: {
                parts: [{ text: systemPrompt }],
              },
            },
            callbacks: {
              onopen: () => {
                console.log(`[VoiceGateway] Gemini Live session open (${modelCandidate})`)
              },
              onmessage: async (msg) => {
                if (sessionContext.fallbackEmitted) return

                // 1. Text transcript delta from output audio transcription
                if (msg.serverContent?.outputTranscription?.text) {
                  const textChunk = msg.serverContent.outputTranscription.text
                  if (!isThoughtOrMetaPlanning(textChunk)) {
                    const cleaned = textChunk.replace(/\*\*.*?\*\*/g, '').replace(/^[A-Z\s]+:\s*/, '')
                    sessionContext.currentAITranscript = `${sessionContext.currentAITranscript || ''}${cleaned}`
                    if (ws.readyState === 1) {
                      ws.send(
                        JSON.stringify({
                          type: 'ai_transcript_delta',
                          text: cleaned,
                        })
                      )
                    }
                  }
                }

                // 2. Audio stream chunk & text parts
                const parts = msg.serverContent?.modelTurn?.parts || []
                for (const part of parts) {
                  if (part.thought) continue

                  if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
                    sessionContext.isAiSpeaking = true
                    sessionContext.hasEmittedTurnForCurrentInput = true
                    if (sessionContext.turnWatchdog) {
                      clearTimeout(sessionContext.turnWatchdog)
                      sessionContext.turnWatchdog = null
                    }
                    sessionContext.currentAudioChunkIndex = (sessionContext.currentAudioChunkIndex || 0) + 1
                    const mimeType = part.inlineData.mimeType
                    const rateMatch = mimeType.match(/(?:^|;)\s*rate=(\d+)/i)
                    const declaredRate = rateMatch ? Number(rateMatch[1]) : null
                    if (ws.readyState === 1) {
                      try {
                        const validated = validatePcm16Chunk({
                          data: part.inlineData.data,
                          mimeType,
                          sampleRate: declaredRate,
                          channels: 1,
                          bitDepth: 16,
                          byteOrder: 'little-endian',
                        }, { allowPartialFrame: true })
                        if (process.env.NODE_ENV !== 'production' && sessionContext.currentAudioChunkIndex <= 5) {
                          console.info('[VoiceGateway][Gemini audio capture]', JSON.stringify({
                            audioTurnId: sessionContext.audioTurnId,
                            audioSequence: sessionContext.currentAudioChunkIndex,
                            transport: 'Gemini Live SDK callback -> base64 inlineData.data -> JSON WebSocket text frame',
                            messageType: 'serverContent.modelTurn.parts[].inlineData',
                            mimeType: validated.mimeType,
                            base64Characters: part.inlineData.data?.length || 0,
                            ...validated.diagnostics,
                            format: {
                              sampleRate: validated.sampleRate,
                              sampleRateEvidence: rateMatch ? 'inlineData MIME rate parameter' : 'not declared; chunk rejected',
                              channels: validated.channels,
                              channelsEvidence: 'Gemini Live protocol expectation; not carried in inlineData metadata',
                              bitDepth: validated.bitDepth,
                              bitDepthEvidence: 'Gemini Live protocol expectation; not carried in inlineData metadata',
                              byteOrder: validated.byteOrder,
                              byteOrderEvidence: 'Gemini Live protocol expectation; not carried in inlineData metadata',
                            },
                          }))
                        }
                        ws.send(JSON.stringify({
                          type: 'ai_audio_chunk',
                          data: validated.data,
                          mimeType: validated.mimeType,
                          audioTurnId: sessionContext.audioTurnId,
                          chunkIndex: sessionContext.currentAudioChunkIndex,
                          audioSequence: sessionContext.currentAudioChunkIndex,
                          sampleRate: validated.sampleRate,
                          channels: validated.channels,
                          bitDepth: validated.bitDepth,
                          byteOrder: validated.byteOrder,
                          diagnostics: validated.diagnostics,
                          formatEvidence: {
                            sampleRate: rateMatch ? 'inlineData MIME' : 'unknown',
                            channels: 'Gemini Live protocol expectation; not inlineData metadata',
                            bitDepth: 'Gemini Live protocol expectation; not inlineData metadata',
                            byteOrder: 'Gemini Live protocol expectation; not inlineData metadata',
                          },
                          timestamp: Date.now(),
                        }))
                      } catch (formatError) {
                        console.warn('[VoiceGateway] Dropping invalid Gemini PCM chunk:', formatError.message)
                      }
                    }
                  }

                  if (part.text && !isThoughtOrMetaPlanning(part.text)) {
                    const cleanedText = part.text.replace(/\*\*.*?\*\*/g, '').replace(/^[A-Z\s]+:\s*/, '')
                    if (cleanedText && ws.readyState === 1) {
                      sessionContext.currentAITranscript = `${sessionContext.currentAITranscript || ''}${cleanedText}`
                      ws.send(
                        JSON.stringify({
                          type: 'ai_transcript_delta',
                          text: cleanedText,
                        })
                      )
                    }
                  }
                }

                // 3. Interruption Notice from Gemini Live
                if (msg.serverContent?.interrupted) {
                  if (sessionContext.preventAiInterruption !== false) {
                    console.log(`[VoiceGateway] Gemini Live server-side interruption suppressed by preventAiInterruption policy.`)
                  } else {
                    console.log(`[VoiceGateway] Gemini Live interrupted by candidate speech. Halting playback.`)
                    sessionContext.isAiSpeaking = false
                    if (ws.readyState === 1) {
                      ws.send(JSON.stringify({ type: 'ai_interrupted' }))
                    }
                  }
                }

                // 4. Turn Complete: Commit spoken transcript to database
                if (msg.serverContent?.turnComplete) {
                  sessionContext.isAiSpeaking = false
                  sessionContext.hasEmittedTurnForCurrentInput = true
                  sessionContext.currentAudioChunkIndex = 0
                  if (sessionContext.turnWatchdog) {
                    clearTimeout(sessionContext.turnWatchdog)
                    sessionContext.turnWatchdog = null
                  }
                  const cleanedCompleted = (sessionContext.currentAITranscript || '')
                    .replace(/\*\*.*?\*\*/g, '')
                    .replace(/^[#*]+\s*/gm, '')
                    .trim()

                  sessionContext.currentAITranscript = ''

                  const spokenTranscript = isThoughtOrMetaPlanning(cleanedCompleted)
                    ? (sessionContext.currentSpokenPrompt || '')
                    : (cleanedCompleted || sessionContext.currentSpokenPrompt || '')
                  sessionContext.currentSpokenPrompt = null
                  if (ws.readyState === 1) {
                    const isNudge = isNudgeText(spokenTranscript)
                    const isTermination = isTerminationText(spokenTranscript)
                    ws.send(JSON.stringify({
                      type: 'ai_transcript_complete',
                      sessionId: sessionContext.sessionId,
                      audioTurnId: sessionContext.audioTurnId,
                      eventId: `${sessionContext.sessionId}-voice-${Date.now()}`,
                      fullTranscript: spokenTranscript,
                      isNudge,
                      isTermination,
                      questionSequence: sessionContext.currentQuestionSequence || 0,
                    }))
                    ws.send(JSON.stringify({
                      type: 'ai_audio_stream_complete',
                      sessionId: sessionContext.sessionId,
                      audioTurnId: sessionContext.audioTurnId,
                      isFallback: false,
                    }))
                  }
                }
              },
              onerror: (err) => {
                sessionContext.isAiSpeaking = false
                sessionContext.isConnectingGemini = false
                if (sessionContext.turnWatchdog) {
                  clearTimeout(sessionContext.turnWatchdog)
                  sessionContext.turnWatchdog = null
                }
                console.error('[VoiceGateway] Gemini Live error:', err.message || err)
                if (ws.readyState === 1 && sessionContext.currentSpokenPrompt && !sessionContext.fallbackEmitted) {
                  this._deliverFallbackAudioOrTurn(sessionContext, sessionContext.currentSpokenPrompt, ws)
                    .catch((fallbackError) => console.warn('[VoiceGateway] Voice recovery failed:', fallbackError.message))
                }
              },
              onclose: (e) => {
                sessionContext.isAiSpeaking = false
                sessionContext.geminiSession = null
                sessionContext.isConnectingGemini = false
                if (sessionContext.turnWatchdog) {
                  clearTimeout(sessionContext.turnWatchdog)
                  sessionContext.turnWatchdog = null
                }
                console.log('[VoiceGateway] Gemini Live session closed:', e.reason || e.code)
                if (ws.readyState === 1 && sessionContext.currentSpokenPrompt && !sessionContext.fallbackEmitted) {
                  this._deliverFallbackAudioOrTurn(sessionContext, sessionContext.currentSpokenPrompt, ws)
                    .catch((fallbackError) => console.warn('[VoiceGateway] Voice recovery after close failed:', fallbackError.message))
                }
                // Auto-reconnect Gemini Live after idle disconnect so next questions remain responsive!
                if (ws.readyState === 1 && !sessionContext.isClosed) {
                  setTimeout(() => {
                    if (ws.readyState === 1 && !sessionContext.isClosed && !sessionContext.geminiSession) {
                      console.log('[VoiceGateway] Background reconnecting Gemini Live session...')
                      this._initGeminiLiveSession(sessionContext, ws).catch((err) => {
                        console.warn('[VoiceGateway] Background Gemini Live reconnect failed:', err.message)
                      })
                    }
                  }, 1500)
                }
              },
            },
          })

          sessionContext.geminiSession = geminiSession
          sessionContext.isConnectingGemini = false
          console.log(`[VoiceGateway] Gemini Live successfully connected with ${modelCandidate}`)
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'session_ready' }))
          }
          break
        } catch (modelErr) {
          console.warn(`[VoiceGateway] Model ${modelCandidate} connection failed:`, modelErr.message)
        }
      }

      if (!sessionContext.geminiSession && ws.readyState === 1) {
        console.warn('[VoiceGateway] Gemini Live models unavailable. Running in resilient REST fallback mode.')
        ws.send(JSON.stringify({ type: 'session_ready', mode: 'rest_fallback' }))
      }
    } finally {
      sessionContext.isConnectingGemini = false
    }
  }
}

/**
 * Client-Side Real-Time Web Audio Engine for QualifyAI Voice Interviews
 * Handles microphone capture (16kHz PCM16), WebSocket streaming,
 * validated audio playback through AIInterviewAudioPlayer, barge-in interruptibility,
 * and audio frequency analysis for the visualizer orb.
 */
// Global singleton holder for cross-page engine transfer (InvitationAcceptancePage → InterviewRoomPage)
import { AIInterviewAudioPlayer } from './AIInterviewAudioPlayer.js'
import { API_BASE_URL } from './apiConfig.js'

let _preconnectedEngine = null

function getSelectedMicConstraint() {
  try {
    const deviceId = window.localStorage?.getItem('qualifyai:selected-microphone')
    return deviceId ? { deviceId: { ideal: deviceId } } : {}
  } catch (_) {
    return {}
  }
}

export class VoiceInterviewEngine {
  /**
   * Store a pre-connected engine instance for the InterviewRoomPage to pick up
   */
  static setPreconnectedEngine(engine) {
    _preconnectedEngine = engine
  }

  /**
   * Retrieve and consume the pre-connected engine (one-time use)
   */
  static consumePreconnectedEngine() {
    const engine = _preconnectedEngine
    _preconnectedEngine = null
    return engine
  }

  constructor({
    token,
    language = 'en-IN',
    onStateChange,
    onTranscript,
    onAiQuestion,
    onInterviewCompleted,
    onCandidateSpeech,
    onAudioLevel,
    onAiSpeakingConcluded,
    onAiSpeechProgress,
    onAiAudioStarted,
    onError,
  }) {
    this.token = token
    this.language = language || (navigator.language && navigator.language.startsWith('en') ? navigator.language : 'en-IN')
    this.onStateChange = onStateChange || (() => {})
    this.onTranscript = onTranscript || (() => {})
    this.onAiQuestion = onAiQuestion || (() => {})
    this.onInterviewCompleted = onInterviewCompleted || (() => {})
    this.onCandidateSpeech = onCandidateSpeech || (() => {})
    this.onAudioLevel = onAudioLevel || (() => {})
    this.onAiSpeakingConcluded = onAiSpeakingConcluded || (() => {})
    this.onAiSpeechProgress = onAiSpeechProgress || (() => {})
    this.onAiAudioStarted = onAiAudioStarted || (() => {})
    this.onError = onError || (() => {})

    this.ws = null
    this.ttsAbortController = null
    this.spokenTextQueue = []
    this.isDrainingSpokenTextQueue = false
    this.playbackWaiters = new Map()
    this.inputAudioContext = null
    this.outputAudioContext = null
    this.mediaStream = null
    this.processorNode = null
    this.analyserNode = null
    this.animFrameId = null

    // All AI audio is decoded, buffered, scheduled, and drained by one player.
    this.isPlaying = false
    this.audioState = 'IDLE'
    this.activeAudioTurnId = null
    this.activePlaybackSequence = null
    this.activePlaybackQuestionId = null
    this.currentQuestionSequence = null
    this.currentQuestionId = null
    this.currentTurnGeneration = 0
    this.cancelledTurns = new Set()
    this.completedTurns = new Set()
    this.audioPlaybackFailed = false
    this.isAiTurnActive = false // Strictly true while Gemini Live audio turn is being generated/streamed
    this.turnCompletionTimer = null
    this.isRecognizing = false // Tracks active SpeechRecognition session lifecycle

    this.preventAiInterruption = true // Default ON: Protect AI speech from background noise/speaker echo
    this.isMuted = false
    this.isManualMuted = false
    this.isAutoMutedWhileSpeaking = false
    this.isConnected = false
    this.isPreconnected = false // True after preconnect() succeeds
    this.hasEnteredRoom = false // Strictly false during countdown; set true 2s after reaching room
    this.isStopped = false
    this.reconnectAttempts = 0
    this.conversationState = 'DISCONNECTED' // 'CONNECTING' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'MUTED'
    this.hasNativeAudioSession = false
    this.hasReceivedNativeAudioInCurrentTurn = false
    this.latestAiTranscript = ''
    this.aiAudioPlayer = new AIInterviewAudioPlayer({
      onPlaybackStart: ({ turnId }) => {
        this.activeAudioTurnId = turnId
        this.isPlaying = true
        this.audioState = 'AI_SPEAKING'
        this.isAutoMutedWhileSpeaking = true
        this._muteMicrophoneHardware(true)
        this._updateState('SPEAKING')
      },
      onPlaybackProgress: (progressData) => {
        if (this.onAiSpeechProgress) {
          this.onAiSpeechProgress(progressData)
        }
      },
      onPlaybackComplete: (report) => {
        this.completedTurns.add(report.turnId)
        if (this.ws?.readyState === WebSocket.OPEN) {
          this._sendGatewayMessage({ type: 'ai_audio_playback_complete', audioTurnId: report.turnId, stats: report.stats })
        }
        this._resolvePlaybackWaiter(report.turnId)
        this._concludeAiSpeakingTurn()
      },
      onError: (error) => {
        this.audioPlaybackFailed = true
        this.audioState = 'ERROR'
        console.error('[VoiceEngine] AI audio playback failed:', error.message)
      },
    })

    // 30%-40% Voice Intensity Gate (Threshold: 0.35):
    // Ambient sound and background noise below 35% volume are strictly filtered out
    this.voiceIntensityThreshold = 0.35
    this.currentAudioLevel = 0
    this.lastVoiceAboveThresholdTime = 0
    this.highpassFilter = null

    if (typeof window !== 'undefined') {
      window.__QUALIFYAI_AUDIO_ENGINE__ = this
      if (import.meta.env?.DEV) window.__QUALIFYAI_AUDIO_DIAGNOSTICS__ = () => this.getAudioDiagnostics()
    }
  }

  /**
   * Prepare audio playback and check the server API during the onboarding countdown.
   * Returns a Promise that resolves to { success: true } or { success: false, error: string }.
   * Does NOT play any audio or start the interview conversation — strictly silent readiness check!
   */
  async preconnect(timeoutMs = 12000) {
    this._updateState('CONNECTING')
    try {
      const health = await Promise.race([
        fetch(`${API_BASE_URL}/health`),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Voice service check timed out after ${timeoutMs}ms.`)), timeoutMs)),
      ])
      if (!health.ok) throw new Error('Voice service is unavailable.')
      await this._ensureOutputAudioContext()
      this._initializeVoiceTransport()
      this.isPreconnected = true
      this.isConnected = true
      this._updateState('LISTENING')
      return { success: true }
    } catch (err) {
      console.error('[VoiceEngine] Preconnect failed:', err)
      return { success: false, error: err.message || 'Unable to connect to Gemini Live.' }
    }
  }

  _initializeVoiceTransport() {
    this.ws = {
      readyState: WebSocket.OPEN,
      send: (payload) => {
        const message = JSON.parse(payload)
        if (message.clientContent) {
          const text = message.clientContent.turns?.flatMap((turn) => turn.parts || []).map((part) => part.text || '').join(' ')
          this._sendLiveText(text)
        }
      },
      close: () => {
        this.ws.readyState = WebSocket.CLOSED
      },
    }
  }

  async _synthesizeSpokenText({ text, turnId, generation, sequence, questionId }) {
    if (!text || this.isStopped) return
    if (this.cancelledTurns.has(turnId)) return

    const controller = new AbortController()
    this.ttsAbortController = controller

    let resolvePlayback
    const playbackFinished = new Promise((resolve) => { resolvePlayback = resolve })
    this.playbackWaiters.set(turnId, resolvePlayback)

    this._handleServerMessage({
      data: JSON.stringify({
        type: 'ai_audio_started',
        audioTurnId: turnId,
        questionId,
        questionSequence: sequence,
        spokenPrompt: text,
      }),
    })

    let buffer = ''
    let receivedChunks = 0
    let playbackTimeout = null

    const consumeLine = (line) => {
      if (!line.trim()) return
      if (this.currentTurnGeneration !== generation || this.cancelledTurns.has(turnId) || this.isStopped) return

      const event = JSON.parse(line)
      if (event.type === 'audio_chunk') {
        if (event.audioTurnId && event.audioTurnId !== this.activeAudioTurnId) return
        if (typeof event.sequence === 'number' && this.currentQuestionSequence != null && event.sequence < this.currentQuestionSequence) return
        receivedChunks++
        this._handleServerMessage({
          data: JSON.stringify({
            type: 'ai_audio_chunk',
            audioTurnId: turnId,
            questionId,
            questionSequence: sequence,
            data: event.data,
            mimeType: event.mimeType || 'audio/pcm;rate=24000',
            sampleRate: event.sampleRate || 24000,
            channels: event.channels || 1,
            bitDepth: event.bitDepth || 16,
            byteOrder: event.byteOrder || 'little-endian',
            audioSequence: event.chunkIndex || receivedChunks,
            chunkIndex: event.chunkIndex || receivedChunks,
          }),
        })
      } else if (event.type === 'complete') {
        if (event.audioTurnId && event.audioTurnId !== this.activeAudioTurnId) return
        if (!receivedChunks) throw new Error('Voice synthesis returned no playable audio.')
        this._handleServerMessage({
          data: JSON.stringify({
            type: 'ai_transcript_complete',
            audioTurnId: turnId,
            questionId,
            questionSequence: sequence,
            fullTranscript: event.text || text,
          }),
        })
        this._handleServerMessage({
          data: JSON.stringify({
            type: 'ai_audio_stream_complete',
            audioTurnId: turnId,
            questionId,
            questionSequence: sequence,
            fullTranscript: event.text || text,
            providerUsed: event.provider,
          }),
        })
      } else if (event.type === 'error') {
        throw new Error(event.error || 'Voice synthesis failed for this prompt.')
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/voice/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
        body: JSON.stringify({
          token: this.token,
          text,
          turnId,
          questionId,
          sequence,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Voice synthesis request failed (${response.status}).`)
      }
      if (!response.body) throw new Error('This browser could not receive streamed interviewer audio.')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        if (this.currentTurnGeneration !== generation || this.cancelledTurns.has(turnId) || this.isStopped) {
          try { reader.cancel() } catch (_) {}
          break
        }
        const { done, value } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) consumeLine(line)
        if (done) break
      }
      if (buffer.trim()) consumeLine(buffer)

      if (this.currentTurnGeneration !== generation || this.cancelledTurns.has(turnId) || this.isStopped) {
        return
      }

      if (!receivedChunks) throw new Error('Voice synthesis returned no playable audio.')

      // Wait for actual physical playback completion on AudioPlaybackEngine
      await Promise.race([
        playbackFinished,
        new Promise((resolve) => {
          playbackTimeout = setTimeout(() => {
            console.warn('[VoiceEngine] Audio playback watchdog reached; advancing turn.')
            this._concludeAiSpeakingTurn()
            resolve()
          }, 90000)
        }),
      ])
    } catch (error) {
      if (error.name === 'AbortError' || this.currentTurnGeneration !== generation || this.cancelledTurns.has(turnId) || this.isStopped) {
        return
      }
      console.warn('[VoiceEngine] Server voice synthesis unavailable:', error.message)
      this.onError(error.message || 'Interviewer voice could not be played.')
      this._handleAiTurnComplete({ audioTurnId: turnId, audioUnavailable: true })
    } finally {
      if (playbackTimeout) clearTimeout(playbackTimeout)
      if (this.ttsAbortController === controller) this.ttsAbortController = null
      this._resolvePlaybackWaiter(turnId)
    }
  }

  _resolvePlaybackWaiter(turnId) {
    const resolve = this.playbackWaiters.get(turnId)
    if (!resolve) return
    this.playbackWaiters.delete(turnId)
    resolve()
  }

  _queueSpokenText(text, sequence = null, questionId = null) {
    if (!text || this.isStopped) return
    return this.speakAiQuestion({ text, sequence, questionId })
  }

  _handleGeminiMessage(message) {
    if (message.setupComplete) {
      this.isConnected = true
      if (this.hasEnteredRoom && !this.processorNode) this._setupMicrophonePipeline()
      if (this.hasEnteredRoom && !this.recognition) this._setupSpeechRecognition()
      this._updateState('LISTENING')
      this._handleServerMessage({ data: JSON.stringify({ type: 'session_ready' }) })
      return
    }
    if (message.error) {
      this.onError(message.error.message || 'Gemini Live returned an error.')
      return
    }
    if (message.sessionResumptionUpdate?.newHandle) {
      this.resumptionHandle = message.sessionResumptionUpdate.newHandle
    }
    const content = message.serverContent
    if (!content) return
    if (content.modelTurn?.parts?.length) {
      if (this.currentLiveTurnId == null) {
        this.currentLiveTurnId = `live-${Date.now()}`
        this._handleServerMessage({ data: JSON.stringify({ type: 'ai_audio_started', audioTurnId: this.currentLiveTurnId }) })
      }
      for (const part of content.modelTurn.parts) {
        const audio = part.inlineData || part.inline_data
        if (audio?.data) {
          this._handleServerMessage({ data: JSON.stringify({
            type: 'ai_audio_chunk', audioTurnId: this.currentLiveTurnId,
            data: audio.data, mimeType: audio.mimeType || audio.mime_type || 'audio/pcm;rate=24000',
            sampleRate: Number((audio.mimeType || '').match(/rate=(\d+)/)?.[1]) || 24000,
            channels: 1, bitDepth: 16, byteOrder: 'little-endian',
          }) })
        }
      }
    }
    const transcript = content.outputTranscription?.text || content.output_transcription?.text
    if (transcript) this.latestAiTranscript = `${this.latestAiTranscript || ''}${transcript}`
    if (content.turnComplete) {
      this._handleServerMessage({ data: JSON.stringify({
        type: 'ai_audio_stream_complete', audioTurnId: this.currentLiveTurnId,
        fullTranscript: this.latestAiTranscript || '',
      }) })
      if (this.latestAiTranscript) this._handleServerMessage({ data: JSON.stringify({
        type: 'ai_transcript_complete', fullTranscript: this.latestAiTranscript,
      }) })
      this.latestAiTranscript = ''
      this.currentLiveTurnId = null
    }
  }

  _sendLiveText(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !text) return false
    this._queueSpokenText(text)
    return true
  }

  _sendGatewayMessage(packet) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    const message = typeof packet === 'string' ? JSON.parse(packet) : packet
    if (message.type === 'speak_question' || message.type === 'repeat_question') return this._sendLiveText(message.text)
    // Candidate answers are committed through the idempotent HTTP interview API; the Live
    // connection is output-only so microphone and camera never proxy through Vercel.
    return true
  }

  /**
   * Attach full callbacks and set up microphone pipeline on a pre-connected engine.
   * Called by InterviewRoomPage after consuming the preconnected engine.
   */
  attachCallbacksAndMic({ onStateChange, onTranscript, onAiQuestion, onInterviewCompleted, onCandidateSpeech, onAudioLevel, onAiSpeakingConcluded, onAiSpeechProgress, onAiAudioStarted, onError, language }) {
    this.isStopped = false
    if (onStateChange) this.onStateChange = onStateChange
    if (onTranscript) this.onTranscript = onTranscript
    if (onAiQuestion) this.onAiQuestion = onAiQuestion
    if (onInterviewCompleted) this.onInterviewCompleted = onInterviewCompleted
    if (onCandidateSpeech) this.onCandidateSpeech = onCandidateSpeech
    if (onAudioLevel) this.onAudioLevel = onAudioLevel
    if (onAiSpeakingConcluded) this.onAiSpeakingConcluded = onAiSpeakingConcluded
    if (onAiSpeechProgress) this.onAiSpeechProgress = onAiSpeechProgress
    if (onAiAudioStarted) this.onAiAudioStarted = onAiAudioStarted
    if (onError) this.onError = onError
    if (language) this.language = language

    // Now set up the full audio pipeline
    this._initMicrophonePipelineAsync()
  }

  /**
   * Toggle or set AI interruption protection mode
   */
  setPreventAiInterruption(enabled) {
    this.preventAiInterruption = Boolean(enabled)
    console.log('[VoiceEngine] setPreventAiInterruption:', this.preventAiInterruption)
    if (this.ws?.readyState === WebSocket.OPEN) {
      this._sendGatewayMessage(
        {
          type: 'set_prevent_interruption',
          enabled: this.preventAiInterruption,
        }
      )
    }
    return this.preventAiInterruption
  }

  /**
   * Diagnostic reporter for developer / audio pipeline inspection
   */
  getAudioDiagnostics() {
    return { ...this.aiAudioPlayer.getState(), isAiTurnActive: this.isAiTurnActive, preventAiInterruption: this.preventAiInterruption }
  }

  /**
   * Speak question or AI prompt aloud with strict question-turn identity and race prevention
   */
  speakAiQuestion(payload, force = false) {
    if (this.isStopped) return
    let text = ''
    let questionId = null
    let sequence = null
    let isFiller = false
    let isForced = force

    if (typeof payload === 'object' && payload !== null) {
      text = String(payload.text || payload.spokenText || '').trim()
      questionId = payload.questionId || null
      sequence = typeof payload.sequence === 'number' ? payload.sequence : null
      isFiller = Boolean(payload.isFiller)
      if (payload.force !== undefined) isForced = Boolean(payload.force)
    } else {
      text = String(payload || '').trim()
    }

    if (!text) return

    // Monotonic sequence guard: never speak a question older than our active question sequence
    if (sequence != null && this.currentQuestionSequence != null && sequence < this.currentQuestionSequence) {
      console.log(`[VoiceEngine] Monotonic Guard: Ignoring older question speech (seq ${sequence} < active ${this.currentQuestionSequence})`)
      return
    }

    // Cancel any previous in-flight synthesis or playback
    this.cancelCurrentAudio('New question/prompt initiated')

    // Establish new canonical turn identity
    this.currentTurnGeneration++
    const generation = this.currentTurnGeneration
    if (sequence != null && !isFiller) {
      this.currentQuestionSequence = sequence
      this.currentQuestionId = questionId
    }

    const turnId = `qturn-${sequence != null ? `seq${sequence}` : (isFiller ? 'filler' : 'prompt')}-${generation}-${Date.now()}`
    this.activeAudioTurnId = turnId
    this.activePlaybackSequence = sequence
    this.activePlaybackQuestionId = questionId

    console.log(`[VoiceEngine] Starting speech turn [${turnId}]: "${text.slice(0, 50)}..."`)

    this.isAiTurnActive = true
    this.isPlaying = true
    this.audioState = 'AI_SPEAKING'
    this.isAutoMutedWhileSpeaking = true
    this._muteMicrophoneHardware(true)
    this._updateState('SPEAKING')

    this.aiAudioPlayer.beginTurn(turnId, sequence)

    this._synthesizeSpokenText({
      text,
      turnId,
      generation,
      sequence,
      questionId,
    })
  }

  /**
   * Cancel and flush any active or in-flight interviewer audio immediately
   */
  cancelCurrentAudio(reason = 'Cancelled') {
    if (this.activeAudioTurnId) {
      this.cancelledTurns.add(this.activeAudioTurnId)
    }
    this.currentTurnGeneration++
    if (this.ttsAbortController) {
      try { this.ttsAbortController.abort(reason) } catch (_) {}
      this.ttsAbortController = null
    }
    this.spokenTextQueue = []
    if (this.turnCompletionTimer) {
      clearTimeout(this.turnCompletionTimer)
      this.turnCompletionTimer = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel() } catch (_) {}
    }
    this.aiAudioPlayer.flush()
    this.isPlaying = false
    this.isAiTurnActive = false
    this._resolvePlaybackWaiter(this.activeAudioTurnId)
  }

  /**
   * Speak arbitrary text prompt
   */
  speakText(text) {
    if (!text || this.isStopped) return
    this.speakAiQuestion(text)
  }

  /**
   * Speak direct text aloud using the unified server TTS interviewer voice pipeline.
   * Auto-mutes microphone hardware during speech to prevent audio feedback.
   */
  speakDirectSpeech(text, { onEnd } = {}) {
    if (!text || this.isStopped) return Promise.resolve()

    console.log('[VoiceEngine] speakDirectSpeech aloud via server TTS pipeline:', text)
    this.speakAiQuestion({ text, force: true })
    if (onEnd) {
      setTimeout(onEnd, Math.min(10000, Math.max(1000, text.length * 60)))
    }
    return Promise.resolve()
  }

  /**
   * Spoken filler nudges when candidate remains silent.
   * Unified Voice Architecture: Uses the EXACT SAME audio pipeline, EXACT SAME CosyVoice provider,
   * and EXACT SAME voice profile (qualifyai_interviewer_01) as the main interview questions.
   */
  triggerSilenceNudge(level = 1) {
    if (this.isStopped) return ''
    const nudge1Phrases = [
      "Whenever you're ready, you can answer. I'm still here.",
      "I am here, you can just answer it. You can answer it in your own way.",
      "Take your time, I am here. You can just answer it in your own way."
    ]
    const nudge2Phrases = [
      "Take your time. You can answer whenever you're ready.",
      "Whenever you're ready, feel free to answer, or we can move forward.",
      "I am still here. Feel free to answer in your own words, or we can move to the next question."
    ]
    const chosen = level === 1
      ? nudge1Phrases[Math.floor(Math.random() * nudge1Phrases.length)]
      : nudge2Phrases[Math.floor(Math.random() * nudge2Phrases.length)]

    console.log(`[VoiceEngine] Speaking unified CosyVoice silence nudge #${level}:`, chosen)
    this.speakAiQuestion({ text: chosen, isFiller: true })

    return chosen
  }

  /**
   * Explicitly set candidate microphone mute state
   */
  setMicrophoneMuted(muted) {
    if (!muted) {
      this.isManualMuted = false
      this.isMuted = false
      this.audioState = 'LISTENING'
      this._muteMicrophoneHardware(false)
      this._updateState('LISTENING')
      return false
    }
    return this.setMute(muted)
  }

  /**
   * Ensure output AudioContext is initialized and active without forcing sample rate
   */
  async _ensureOutputAudioContext() {
    try {
      this.outputAudioContext = await this.aiAudioPlayer.initialize()
      return this.outputAudioContext
    } catch (err) {
      console.warn('[VoiceEngine] Failed to resume outputAudioContext:', err)
      return null
    }
  }

  /**
   * Initialize microphone pipeline asynchronously (used by attachCallbacksAndMic)
   */
  async _initMicrophonePipelineAsync() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!this.inputAudioContext) {
        this.inputAudioContext = new AudioCtx({ sampleRate: 16000 })
      }
      if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume()
      }

      await this._ensureOutputAudioContext()

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...getSelectedMicConstraint(),
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: false }, // Prevent AGC from boosting background room hiss during candidate pauses
        },
      })

      this._setupMicrophonePipeline()
      this._setupSpeechRecognition()
      this._updateState('LISTENING')
      // Note: candidate_entered_room is NOT sent here.
      // InterviewRoomPage explicitly calls markCandidateEnteredRoom() 2 seconds after room load.
    } catch (err) {
      console.error('[VoiceEngine] Mic pipeline setup failed:', err)
      this.onError(err.message || 'Microphone access failed')
    }
  }

  /**
   * Connect to backend Voice WebSocket gateway (full fresh connection)
   */
  async start() {
    this.isStopped = false

    // If already preconnected, just set up mic pipeline
    if (this.isPreconnected && this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      await this._initMicrophonePipelineAsync()
      return
    }

    try {
      this._updateState('CONNECTING')

      // 1. Initialize Audio Contexts
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!this.inputAudioContext || this.inputAudioContext.state === 'closed') {
        this.inputAudioContext = new AudioCtx({ sampleRate: 16000 })
      }
      await this._ensureOutputAudioContext()

      // Resume context if suspended by browser autoplay policy
      if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume()
      }

      // 2. Request Microphone Access
      if (!this.mediaStream || this.mediaStream.getTracks().every((track) => track.readyState === 'ended')) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...getSelectedMicConstraint(),
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: false },
          },
        })
      }

      // Interviewer speech is streamed from the server-side CosyVoice provider over HTTP.
      this._initializeVoiceTransport()
      this.isConnected = true
      this.reconnectAttempts = 0
      if (this.hasEnteredRoom && !this.processorNode) this._setupMicrophonePipeline()
      if (this.hasEnteredRoom && !this.recognition) this._setupSpeechRecognition()
      this._updateState('LISTENING')
    } catch (err) {
      console.error('[VoiceEngine] Initialization failed:', err)
      this.onError(err.message || 'Microphone access or connection failed')
      this.stop()
    }
  }

  /**
   * Exponential backoff reconnection handler
   */
  _attemptReconnect() {
    if (this.isStopped || (this.reconnectAttempts || 0) >= 3) {
      this._updateState('DISCONNECTED')
      return
    }

    this.reconnectAttempts = (this.reconnectAttempts || 0) + 1
    const delay = Math.min(4000, 1000 * Math.pow(1.5, this.reconnectAttempts))
    this._updateState('CONNECTING')

    setTimeout(() => {
      if (this.isStopped) return
      console.log(`[VoiceEngine] Reconnect attempt ${this.reconnectAttempts}/3...`)
      this.start()
    }, delay)
  }

  /**
   * Public explicit reconnect method (called by Reconnect button in UI)
   */
  async reconnect() {
    this.isStopped = false
    this.reconnectAttempts = 0
    return this.start()
  }

  /**
   * Set up microphone capture and frequency analysis
   */
  _setupMicrophonePipeline() {
    if (!this.inputAudioContext || !this.mediaStream) return

    const sourceNode = this.inputAudioContext.createMediaStreamSource(this.mediaStream)

    // Highpass filter (85Hz) removes electrical hum, AC rumbling, and desk bumps
    try {
      this.highpassFilter = this.inputAudioContext.createBiquadFilter()
      this.highpassFilter.type = 'highpass'
      this.highpassFilter.frequency.setValueAtTime(85, this.inputAudioContext.currentTime)
      this.highpassFilter.Q.setValueAtTime(0.7, this.inputAudioContext.currentTime)
      sourceNode.connect(this.highpassFilter)
    } catch (_) {
      this.highpassFilter = sourceNode
    }

    const audioPipelineOutput = this.highpassFilter || sourceNode

    // Analyser node for candidate visualizer reaction
    this.analyserNode = this.inputAudioContext.createAnalyser()
    this.analyserNode.fftSize = 256
    audioPipelineOutput.connect(this.analyserNode)

    // Script processor node for PCM16 conversion (bufferSize: 2048 samples = ~128ms chunks)
    this.processorNode = this.inputAudioContext.createScriptProcessor(2048, 1, 1)

    this.processorNode.onaudioprocess = (e) => {
      // If candidate is muted, or AI is currently speaking, DROP audio frames to prevent barge-in disturbance!
      if (
        this.isMuted ||
        this.isManualMuted ||
        this.isAutoMutedWhileSpeaking ||
        this.conversationState === 'SPEAKING' ||
        this.aiAudioPlayer.activeSources.size > 0 ||
        !this.isConnected ||
        this.ws?.readyState !== WebSocket.OPEN
      ) {
        return
      }

      const inputData = e.inputBuffer.getChannelData(0)

      // Calculate RMS power
      let sumSq = 0
      for (let i = 0; i < inputData.length; i++) {
        sumSq += inputData[i] * inputData[i]
      }
      const rms = Math.sqrt(sumSq / inputData.length)

      // Intensity Noise Gate: If RMS power is below noise floor (0.02) and no voice activity above threshold recently,
      // drop this chunk to eliminate ambient background murmur from streaming over WebSocket
      if (rms < 0.02 && (!this.lastVoiceAboveThresholdTime || Date.now() - this.lastVoiceAboveThresholdTime > 500)) {
        return
      }

      const pcm16Data = this._floatTo16BitPCM(inputData)
      const base64Audio = this._arrayBufferToBase64(pcm16Data.buffer)

      // Audio is transcribed locally by SpeechRecognition and committed over HTTPS.
      // Never proxy candidate microphone audio through Vercel.
    }

    audioPipelineOutput.connect(this.processorNode)
    this.processorNode.connect(this.inputAudioContext.destination)

    this._startVisualizerLoop()
  }

  /**
   * Helper to mute/unmute hardware microphone tracks and speech recognition
   */
  _muteMicrophoneHardware(muted) {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted
      })
    }
    if (muted && this.recognition) {
      this.isRecognizing = false
      try {
        this.recognition.abort()
      } catch (_) {}
    } else if (!muted && !this.isManualMuted && this.recognition) {
      if (!this.isRecognizing) {
        try {
          this.recognition.start()
          this.isRecognizing = true
        } catch (e) {
          if (e.name === 'InvalidStateError' || e.message?.includes('already started')) {
            this.isRecognizing = true
          }
        }
      }
    }
  }

  /**
   * Continuous loop to measure RMS audio volume for visualizer
   */
  _startVisualizerLoop() {
    const dataArray = new Uint8Array(this.analyserNode ? this.analyserNode.frequencyBinCount : 0)

    const updateLoop = () => {
      if (!this.analyserNode || !this.isConnected) return

      this.analyserNode.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i]
      }
      const avg = sum / dataArray.length
      const rawNormalized = Math.min(1, avg / 128)

      // 30%-40% Voice Intensity Gate (35% threshold):
      // Sounds below 0.35 are strictly suppressed as ambient background noise
      let gatedLevel = 0
      if (rawNormalized >= this.voiceIntensityThreshold) {
        gatedLevel = Math.min(1, (rawNormalized - this.voiceIntensityThreshold) / (1 - this.voiceIntensityThreshold))
        this.lastVoiceAboveThresholdTime = Date.now()
      }
      this.currentAudioLevel = gatedLevel

      // When AI is speaking, mic level visualizer is clamped to 0
      if (this.conversationState === 'SPEAKING' || this.isAutoMutedWhileSpeaking) {
        this.onAudioLevel(0)
      } else {
        this.onAudioLevel(gatedLevel)
      }
      this.animFrameId = requestAnimationFrame(updateLoop)
    }

    updateLoop()
  }

  /**
   * Handle incoming messages from Voice Gateway
   */
  _handleServerMessage(event) {
    try {
      const msg = JSON.parse(event.data)

      switch (msg.type) {
        case 'session_ready':
          this._updateState('LISTENING')
          // If candidate already reached room and 2s passed, send room enter
          if (this.hasEnteredRoom && this.ws?.readyState === WebSocket.OPEN) {
            this._sendGatewayMessage({ type: 'candidate_entered_room' })
          }
          break

        case 'ai_thinking':
          this._updateState('THINKING')
          break

        case 'candidate_transcript_ack':
          if (this.conversationState !== 'SPEAKING') {
            this._updateState('THINKING')
          }
          break

        case 'ai_audio_started':
        case 'ai_turn_started': // Legacy server compatibility during rolling deploys
          if (!this.hasEnteredRoom) break
          this._beginAudioTurn(msg.audioTurnId)
          this.isAiTurnActive = true
          this.isAutoMutedWhileSpeaking = true
          this._muteMicrophoneHardware(true)
          this.audioState = 'AI_SPEAKING'
          this._updateState('SPEAKING')
          if (this.onAiAudioStarted) {
            this.onAiAudioStarted(msg)
          }
          break

        case 'ai_audio_chunk':
          // Preserve runtime format metadata and pass bytes to the authoritative player.
          if (!this.hasEnteredRoom) {
            break
          }
          this.hasNativeAudioSession = true
          if ('speechSynthesis' in window) {
            try {
              window.speechSynthesis.cancel()
            } catch (_) {}
          }
          this._playAiAudioChunk(msg)
          break

        case 'ai_transcript_delta':
          if (!this.hasEnteredRoom) break
          this.onTranscript({ text: msg.text, isDelta: true, speaker: 'AI', sequence: msg.sequence })
          break

        case 'ai_transcript_complete':
          if (!this.hasEnteredRoom) break
          this.latestAiTranscript = msg.fullTranscript || ''
          this.onTranscript({
            text: msg.fullTranscript,
            questionText: msg.questionText,
            sequence: msg.sequence,
            isNudge: msg.isNudge,
            isTermination: msg.isTermination,
            isFinal: true,
            speaker: 'AI',
          })

          break

        case 'ai_audio_stream_complete':
        case 'ai_turn_complete': // Legacy server compatibility during rolling deploys
          if (!this.hasEnteredRoom) break
          if (msg.type === 'ai_turn_complete') {
            this.latestAiTranscript = msg.fullTranscript || ''
            this.onTranscript({
              text: msg.fullTranscript,
              questionText: msg.questionText,
              isNudge: msg.isNudge,
              isTermination: msg.isTermination,
              isFinal: true,
              speaker: 'AI',
            })
          }
          this._handleAiTurnComplete({ ...msg, fullTranscript: msg.fullTranscript || this.latestAiTranscript })
          break

        case 'ai_question':
          // Authoritative AI Question Event from Gemini AI Interviewer
          if (this.onAiQuestion) {
            this.onAiQuestion(msg)
          }
          break

        case 'interview_completed':
          this.onInterviewCompleted(msg)
          break

        case 'ai_interrupted':
          // Only halt audio if interruption protection is disabled
          if (!this.preventAiInterruption) {
            this._stopAiAudioPlayback()
            if ('speechSynthesis' in window) {
              try { window.speechSynthesis.cancel() } catch (_) {}
            }
            this._concludeAiSpeakingTurn()
          } else {
            console.log('[VoiceEngine] Suppressed ai_interrupted event because preventAiInterruption is active.')
          }
          break

        case 'session_closed':
          console.warn('[VoiceEngine] Server indicated voice session closed:', msg.reason)
          if (!this.isStopped) {
            this._attemptReconnect()
          }
          break

        case 'error':
          this.onError(msg.message)
          break

        default:
          break
      }
    } catch (err) {
      console.error('[VoiceEngine] Error parsing server message:', err)
    }
  }

  /**
   * Called explicitly by InterviewRoomPage after candidate enters room and 2 seconds have passed
   */
  markCandidateEnteredRoom() {
    this.hasEnteredRoom = true
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[VoiceEngine] Candidate entered room (2s delay passed). Triggering AI interview start.')
      this._sendGatewayMessage({ type: 'candidate_entered_room' })
    }
  }


  /**
   * Selects the most natural, human-like voice available in the browser for fallback turns
   */
  _getPreferredSpeechVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
    const voices = window.speechSynthesis.getVoices()
    if (!voices || voices.length === 0) return null

    // 1. Look for high-fidelity natural online/neural voices first
    const naturalVoices = voices.filter(
      (v) =>
        (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Neural')) &&
        (v.lang.startsWith('en') || (this.language && v.lang.startsWith(this.language.substring(0, 2))))
    )
    if (naturalVoices.length > 0) {
      const femaleNatural = naturalVoices.find(
        (v) => /jenny|aria|sonia|neerja|samantha|zira|steffi|sara/i.test(v.name)
      )
      if (femaleNatural) return femaleNatural
      return naturalVoices[0]
    }

    // 2. Look for Google / Apple high quality voices
    const qualityVoices = voices.filter(
      (v) =>
        (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Siri')) &&
        v.lang.startsWith('en')
    )
    if (qualityVoices.length > 0) return qualityVoices[0]

    // 3. Fallback to any English female voice, or first English voice
    const femaleVoice = voices.find((v) => /female|woman|zira|susan|hazel/i.test(v.name) && v.lang.startsWith('en'))
    if (femaleVoice) return femaleVoice

    return voices.find((v) => v.lang.startsWith('en')) || voices[0]
  }

  /**
   * Request Voice Gateway or browser engine to explicitly repeat the active question aloud
   */
  repeatAiQuestion(spokenText) {
    return this.speakAiQuestion(spokenText, true)
  }

  _resetTurnCompletionTimer(timeoutMs = 90000) {
    if (this.turnCompletionTimer) {
      clearTimeout(this.turnCompletionTimer)
      this.turnCompletionTimer = null
    }

    // Dynamic turn safety watchdog: ensures speaking turn doesn't hang forever,
    // but scales appropriately with spoken script length and resets on each active chunk.
    this.turnCompletionTimer = setTimeout(() => {
      if (this.isAiTurnActive || this.conversationState === 'SPEAKING') {
        console.warn(`[VoiceEngine] Safety turn watchdog reached (${timeoutMs}ms). Concluding speaking turn and passing mic to candidate.`)
        this._stopAiAudioPlayback()
        this._concludeAiSpeakingTurn()
      }
    }, timeoutMs)
  }

  _beginAudioTurn(turnId, sequence = null) {
    this._resetTurnCompletionTimer(90000)

    if (turnId != null && this.activeAudioTurnId === turnId) return
    this.aiAudioPlayer.beginTurn(turnId, sequence)
    this.activeAudioTurnId = turnId ?? this.aiAudioPlayer.turnId
    this.latestAiTranscript = ''
    this.audioPlaybackFailed = false
    this.hasReceivedNativeAudioInCurrentTurn = false
  }

  _playAiAudioChunk(chunkPayload) {
    if (!this.hasEnteredRoom) return Promise.resolve()
    if (this.isStopped) return Promise.resolve()
    if (chunkPayload?.audioTurnId && this.cancelledTurns.has(chunkPayload.audioTurnId)) {
      return Promise.resolve()
    }
    const incomingSeq = typeof chunkPayload?.questionSequence === 'number'
      ? chunkPayload.questionSequence
      : (typeof chunkPayload?.sequence === 'number' ? chunkPayload.sequence : null)
    if (incomingSeq != null && this.currentQuestionSequence != null && incomingSeq < this.currentQuestionSequence) {
      return Promise.resolve()
    }
    if (chunkPayload?.audioTurnId != null && this.activeAudioTurnId != null && chunkPayload.audioTurnId !== this.activeAudioTurnId) {
      // Chunk belongs to an inactive or superseded turn; drop it
      return Promise.resolve()
    }
    if (chunkPayload?.audioTurnId != null && this.activeAudioTurnId == null) {
      this._beginAudioTurn(chunkPayload.audioTurnId, incomingSeq)
    }
    this.hasReceivedNativeAudioInCurrentTurn = true
    this.isAiTurnActive = true
    // Reset watchdog on each active audio chunk: as long as AI is playing chunks, keep turn alive!
    this._resetTurnCompletionTimer(90000)
    return this.aiAudioPlayer.enqueue(chunkPayload)
  }

  _handleAiTurnComplete(message) {
    if (message.audioTurnId && this.cancelledTurns.has(message.audioTurnId)) {
      return
    }
    const isMatchingTurn =
      message.audioTurnId == null ||
      this.activeAudioTurnId == null ||
      message.audioTurnId === this.activeAudioTurnId ||
      message.audioTurnId === this.aiAudioPlayer?.turnId

    if (!isMatchingTurn && this.hasReceivedNativeAudioInCurrentTurn) {
      console.warn('[VoiceEngine] Ignoring completion for a stale audio turn:', message.audioTurnId, 'current:', this.activeAudioTurnId)
      return
    }

    if (this.activeAudioTurnId == null && message.audioTurnId != null) this.activeAudioTurnId = message.audioTurnId
    this.audioState = 'AI_FINISHING'
    this.isAiTurnActive = false

    if (message.audioUnavailable || this.audioPlaybackFailed || !this.hasReceivedNativeAudioInCurrentTurn) {
      this._stopAiAudioPlayback()
      this._concludeAiSpeakingTurn()
      return
    }

    this.aiAudioPlayer.completeStream().catch((err) => {
      this.audioPlaybackFailed = true
      console.error('[VoiceEngine] Could not complete AI audio stream:', err.message)
      this._stopAiAudioPlayback()
      this._concludeAiSpeakingTurn()
    })
  }

  /**
   * Safe conclusion of AI speaking turn - un-mutes microphone and transitions to LISTENING
   */
  _concludeAiSpeakingTurn() {
    this._resolvePlaybackWaiter(this.activeAudioTurnId)
    if (this.turnCompletionTimer) {
      clearTimeout(this.turnCompletionTimer)
      this.turnCompletionTimer = null
    }
    this.isAiTurnActive = false
    this.isAutoMutedWhileSpeaking = false
    this.isPlaying = false
    this.hasReceivedNativeAudioInCurrentTurn = false

    // Cleanly clear residual playback sources so candidate speech filter never trips
    if (this.aiAudioPlayer?.activeSources) {
      this.aiAudioPlayer.activeSources.forEach((src) => {
        try { src.stop?.() } catch (_) {}
        try { src.disconnect() } catch (_) {}
      })
      this.aiAudioPlayer.activeSources.clear()
    }

    if (!this.isManualMuted) {
      this.isMuted = false
      this.audioState = 'LISTENING'
      this._muteMicrophoneHardware(false)
      this._updateState('LISTENING')
    } else {
      this.audioState = 'MUTED'
      this._updateState('MUTED')
    }

    if (this.onAiSpeakingConcluded) {
      this.onAiSpeakingConcluded()
    }
  }

  /**
   * Authoritative method to pass the microphone to the candidate and begin listening
   */
  unmuteAndStartListening() {
    if (this.turnCompletionTimer) {
      clearTimeout(this.turnCompletionTimer)
      this.turnCompletionTimer = null
    }
    this.isManualMuted = false
    this.isMuted = false
    this.isAutoMutedWhileSpeaking = false
    this.isAiTurnActive = false
    this.isPlaying = false
    this.hasReceivedNativeAudioInCurrentTurn = false

    if (this.aiAudioPlayer?.activeSources) {
      this.aiAudioPlayer.activeSources.forEach((src) => {
        try { src.stop?.() } catch (_) {}
        try { src.disconnect() } catch (_) {}
      })
      this.aiAudioPlayer.activeSources.clear()
    }

    this.audioState = 'LISTENING'
    this._muteMicrophoneHardware(false)
    this._updateState('LISTENING')

    if (this.recognition && !this.isRecognizing) {
      try {
        this.recognition.start()
        this.isRecognizing = true
      } catch (_) {}
    }
  }

  /**
   * Stop all active playing audio sources on interruption
   */
  _stopAiAudioPlayback() {
    this.cancelCurrentAudio('Interruption')
    this.audioState = 'INTERRUPTED'
  }

  /**
   * Set up browser SpeechRecognition to transcribe candidate speech in real time
   */
  _setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    try {
      this.recognition = new SpeechRecognition()
      this.recognition.continuous = true
      this.recognition.interimResults = true
      this.recognition.maxAlternatives = 1
      this.recognition.lang = this.language || 'en-IN'
      this._recognitionSessionId = `sess_${Date.now()}`
      this._lastFinalizedIndex = -1
      this._pendingInterimTranscript = ''

      this.recognition.onresult = (event) => {
        let currentInterim = ''

        // 1. Process any newly finalized results strictly once by tracking last finalized index
        for (let i = this._lastFinalizedIndex + 1; i < event.results.length; ++i) {
          const res = event.results[i]
          if (res.isFinal) {
            const transcript = (res[0]?.transcript || '').trim()
            this._lastFinalizedIndex = i
            this._pendingInterimTranscript = ''
            if (transcript) {
              const segId = `${this._recognitionSessionId}_${i}`
              this.onCandidateSpeech({
                text: transcript,
                isInterim: false,
                isFinal: true,
                segmentId: segId,
              })
            }
          }
        }

        // 2. Aggregate only unfinalized results beyond the last finalized index
        for (let i = this._lastFinalizedIndex + 1; i < event.results.length; ++i) {
          const res = event.results[i]
          if (!res.isFinal) {
            currentInterim += (res[0]?.transcript || '')
          }
        }

        // Interruption & Barge-in Handling while AI is actively speaking:
        if (this.conversationState === 'SPEAKING' && this.isAiTurnActive) {
          if (this.preventAiInterruption) {
            return
          }

          const words = (currentInterim).trim().split(/\s+/)
          if (words.length >= 2) {
            console.log('[VoiceEngine] Candidate intentional barge-in detected. Halting AI speech.')
            this._stopAiAudioPlayback()
            if ('speechSynthesis' in window) {
              try {
                window.speechSynthesis.cancel()
              } catch (_) {}
            }
            this.isAutoMutedWhileSpeaking = false
            if (this.ws?.readyState === WebSocket.OPEN) {
              this._sendGatewayMessage({ type: 'candidate_interrupted' })
            }
            this._updateState('LISTENING')
            if (this.onAiSpeakingConcluded) {
              this.onAiSpeakingConcluded()
            }
          }
          return
        }

        // 3. Emit interim preview for currently spoken words
        const trimmedInterim = currentInterim.trim()
        this._pendingInterimTranscript = trimmedInterim
        this.onCandidateSpeech({
          text: trimmedInterim,
          isInterim: true,
          isFinal: false,
          segmentId: `${this._recognitionSessionId}_interim`,
        })
      }

      this.recognition.onstart = () => {
        this.isRecognizing = true
      }

      this.recognition.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn('[VoiceEngine] SpeechRecognition notice:', e.error)
        }
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          this.isRecognizing = false
        }
      }

      this.recognition.onend = () => {
        this.isRecognizing = false
        this._lastFinalizedIndex = -1
        this._pendingInterimTranscript = ''
        if (
          this.isConnected &&
          !this.isMuted &&
          !this.isManualMuted &&
          !this.isAutoMutedWhileSpeaking &&
          this.conversationState !== 'SPEAKING' &&
          !this.isAiTurnActive &&
          this.recognition
        ) {
          try {
            this._recognitionSessionId = `sess_${Date.now()}`
            this._lastFinalizedIndex = -1
            this.recognition.start()
            this.isRecognizing = true
          } catch (_) {}
        }
      }

      try {
        this.recognition.start()
        this.isRecognizing = true
      } catch (_) {}
    } catch (err) {
      console.warn('[VoiceEngine] SpeechRecognition unavailable:', err)
    }
  }

  /**
   * Reset candidate speech recognition and flush any pending interim phrases
   * Called when transitioning to a new question so previous turn speech never leaks over.
   */
  resetCandidateSpeechRecognition() {
    this._pendingInterimTranscript = ''
    this._lastFinalizedIndex = -1
    this._recognitionSessionId = `sess_${Date.now()}`
    if (this.recognition) {
      try {
        this.recognition.abort()
      } catch (_) {}
      setTimeout(() => {
        if (this.isConnected && !this.isMuted && !this.isAutoMutedWhileSpeaking && this.conversationState !== 'SPEAKING') {
          try {
            this._recognitionSessionId = `sess_${Date.now()}`
            this._lastFinalizedIndex = -1
            this.recognition.start()
          } catch (_) {}
        }
      }, 50)
    }
  }

  /**
   * Change recognition language / accent (e.g. 'en-IN', 'en-US')
   */
  setLanguage(lang) {
    if (!lang || lang === this.language) return
    this.language = lang
    if (this.recognition) {
      try {
        this.recognition.abort()
        this.recognition.lang = lang
        this.recognition.start()
      } catch (_) {}
    }
  }

  /**
   * Explicitly forward confirmed candidate transcript over WebSocket
   */
  sendCandidateTranscript(text, metadata = {}) {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch (_) {}
    }
    this._stopAiAudioPlayback()
    if (!text || !text.trim() || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this._updateState('THINKING')
    this._sendGatewayMessage(
      {
        type: 'candidate_transcript',
        text: text.trim(),
        questionSequence: metadata.questionSequence,
        questionId: metadata.questionId,
      }
    )
  }


  /**
   * Request skip to next JD question after 2 silence nudges
   */
  skipUnansweredQuestion(unansweredCount = 1) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this._sendGatewayMessage(
      {
        type: 'skip_unanswered_question',
        unansweredCount,
      }
    )
  }

  /**
   * Terminate assessment session after 3 unanswered questions
   */
  terminateForUnanswered() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this._sendGatewayMessage(
      {
        type: 'terminate_unanswered',
      }
    )
  }

  /**
   * Toggle candidate microphone mute
   */
  toggleMute() {
    if (this.isAutoMutedWhileSpeaking || this.isAiTurnActive || this.conversationState === 'SPEAKING') {
      // Candidate clicked to unmute during or right after AI speaking turn -> halt audio and pass mic immediately
      this._stopAiAudioPlayback()
      this.isAutoMutedWhileSpeaking = false
      this.isAiTurnActive = false
      this.isManualMuted = false
      this.isMuted = false
      this._muteMicrophoneHardware(false)
      this._updateState('LISTENING')
      if (this.onAiSpeakingConcluded) {
        this.onAiSpeakingConcluded()
      }
      return false
    }

    this.isManualMuted = !this.isManualMuted
    this.isMuted = this.isManualMuted
    this._muteMicrophoneHardware(this.isMuted)
    this._updateState(this.isMuted ? 'MUTED' : 'LISTENING')
    return this.isMuted
  }

  /**
   * Set candidate microphone mute state explicitly
   */
  setMute(muted) {
    if (!muted && (this.isAutoMutedWhileSpeaking || this.isAiTurnActive || this.conversationState === 'SPEAKING')) {
      this._stopAiAudioPlayback()
      this.isAutoMutedWhileSpeaking = false
      this.isAiTurnActive = false
      this.isManualMuted = false
      this.isMuted = false
      this._muteMicrophoneHardware(false)
      this._updateState('LISTENING')
      if (this.onAiSpeakingConcluded) {
        this.onAiSpeakingConcluded()
      }
      return false
    }

    this.isManualMuted = Boolean(muted)
    this.isMuted = this.isManualMuted
    this._muteMicrophoneHardware(this.isMuted)
    this._updateState(this.isMuted ? 'MUTED' : 'LISTENING')
    return this.isMuted
  }

  /**
   * Terminate voice session and release hardware resources
   */
  stop() {
    this.isStopped = true
    this.reconnectAttempts = 0
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch (_) {}
    }
    if (this.recognition) {
      try {
        this.recognition.abort()
      } catch (_) {}
      this.recognition = null
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }

    this._stopAiAudioPlayback()

    if (this.processorNode) {
      try {
        this.processorNode.disconnect()
      } catch (_) {}
      this.processorNode = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop())
      this.mediaStream = null
    }

    if (this.inputAudioContext) {
      try {
        this.inputAudioContext.close()
      } catch (_) {}
      this.inputAudioContext = null
    }

    this.aiAudioPlayer.destroy().catch((err) => console.warn('[VoiceEngine] Audio player cleanup failed:', err.message))
    this.outputAudioContext = null

    if (typeof window !== 'undefined' && window.__QUALIFYAI_AUDIO_ENGINE__ === this) {
      delete window.__QUALIFYAI_AUDIO_ENGINE__
      delete window.__QUALIFYAI_AUDIO_DIAGNOSTICS__
    }

    if (this.ws) {
      try {
        this.ws.close()
      } catch (_) {}
      this.ws = null
    }

    this.isConnected = false
    this._updateState('DISCONNECTED')
  }

  _updateState(state) {
    this.conversationState = state
    if (state === 'LISTENING' || state === 'MUTED' || state === 'THINKING') this.audioState = state
    else if (state === 'SPEAKING' && !['AI_SPEAKING', 'AI_FINISHING', 'PLAYBACK_DRAINING'].includes(this.audioState)) this.audioState = 'AI_SPEAKING'
    this.onStateChange(state)
  }

  _floatTo16BitPCM(float32Array) {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16Array
  }

  _arrayBufferToBase64(buffer) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary)
  }
}

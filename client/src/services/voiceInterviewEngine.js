/**
 * Client-Side Real-Time Web Audio Engine for QualifyAI Voice Interviews
 * Handles microphone capture (16kHz PCM16), WebSocket streaming,
 * low-latency audio playback (24kHz PCM16), barge-in interruptibility,
 * and audio frequency analysis for the visualizer orb.
 */
// Global singleton holder for cross-page engine transfer (InvitationAcceptancePage → InterviewRoomPage)
let _preconnectedEngine = null

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

  constructor({ token, language = 'en-IN', onStateChange, onTranscript, onAiQuestion, onInterviewCompleted, onCandidateSpeech, onAudioLevel, onAiSpeakingConcluded, onError }) {
    this.token = token
    this.language = language || (navigator.language && navigator.language.startsWith('en') ? navigator.language : 'en-IN')
    this.onStateChange = onStateChange || (() => {})
    this.onTranscript = onTranscript || (() => {})
    this.onAiQuestion = onAiQuestion || (() => {})
    this.onInterviewCompleted = onInterviewCompleted || (() => {})
    this.onCandidateSpeech = onCandidateSpeech || (() => {})
    this.onAudioLevel = onAudioLevel || (() => {})
    this.onAiSpeakingConcluded = onAiSpeakingConcluded || (() => {})
    this.onError = onError || (() => {})

    this.ws = null
    this.inputAudioContext = null
    this.outputAudioContext = null
    this.mediaStream = null
    this.processorNode = null
    this.analyserNode = null
    this.animFrameId = null

    // Audio Playback & Jitter Buffer State
    this.audioQueue = []
    this.isPlaying = false
    this.scheduledTime = 0
    this.activeSources = []
    this.pcmByteCarryover = null // Residual odd byte carried across WebSocket chunks
    this.isAiTurnActive = false // Strictly true while Gemini Live audio turn is being generated/streamed
    this.turnCompletionTimer = null

    // Audio Diagnostics Metrics
    this.audioStats = {
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16,
      chunksReceived: 0,
      bytesReceived: 0,
      chunkSizes: [],
      chunkIntervals: [],
      lastChunkTimestamp: 0,
      droppedChunks: 0,
      duplicateChunks: 0,
      lastChunkIndex: -1,
      audioContextState: 'uninitialized',
    }

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

    // 30%-40% Voice Intensity Gate (Threshold: 0.35):
    // Ambient sound and background noise below 35% volume are strictly filtered out
    this.voiceIntensityThreshold = 0.35
    this.currentAudioLevel = 0
    this.lastVoiceAboveThresholdTime = 0
    this.highpassFilter = null

    if (typeof window !== 'undefined') {
      window.__QUALIFYAI_AUDIO_ENGINE__ = this
    }
  }

  /**
   * Pre-connect to backend Voice WebSocket gateway during countdown.
   * Establishes WebSocket + waits for Gemini Live 'session_ready' from server.
   * Returns a Promise that resolves to { success: true } or { success: false, error: string }.
   * Does NOT play any audio or start the interview conversation — strictly silent readiness check!
   */
  async preconnect(timeoutMs = 12000) {
    return new Promise((resolve) => {
      try {
        this._updateState('CONNECTING')

        // Connect to WebSocket Gateway
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.hostname === 'localhost' ? 'localhost:5000' : window.location.host
        const wsUrl = `${protocol}//${host}/ws/voice-interview?token=${encodeURIComponent(this.token)}`

        this.ws = new WebSocket(wsUrl)

        let settled = false
        const timeoutId = setTimeout(() => {
          if (!settled) {
            settled = true
            console.error('[VoiceEngine] Preconnect timed out after', timeoutMs, 'ms')
            resolve({ success: false, error: 'Connection to AI evaluator timed out. Please try again later.' })
          }
        }, timeoutMs)

        this.ws.onopen = () => {
          this.isConnected = true
          // Don't set up mic pipeline yet — wait for session_ready from server (Gemini Live connected)
        }

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)

            if (msg.type === 'session_ready') {
              // Gemini Live is fully connected and ready in background!
              this.isPreconnected = true
              if (!settled) {
                settled = true
                clearTimeout(timeoutId)
                resolve({ success: true })
              }
            } else if (msg.type === 'error') {
              if (!settled) {
                settled = true
                clearTimeout(timeoutId)
                resolve({ success: false, error: msg.message || 'Voice session initialization failed.' })
              }
            }
            // CRITICAL: During preconnect countdown, DO NOT process audio chunks or turns!
          } catch (err) {
            console.error('[VoiceEngine] Preconnect message parse error:', err)
          }
        }

        this.ws.onerror = (err) => {
          console.error('[VoiceEngine] WebSocket error during preconnect:', err)
          if (!settled) {
            settled = true
            clearTimeout(timeoutId)
            resolve({ success: false, error: 'Failed to connect to voice server. Please check your connection and try again.' })
          }
        }

        this.ws.onclose = (e) => {
          this.isConnected = false
          if (!settled) {
            settled = true
            clearTimeout(timeoutId)
            resolve({ success: false, error: 'Voice connection closed unexpectedly. Please try again later.' })
          }
          this._updateState('DISCONNECTED')
        }
      } catch (err) {
        console.error('[VoiceEngine] Preconnect initialization failed:', err)
        resolve({ success: false, error: err.message || 'Voice engine initialization failed.' })
      }
    })
  }

  /**
   * Attach full callbacks and set up microphone pipeline on a pre-connected engine.
   * Called by InterviewRoomPage after consuming the preconnected engine.
   */
  attachCallbacksAndMic({ onStateChange, onTranscript, onAiQuestion, onInterviewCompleted, onCandidateSpeech, onAudioLevel, onAiSpeakingConcluded, onError, language }) {
    this.isStopped = false
    if (onStateChange) this.onStateChange = onStateChange
    if (onTranscript) this.onTranscript = onTranscript
    if (onAiQuestion) this.onAiQuestion = onAiQuestion
    if (onInterviewCompleted) this.onInterviewCompleted = onInterviewCompleted
    if (onCandidateSpeech) this.onCandidateSpeech = onCandidateSpeech
    if (onAudioLevel) this.onAudioLevel = onAudioLevel
    if (onAiSpeakingConcluded) this.onAiSpeakingConcluded = onAiSpeakingConcluded
    if (onError) this.onError = onError
    if (language) this.language = language

    // Re-assign message and close handlers to use the updated callbacks
    if (this.ws) {
      this.ws.onmessage = (event) => this._handleServerMessage(event)
      this.ws.onerror = (err) => {
        console.error('[VoiceEngine] WebSocket error:', err)
        this.onError('WebSocket connection error')
      }
      this.ws.onclose = (e) => {
        this.isConnected = false
        if (!this.isStopped) {
          console.warn('[VoiceEngine] WebSocket closed unexpectedly. Attempting reconnection...')
          this._attemptReconnect()
        } else {
          this._updateState('DISCONNECTED')
        }
      }
    }

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
      this.ws.send(
        JSON.stringify({
          type: 'set_prevent_interruption',
          enabled: this.preventAiInterruption,
        })
      )
    }
    return this.preventAiInterruption
  }

  /**
   * Diagnostic reporter for developer / audio pipeline inspection
   */
  getAudioDiagnostics() {
    const avgSize = this.audioStats.chunkSizes.length
      ? Math.round(this.audioStats.chunkSizes.reduce((a, b) => a + b, 0) / this.audioStats.chunkSizes.length)
      : 0
    const avgInterval = this.audioStats.chunkIntervals.length
      ? Math.round(this.audioStats.chunkIntervals.reduce((a, b) => a + b, 0) / this.audioStats.chunkIntervals.length)
      : 0

    return {
      geminiFormat: 'audio/pcm;rate=24000 (16-bit LE mono)',
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16,
      chunksReceived: this.audioStats.chunksReceived,
      bytesReceived: this.audioStats.bytesReceived,
      averageChunkSize: avgSize,
      averageChunkIntervalMs: avgInterval,
      droppedChunks: this.audioStats.droppedChunks,
      duplicateChunks: this.audioStats.duplicateChunks,
      activeSourcesCount: this.activeSources.length,
      audioContextState: this.outputAudioContext?.state || 'closed',
      audioContextSampleRate: this.outputAudioContext?.sampleRate || 0,
      isAiTurnActive: this.isAiTurnActive,
      preventAiInterruption: this.preventAiInterruption,
      scheduledTime: this.scheduledTime,
      currentTime: this.outputAudioContext?.currentTime || 0,
      playbackLatencyMs: Math.max(0, Math.round((this.scheduledTime - (this.outputAudioContext?.currentTime || 0)) * 1000)),
    }
  }

  /**
   * Ensure output AudioContext is initialized and active without forcing sample rate
   */
  async _ensureOutputAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!this.outputAudioContext) {
        // Native hardware rate (44.1k/48k); Web Audio cleanly resamples 24kHz buffers
        this.outputAudioContext = new AudioCtx()
      }
      if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume()
      }
      this.audioStats.audioContextState = this.outputAudioContext.state
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
      this.inputAudioContext = new AudioCtx({ sampleRate: 16000 })
      await this._ensureOutputAudioContext()

      // Resume context if suspended by browser autoplay policy
      if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume()
      }

      // 2. Request Microphone Access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: false },
        },
      })

      // 3. Connect to WebSocket Gateway
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.hostname === 'localhost' ? 'localhost:5000' : window.location.host
      const wsUrl = `${protocol}//${host}/ws/voice-interview?token=${encodeURIComponent(this.token)}`

      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this.isConnected = true
        this.reconnectAttempts = 0
        this._setupMicrophonePipeline()
        this._setupSpeechRecognition()
        this._updateState('LISTENING')
        // Note: InterviewRoomPage explicitly calls markCandidateEnteredRoom() after 2 seconds!
      }

      this.ws.onmessage = (event) => {
        this._handleServerMessage(event)
      }

      this.ws.onerror = (err) => {
        console.error('[VoiceEngine] WebSocket error:', err)
        this.onError('WebSocket connection error')
      }

      this.ws.onclose = (e) => {
        this.isConnected = false
        if (!this.isStopped) {
          console.warn('[VoiceEngine] WebSocket closed unexpectedly. Attempting reconnection...')
          this._attemptReconnect()
        } else {
          this._updateState('DISCONNECTED')
        }
      }
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
        this.activeSources.length > 0 ||
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

      this.ws.send(
        JSON.stringify({
          type: 'audio_chunk',
          data: base64Audio,
          mimeType: 'audio/pcm;rate=16000',
        })
      )
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
      try {
        this.recognition.abort()
      } catch (_) {}
    } else if (!muted && !this.isManualMuted && this.recognition) {
      try {
        this.recognition.start()
      } catch (_) {}
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
            this.ws.send(JSON.stringify({ type: 'candidate_entered_room' }))
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

        case 'ai_audio_chunk':
          // Audio chunk from Gemini Live (24kHz PCM16 Base64) - strictly only play if in room!
          if (!this.hasEnteredRoom) {
            break
          }
          this.hasNativeAudioSession = true
          this.hasReceivedNativeAudioInCurrentTurn = true
          if ('speechSynthesis' in window) {
            try {
              window.speechSynthesis.cancel()
            } catch (_) {}
          }
          this._playAiAudioChunk(msg)
          break

        case 'ai_transcript_delta':
          if (!this.hasEnteredRoom) break
          this.onTranscript({ text: msg.text, isDelta: true, speaker: 'AI' })
          break

        case 'ai_turn_complete':
          if (!this.hasEnteredRoom) break
          this.onTranscript({
            text: msg.fullTranscript,
            questionText: msg.questionText,
            isNudge: msg.isNudge,
            isTermination: msg.isTermination,
            isFinal: true,
            speaker: 'AI',
          })

          // SINGLE-VOICE TURN RESOLUTION:
          // If native audio was actually received for this turn and not flagged as fallback,
          // let the Web Audio timeline conclude. Otherwise, immediately use browser SpeechSynthesis!
          const hasNativeAudioInCurrentTurn =
            (this.hasReceivedNativeAudioInCurrentTurn || this.activeSources.length > 0) && !msg.isFallback

          if (hasNativeAudioInCurrentTurn) {
            this.hasReceivedNativeAudioInCurrentTurn = false
            this.isAiTurnActive = false

            // Schedule graceful speaking conclusion once all queued audio completes on Web Audio timeline
            const remainingSec = Math.max(0, this.scheduledTime - (this.outputAudioContext?.currentTime || 0))
            if (this.turnCompletionTimer) clearTimeout(this.turnCompletionTimer)
            this.turnCompletionTimer = setTimeout(() => {
              if (!this.isAiTurnActive && this.activeSources.length === 0) {
                this._concludeAiSpeakingTurn()
              }
            }, Math.ceil((remainingSec + 0.12) * 1000))
          } else if ('speechSynthesis' in window && msg.fullTranscript) {
            // Immediate Fallback: Speak aloud via SpeechSynthesis whenever Gemini Live native audio is absent in this turn!
            try {
              window.speechSynthesis.cancel()
              const utterance = new SpeechSynthesisUtterance(msg.fullTranscript)
              utterance.lang = this.language || 'en-IN'
              utterance.rate = 1.02

              this._updateState('SPEAKING')
              this.isAutoMutedWhileSpeaking = true
              this._muteMicrophoneHardware(true)

              utterance.onend = () => {
                this._concludeAiSpeakingTurn()
              }

              utterance.onerror = () => {
                this._concludeAiSpeakingTurn()
              }

              window.speechSynthesis.speak(utterance)
            } catch (synthErr) {
              console.warn('[VoiceEngine] SpeechSynthesis fallback notice:', synthErr)
              this._concludeAiSpeakingTurn()
            }
          } else {
            // Audio finished or unavailable, restore microphone and return to listening
            this._concludeAiSpeakingTurn()
          }
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
      this.ws.send(JSON.stringify({ type: 'candidate_entered_room' }))
    }
  }

  /**
   * Speak newly generated real-time AI question and options aloud
   */
  speakAiQuestion(spokenText, force = false) {
    if (!spokenText || this.isStopped) return

    // 1. If WebSocket is connected, request Voice Gateway to deliver the prompt
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: force ? 'repeat_question' : 'speak_question',
          text: spokenText,
          force,
        })
      )
      return
    }

    // 2. Disconnected / offline fallback ONLY:
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(spokenText)
        utterance.lang = this.language || 'en-IN'
        utterance.rate = 1.02

        this._updateState('SPEAKING')
        this.isAutoMutedWhileSpeaking = true
        this._muteMicrophoneHardware(true)

        utterance.onend = () => {
          this._concludeAiSpeakingTurn()
        }

        utterance.onerror = () => {
          this._concludeAiSpeakingTurn()
        }

        window.speechSynthesis.speak(utterance)
      } catch (err) {
        console.warn('[VoiceEngine] speakAiQuestion speech error:', err)
      }
    }
  }

  /**
   * Request Voice Gateway or browser engine to explicitly repeat the active question aloud
   */
  repeatAiQuestion(spokenText) {
    return this.speakAiQuestion(spokenText, true)
  }

  /**
   * Decode Base64 16-bit Little-Endian PCM audio with cross-chunk byte carryover
   */
  _decodePcm16Chunk(base64Data) {
    if (!base64Data) return null
    let binaryString = ''
    try {
      binaryString = atob(base64Data)
    } catch (e) {
      console.error('[VoiceEngine] Base64 decode failed for audio chunk:', e)
      return null
    }

    const rawLen = binaryString.length
    if (rawLen === 0) return null

    // Combine any residual byte carried over from the previous chunk
    const carryoverLen = this.pcmByteCarryover ? this.pcmByteCarryover.length : 0
    const totalLen = carryoverLen + rawLen

    // PCM16 requires an even number of bytes (2 bytes per sample)
    const usableByteLen = totalLen - (totalLen % 2)
    const remainderLen = totalLen - usableByteLen

    const combinedBytes = new Uint8Array(usableByteLen)
    let destIdx = 0

    // 1. Insert carryover byte if available
    if (carryoverLen > 0) {
      for (let i = 0; i < carryoverLen && destIdx < usableByteLen; i++) {
        combinedBytes[destIdx++] = this.pcmByteCarryover[i]
      }
      this.pcmByteCarryover = null
    }

    // 2. Insert incoming bytes up to usable limit
    const binaryCopyLimit = usableByteLen - destIdx
    for (let i = 0; i < binaryCopyLimit; i++) {
      combinedBytes[destIdx++] = binaryString.charCodeAt(i)
    }

    // 3. Stash remainder byte for the next incoming chunk
    if (remainderLen > 0) {
      this.pcmByteCarryover = new Uint8Array(remainderLen)
      for (let i = 0; i < remainderLen; i++) {
        this.pcmByteCarryover[i] = binaryString.charCodeAt(binaryCopyLimit + i)
      }
    }

    if (usableByteLen < 2) return null

    // Convert Int16 (little-endian) to Float32 [-1.0, 1.0]
    const sampleCount = usableByteLen / 2
    const float32Array = new Float32Array(sampleCount)
    const dataView = new DataView(combinedBytes.buffer, combinedBytes.byteOffset, combinedBytes.byteLength)

    for (let i = 0; i < sampleCount; i++) {
      const int16 = dataView.getInt16(i * 2, true) // Little-endian
      // Proper Int16 normalization without DC shift or clipping
      float32Array[i] = int16 < 0 ? int16 / 32768.0 : int16 / 32767.0
    }

    return float32Array
  }

  /**
   * Schedule 24kHz PCM audio chunk onto Web Audio timeline with jitter buffering
   */
  async _playAiAudioChunk(chunkPayload) {
    if (!this.hasEnteredRoom) return
    await this._ensureOutputAudioContext()
    if (!this.outputAudioContext) return

    const base64Data = typeof chunkPayload === 'string' ? chunkPayload : chunkPayload?.data
    if (!base64Data) return

    const chunkIndex = typeof chunkPayload === 'object' ? chunkPayload.chunkIndex : null
    const now = Date.now()

    // 1. Metrics and Diagnostic Recording
    this.audioStats.chunksReceived++
    if (this.audioStats.lastChunkTimestamp) {
      this.audioStats.chunkIntervals.push(now - this.audioStats.lastChunkTimestamp)
      if (this.audioStats.chunkIntervals.length > 50) this.audioStats.chunkIntervals.shift()
    }
    this.audioStats.lastChunkTimestamp = now

    if (typeof chunkIndex === 'number') {
      if (this.audioStats.lastChunkIndex >= 0) {
        if (chunkIndex === this.audioStats.lastChunkIndex) {
          this.audioStats.duplicateChunks++
          console.warn(`[VoiceEngine] Duplicate audio chunk #${chunkIndex} received. Ignoring.`)
          return
        } else if (chunkIndex < this.audioStats.lastChunkIndex) {
          this.audioStats.droppedChunks++
          console.warn(`[VoiceEngine] Out-of-order audio chunk #${chunkIndex} < #${this.audioStats.lastChunkIndex}.`)
        } else if (chunkIndex > this.audioStats.lastChunkIndex + 1) {
          this.audioStats.droppedChunks += chunkIndex - (this.audioStats.lastChunkIndex + 1)
        }
      }
      this.audioStats.lastChunkIndex = chunkIndex
    }

    // 2. Decode PCM16 Little-Endian to Float32
    const float32Array = this._decodePcm16Chunk(base64Data)
    if (!float32Array || float32Array.length === 0) return

    this.audioStats.bytesReceived += float32Array.length * 2
    this.audioStats.chunkSizes.push(float32Array.length * 2)
    if (this.audioStats.chunkSizes.length > 50) this.audioStats.chunkSizes.shift()

    try {
      // 3. Create AudioBuffer at 24000Hz (native Web Audio resamples cleanly to output device)
      const audioBuffer = this.outputAudioContext.createBuffer(1, float32Array.length, 24000)
      audioBuffer.copyToChannel(float32Array, 0)

      // 4. Sequential timeline scheduling with 80ms jitter buffer cushion
      const JITTER_BUFFER_SEC = 0.08
      const currentTime = this.outputAudioContext.currentTime

      if (this.scheduledTime < currentTime) {
        this.scheduledTime = currentTime + JITTER_BUFFER_SEC
      }

      const source = this.outputAudioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(this.outputAudioContext.destination)
      source.start(this.scheduledTime)

      this.scheduledTime += audioBuffer.duration
      this.activeSources.push(source)

      // Mark speaking state and mute candidate mic hardware during AI delivery
      this.isAiTurnActive = true
      if (!this.isAutoMutedWhileSpeaking) {
        this.isAutoMutedWhileSpeaking = true
        this._muteMicrophoneHardware(true)
      }
      this._updateState('SPEAKING')

      source.onended = () => {
        const idx = this.activeSources.indexOf(source)
        if (idx !== -1) this.activeSources.splice(idx, 1)

        // Conclude speaking only when turn is completed AND all active sources have finished playing
        if (this.activeSources.length === 0 && !this.isAiTurnActive) {
          this._concludeAiSpeakingTurn()
        }
      }
    } catch (err) {
      console.error('[VoiceEngine] Failed to schedule audio chunk:', err)
    }
  }

  /**
   * Safe conclusion of AI speaking turn
   */
  _concludeAiSpeakingTurn() {
    if (this.turnCompletionTimer) {
      clearTimeout(this.turnCompletionTimer)
      this.turnCompletionTimer = null
    }
    this.isAiTurnActive = false
    this.isAutoMutedWhileSpeaking = false
    this.pcmByteCarryover = null
    if (!this.isManualMuted) {
      this._muteMicrophoneHardware(false)
      this._updateState('LISTENING')
    } else {
      this._updateState('MUTED')
    }
    if (this.onAiSpeakingConcluded) {
      this.onAiSpeakingConcluded()
    }
  }

  /**
   * Stop all active playing audio sources on interruption
   */
  _stopAiAudioPlayback() {
    if (this.turnCompletionTimer) {
      clearTimeout(this.turnCompletionTimer)
      this.turnCompletionTimer = null
    }
    this.isAiTurnActive = false
    for (const source of this.activeSources) {
      try {
        source.stop()
        source.disconnect()
      } catch (_) {}
    }
    this.activeSources = []
    this.pcmByteCarryover = null
    if (this.outputAudioContext) {
      this.scheduledTime = this.outputAudioContext.currentTime
    }
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

      this.recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i]
          const transcript = res[0]?.transcript || ''
          if (res.isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        // Interruption & Barge-in Handling while AI is speaking:
        if (this.conversationState === 'SPEAKING' || this.isAiTurnActive || this.activeSources.length > 0) {
          // If "Prevent AI Interruption" is enabled, background noise / speech MUST NOT interrupt the AI!
          if (this.preventAiInterruption) {
            return
          }

          // Only allow intentional barge-in if candidate spoke multiple distinct words
          const words = (interimTranscript || finalTranscript).trim().split(/\s+/)
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
              this.ws.send(JSON.stringify({ type: 'candidate_interrupted' }))
            }
            this._updateState('LISTENING')
            if (this.onAiSpeakingConcluded) {
              this.onAiSpeakingConcluded()
            }
          }
          return
        }

        // Stream real-time speech into candidate's response box
        if (interimTranscript) {
          this.onCandidateSpeech({ text: interimTranscript, isInterim: true, isFinal: false })
        }

        if (finalTranscript && finalTranscript.trim()) {
          this.onCandidateSpeech({ text: finalTranscript.trim(), isInterim: false, isFinal: true })
        }
      }

      this.recognition.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn('[VoiceEngine] SpeechRecognition notice:', e.error)
        }
      }

      this.recognition.onend = () => {
        if (this.isConnected && !this.isMuted && this.recognition) {
          try {
            this.recognition.start()
          } catch (_) {}
        }
      }

      this.recognition.start()
    } catch (err) {
      console.warn('[VoiceEngine] SpeechRecognition unavailable:', err)
    }
  }

  /**
   * Reset candidate speech recognition and flush any pending interim phrases
   * Called when transitioning to a new question so previous turn speech never leaks over.
   */
  resetCandidateSpeechRecognition() {
    if (this.recognition) {
      try {
        this.recognition.abort()
      } catch (_) {}
      setTimeout(() => {
        if (this.isConnected && !this.isMuted && !this.isAutoMutedWhileSpeaking && this.conversationState !== 'SPEAKING') {
          try {
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
    this.ws.send(
      JSON.stringify({
        type: 'candidate_transcript',
        text: text.trim(),
        questionSequence: metadata.questionSequence,
        questionId: metadata.questionId,
      })
    )
  }

  /**
   * Request AI evaluator silence nudge
   */
  triggerSilenceNudge(nudgeIndex = 1) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(
      JSON.stringify({
        type: 'trigger_nudge',
        nudgeIndex,
      })
    )
  }

  /**
   * Request skip to next JD question after 2 silence nudges
   */
  skipUnansweredQuestion(unansweredCount = 1) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(
      JSON.stringify({
        type: 'skip_unanswered_question',
        unansweredCount,
      })
    )
  }

  /**
   * Terminate assessment session after 3 unanswered questions
   */
  terminateForUnanswered() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(
      JSON.stringify({
        type: 'terminate_unanswered',
      })
    )
  }

  /**
   * Toggle candidate microphone mute
   */
  toggleMute() {
    this.isManualMuted = !this.isManualMuted
    this.isMuted = this.isManualMuted
    if (!this.isAutoMutedWhileSpeaking) {
      this._muteMicrophoneHardware(this.isMuted)
    }
    this._updateState(this.isMuted ? 'MUTED' : (this.isAutoMutedWhileSpeaking ? 'SPEAKING' : 'LISTENING'))
    return this.isMuted
  }

  /**
   * Set candidate microphone mute state explicitly (e.g. auto-mute for coding questions)
   */
  setMute(muted) {
    this.isManualMuted = Boolean(muted)
    this.isMuted = this.isManualMuted
    if (!this.isAutoMutedWhileSpeaking) {
      this._muteMicrophoneHardware(this.isMuted)
    }
    this._updateState(this.isMuted ? 'MUTED' : (this.isAutoMutedWhileSpeaking ? 'SPEAKING' : 'LISTENING'))
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

    if (this.outputAudioContext) {
      try {
        this.outputAudioContext.close()
      } catch (_) {}
      this.outputAudioContext = null
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

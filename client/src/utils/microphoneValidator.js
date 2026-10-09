/**
 * Microphone Signal Verification Engine
 * Provides technical capture validation to confirm genuine audio capture
 * without requiring loud peaks or arbitrary high decibel thresholds.
 * Distinguishes genuine quiet speech from digital silence, disconnected devices,
 * and isolated transient clicks/spikes.
 */

export const MICROPHONE_VERIFICATION_STATES = {
  WAITING_FOR_INPUT: 'waiting_for_input',
  INPUT_DETECTED: 'input_detected',
  VERIFIED: 'verified',
  NEEDS_ATTENTION: 'needs_attention',
}

export const MIC_VALIDATION_CONFIG = {
  // Quiet conversational speech floor (-58 dB allows quiet speech to pass while rejecting silence)
  MIN_DECIBEL_THRESHOLD: -58,
  // Minimum RMS amplitude to reject pure digital flatline
  MIN_RMS_THRESHOLD: 0.0005,
  // Minimum zero crossings per 2048-sample frame to reject DC offset or frozen buffer
  MIN_ZERO_CROSSINGS: 3,
  // Minimum valid active frames required in rolling window to verify
  MIN_ACTIVE_FRAMES: 5,
  // Minimum duration of active signal in milliseconds to reject single-frame transient clicks
  MIN_ACTIVE_DURATION_MS: 250,
  // Maximum rolling window duration in milliseconds
  ROLLING_WINDOW_MS: 450,
  // Margin above estimated noise floor to consider signal non-silent
  NOISE_FLOOR_MARGIN_DB: 3.0,
}

/**
 * Analyze an audio frame from Web Audio API Float32Array time domain data
 * @param {Float32Array|Array<number>} timeData - sample float array (-1.0 to 1.0)
 * @returns {object} Frame analysis metrics
 */
export function analyzeAudioFrame(timeData) {
  if (!timeData || timeData.length === 0) {
    return {
      rms: 0,
      db: -90,
      peakSample: 0,
      zeroCrossings: 0,
      isDigitalSilence: true,
    }
  }

  let sumSquares = 0
  let zeroCrossings = 0
  let prevSample = 0
  let peakSample = 0

  for (let i = 0; i < timeData.length; i++) {
    const s = timeData[i]
    sumSquares += s * s
    const absS = Math.abs(s)
    if (absS > peakSample) peakSample = absS
    if ((s > 0 && prevSample <= 0) || (s < 0 && prevSample >= 0)) {
      zeroCrossings++
    }
    prevSample = s
  }

  const rms = Math.sqrt(sumSquares / timeData.length)
  const db = rms > 0 ? 20 * Math.log10(rms) : -90
  const isDigitalSilence =
    rms < MIC_VALIDATION_CONFIG.MIN_RMS_THRESHOLD ||
    peakSample < 0.0003 ||
    zeroCrossings < MIC_VALIDATION_CONFIG.MIN_ZERO_CROSSINGS

  return {
    rms,
    db,
    peakSample,
    zeroCrossings,
    isDigitalSilence,
  }
}

/**
 * Determine if a single frame represents non-silent acoustic input
 * @param {object} frameMetrics - From analyzeAudioFrame
 * @param {number} noiseFloorDb - Current estimated background noise floor in dB
 * @returns {boolean} True if frame contains valid acoustic activity
 */
export function isFrameNonSilent(frameMetrics, noiseFloorDb = -65) {
  if (!frameMetrics || frameMetrics.isDigitalSilence) {
    return false
  }

  // Signal is valid if above the absolute minimum threshold OR distinctly above the ambient noise floor
  const isAboveFloor =
    frameMetrics.db >= MIC_VALIDATION_CONFIG.MIN_DECIBEL_THRESHOLD ||
    frameMetrics.db >= noiseFloorDb + MIC_VALIDATION_CONFIG.NOISE_FLOOR_MARGIN_DB

  return isAboveFloor && frameMetrics.zeroCrossings >= MIC_VALIDATION_CONFIG.MIN_ZERO_CROSSINGS
}

/**
 * Evaluate rolling window of frames to determine microphone verification state
 * Distinguishes genuine continuous speech from digital silence and transient noise spikes.
 * @param {Array<object>} rollingFrames - Array of frame records with timestamps and metrics
 * @param {number} noiseFloorDb - Current estimated background noise floor in dB
 * @param {number|null} referenceTime - Optional reference timestamp for testing or calculation
 * @returns {object} Evaluated verification status
 */
export function evaluateRollingWindow(rollingFrames, noiseFloorDb = -65, referenceTime = null) {
  if (!Array.isArray(rollingFrames) || rollingFrames.length === 0) {
    return {
      state: MICROPHONE_VERIFICATION_STATES.WAITING_FOR_INPUT,
      isVerified: false,
      activeFrameCount: 0,
      activeDurationMs: 0,
      message: 'Waiting for microphone audio input...',
    }
  }

  const refTime = referenceTime ?? (rollingFrames.length > 0 ? rollingFrames[rollingFrames.length - 1].timestamp : Date.now())
  // Keep only frames within the rolling window
  const recentFrames = rollingFrames.filter(
    (f) => refTime - f.timestamp <= MIC_VALIDATION_CONFIG.ROLLING_WINDOW_MS && f.timestamp <= refTime
  )

  if (recentFrames.length === 0) {
    return {
      state: MICROPHONE_VERIFICATION_STATES.WAITING_FOR_INPUT,
      isVerified: false,
      activeFrameCount: 0,
      activeDurationMs: 0,
      message: 'Waiting for microphone audio input...',
    }
  }

  const activeFrames = recentFrames.filter((f) => f.isNonSilent)

  if (activeFrames.length === 0) {
    // Check if there is faint physical audio that is simply quiet
    const hasFaintSignal = recentFrames.some(
      (f) => !f.isDigitalSilence && (f.peakSample > 0.0008 || f.rms > 0.0004)
    )

    if (hasFaintSignal) {
      return {
        state: MICROPHONE_VERIFICATION_STATES.WAITING_FOR_INPUT,
        isVerified: false,
        activeFrameCount: 0,
        activeDurationMs: 0,
        message: 'Audio signal is very quiet — please speak naturally or check device input volume.',
      }
    }

    return {
      state: MICROPHONE_VERIFICATION_STATES.WAITING_FOR_INPUT,
      isVerified: false,
      activeFrameCount: 0,
      activeDurationMs: 0,
      message: 'Microphone active — speak normally into your microphone...',
    }
  }

  const activeDurationMs =
    activeFrames.length > 1
      ? activeFrames[activeFrames.length - 1].timestamp - activeFrames[0].timestamp
      : 0

  // Single isolated transient spike (e.g. 1-2 frames from a mouse click or desk bump)
  const isTransientClick =
    activeFrames.length < MIC_VALIDATION_CONFIG.MIN_ACTIVE_FRAMES ||
    activeDurationMs < 120

  // Verified condition: sustained acoustic input across several frames and minimum duration
  const hasMetVerification =
    activeFrames.length >= MIC_VALIDATION_CONFIG.MIN_ACTIVE_FRAMES &&
    activeDurationMs >= MIC_VALIDATION_CONFIG.MIN_ACTIVE_DURATION_MS

  if (hasMetVerification) {
    return {
      state: MICROPHONE_VERIFICATION_STATES.VERIFIED,
      isVerified: true,
      activeFrameCount: activeFrames.length,
      activeDurationMs,
      message: 'Microphone verified. Genuine voice signal captured successfully.',
    }
  }

  if (isTransientClick) {
    return {
      state: MICROPHONE_VERIFICATION_STATES.INPUT_DETECTED,
      isVerified: false,
      activeFrameCount: activeFrames.length,
      activeDurationMs,
      message: 'Brief sound detected — speak continuously to confirm microphone...',
    }
  }

  return {
    state: MICROPHONE_VERIFICATION_STATES.INPUT_DETECTED,
    isVerified: false,
    activeFrameCount: activeFrames.length,
    activeDurationMs,
    message: 'Voice input detected — confirming microphone stream...',
  }
}

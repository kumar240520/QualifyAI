import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  MICROPHONE_VERIFICATION_STATES,
  MIC_VALIDATION_CONFIG,
  analyzeAudioFrame,
  isFrameNonSilent,
  evaluateRollingWindow,
} from '../../client/src/utils/microphoneValidator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '../../client/src')

describe('QUALIFYAI — Candidate Onboarding Layout & Microphone Verification Test Suite', () => {
  // --------------------------------------------------------------------------
  // PART 1: Layout & Container Removal Verification
  // --------------------------------------------------------------------------
  describe('Part 1: Candidate Onboarding Layout & Natural Scrolling', () => {
    const pagePath = path.resolve(clientRoot, 'pages/InvitationAcceptancePage.jsx')
    const pageContent = fs.readFileSync(pagePath, 'utf8')

    it('removes the enclosing right-side card container across all stages', () => {
      // Must not contain the old enclosing card wrapper with rounded-3xl and my-auto
      assert.ok(
        !pageContent.includes('rounded-3xl p-7 sm:p-9 lg:p-10 shadow-xs flex-1 flex flex-col justify-between max-w-3xl mx-auto w-full my-auto space-y-8'),
        'Stage 1 enclosing card wrapper must be removed'
      )
      assert.ok(
        !pageContent.includes('rounded-3xl p-7 sm:p-9 lg:p-10 shadow-xs flex-1 flex flex-col justify-between max-w-3xl mx-auto w-full my-auto space-y-6'),
        'Stage 2 enclosing card wrapper must be removed'
      )
      assert.ok(
        !pageContent.includes('rounded-3xl p-7 sm:p-9 lg:p-10 shadow-xs flex-1 flex flex-col justify-between max-w-3xl mx-auto w-full my-auto space-y-7'),
        'Stage 3 enclosing card wrapper must be removed'
      )

      // Content renders directly in spacious, un-cramped max-w-4xl container
      assert.ok(
        pageContent.includes('w-full max-w-4xl mx-auto flex-1 flex flex-col justify-between space-y-8'),
        'Stages must render directly in max-w-4xl layout without outer artificial card'
      )
    })

    it('enables natural page-level scrolling and removes nested overflow-y-auto traps', () => {
      // Root container must use min-h-screen and not lock overflow-hidden
      assert.ok(pageContent.includes('min-h-screen w-full bg-[#f8fafc]'), 'Root must use min-h-screen')
      assert.ok(!pageContent.includes('h-screen w-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col overflow-hidden'), 'Root must not lock viewport with h-screen overflow-hidden')

      // Main container must allow natural vertical expansion
      assert.ok(pageContent.includes('min-h-[calc(100vh-3.5rem)]'), 'Main workspace must have proper min-height')
      assert.ok(!pageContent.includes('<main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">'), 'Main must not trap children with overflow-hidden')

      // Right column content surface must not create a nested scroll container
      assert.ok(!pageContent.includes('<div className="lg:col-span-8 bg-[#f8fafc] p-6 sm:p-8 lg:p-10 flex flex-col justify-between overflow-y-auto">'), 'Right column must not create an internal scroll trap')
    })

    it('preserves the left sidebar exactly with sticky positioning and proctoring policy', () => {
      // Must preserve role info, 3 stages stepper, warning policy, and footer
      assert.ok(pageContent.includes('lg:col-span-4 bg-white'), 'Sidebar column exists')
      assert.ok(pageContent.includes('lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto'), 'Sidebar must be sticky on desktop')
      assert.ok(pageContent.includes('Assessment Onboarding Stages'), 'Onboarding stages stepper preserved')
      assert.ok(pageContent.includes('Strict 3-Strike Warning Policy'), 'Strict 3-strike warning policy preserved')
      assert.ok(pageContent.includes('3 warnings results in instant automatic detention'), 'Detention policy message preserved')
      assert.ok(pageContent.includes('Conversational AI Voice'), 'Format metadata preserved')
    })

    it('preserves individual component cards and styles', () => {
      // Stage 1 Profile card
      assert.ok(pageContent.includes('Candidate Profile Details'), 'Stage 1 form card preserved')
      // Stage 2 Warning banner & 6 Rule cards
      assert.ok(pageContent.includes('Strict Tab-Switch & 3-Warning Automatic Detention Rule'), 'Stage 2 warning banner preserved')
      assert.ok(pageContent.includes('Tab Switch & Focus Guard'), 'Rule 1 card preserved')
      assert.ok(pageContent.includes('Automatic Detention'), 'Rule 2 card preserved')
      assert.ok(pageContent.includes('Full-Screen Lockdown'), 'Rule 3 card preserved')
      assert.ok(pageContent.includes('Zero External AI Tools'), 'Rule 4 card preserved')
      assert.ok(pageContent.includes('Voice Acoustic Analysis'), 'Rule 5 card preserved')
      assert.ok(pageContent.includes('Single-Use Session'), 'Rule 6 card preserved')
      assert.ok(pageContent.includes('I solemnly agree to the Honor Code'), 'Honor code agreement card preserved')
      // Stage 3 Check cards
      assert.ok(pageContent.includes('Check 1: Live Microphone Audio Check'), 'Microphone check card preserved')
      assert.ok(pageContent.includes('Check 2: Camera & Face Detection'), 'Camera check card preserved')
      assert.ok(pageContent.includes('Check 3: Full Screen Tab Lockdown'), 'Fullscreen check card preserved')
    })

    it('preserves accessible footer actions across all stages', () => {
      assert.ok(pageContent.includes('Continue to Examination Rules'), 'Stage 1 continue button exists')
      assert.ok(pageContent.includes('Continue to Hardware Checks'), 'Stage 2 continue button exists')
      assert.ok(pageContent.includes('Start Assessment'), 'Stage 3 launch button exists')
      assert.ok(pageContent.includes('pt-6 border-t border-slate-200/80 flex items-center justify-between mt-auto'), 'Footer buttons use mt-auto and proper spacing')
    })
  })

  // --------------------------------------------------------------------------
  // PART 2: Microphone Verification Engine Unit & Acceptance Tests
  // --------------------------------------------------------------------------
  describe('Part 2: Microphone Verification Engine', () => {
    // Helper to generate synthetic audio sine waveform
    function generateSineWave(sampleRate, frequency, amplitude, numSamples) {
      const buffer = new Float32Array(numSamples)
      for (let i = 0; i < numSamples; i++) {
        buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate)
      }
      return buffer
    }

    it('Scenario 1: Normal conversational speech verifies successfully', () => {
      // Normal speech: ~200Hz voice pitch, amplitude 0.1 (-20 dBFS), 2048 samples
      const frameBuffer = generateSineWave(44100, 200, 0.1, 2048)
      const metrics = analyzeAudioFrame(frameBuffer)

      assert.strictEqual(metrics.isDigitalSilence, false, 'Speech frame must not be silence')
      assert.ok(metrics.rms > 0.05, `RMS should be ~0.07, got ${metrics.rms}`)
      assert.ok(metrics.db > -30, `dB should be ~-23 dB, got ${metrics.db}`)
      assert.ok(metrics.zeroCrossings > 10, 'Must have active zero crossings')

      const isNonSilent = isFrameNonSilent(metrics, -65)
      assert.strictEqual(isNonSilent, true, 'Speech frame must be non-silent')

      // Create rolling window of 6 speech frames spanning 300ms
      const baseTime = 1000000
      const rollingFrames = []
      for (let i = 0; i < 6; i++) {
        rollingFrames.push({
          timestamp: baseTime + i * 50,
          db: metrics.db,
          rms: metrics.rms,
          peakSample: metrics.peakSample,
          zeroCrossings: metrics.zeroCrossings,
          isDigitalSilence: false,
          isNonSilent: true,
        })
      }

      const evalResult = evaluateRollingWindow(rollingFrames, -65, baseTime + 250)
      assert.strictEqual(evalResult.state, MICROPHONE_VERIFICATION_STATES.VERIFIED)
      assert.strictEqual(evalResult.isVerified, true)
      assert.ok(evalResult.activeFrameCount >= 5)
      assert.ok(evalResult.activeDurationMs >= 250)
      assert.ok(evalResult.message.includes('verified'))
    })

    it('Scenario 2: Quiet but clearly detectable speech passes verification', () => {
      // Quiet speech: amplitude 0.003 (~ -50 dBFS, well above silence floor of -58 dB)
      const frameBuffer = generateSineWave(44100, 180, 0.003, 2048)
      const metrics = analyzeAudioFrame(frameBuffer)

      assert.strictEqual(metrics.isDigitalSilence, false, 'Quiet speech must not be digital silence')
      assert.ok(metrics.db >= MIC_VALIDATION_CONFIG.MIN_DECIBEL_THRESHOLD, `dB (${metrics.db}) must be >= ${MIC_VALIDATION_CONFIG.MIN_DECIBEL_THRESHOLD}`)
      assert.ok(isFrameNonSilent(metrics, -65), 'Quiet speech must be classified as non-silent')

      // 6 frames over 280ms
      const baseTime = 2000000
      const rollingFrames = []
      for (let i = 0; i < 6; i++) {
        rollingFrames.push({
          timestamp: baseTime + i * 50,
          db: metrics.db,
          rms: metrics.rms,
          peakSample: metrics.peakSample,
          zeroCrossings: metrics.zeroCrossings,
          isDigitalSilence: false,
          isNonSilent: true,
        })
      }

      const evalResult = evaluateRollingWindow(rollingFrames, -65, baseTime + 250)
      assert.strictEqual(evalResult.state, MICROPHONE_VERIFICATION_STATES.VERIFIED, 'Quiet speech must verify')
      assert.strictEqual(evalResult.isVerified, true)
    })

    it('Scenario 3: Low displayed input level (-55 dB) does not prevent verification', () => {
      // Signal at -55 dB with noise floor at -65 dB
      const frameBuffer = generateSineWave(44100, 150, 0.0025, 2048)
      const metrics = analyzeAudioFrame(frameBuffer)

      assert.strictEqual(isFrameNonSilent(metrics, -65), true)

      const baseTime = 3000000
      const rollingFrames = Array.from({ length: 6 }, (_, i) => ({
        timestamp: baseTime + i * 50,
        db: metrics.db,
        rms: metrics.rms,
        peakSample: metrics.peakSample,
        zeroCrossings: metrics.zeroCrossings,
        isDigitalSilence: false,
        isNonSilent: true,
      }))

      const evalResult = evaluateRollingWindow(rollingFrames, -65, baseTime + 250)
      assert.strictEqual(evalResult.isVerified, true, 'Low displayed dB value must still verify genuine audio')
    })

    it('Scenario 4: Digital silence or muted stream is rejected and does not verify', () => {
      // All zeros buffer (muted or disconnected stream)
      const zeroBuffer = new Float32Array(2048)
      const metrics = analyzeAudioFrame(zeroBuffer)

      assert.strictEqual(metrics.rms, 0)
      assert.strictEqual(metrics.isDigitalSilence, true, 'Zero buffer must be marked digital silence')
      assert.strictEqual(isFrameNonSilent(metrics, -65), false)

      const baseTime = 4000000
      const rollingFrames = Array.from({ length: 8 }, (_, i) => ({
        timestamp: baseTime + i * 40,
        db: -90,
        rms: 0,
        peakSample: 0,
        zeroCrossings: 0,
        isDigitalSilence: true,
        isNonSilent: false,
      }))

      const evalResult = evaluateRollingWindow(rollingFrames, -65, baseTime + 280)
      assert.strictEqual(evalResult.state, MICROPHONE_VERIFICATION_STATES.WAITING_FOR_INPUT)
      assert.strictEqual(evalResult.isVerified, false, 'Digital silence must never be marked verified')
      assert.ok(evalResult.message.includes('speak normally') || evalResult.message.includes('Waiting'))
    })

    it('Scenario 5: Single click or transient noise spike is rejected', () => {
      // A click is 1 high-energy frame (or 2 frames < 100ms) surrounded by silence
      const baseTime = 5000000
      const rollingFrames = [
        // Silence
        { timestamp: baseTime, db: -70, rms: 0.0001, peakSample: 0.0002, zeroCrossings: 2, isDigitalSilence: true, isNonSilent: false },
        // Transient Click spike (1 frame)
        { timestamp: baseTime + 40, db: -15, rms: 0.15, peakSample: 0.8, zeroCrossings: 35, isDigitalSilence: false, isNonSilent: true },
        // Immediate silence
        { timestamp: baseTime + 80, db: -72, rms: 0.0001, peakSample: 0.0002, zeroCrossings: 1, isDigitalSilence: true, isNonSilent: false },
        { timestamp: baseTime + 120, db: -72, rms: 0.0001, peakSample: 0.0002, zeroCrossings: 2, isDigitalSilence: true, isNonSilent: false },
      ]

      const evalResult = evaluateRollingWindow(rollingFrames, -65, baseTime + 120)
      assert.strictEqual(evalResult.isVerified, false, 'Transient click must NOT verify the microphone')
      assert.strictEqual(evalResult.state, MICROPHONE_VERIFICATION_STATES.INPUT_DETECTED)
      assert.ok(evalResult.message.includes('Brief sound') || evalResult.message.includes('detected'))
    })

    it('Scenario 6: Ambiguous / very faint signal shows instructional message without marking mic broken', () => {
      const baseTime = 6000000
      const rollingFrames = Array.from({ length: 6 }, (_, i) => ({
        timestamp: baseTime + i * 40,
        db: -63,
        rms: 0.0007,
        peakSample: 0.0015,
        zeroCrossings: 4,
        isDigitalSilence: false,
        isNonSilent: false, // below speech threshold
      }))

      const evalResult = evaluateRollingWindow(rollingFrames, -65, baseTime + 200)
      assert.strictEqual(evalResult.isVerified, false)
      assert.strictEqual(evalResult.state, MICROPHONE_VERIFICATION_STATES.WAITING_FOR_INPUT)
      assert.ok(evalResult.message.includes('very quiet') || evalResult.message.includes('speak naturally'), 'Must provide neutral helpful guidance')
    })

    it('Scenario 7: Evidence-based verification states are clearly distinct', () => {
      assert.strictEqual(MICROPHONE_VERIFICATION_STATES.WAITING_FOR_INPUT, 'waiting_for_input')
      assert.strictEqual(MICROPHONE_VERIFICATION_STATES.INPUT_DETECTED, 'input_detected')
      assert.strictEqual(MICROPHONE_VERIFICATION_STATES.VERIFIED, 'verified')
      assert.strictEqual(MICROPHONE_VERIFICATION_STATES.NEEDS_ATTENTION, 'needs_attention')
    })
  })

  // --------------------------------------------------------------------------
  // PART 3: InvitationAcceptancePage UI & Diagnostics Integration
  // --------------------------------------------------------------------------
  describe('Part 3: InvitationAcceptancePage Microphone UI & Diagnostics Integration', () => {
    const pagePath = path.resolve(clientRoot, 'pages/InvitationAcceptancePage.jsx')
    const pageContent = fs.readFileSync(pagePath, 'utf8')

    it('displays evidence-based status badges for all states in Check 1 UI', () => {
      assert.ok(pageContent.includes('VERIFIED ✓'), 'Must render VERIFIED ✓ badge')
      assert.ok(pageContent.includes('INPUT DETECTED'), 'Must render INPUT DETECTED badge')
      assert.ok(pageContent.includes('NEEDS ATTENTION'), 'Must render NEEDS ATTENTION badge')
      assert.ok(pageContent.includes('WAITING FOR INPUT'), 'Must render WAITING FOR INPUT badge')
    })

    it('explicitly labels input meter as a diagnostic visual indicator', () => {
      assert.ok(
        pageContent.includes('Live input level (Diagnostic meter)'),
        'Input meter header must be titled as a diagnostic meter'
      )
      assert.ok(
        pageContent.includes('aria-label="Microphone input level (Diagnostic visual indicator)"'),
        'Input meter aria-label must designate diagnostic indicator'
      )
    })

    it('implements stopMicTest and cleans up audio resources on unmount and countdown start', () => {
      assert.ok(pageContent.includes('const stopMicTest = () => {'), 'stopMicTest function must exist')
      assert.ok(pageContent.includes('micStreamRef.current.getTracks().forEach((track) => track.stop())'), 'Must stop all stream tracks')
      assert.ok(pageContent.includes('cancelAnimationFrame(animFrameRef.current)'), 'Must cancel animation frames')
      assert.ok(pageContent.includes('stopMicTest()'), 'stopMicTest must be called on restart, cleanup, and launch')
    })

    it('handles device disconnect and permission errors with actionable messages', () => {
      assert.ok(pageContent.includes('track.onended = () => {'), 'Must handle track onended disconnect event')
      assert.ok(pageContent.includes('MICROPHONE_VERIFICATION_STATES.NEEDS_ATTENTION'), 'Disconnect sets state to NEEDS_ATTENTION')
      assert.ok(pageContent.includes('Allow microphone access in your browser to continue.'), 'Actionable permission error message exists')
      assert.ok(pageContent.includes('The selected microphone disconnected. Choose an available input device.'), 'Actionable disconnect error message exists')
    })

    it('keeps camera, face detection, and fullscreen checks independent of microphone verification', () => {
      assert.ok(pageContent.includes('setIsReadyForAssessment(audioCheckPassed && cameraCheckPassed && faceCheckPassed && fullscreenCheckPassed)'), 'All four checks independently participate in readiness gate')
      assert.ok(pageContent.includes('handleStartCameraTest'), 'Camera test has its own independent starter')
      assert.ok(pageContent.includes('handleRequestFullscreen'), 'Fullscreen check is independent')
    })
  })
})

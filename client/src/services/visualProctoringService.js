import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const CHECK_INTERVAL_MS = 300

function faceYawRatio(landmarks) {
  const nose = landmarks?.[1]
  const left = landmarks?.[33]
  const right = landmarks?.[263]
  if (!nose || !left || !right) return null
  const eyeWidth = Math.abs(right.x - left.x)
  if (eyeWidth < 0.01) return null
  return (nose.x - Math.min(left.x, right.x)) / eyeWidth
}

export class VisualProctoringService {
  constructor({ video, stream, onEvent = () => {}, onStatus = () => {} } = {}) {
    this.video = video
    this.stream = stream || null
    this.onEvent = onEvent
    this.onStatus = onStatus
    this.landmarker = null
    this.frameId = null
    this.lastInferenceAt = 0
    this.pendingSince = new Map()
    this.reported = new Set()
    this.lastReportedAt = new Map()
    this.running = false
    this.facePresent = false
    this.cameraLostSince = null
    this.analysisFailed = false
    this.onTrackEnded = () => {
      this.cameraLostSince = Date.now()
      this.onStatus({ cameraReady: false, facePresent: false, message: 'Camera disconnected. Reconnect it to continue.' })
    }
  }

  async start() {
    this.analysisFailed = false
    if (!this.video) throw new Error('Camera preview is unavailable.')
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } },
        audio: false,
      })
    }
    this.stream.getVideoTracks().forEach((track) => track.addEventListener('ended', this.onTrackEnded))
    this.video.srcObject = this.stream
    await this.video.play()
    const vision = await FilesetResolver.forVisionTasks(WASM_ROOT)
    this.landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 3,
      minFaceDetectionConfidence: 0.65,
      minFacePresenceConfidence: 0.65,
      minTrackingConfidence: 0.65,
    })
    this.running = true
    this.onStatus({ cameraReady: true, facePresent: false, message: 'Camera ready. Position your face in the frame.' })
    this._schedule()
    return this.stream
  }

  _schedule() {
      if (!this.running) return
      this.frameId = requestAnimationFrame((now) => {
      if (!this.analysisFailed && now - this.lastInferenceAt >= CHECK_INTERVAL_MS) {
        this.lastInferenceAt = now
        this._analyzeFrame()
      }
      this._schedule()
    })
  }

  _analyzeFrame() {
    try {
      const liveCamera = this.stream?.getVideoTracks().some((track) => track.readyState === 'live')
      if (!liveCamera) {
        const now = Date.now()
        this.cameraLostSince ||= now
        this.onStatus({ cameraReady: false, facePresent: false, message: 'Camera disconnected. Reconnect it to continue.' })
        this._updateEpisode('CAMERA_LOST', now - this.cameraLostSince >= 2500, now, 1, 1, 'The camera connection was lost.')
        return
      }
      if (!this.video || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !this.landmarker) return
      const result = this.landmarker.detectForVideo(this.video, performance.now())
      const faces = result.faceLandmarks || []
      const now = Date.now()
      const facePresent = faces.length > 0
      this.facePresent = facePresent
      if (facePresent) this.cameraLostSince = null
      this.onStatus({ cameraReady: Boolean(this.stream?.getVideoTracks().some((track) => track.readyState === 'live')), facePresent, faceCount: faces.length })

      this._updateEpisode('FACE_ABSENT', !facePresent, now, 3000, 0.9, 'No face was visible in the camera for several seconds.')
      this._updateEpisode('MULTIPLE_FACES', faces.length > 1, now, 1400, 0.85, 'More than one face was visible in the camera.')
      const yaw = faces.length === 1 ? faceYawRatio(faces[0]) : null
      const lookingAway = yaw != null && (yaw < 0.20 || yaw > 0.80)
      this._updateEpisode('FACE_ORIENTATION', lookingAway, now, 3000, 0.75, 'Your face was turned away from the screen for several seconds.', { yawRatio: yaw })
      this._updateEpisode('CAMERA_LOST', Boolean(this.cameraLostSince && now - this.cameraLostSince >= 2500), now, 1, 1, 'The camera connection was lost.')
    } catch (error) {
      // A vision/model runtime error degrades visual checks but never interrupts voice or ends the interview.
      this.analysisFailed = true
      this.onStatus({ cameraReady: false, facePresent: this.facePresent, degraded: true, message: 'Camera analysis paused. Voice interview remains available.' })
      console.warn('[VisualProctoring] Frame analysis unavailable:', error.message)
    }
  }

  _updateEpisode(type, condition, now, thresholdMs, confidence, reason, details = {}) {
    if (!condition) {
      this.pendingSince.delete(type)
      this.reported.delete(type)
      return
    }
    const start = this.pendingSince.get(type) || now
    this.pendingSince.set(type, start)
    const durationMs = now - start
    if (durationMs < thresholdMs || this.reported.has(type)) return
    if (now - (this.lastReportedAt.get(type) || 0) < 15_000) return
    this.reported.add(type)
    this.lastReportedAt.set(type, now)
    this.onEvent({
      source: 'visual', type, confidence, durationMs: Math.max(durationMs, thresholdMs),
      timestamp: now, severity: type === 'MULTIPLE_FACES' ? 'HIGH' : 'MEDIUM', reason, metadata: details,
    })
  }

  getStatus() {
    return {
      cameraReady: Boolean(this.stream?.getVideoTracks().some((track) => track.readyState === 'live')),
      facePresent: this.facePresent,
    }
  }

  stop({ stopTracks = true } = {}) {
    this.running = false
    if (this.frameId != null) cancelAnimationFrame(this.frameId)
    this.frameId = null
    try { this.landmarker?.close() } catch (_) {}
    this.landmarker = null
    if (this.stream) {
      this.stream.getVideoTracks().forEach((track) => {
        track.removeEventListener('ended', this.onTrackEnded)
        if (stopTracks) track.stop()
      })
    }
    if (this.video) this.video.srcObject = null
    if (stopTracks) this.stream = null
  }
}

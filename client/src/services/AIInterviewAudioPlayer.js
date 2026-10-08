/**
 * AIInterviewAudioPlayer (Legacy compatibility alias for AudioPlaybackEngine)
 * All audio scheduling, queue management, and playback is authoritatively handled by AudioPlaybackEngine.
 */
import { AudioPlaybackEngine } from './AudioPlaybackEngine.js'

export { AudioPlaybackEngine }
export const AIInterviewAudioPlayer = AudioPlaybackEngine
export default AudioPlaybackEngine

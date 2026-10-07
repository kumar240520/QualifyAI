/**
 * QualifyAI Voice Profile Configuration
 * Configures the interviewer persona, tone, style, pacing, and voice mappings.
 */

export const VOICE_PROFILES = {
  sarah_recruiter: {
    id: 'sarah_recruiter',
    role: 'professional_interviewer',
    interviewerName: 'Sarah',
    gender: 'female',
    tone: 'warm',
    style: 'conversational',
    energy: 'moderate',
    pace: 'unhurried',
    speed: 0.88, // 12% slower for relaxed, thoughtful, natural recruiter cadence
    expressiveness: 'high',
    formality: 'professional',
    geminiVoice: 'Aoede',
    kokoroVoice: 'af_heart', // Top-rated natural Grade A conversational voice in Kokoro
    geminiModel: 'models/gemini-2.5-flash-native-audio-latest',
    fallbackModels: [
      'models/gemini-2.5-flash-native-audio-preview-12-2025',
      'models/gemini-3.1-flash-live-preview',
    ],
  },
  michael_recruiter: {
    id: 'michael_recruiter',
    role: 'professional_interviewer',
    interviewerName: 'Michael',
    gender: 'male',
    tone: 'warm',
    style: 'conversational',
    energy: 'moderate',
    pace: 'unhurried',
    speed: 0.88,
    expressiveness: 'high',
    formality: 'professional',
    geminiVoice: 'Charon', // Warm, deep, authoritative male interviewer voice
    kokoroVoice: 'am_michael',
    geminiModel: 'models/gemini-2.5-flash-native-audio-latest',
    fallbackModels: [
      'models/gemini-2.5-flash-native-audio-preview-12-2025',
      'models/gemini-3.1-flash-live-preview',
    ],
  },
  kore_recruiter: {
    id: 'kore_recruiter',
    role: 'professional_interviewer',
    interviewerName: 'Kore',
    gender: 'female',
    tone: 'calm',
    style: 'clear',
    energy: 'moderate',
    pace: 'natural',
    expressiveness: 'high',
    formality: 'professional',
    geminiVoice: 'Kore',
    kokoroVoice: 'af_kore',
    geminiModel: 'models/gemini-2.5-flash-native-audio-latest',
    fallbackModels: [
      'models/gemini-2.5-flash-native-audio-preview-12-2025',
    ],
  },
}

export const DEFAULT_VOICE_PROFILE = VOICE_PROFILES.sarah_recruiter

export function getVoiceProfile(profileId = null) {
  if (profileId && VOICE_PROFILES[profileId]) {
    return VOICE_PROFILES[profileId]
  }
  return DEFAULT_VOICE_PROFILE
}

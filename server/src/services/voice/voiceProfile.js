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
    pace: 'natural',
    expressiveness: 'high',
    formality: 'professional',
    geminiVoice: 'Aoede', // Top-rated natural, warm conversational voice in Gemini Live
    kokoroVoice: 'af_heart', // Top-rated natural Grade A conversational voice in Kokoro
    geminiModel: 'models/gemini-2.5-flash-native-audio-latest',
    fallbackModels: [
      'models/gemini-2.5-flash-native-audio-preview-12-2025',
      'models/gemini-3.1-flash-live-preview',
    ],
    sampleRate: 24000,
  },
  michael_recruiter: {
    id: 'michael_recruiter',
    role: 'professional_interviewer',
    interviewerName: 'Michael',
    gender: 'male',
    tone: 'warm',
    style: 'conversational',
    energy: 'moderate',
    pace: 'natural',
    expressiveness: 'high',
    formality: 'professional',
    geminiVoice: 'Charon', // Warm, deep, authoritative male interviewer voice
    kokoroVoice: 'am_michael',
    geminiModel: 'models/gemini-2.5-flash-native-audio-latest',
    fallbackModels: [
      'models/gemini-2.5-flash-native-audio-preview-12-2025',
      'models/gemini-3.1-flash-live-preview',
    ],
    sampleRate: 24000,
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
    sampleRate: 24000,
  },
}

export const DEFAULT_VOICE_PROFILE = VOICE_PROFILES.sarah_recruiter

export function getVoiceProfile(profileId = null) {
  if (profileId && VOICE_PROFILES[profileId]) {
    return VOICE_PROFILES[profileId]
  }
  return DEFAULT_VOICE_PROFILE
}

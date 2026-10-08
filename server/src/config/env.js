import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Vercel injects secrets through environment configuration; local dotenv loading is dev-only.
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') })
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  supabase: {
    url: process.env.SUPABASE_URL || 'https://gyyvjswwdhegfqxizdvl.supabase.co',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    defaultModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    liveModel: process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025',
  },
  tts: {
    enableNewTts: process.env.ENABLE_NEW_TTS !== 'false',
    provider: process.env.TTS_PROVIDER || 'cosyvoice',
    fallbackProvider: process.env.TTS_FALLBACK_PROVIDER || 'gemini_live',
    cosyvoice: {
      apiUrl: process.env.COSYVOICE_API_URL || 'http://localhost:50000',
      apiKey: process.env.COSYVOICE_API_KEY || '',
      model: process.env.COSYVOICE_MODEL || 'Fun-CosyVoice-3',
      voiceId: process.env.COSYVOICE_VOICE_ID || 'qualifyai_interviewer_01',
      sampleRate: parseInt(process.env.COSYVOICE_SAMPLE_RATE || '24000', 10),
    },
  },
}

if (!config.supabase.url || !config.supabase.anonKey) {
  console.warn('[Config Warning] Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment.')
}

if (!config.gemini.apiKey) {
  console.warn('[Config Info] GEMINI_API_KEY is not set yet in server/.env.')
}

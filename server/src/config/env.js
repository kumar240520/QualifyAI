import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

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
  },
}

if (!config.supabase.url || !config.supabase.anonKey) {
  console.warn('[Config Warning] Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment.')
}

if (!config.gemini.apiKey) {
  console.warn('[Config Info] GEMINI_API_KEY is not set yet in server/.env.')
}

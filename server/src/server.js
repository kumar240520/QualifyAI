import http from 'http'
import app from './app.js'
import { config } from './config/env.js'
import { VoiceGateway } from './services/voice/voiceGateway.js'
import { ttsManager } from './services/voice/providers/TTSManager.js'

// Local development adapter only. Vercel imports the stateless Express app from api/index.js.
const server = http.createServer(app)

// Attach real-time Voice Gateway WebSocket server on /ws/voice-interview
const voiceGateway = new VoiceGateway(server)

// Pre-initialize multi-tier TTS Manager & warm phrase cache on server startup
if (process.env.NODE_ENV !== 'test') {
  ttsManager.initialize().catch((err) => {
    console.warn('[Server] TTSManager pre-warm notice:', err.message)
  })
}

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server.listen(config.port, () => console.log(`QualifyAI local API listening on ${config.port}`))
}

export { voiceGateway }
export default server

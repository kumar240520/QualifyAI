import http from 'http'
import app from './app.js'
import { config } from './config/env.js'

// Local development adapter only. Vercel imports the stateless Express app from api/index.js.
const server = http.createServer(app)

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server.listen(config.port, () => console.log(`QualifyAI local API listening on ${config.port}`))
}

export default server

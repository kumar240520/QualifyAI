import express from 'express'
import cors from 'cors'
import { config } from './config/env.js'
import authRoutes from './routes/authRoutes.js'
import aiRoutes from './routes/aiRoutes.js'
import jobRoutes from './routes/jobRoutes.js'
import invitationRoutes from './routes/invitationRoutes.js'
import interviewRoutes from './routes/interviewRoutes.js'
import datasetRoutes from './routes/datasetRoutes.js'
import modelEvaluationRoutes from './routes/modelEvaluationRoutes.js'
import geminiRoutes from './routes/geminiRoutes.js'
import voiceRoutes from './routes/voiceRoutes.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
const configuredOrigins = new Set(
  [
    config.clientUrl,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
  ]
    .filter(Boolean)
    .map((origin) => origin.replace(/\/$/, ''))
)

app.disable('x-powered-by')
if (process.env.VERCEL) app.set('trust proxy', true)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (config.nodeEnv === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  next()
})
app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.has(origin.replace(/\/$/, ''))) return callback(null, true)
    try {
      if (origin && /\.vercel\.app$/.test(new URL(origin).hostname)) return callback(null, true)
    } catch (_) {}
    if (config.nodeEnv !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true)
    return callback(new Error('Origin is not allowed by CORS.'))
  },
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use((req, res, next) => {
  const started = Date.now()
  res.on('finish', () => console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - started}ms`))
  next()
})

app.get('/', (_req, res) => res.status(200).json({
  name: 'QualifyAI Backend API',
  status: 'online',
  health: '/api/health',
  version: '1.2.0',
}))

app.get('/api', (_req, res) => res.status(200).json({
  name: 'QualifyAI Backend API',
  status: 'online',
  health: '/api/health',
  version: '1.2.0',
}))

app.get('/api/health', (_req, res) => res.status(200).json({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  version: '1.2.0',
  environment: config.nodeEnv,
  supabaseConfigured: Boolean(config.supabase.url && config.supabase.anonKey),
  geminiConfigured: Boolean(config.gemini.apiKey),
}))

app.use('/api/auth', authRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api/invitations', invitationRoutes)
app.use('/api/interviews', interviewRoutes)
app.use('/api/datasets', datasetRoutes)
app.use('/api/model-benchmarks', modelEvaluationRoutes)
app.use('/api/gemini', geminiRoutes)
app.use('/api/voice', voiceRoutes)
app.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` } }))
app.use(errorHandler)

export default app

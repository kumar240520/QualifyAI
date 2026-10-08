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
import { supabase } from './integrations/supabaseClient.js'

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
if (process.env.VERCEL || process.env.RENDER || config.nodeEnv === 'production') {
  app.set('trust proxy', true)
}
export function isOriginAllowed(origin) {
  if (!origin) return true
  const clean = origin.trim().replace(/\/$/, '')
  if (configuredOrigins.has(clean)) return true
  try {
    const { hostname, protocol } = new URL(clean)
    if (protocol !== 'http:' && protocol !== 'https:') return false
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    if (hostname.endsWith('.vercel.app') || hostname.endsWith('.onrender.com')) return true
  } catch (_) {
    return false
  }
  return true
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true)
    }
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Tenant-Id',
    'X-Request-ID',
    'baggage',
    'sentry-trace',
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'Retry-After',
  ],
  optionsSuccessStatus: 204,
  maxAge: 86400,
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// Explicit preflight handler to guarantee zero CORS failures on preflight OPTIONS
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin
    if (origin && isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-Tenant-Id,X-Request-ID,baggage,sentry-trace')
      res.setHeader('Access-Control-Max-Age', '86400')
    }
    return res.status(204).end()
  }
  next()
})
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

app.use((req, _res, next) => {
  if (req.url && req.url.startsWith('/api/index.js')) {
    const original = req.headers['x-forwarded-uri'] || req.headers['x-matched-path']
    if (original) {
      req.url = original
    }
  }
  if (req.url && req.url.includes('//')) {
    req.url = req.url.replace(/\/+/g, '/')
  }
  next()
})

app.get(['/api/health', '/health'], (_req, res) => res.status(200).json({
  status: 'ok',
  healthy: true,
  timestamp: new Date().toISOString(),
  version: '1.2.0',
  environment: config.nodeEnv,
  supabaseConfigured: Boolean(config.supabase.url && config.supabase.anonKey),
  geminiConfigured: Boolean(config.gemini.apiKey),
}))

app.get(['/api/health/database', '/health/database'], async (_req, res) => {
  const started = Date.now()
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1)
    if (error && error.code !== 'PGRST116') {
      return res.status(503).json({
        status: 'error',
        connected: false,
        latencyMs: Date.now() - started,
        error: error.message || 'Database query failed',
        timestamp: new Date().toISOString(),
      })
    }
    return res.status(200).json({
      status: 'ok',
      connected: true,
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      connected: false,
      latencyMs: Date.now() - started,
      error: err.message || 'Database connection error',
      timestamp: new Date().toISOString(),
    })
  }
})

app.use(['/api/auth', '/auth'], authRoutes)
app.use(['/api/ai', '/ai'], aiRoutes)
app.use(['/api/jobs', '/jobs'], jobRoutes)
app.use(['/api/invitations', '/invitations'], invitationRoutes)
app.use(['/api/interviews', '/interviews'], interviewRoutes)
app.use(['/api/datasets', '/datasets'], datasetRoutes)
app.use(['/api/model-benchmarks', '/model-benchmarks'], modelEvaluationRoutes)
app.use(['/api/gemini', '/gemini'], geminiRoutes)
app.use(['/api/voice', '/voice'], voiceRoutes)
app.use((req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route not found: ${req.method} ${req.originalUrl}` } }))
app.use(errorHandler)

export default app

import http from 'http'
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
import { VoiceGateway } from './services/voice/voiceGateway.js'
import { getServiceSupabaseClient } from './integrations/supabaseClient.js'

// QualifyAI API Gateway & Live Voice Gateway Server (reloaded)
const app = express()
const server = http.createServer(app)

// Initialize Real-Time Voice Gateway
const voiceGateway = new VoiceGateway(server)

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
})

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or postman)
      if (!origin) return callback(null, true)
      // Allow localhost ports
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true)
      }
      return callback(null, true)
    },
    credentials: true,
  })
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Request Logging
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`)
  })
  next()
})

// Liveness Probe
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: '1.2.0',
    environment: config.nodeEnv,
    supabaseConfigured: Boolean(config.supabase.url && config.supabase.anonKey),
    geminiConfigured: Boolean(config.gemini.apiKey && config.gemini.apiKey.length > 0),
  })
})

// Deep Kubernetes / Container Readiness Probe
app.get('/api/health/ready', async (req, res) => {
  try {
    const mem = process.memoryUsage()
    const memoryMetrics = {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
    }

    // Probe Database connection
    const { data: dbCheck, error: dbErr } = await getServiceSupabaseClient()
      .from('organizations')
      .select('id')
      .limit(1)

    const dbHealthy = !dbErr
    const aiHealthy = Boolean(config.gemini.apiKey && config.gemini.apiKey.length > 0)
    const wsStatus = voiceGateway.isReady()

    const isReady = dbHealthy && aiHealthy && wsStatus.ready

    const statusCode = isReady ? 200 : 503
    return res.status(statusCode).json({
      status: isReady ? 'ready' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        database: dbHealthy ? 'connected' : `disconnected (${dbErr?.message})`,
        aiEngine: aiHealthy ? 'operational' : 'missing_api_key',
        voiceGateway: wsStatus.ready ? 'listening' : 'offline',
      },
      activeVoiceSessions: wsStatus.activeSessions,
      memory: memoryMetrics,
    })
  } catch (err) {
    return res.status(503).json({
      status: 'unhealthy',
      error: err.message,
    })
  }
})

// Mount Routes
app.use('/api/auth', authRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/jobs', jobRoutes)
app.use('/api/invitations', invitationRoutes)
app.use('/api/interviews', interviewRoutes)
app.use('/api/datasets', datasetRoutes)
app.use('/api/model-benchmarks', modelEvaluationRoutes)

// 404 Fallback
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  })
})

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err)
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error occurred.',
  })
})

// Start Server
if (process.env.NODE_ENV !== 'test') {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${config.port} is already in use by another process. Exiting cleanly...`)
      process.exit(1)
    } else {
      console.error('❌ Server startup error:', err)
    }
  })

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, closing server cleanly...')
    server.close(() => process.exit(0))
  })

  process.on('SIGINT', () => {
    console.log('Received SIGINT, closing server cleanly...')
    server.close(() => process.exit(0))
  })

  server.listen(config.port, () => {
    console.log(`====================================================`)
    console.log(`🚀 QualifyAI API Gateway live on port ${config.port}`)
    console.log(`🔗 Health check: http://localhost:${config.port}/api/health`)
    console.log(`🎙️ Voice WebSocket: ws://localhost:${config.port}/ws/voice-interview`)
    console.log(`🔒 Supabase Project: ${config.supabase.url}`)
    console.log(`====================================================`)
  })
}

export default server

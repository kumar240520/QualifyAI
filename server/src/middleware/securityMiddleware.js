/**
 * Security & Hardening Middleware (Phase 12)
 * Implements:
 * 1. High-Performance Sliding Window Rate Limiting (Brute-force & DoS prevention)
 * 2. Candidate Input Sanitization & Max Length Guards
 * 3. AI Prompt Injection Neutralization
 */

import { createHash } from 'node:crypto'
import { getServiceSupabaseClient } from '../integrations/supabaseClient.js'

// Local-only fallback used when running without the Postgres limiter during development.
const requestBuckets = new Map()

if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of requestBuckets.entries()) {
    const valid = timestamps.filter((t) => now - t < 15 * 60 * 1000)
    if (valid.length === 0) {
      requestBuckets.delete(key)
    } else {
      requestBuckets.set(key, valid)
    }
  }
}, 5 * 60 * 1000).unref?.()

/**
 * Creates a sliding-window rate limiter
 * @param {Object} options
 * @param {number} options.windowMs Window duration in milliseconds
 * @param {number} options.maxRequests Maximum requests allowed per window
 * @param {string} options.message Error message returned upon limit breach
 */
export function createRateLimiter({
  windowMs = 60 * 1000,
  maxRequests = 30,
  message = 'Too many requests. Please try again later.',
  keyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || 'global',
}) {
  return (req, res, next) => {
    const source = `${req.baseUrl || req.path}:${keyGenerator(req)}`
    const key = createHash('sha256').update(source).digest('hex')
    const localFallback = () => {
      const now = Date.now()
      const timestamps = (requestBuckets.get(key) || []).filter((timestamp) => now - timestamp < windowMs)
      if (timestamps.length >= maxRequests) {
        const retryAfter = Math.ceil((timestamps[0] + windowMs - now) / 1000)
        res.setHeader('Retry-After', retryAfter)
        res.setHeader('X-RateLimit-Limit', maxRequests)
        res.setHeader('X-RateLimit-Remaining', 0)
        return res.status(429).json({ success: false, error: message, retryAfterSeconds: retryAfter })
      }
      timestamps.push(now)
      requestBuckets.set(key, timestamps)
      res.setHeader('X-RateLimit-Limit', maxRequests)
      res.setHeader('X-RateLimit-Remaining', maxRequests - timestamps.length)
      return next()
    }

    let supabase
    try {
      supabase = getServiceSupabaseClient()
    } catch (error) {
      if (!process.env.VERCEL) return localFallback()
      console.error('[Security] Persistent rate limiter unavailable:', error.message)
      return res.status(503).json({ success: false, error: 'Request protection is temporarily unavailable. Please retry shortly.' })
    }
    supabase.rpc('consume_api_rate_limit', {
      p_bucket_key: key,
      p_window_seconds: Math.ceil(windowMs / 1000),
      p_max_requests: maxRequests,
    }).then(({ data, error }) => {
      if (error) throw error
      const result = Array.isArray(data) ? data[0] : data
      if (!result || typeof result.allowed !== 'boolean') throw new Error('Invalid rate limiter response')
      res.setHeader('X-RateLimit-Limit', maxRequests)
      res.setHeader('X-RateLimit-Remaining', result.remaining)
      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfterSeconds)
        return res.status(429).json({ success: false, error: message, retryAfterSeconds: result.retryAfterSeconds })
      }
      return next()
    }).catch((error) => {
      if (process.env.VERCEL) {
        console.error('[Security] Persistent rate limit failed:', error.message)
        return res.status(503).json({ success: false, error: 'Request protection is temporarily unavailable. Please retry shortly.' })
      }
      return localFallback()
    })
  }
}

/**
 * Pre-configured Rate Limiters for API Gateway
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // 50 attempts per 15 min per IP
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
})

export const candidateAnswerRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 45, // 45 answer submissions per minute per candidate
  message: 'Answer submission rate limit exceeded. Please pace your responses.',
  keyGenerator: (req) => req.body?.token || req.params.id || req.ip,
})

export const aiSynthesisRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 AI generations per minute per recruiter
  message: 'AI generation concurrency limit reached. Please wait a moment before re-generating.',
  keyGenerator: (req) => req.user?.id || req.ip,
})

/**
 * Candidate Input Sanitization & Prompt Injection Neutralization
 */
export function sanitizeCandidateInput(req, res, next) {
  if (req.body && typeof req.body.answerText === 'string') {
    let input = req.body.answerText.trim()

    // 1. Bound maximum character length (Max 12,000 characters per turn)
    if (input.length > 12000) {
      return res.status(400).json({
        success: false,
        error: 'Answer exceeds the maximum length limit of 12,000 characters.',
      })
    }

    // 2. Neutralize known LLM prompt injection and instruction override delimiters
    input = input
      .replace(/<\/?system>/gi, '[system-tag-stripped]')
      .replace(/\[INST\]/gi, '[inst-stripped]')
      .replace(/\[\/INST\]/gi, '[/inst-stripped]')
      .replace(/<<SYS>>/gi, '[sys-stripped]')
      .replace(/<\/SYS>>/gi, '[/sys-stripped]')
      .replace(/---BEGIN INSTRUCTION---/gi, '[instruction-delimiter-stripped]')
      .replace(/---END INSTRUCTION---/gi, '[instruction-delimiter-stripped]')

    req.body.answerText = input
  }

  next()
}

/**
 * Helper to wrap untrusted dialogue transcripts in structured XML boundaries for LLM evaluation
 */
export function wrapUntrustedTranscript(transcripts) {
  return transcripts
    .map((t) => {
      // Neutralize any XML closing tags inside transcript content
      const safeContent = (t.content || '')
        .replace(/<\/candidate_response>/gi, '&lt;/candidate_response&gt;')
        .replace(/<\/ai_question>/gi, '&lt;/ai_question&gt;')

      if (t.speaker === 'AI') {
        return `<ai_question turn="${t.sequence}">\n${safeContent}\n</ai_question>`
      } else {
        return `<candidate_response turn="${t.sequence}">\n${safeContent}\n</candidate_response>`
      }
    })
    .join('\n\n')
}

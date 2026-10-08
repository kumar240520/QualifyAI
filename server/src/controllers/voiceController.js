import { randomUUID } from 'node:crypto'
import { getServiceSupabaseClient } from '../integrations/supabaseClient.js'
import { ttsManager } from '../services/voice/providers/TTSManager.js'
import { DEFAULT_VOICE_PROFILE } from '../services/voice/voiceProfile.js'

export const voiceController = {
  async synthesize(req, res) {
    const token = String(req.body?.token || '').trim()
    const text = String(req.body?.text || '').trim()
    if (!token || token.length > 512) return res.status(401).json({ success: false, error: 'A valid interview invitation is required.' })
    if (!text || text.length > 5000) return res.status(400).json({ success: false, error: 'Speech text must contain between 1 and 5000 characters.' })

    try {
      const supabase = getServiceSupabaseClient()
      const { data: invitation, error } = await supabase
        .from('invitations')
        .select('status,expires_at')
        .eq('token', token)
        .maybeSingle()
      if (error) throw error
      if (!invitation) return res.status(404).json({ success: false, error: 'Interview invitation not found.' })
      if (['COMPLETED', 'EXPIRED', 'CANCELLED'].includes(String(invitation.status).toUpperCase()) || (invitation.expires_at && Date.parse(invitation.expires_at) <= Date.now())) {
        return res.status(410).json({ success: false, error: 'This interview invitation is no longer active.' })
      }

      res.status(200)
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store, no-transform')
      res.setHeader('X-Accel-Buffering', 'no')
      res.flushHeaders?.()

      const turnId = randomUUID()
      const abortController = new AbortController()
      res.on('close', () => {
        if (!res.writableEnded) abortController.abort()
      })
      const write = (event) => {
        if (!res.destroyed && !res.writableEnded) res.write(`${JSON.stringify(event)}\n`)
      }
      write({ type: 'start', audioTurnId: turnId, text })

      try {
        const result = await ttsManager.synthesize({
          text,
          voiceProfile: DEFAULT_VOICE_PROFILE,
          preferredProvider: 'cosyvoice',
          timeoutMs: Math.max(30000, text.length * 150),
          onChunk: (chunk) => write({ type: 'audio_chunk', audioTurnId: turnId, ...chunk }),
        })
        write({ type: 'complete', audioTurnId: turnId, text: result.fullTranscript || text, provider: result.providerUsed || 'cosyvoice' })
      } catch (synthesisError) {
        write({ type: 'error', audioTurnId: turnId, error: synthesisError.message || 'CosyVoice could not synthesize this prompt.' })
      } finally {
        if (!res.destroyed && !res.writableEnded) res.end()
      }
    } catch (error) {
      console.error('[VoiceController.synthesize]', error.message)
      if (!res.headersSent) return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to authorize voice synthesis.' })
      if (!res.writableEnded) res.end()
    }
  },
}

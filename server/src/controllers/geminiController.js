import { GoogleGenAI } from '@google/genai'
import { config } from '../config/env.js'
import { getServiceSupabaseClient } from '../integrations/supabaseClient.js'

const LIVE_SYSTEM_INSTRUCTION = `You are the voice for a structured job interview. Speak only the exact interviewer message sent by the application. Do not invent questions, evaluate answers, reveal private scoring, or continue the conversation on your own. Use a clear, natural, concise professional speaking style.`

export const geminiController = {
  async createLiveToken(req, res) {
    try {
      const invitationToken = String(req.body?.token || '').trim()
      const requestedInterviewId = String(req.body?.interviewId || '').trim()
      if (!invitationToken || invitationToken.length > 512) {
        return res.status(401).json({ success: false, error: 'A valid interview invitation token is required.' })
      }
      if (!config.gemini.apiKey) return res.status(503).json({ success: false, error: 'Live voice is not configured.' })

      const supabase = getServiceSupabaseClient()
      const { data: invitation, error: invitationError } = await supabase
        .from('invitations')
        .select('id,job_id,candidate_id,status,expires_at,interview_duration_minutes')
        .eq('token', invitationToken)
        .maybeSingle()
      if (invitationError) throw invitationError
      if (!invitation) return res.status(404).json({ success: false, error: 'Invalid interview invitation.' })
      if (['COMPLETED', 'EXPIRED'].includes(invitation.status) || Date.parse(invitation.expires_at) <= Date.now()) {
        return res.status(410).json({ success: false, error: 'This interview invitation has expired.' })
      }
      const { data: interview, error: interviewError } = await supabase
        .from('interviews')
        .select('id,status,candidate_id,job_id')
        .eq('candidate_id', invitation.candidate_id)
        .eq('job_id', invitation.job_id)
        .maybeSingle()
      if (interviewError) throw interviewError
      if (!interview || (requestedInterviewId && requestedInterviewId !== interview.id)) {
        if (requestedInterviewId || interview) return res.status(403).json({ success: false, error: 'This invitation is not authorized for that interview.' })
      }
      if (interview && ['COMPLETED', 'EVALUATED', 'CANCELLED'].includes(interview.status)) {
        return res.status(403).json({ success: false, error: 'This interview is no longer active.' })
      }
      const { data: session, error: sessionError } = interview
        ? await supabase.from('interview_sessions').select('id,session_metadata').eq('interview_id', interview.id).maybeSingle()
        : { data: null, error: null }
      if (sessionError) throw sessionError

      const endsAt = session?.session_metadata?.ends_at
      const expiry = endsAt && Number.isFinite(Date.parse(endsAt))
        ? new Date(endsAt)
        : new Date(Date.now() + Math.max(1, Number(session?.session_metadata?.duration_minutes || invitation.interview_duration_minutes) || 30) * 60_000)
      if (invitation.expires_at && Date.parse(invitation.expires_at) < expiry.getTime()) expiry.setTime(Date.parse(invitation.expires_at))
      if (expiry.getTime() <= Date.now()) return res.status(410).json({ success: false, error: 'The interview time has expired.' })

      const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })
      const token = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime: expiry.toISOString(),
          liveConnectConstraints: {
            model: config.gemini.liveModel,
            config: {
              responseModalities: ['AUDIO'],
              systemInstruction: LIVE_SYSTEM_INSTRUCTION,
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
              sessionResumption: {},
              contextWindowCompression: { slidingWindow: {} },
            },
          },
          lockAdditionalFields: ['responseModalities', 'systemInstruction', 'speechConfig', 'sessionResumption', 'contextWindowCompression'],
        },
      })
      return res.status(200).json({
        success: true,
        data: {
          token: token.name,
          model: config.gemini.liveModel,
          interviewId: interview?.id || null,
          sessionId: session?.id || null,
          expiresAt: token.expireTime || expiry.toISOString(),
        },
      })
    } catch (error) {
      console.error('[GeminiController.createLiveToken]', error.message)
      return res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Unable to initialize live voice.' })
    }
  },
}

import { GoogleGenAI, Type } from '@google/genai'
import { config } from '../../config/index.js'
import { getServiceSupabaseClient } from '../../integrations/supabaseClient.js'
import { evaluationEngineService } from '../evaluation/evaluationEngineService.js'

/**
 * Domain Service for Candidate Diagnostic Experience (Phase 11)
 * Generates and serves constructive, privacy-first, growth-oriented feedback
 * strictly decoupled from internal recruiter hiring decisions and proctoring telemetry.
 */
export const candidateDiagnosticService = {
  /**
   * Helper: call Gemini with structured schema with model fallback
   */
  async _callGeminiStructured({ prompt, responseSchema }) {
    const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
    ]

    let lastError = null
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.3,
          },
        })

        const text = response.text
        return JSON.parse(text)
      } catch (err) {
        lastError = err
        console.warn(`[CandidateDiagnosticService] Model ${model} failed, attempting fallback:`, err.message)
      }
    }
    throw new Error(`All Gemini candidate diagnostic models failed: ${lastError?.message}`)
  },

  /**
   * Synthesize or retrieve Candidate Diagnostic Report
   */
  async generateCandidateDiagnostic(interviewId) {
    const supabase = getServiceSupabaseClient()

    // 1. Fetch interview details with job & candidate
    const { data: interview, error: intErr } = await supabase
      .from('interviews')
      .select('*, jobs(*), candidates(*)')
      .eq('id', interviewId)
      .single()

    if (intErr || !interview) {
      const err = new Error(`Interview not found: ${interviewId}`)
      err.status = 404
      throw err
    }

    const job = interview.jobs
    const candidate = interview.candidates

    // 2. Check if diagnostic report already exists
    const { data: existingReport } = await supabase
      .from('candidate_diagnostic_reports')
      .select('*')
      .eq('interview_id', interviewId)
      .maybeSingle()

    if (existingReport) {
      return {
        id: existingReport.id,
        interview_id: interviewId,
        candidate_name: candidate.full_name,
        candidate_email: candidate.email,
        job_title: job.title,
        department: job.department,
        completed_at: interview.completed_at || interview.updated_at,
        candidate_visible_summary: existingReport.candidate_visible_summary,
        articulation_summary: existingReport.articulation_summary,
        pillar_ratings: existingReport.pillar_ratings || [],
        verified_strengths: existingReport.verified_strengths || [],
        recommended_growth_areas: existingReport.recommended_growth_areas || [],
        action_plan: existingReport.action_plan || [],
        created_at: existingReport.created_at,
      }
    }

    // 3. Ensure evaluation exists; if not, trigger evaluation engine
    let { data: evaluation } = await supabase
      .from('evaluations')
      .select('*, rubric_scores(*)')
      .eq('interview_id', interviewId)
      .maybeSingle()

    if (!evaluation) {
      try {
        const evalResult = await evaluationEngineService.evaluateInterview(interviewId)
        evaluation = evalResult.evaluation
      } catch (e) {
        console.warn('[CandidateDiagnosticService] Auto-evaluation notice:', e.message)
      }
    }

    // 4. Fetch transcripts
    const { data: transcripts } = await supabase
      .from('transcripts')
      .select('speaker, content, sequence')
      .eq('interview_id', interviewId)
      .order('sequence', { ascending: true })

    const dialogueText = (transcripts || [])
      .map((t) => `[${t.speaker}]: ${t.content}`)
      .join('\n\n')

    // 5. Structure prompt for Gemini Candidate Growth Mentor
    const prompt = `You are a distinguished Principal Software Engineer Mentor and Senior Engineering Career Coach.
You are generating a constructive, encouraging, deeply technical post-interview Diagnostic Report for a candidate who just completed a technical assessment.

ROLE TARGET:
Position: ${job.title}
Department: ${job.department || 'Engineering'}
Candidate Name: ${candidate.full_name}

ASSESSMENT DIALOGUE TRANSCRIPT:
${dialogueText || 'No verbal transcript recorded.'}

EVALUATION SCORES (INTERNAL CONTEXT):
Technical Depth Score: ${evaluation?.technical_score || 80}/100
Problem Solving Score: ${evaluation?.problem_solving_score || 78}/100
Communication Score: ${evaluation?.communication_score || 85}/100

CRITICAL GUIDELINES:
1. This report is viewed directly by the CANDIDATE.
2. DO NOT mention hiring decisions, pass/fail status, offer recommendations, or proctoring/risk telemetry.
3. Be respectful, encouraging, and technically rigorous. Frame every weakness as an actionable growth vector.
4. Extract 2-3 verified strengths with verbatim or near-verbatim quotes from the transcript where they demonstrated competence.
5. Provide 2-3 specific growth areas with concrete recommended resources (e.g., books, RFCs, technical papers, open-source projects).
6. Create an actionable 2-phase learning roadmap (Sprint 1: Days 1-14, Sprint 2: Days 15-30).`

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        candidate_visible_summary: {
          type: Type.STRING,
          description: 'Two to three paragraph empowering summary of the candidate technical demonstration and key takeaways.',
        },
        articulation_summary: {
          type: Type.STRING,
          description: 'Constructive review of verbal technical articulation, structure, conciseness, and clarity.',
        },
        pillar_ratings: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              pillar: { type: Type.STRING, description: 'Evaluation pillar name' },
              score: { type: Type.NUMBER, description: 'Diagnostic score 0-100' },
              proficiency_level: {
                type: Type.STRING,
                enum: ['DEVELOPING', 'PROFICIENT', 'ADVANCED', 'EXPERT'],
              },
              feedback: { type: Type.STRING, description: 'Specific constructive feedback' },
            },
            required: ['pillar', 'score', 'proficiency_level', 'feedback'],
          },
        },
        verified_strengths: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              description: { type: Type.STRING },
              evidence_quote: { type: Type.STRING },
            },
            required: ['topic', 'description', 'evidence_quote'],
          },
        },
        recommended_growth_areas: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              observation: { type: Type.STRING },
              recommendation: { type: Type.STRING },
              suggested_resources: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['topic', 'observation', 'recommendation', 'suggested_resources'],
          },
        },
        action_plan: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              phase: { type: Type.STRING, description: 'e.g. Weeks 1-2' },
              focus: { type: Type.STRING, description: 'Core learning focus' },
              action: { type: Type.STRING, description: 'Specific hands-on project or exercise' },
            },
            required: ['phase', 'focus', 'action'],
          },
        },
      },
      required: [
        'candidate_visible_summary',
        'articulation_summary',
        'pillar_ratings',
        'verified_strengths',
        'recommended_growth_areas',
        'action_plan',
      ],
    }

    const aiOutput = await this._callGeminiStructured({ prompt, responseSchema })

    // 6. Persist in candidate_diagnostic_reports
    const { data: createdReport, error: saveErr } = await supabase
      .from('candidate_diagnostic_reports')
      .upsert(
        {
          interview_id: interviewId,
          candidate_id: candidate.id,
          candidate_visible_summary: aiOutput.candidate_visible_summary,
          articulation_summary: aiOutput.articulation_summary,
          pillar_ratings: aiOutput.pillar_ratings,
          verified_strengths: aiOutput.verified_strengths,
          recommended_growth_areas: aiOutput.recommended_growth_areas,
          action_plan: aiOutput.action_plan,
        },
        { onConflict: 'interview_id' }
      )
      .select()
      .single()

    if (saveErr) {
      console.error('[CandidateDiagnosticService] Error persisting report:', saveErr)
      throw saveErr
    }

    return {
      id: createdReport.id,
      interview_id: interviewId,
      candidate_name: candidate.full_name,
      candidate_email: candidate.email,
      job_title: job.title,
      department: job.department,
      completed_at: interview.completed_at || interview.updated_at,
      candidate_visible_summary: createdReport.candidate_visible_summary,
      articulation_summary: createdReport.articulation_summary,
      pillar_ratings: createdReport.pillar_ratings || [],
      verified_strengths: createdReport.verified_strengths || [],
      recommended_growth_areas: createdReport.recommended_growth_areas || [],
      action_plan: createdReport.action_plan || [],
      created_at: createdReport.created_at,
    }
  },

  /**
   * Retrieve report by interview ID
   */
  async getCandidateDiagnostic(interviewId) {
    return this.generateCandidateDiagnostic(interviewId)
  },

  /**
   * Retrieve report directly using Candidate Invitation Token
   */
  async getCandidateDiagnosticByToken(token) {
    const supabase = getServiceSupabaseClient()

    // 1. Resolve invitation
    const { data: invitation, error: invErr } = await supabase
      .from('invitations')
      .select('*, jobs(*), candidates(*)')
      .eq('token', token)
      .maybeSingle()

    if (invErr || !invitation) {
      const err = new Error('Invalid or expired invitation token.')
      err.status = 404
      throw err
    }

    // 2. Find associated interview
    const { data: interview, error: intErr } = await supabase
      .from('interviews')
      .select('id')
      .eq('job_id', invitation.job_id)
      .eq('candidate_id', invitation.candidate_id)
      .maybeSingle()

    if (intErr || !interview) {
      const err = new Error('No interview session associated with this invitation.')
      err.status = 404
      throw err
    }

    return this.getCandidateDiagnostic(interview.id)
  },
}

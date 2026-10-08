import { getSupabaseClient, getServiceSupabaseClient } from '../integrations/supabaseClient.js'
import { aiOrchestrator } from '../integrations/ai/index.js'
import { NotFoundError, ValidationError } from '../utils/errors.js'

/**
 * Enterprise Job Requisition & JD Intelligence Service
 */
export const jobService = {
  /**
   * List all jobs for an organization
   */
  async listJobs({ organizationId, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()

    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*, job_requirements(*)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[JobService.listJobs] Supabase error:', error.message)
      throw new Error(`Failed to list jobs: ${error.message}`)
    }

    return jobs || []
  },

  /**
   * Get job by ID with requirements
   */
  async getJobById({ jobId, organizationId, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()

    const { data: job, error } = await supabase
      .from('jobs')
      .select('*, job_requirements(*)')
      .eq('id', jobId)
      .eq('organization_id', organizationId)
      .single()

    if (error || !job) {
      throw new NotFoundError('Job requisition not found or unauthorized.')
    }

    return job
  },

  /**
   * Create a new job requisition
   */
  async createJob({ organizationId, userId, title, description, department, seniority = 'SENIOR', userToken }) {
    if (!title || !description) {
      throw new Error('Job title and description are required.')
    }

    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        organization_id: organizationId,
        title: title.trim(),
        description: description.trim(),
        department: department?.trim() || 'Engineering',
        seniority: seniority || 'SENIOR',
        status: 'ACTIVE',
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      console.error('[JobService.createJob] Database error:', error.message)
      throw new Error(`Failed to create job: ${error.message}`)
    }

    return job
  },

  /**
   * AI-powered Job Description Intelligence using Google Gemini
   */
  async parseJobDescription({ jobId, organizationId, descriptionText, userToken }) {
    // 1. Verify job exists and belongs to the organization
    const job = await this.getJobById({ jobId, organizationId, userToken })
    const rawText = descriptionText || job.description

    if (!rawText || rawText.trim().length < 20) {
      throw new Error('Job description is too brief for AI competency extraction.')
    }

    // 2. Formulate structured extraction prompt for Gemini
    const prompt = `Analyze this technical job description and extract a structured recruitment specification:

Position Title: ${job.title}
Target Seniority: ${job.seniority}
Department: ${job.department}

Job Description:
"""
${rawText}
"""

Extract and respond strictly with a valid JSON object matching this schema:
{
  "skills": [
    {
      "name": "string (e.g. Distributed Consensus, Go, PostgreSQL, Raft, Kubernetes)",
      "category": "string (e.g. Languages, Architecture, Data, Cloud, Protocols)",
      "level": "Required" or "Preferred"
    }
  ],
  "experience_years": number (e.g. 5),
  "responsibilities": [
    "string (detailed primary responsibilities)"
  ],
  "technical_requirements": [
    "string (verifiable technical specifications and prerequisites)"
  ],
  "role_context": "string (1-2 sentence executive summary of the position scope)"
}
`

    const schema = {
      type: 'object',
      properties: {
        skills: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              category: { type: 'string' },
              level: { type: 'string', enum: ['Required', 'Preferred'] },
            },
            required: ['name', 'category', 'level'],
          },
        },
        experience_years: { type: 'integer' },
        responsibilities: { type: 'array', items: { type: 'string' } },
        technical_requirements: { type: 'array', items: { type: 'string' } },
        role_context: { type: 'string' },
      },
      required: ['skills', 'responsibilities', 'technical_requirements', 'role_context'],
    }

    // 3. Call AI Orchestrator with schema enforcement
    const aiResult = await aiOrchestrator.generateStructured({
      prompt,
      schema,
      systemInstruction: 'You are QualifyAI JD Intelligence Engine. Extract technical requirements with zero hallucination. Return strictly valid JSON.',
    })

    const parsedData = aiResult.data

    // 4. Validate output schema (Rule 34: Never blindly trust raw LLM output)
    if (!parsedData || !Array.isArray(parsedData.skills) || parsedData.skills.length === 0) {
      throw new Error('AI extraction returned invalid or empty competency specifications.')
    }

    // 5. Persist into public.job_requirements (upsert pattern)
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()

    const { data: requirements, error: upsertError } = await supabase
      .from('job_requirements')
      .upsert(
        {
          job_id: jobId,
          skills: parsedData.skills,
          experience_years: parsedData.experience_years || 5,
          responsibilities: parsedData.responsibilities || [],
          technical_requirements: parsedData.technical_requirements || [],
          role_context: parsedData.role_context || '',
        },
        { onConflict: 'job_id' }
      )
      .select()
      .single()

    if (upsertError) {
      console.error('[JobService.parseJobDescription] Persist error:', upsertError.message)
      throw new Error(`Failed to persist extracted requirements: ${upsertError.message}`)
    }

    return requirements
  },

  /**
   * Update / calibrate extracted requirements
   */
  async updateRequirements({ jobId, organizationId, requirementsData, userToken }) {
    await this.getJobById({ jobId, organizationId, userToken })
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()

    const { data: updated, error } = await supabase
      .from('job_requirements')
      .upsert(
        {
          job_id: jobId,
          skills: requirementsData.skills || [],
          experience_years: requirementsData.experience_years || 5,
          responsibilities: requirementsData.responsibilities || [],
          technical_requirements: requirementsData.technical_requirements || [],
          role_context: requirementsData.role_context || '',
        },
        { onConflict: 'job_id' }
      )
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update requirements: ${error.message}`)
    }

    return updated
  },
}

import { getSupabaseClient, getServiceSupabaseClient } from '../integrations/supabaseClient.js'
import { aiOrchestrator } from '../integrations/ai/index.js'

/**
 * Enterprise Rubric Matrix & Targeted Question Intelligence Service
 */
export const rubricService = {
  /**
   * Helper: verify job exists and belongs to the active organization
   */
  async _verifyJobBelongsToOrg(jobId, organizationId, supabase) {
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*, job_requirements(*)')
      .eq('id', jobId)
      .eq('organization_id', organizationId)
      .single()

    if (error || !job) {
      console.error('[RubricService._verifyJobBelongsToOrg] lookup failed:', {
        jobId,
        organizationId,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorDetails: error?.details,
        jobFound: !!job,
      })
      const err = new Error('Job requisition not found or unauthorized.')
      err.status = 404
      throw err
    }
    return job
  },

  /**
   * Fetch rubric and all associated scoring criteria for a job
   */
  async getRubricByJob({ jobId, organizationId, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    const { data: rubric, error } = await supabase
      .from('rubrics')
      .select('*, rubric_criteria(*)')
      .eq('job_id', jobId)
      .maybeSingle()

    if (error) {
      console.error('[RubricService.getRubricByJob] Error fetching rubric:', error.message)
      throw new Error(`Failed to fetch rubric: ${error.message}`)
    }

    if (rubric && rubric.rubric_criteria) {
      // Sort criteria by weight descending, then created_at
      rubric.rubric_criteria.sort((a, b) => b.weight - a.weight || new Date(a.created_at) - new Date(b.created_at))
    }

    return rubric
  },

  /**
   * AI-synthesize a dynamic 5-pillar rubric grounded in job requirements
   */
  async generateRubric({ jobId, organizationId, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    const job = await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    const reqs = Array.isArray(job.job_requirements)
      ? job.job_requirements[0]
      : job.job_requirements || {}

    const skillsContext = (reqs.skills || [])
      .map((s) => (typeof s === 'string' ? s : `${s.name} (${s.level || 'Required'})`))
      .join(', ')

    const responsibilitiesContext = (reqs.responsibilities || []).join('\n- ')
    const technicalReqsContext = (reqs.technical_requirements || []).join('\n- ')

    // Structured Prompt for Gemini Rubric Synthesis
    const prompt = `Synthesize a rigorous, objective 5-Pillar Technical Assessment Rubric for this role:

Role: ${job.title} (${job.seniority || 'MID-SENIOR'})
Department: ${job.department || 'Engineering'}
Extracted Competencies / Skills: ${skillsContext || 'Full-stack engineering, system design, problem solving'}

Responsibilities:
${responsibilitiesContext || job.description.slice(0, 500)}

Technical Prerequisites:
${technicalReqsContext || 'Production software development experience'}

Task: Generate exactly 5 comprehensive evaluation criteria pillars.
Each pillar must have:
1. name: Clear descriptive title of the competency pillar (e.g. "Distributed Architecture & Fault Tolerance", "Data Storage & Query Optimization", "Concurrency & Memory Safety", "System Reliability & Observability", "Engineering Tradeoffs & Communication")
2. description: 1-2 sentence definition of what this pillar measures
3. weight: Integer from 1 (supplementary) to 5 (mission-critical core skill)
4. expected_competency: Detailed summary of what a hire must demonstrate for this seniority level
5. evaluation_guidance: Specific benchmarks for:
   - level1: Novice / Inadequate signal (concrete mistakes, red flags, shallow answers)
   - level3: Competent / Baseline expectations (solid working knowledge, reasonable implementation)
   - level5: Expert / Staff caliber (deep trade-off mastery, edge-case anticipation, architectural maturity)

Respond strictly with a valid JSON object matching this schema:
{
  "rubric_title": "${job.title} Technical Evaluation Matrix",
  "rubric_description": "Comprehensive 5-pillar assessment matrix calibrated for ${job.title}",
  "criteria": [
    {
      "name": "string",
      "description": "string",
      "weight": 5,
      "expected_competency": "string",
      "evaluation_guidance": {
        "level1": "string",
        "level3": "string",
        "level5": "string"
      }
    }
  ]
}`

    const schema = {
      type: 'object',
      properties: {
        rubric_title: { type: 'string' },
        rubric_description: { type: 'string' },
        criteria: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              weight: { type: 'integer' },
              expected_competency: { type: 'string' },
              evaluation_guidance: {
                type: 'object',
                properties: {
                  level1: { type: 'string' },
                  level3: { type: 'string' },
                  level5: { type: 'string' },
                },
                required: ['level1', 'level3', 'level5'],
              },
            },
            required: ['name', 'description', 'weight', 'expected_competency', 'evaluation_guidance'],
          },
        },
      },
      required: ['rubric_title', 'criteria'],
    }

    const aiResult = await aiOrchestrator.generateStructured({
      prompt,
      schema,
      systemInstruction:
        'You are the QualifyAI Psychometric & Evaluation Rubric Architect. Calibrate objective, bias-free, highly discriminative criteria for technical candidate assessment. Return strictly valid JSON.',
    })

    const parsedData = aiResult.data

    if (!parsedData || !Array.isArray(parsedData.criteria) || parsedData.criteria.length === 0) {
      throw new Error('AI rubric generation returned invalid or empty criteria.')
    }

    // Upsert rubric record for this job
    let rubricId
    const { data: existingRubric } = await supabase
      .from('rubrics')
      .select('id')
      .eq('job_id', jobId)
      .maybeSingle()

    if (existingRubric?.id) {
      rubricId = existingRubric.id
      await supabase
        .from('rubrics')
        .update({
          title: parsedData.rubric_title || `${job.title} Evaluation Matrix`,
          description: parsedData.rubric_description || `Calibrated assessment matrix for ${job.title}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rubricId)

      // Delete existing criteria to replace cleanly with freshly synthesized pillars
      await supabase.from('rubric_criteria').delete().eq('rubric_id', rubricId)
    } else {
      const { data: newRubric, error: insertRubricError } = await supabase
        .from('rubrics')
        .insert({
          job_id: jobId,
          title: parsedData.rubric_title || `${job.title} Evaluation Matrix`,
          description: parsedData.rubric_description || `Calibrated assessment matrix for ${job.title}`,
        })
        .select()
        .single()

      if (insertRubricError) {
        throw new Error(`Failed to create rubric record: ${insertRubricError.message}`)
      }
      rubricId = newRubric.id
    }

    // Insert criteria
    const criteriaToInsert = parsedData.criteria.map((c) => ({
      rubric_id: rubricId,
      name: c.name,
      description: c.description,
      weight: Math.min(Math.max(Number(c.weight) || 3, 1), 5),
      expected_competency: c.expected_competency,
      evaluation_guidance: c.evaluation_guidance || {},
    }))

    const { data: insertedCriteria, error: insertCritError } = await supabase
      .from('rubric_criteria')
      .insert(criteriaToInsert)
      .select()

    if (insertCritError) {
      throw new Error(`Failed to save rubric criteria: ${insertCritError.message}`)
    }

    return {
      id: rubricId,
      job_id: jobId,
      title: parsedData.rubric_title || `${job.title} Evaluation Matrix`,
      description: parsedData.rubric_description,
      rubric_criteria: insertedCriteria || [],
    }
  },

  /**
   * Update weights and guidance for rubric criteria
   */
  async updateRubric({ jobId, organizationId, criteria, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    if (!Array.isArray(criteria) || criteria.length === 0) {
      throw new Error('Criteria array is required for updating rubric.')
    }

    for (const c of criteria) {
      if (!c.id) continue
      const updatePayload = {}
      if (c.weight !== undefined) {
        updatePayload.weight = Math.min(Math.max(Number(c.weight) || 1, 1), 5)
      }
      if (c.expected_competency !== undefined) {
        updatePayload.expected_competency = c.expected_competency
      }
      if (c.evaluation_guidance !== undefined) {
        updatePayload.evaluation_guidance = c.evaluation_guidance
      }

      await supabase
        .from('rubric_criteria')
        .update(updatePayload)
        .eq('id', c.id)
    }

    return this.getRubricByJob({ jobId, organizationId, userToken })
  },

  /**
   * Fetch question pool for a specific job
   */
  async getQuestionsByJob({ jobId, organizationId, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    const { data: questions, error } = await supabase
      .from('questions')
      .select('*, rubric_criteria(id, name, weight)')
      .eq('job_id', jobId)
      .order('context_order', { ascending: true })

    if (error) {
      console.error('[RubricService.getQuestionsByJob] Error fetching questions:', error.message)
      throw new Error(`Failed to fetch questions: ${error.message}`)
    }

    return questions || []
  },

  /**
   * AI-synthesize targeted interview questions mapped to rubric criteria
   */
  async generateQuestions({ jobId, organizationId, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    const job = await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    // Ensure rubric exists first
    let rubric = await this.getRubricByJob({ jobId, organizationId, userToken })
    if (!rubric || !rubric.rubric_criteria || rubric.rubric_criteria.length === 0) {
      rubric = await this.generateRubric({ jobId, organizationId, userToken })
    }

    // Fetch parsed job requirements to ground question pool in verified technical stack
    const { data: jobWithReqs } = await supabase
      .from('jobs')
      .select('*, job_requirements(*)')
      .eq('id', jobId)
      .single()

    const jobReqs = Array.isArray(jobWithReqs?.job_requirements)
      ? jobWithReqs.job_requirements[0] || {}
      : jobWithReqs?.job_requirements || {}

    const skillsList = Array.isArray(jobReqs.skills)
      ? jobReqs.skills.map((s) => (typeof s === 'object' ? s.name : s)).join(', ')
      : ''
    const techReqs = Array.isArray(jobReqs.technical_requirements)
      ? jobReqs.technical_requirements.join('; ')
      : ''

    const criteriaList = rubric.rubric_criteria || []
    const criteriaSummary = criteriaList
      .map((c, i) => `${i + 1}. [${c.name}] (Weight ${c.weight}/5): ${c.expected_competency || c.description}`)
      .join('\n')

    const prompt = `Synthesize a diverse, multi-format technical question pool for an AI-led technical assessment:

Position: ${job.title} (${job.seniority || 'SENIOR'})
Department: ${job.department || 'Engineering'}
${skillsList ? `Required Technologies & Frameworks:\n${skillsList}\n` : ''}
${techReqs ? `Technical Specifications:\n${techReqs}\n` : ''}

Evaluation Criteria Pillars:
${criteriaSummary}

CRITICAL REQUIREMENT - DIVERSE QUESTION FORMATS:
You MUST generate 7 to 9 questions containing a rich, balanced distribution of different interactive question formats. DO NOT generate only long descriptive questions!

MANDATORY QUESTION TYPE DISTRIBUTION:
1. At least 2 'MULTIPLE_CHOICE' questions:
   - Provide a realistic question testing edge-cases or design rules.
   - Must provide an "options" array with exactly 4 clear options ["A) ...", "B) ...", "C) ...", "D) ..."].
   - Provide "correct_answer" indicating the correct option letter and explanation.
2. At least 1-2 'CODE_OUTPUT' questions:
   - A real-world code snippet (e.g. JavaScript, Python, Go, Java, or SQL from the JD) where the candidate predicts console output or behavior.
   - Provide code in "code_snippet" and set "language".
   - Provide expected result in "correct_answer".
3. At least 1 'SQL' or 'CODE_WRITING' question:
   - Provide starter code template or database schema in "code_snippet" with language.
4. At least 1 'FILL_IN_THE_BLANK' or 'TRUE_FALSE' question:
   - For FILL_IN_THE_BLANK, use '____' in question_text.
   - For TRUE_FALSE, pose a nuanced engineering assertion.
5. At least 1 'SCENARIO' question:
   - Production failure, traffic spike, or scalability constraint.
6. At most 1-2 'DESCRIPTIVE' questions:
   - High-level architectural discussion.

Respond strictly with a valid JSON object matching this schema:
{
  "questions": [
    {
      "criterion_name": "string (must match one pillar name)",
      "type": "MULTIPLE_CHOICE" | "CODE_OUTPUT" | "CODE_WRITING" | "SQL" | "FILL_IN_THE_BLANK" | "TRUE_FALSE" | "SCENARIO" | "DESCRIPTIVE",
      "question_text": "string (clear, concise prompt)",
      "difficulty": "EASY" | "MEDIUM" | "HARD",
      "context_order": 1,
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_answer": "string",
      "code_snippet": "string or null",
      "language": "string",
      "expected_concepts": ["concept1", "concept2"],
      "sample_follow_ups": ["follow up 1", "follow up 2"],
      "rubric_focus": "string"
    }
  ]
}`

    const schema = {
      type: 'object',
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              criterion_name: { type: 'string' },
              type: {
                type: 'string',
                enum: [
                  'MULTIPLE_CHOICE',
                  'CODE_OUTPUT',
                  'CODE_WRITING',
                  'SQL',
                  'FILL_IN_THE_BLANK',
                  'TRUE_FALSE',
                  'SCENARIO',
                  'DESCRIPTIVE',
                ],
              },
              question_text: { type: 'string' },
              difficulty: {
                type: 'string',
                enum: ['EASY', 'MEDIUM', 'HARD'],
              },
              context_order: { type: 'integer' },
              options: {
                type: 'array',
                items: { type: 'string' },
              },
              correct_answer: { type: 'string' },
              code_snippet: { type: 'string' },
              language: { type: 'string' },
              expected_concepts: { type: 'array', items: { type: 'string' } },
              sample_follow_ups: { type: 'array', items: { type: 'string' } },
              rubric_focus: { type: 'string' },
            },
            required: ['criterion_name', 'type', 'question_text', 'difficulty', 'context_order', 'expected_concepts'],
          },
        },
      },
      required: ['questions'],
    }

    const aiResult = await aiOrchestrator.generateStructured({
      prompt,
      schema,
      systemInstruction:
        'You are the QualifyAI Technical Assessment Engine. Generate varied, discriminative interview questions spanning multiple choice, code output prediction, coding/SQL, and system scenarios based on the job description. Return strictly valid JSON.',
    })

    const parsedData = aiResult.data

    if (!parsedData || !Array.isArray(parsedData.questions) || parsedData.questions.length === 0) {
      throw new Error('AI question synthesis returned empty or invalid question set.')
    }

    // Create a lookup for criterion name -> criterion id
    const criterionMap = new Map()
    criteriaList.forEach((c) => {
      criterionMap.set(c.name.toLowerCase().trim(), c.id)
    })

    // Prepare questions for insertion with rich typed metadata
    const questionsToInsert = parsedData.questions.map((q, idx) => {
      let matchedCriterionId = null
      if (q.criterion_name) {
        const query = q.criterion_name.toLowerCase().trim()
        for (const [name, id] of criterionMap.entries()) {
          if (name.includes(query) || query.includes(name)) {
            matchedCriterionId = id
            break
          }
        }
      }

      if (!matchedCriterionId && criteriaList.length > 0) {
        matchedCriterionId = criteriaList[idx % criteriaList.length].id
      }

      const qType = q.type || 'DESCRIPTIVE'

      return {
        job_id: jobId,
        rubric_criterion_id: matchedCriterionId,
        type: qType,
        question_text: (idx === 0 && job.opening_question) ? job.opening_question : q.question_text,
        difficulty: q.difficulty || job.target_difficulty || 'MEDIUM',
        context_order: q.context_order || idx + 1,
        metadata: {
          type: qType,
          options: Array.isArray(q.options) && q.options.length > 0 ? q.options : [],
          correct_answer: q.correct_answer || '',
          code_snippet: q.code_snippet || null,
          language: q.language || (qType === 'SQL' ? 'sql' : 'javascript'),
          expected_concepts: q.expected_concepts || [],
          sample_follow_ups: q.sample_follow_ups || [],
          rubric_focus: q.rubric_focus || '',
        },
      }
    })

    // Delete existing questions for this job before saving fresh set
    await supabase.from('questions').delete().eq('job_id', jobId)

    const { data: insertedQuestions, error: insertError } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select('*, rubric_criteria(id, name, weight)')

    if (insertError) {
      throw new Error(`Failed to save question pool: ${insertError.message}`)
    }

    return insertedQuestions || []
  },

  /**
   * Update the first / opening question for a job requisition (Requirement 8)
   */
  async updateOpeningQuestion({ jobId, organizationId, openingQuestion, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    const cleanQuestion = String(openingQuestion || '').trim()
    if (!cleanQuestion || cleanQuestion.length < 5) {
      throw new Error('Opening question must be at least 5 characters long.')
    }

    // 1. Update jobs table
    const { data: updatedJob, error: jobErr } = await supabase
      .from('jobs')
      .update({ opening_question: cleanQuestion })
      .eq('id', jobId)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (jobErr) {
      throw new Error(`Failed to update opening question on job: ${jobErr.message}`)
    }

    // 2. If questions pool exists, update the first question
    const { data: existingQuestions } = await supabase
      .from('questions')
      .select('id, context_order')
      .eq('job_id', jobId)
      .order('context_order', { ascending: true })
      .limit(1)

    if (existingQuestions && existingQuestions.length > 0) {
      await supabase
        .from('questions')
        .update({ question_text: cleanQuestion })
        .eq('id', existingQuestions[0].id)
    }

    return { success: true, opening_question: cleanQuestion, job: updatedJob }
  },

  /**
   * Update the target difficulty for a job requisition (Requirement 9)
   */
  async updateDifficulty({ jobId, organizationId, difficulty, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    const validLevels = ['EASY', 'MEDIUM', 'HARD']
    const normalized = String(difficulty || '').toUpperCase().trim()
    if (!validLevels.includes(normalized)) {
      throw new Error(`Invalid difficulty level "${difficulty}". Allowed: ${validLevels.join(', ')}`)
    }

    const { data: updatedJob, error: jobErr } = await supabase
      .from('jobs')
      .update({ target_difficulty: normalized })
      .eq('id', jobId)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (jobErr) {
      throw new Error(`Failed to update difficulty on job: ${jobErr.message}`)
    }

    return { success: true, target_difficulty: normalized, job: updatedJob }
  },

  /**
   * Update an existing question
   */
  async updateQuestion({ jobId, organizationId, questionId, questionData, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    const payload = {}
    if (questionData.question_text !== undefined) payload.question_text = String(questionData.question_text).trim()
    if (questionData.type !== undefined) payload.type = questionData.type
    if (questionData.difficulty !== undefined) payload.difficulty = questionData.difficulty
    if (questionData.metadata !== undefined) payload.metadata = questionData.metadata

    const { data: updated, error } = await supabase
      .from('questions')
      .update(payload)
      .eq('id', questionId)
      .eq('job_id', jobId)
      .select('*, rubric_criteria(id, name, weight)')
      .single()

    if (error) {
      throw new Error(`Failed to update question: ${error.message}`)
    }

    // If this was the first question, also synchronize job.opening_question
    if (payload.question_text) {
      const { data: firstQ } = await supabase
        .from('questions')
        .select('id')
        .eq('job_id', jobId)
        .order('context_order', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (firstQ?.id === questionId) {
        await supabase
          .from('jobs')
          .update({ opening_question: payload.question_text })
          .eq('id', jobId)
      }
    }

    return updated
  },

  /**
   * Create a custom question
   */
  async createQuestion({ jobId, organizationId, questionData, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    if (!questionData?.question_text) {
      throw new Error('Question text is required.')
    }

    const { data: question, error } = await supabase
      .from('questions')
      .insert({
        job_id: jobId,
        rubric_criterion_id: questionData.rubric_criterion_id || null,
        type: questionData.type || 'TECHNICAL',
        question_text: questionData.question_text.trim(),
        difficulty: questionData.difficulty || 'MEDIUM',
        context_order: questionData.context_order || 99,
        metadata: questionData.metadata || {
          expected_concepts: questionData.expected_concepts || [],
          rubric_focus: questionData.rubric_focus || '',
        },
      })
      .select('*, rubric_criteria(id, name, weight)')
      .single()

    if (error) {
      throw new Error(`Failed to create question: ${error.message}`)
    }

    return question
  },

  /**
   * Delete a question
   */
  async deleteQuestion({ jobId, organizationId, questionId, userToken }) {
    const supabase = userToken ? getSupabaseClient(userToken) : getServiceSupabaseClient()
    await this._verifyJobBelongsToOrg(jobId, organizationId, supabase)

    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId)
      .eq('job_id', jobId)

    if (error) {
      throw new Error(`Failed to delete question: ${error.message}`)
    }

    return { success: true, id: questionId }
  },
}

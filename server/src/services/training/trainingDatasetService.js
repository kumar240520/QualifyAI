import { getServiceSupabaseClient } from '../../integrations/supabaseClient.js'
import { datasetAnonymizerService } from './datasetAnonymizerService.js'

/**
 * Enterprise AI Training Dataset Infrastructure Service (Phase 13)
 * Orchestrates extraction, PII scrub, multi-format transformation, and export
 * for QualifyAI specialized model fine-tuning.
 */
export const trainingDatasetService = {
  /**
   * Format a single sample into the target fine-tuning specification
   */
  formatSample({ systemInstruction, inputPrompt, targetOutput }, format = 'GEMINI_JSONL') {
    switch (format) {
      case 'GEMINI_JSONL': {
        const fullUserPrompt = systemInstruction
          ? `${systemInstruction}\n\n${inputPrompt}`
          : inputPrompt
        return {
          contents: [
            { role: 'user', parts: [{ text: fullUserPrompt }] },
            { role: 'model', parts: [{ text: targetOutput }] },
          ],
        }
      }
      case 'OPENAI_JSONL': {
        return {
          messages: [
            { role: 'system', content: systemInstruction || 'You are the QualifyAI Enterprise Technical Interview Engine.' },
            { role: 'user', content: inputPrompt },
            { role: 'assistant', content: targetOutput },
          ],
        }
      }
      case 'ALPACA_JSON': {
        return {
          instruction: systemInstruction || 'Conduct rigorous technical interview assessment with grounded evaluation.',
          input: inputPrompt,
          output: targetOutput,
        }
      }
      case 'CHATML_JSONL': {
        const sys = systemInstruction || 'You are the QualifyAI Enterprise Technical Interview Engine.'
        return {
          prompt: `<|im_start|>system\n${sys}<|im_end|>\n<|im_start|>user\n${inputPrompt}<|im_end|>\n<|im_start|>assistant\n`,
          completion: `${targetOutput}<|im_end|>`,
        }
      }
      default:
        throw new Error(`Unsupported dataset export format: ${format}`)
    }
  },

  /**
   * Extract training samples from completed interviews for a tenant organization
   */
  async generateDataset({
    organizationId,
    userId = null,
    name,
    description = '',
    datasetType = 'HYBRID', // 'INTERVIEWER_POLICY', 'EVALUATOR_SCORING', 'HYBRID'
    format = 'GEMINI_JSONL', // 'GEMINI_JSONL', 'OPENAI_JSONL', 'ALPACA_JSON', 'CHATML_JSONL'
    filterConfig = {},
  }) {
    const supabase = getServiceSupabaseClient()

    // 1. Fetch eligible interviews within the organization
    let query = supabase
      .from('interviews')
      .select(`
        id,
        organization_id,
        job_id,
        candidate_id,
        status,
        created_at,
        jobs ( id, title, department, seniority, organization_id, organizations ( name ) ),
        candidates ( id, full_name, email ),
        evaluations ( id, overall_score, technical_score, problem_solving_score, summary ),
        transcripts (
          id,
          speaker,
          content,
          sequence,
          created_at
        ),
        candidate_diagnostic_reports (
          id,
          candidate_visible_summary,
          pillar_ratings,
          action_plan,
          recommended_growth_areas,
          verified_strengths
        )
      `)
      .eq('organization_id', organizationId)

    if (filterConfig.jobId) {
      query = query.eq('job_id', filterConfig.jobId)
    }

    const { data: interviews, error: intError } = await query

    if (intError) {
      console.error('[TrainingDatasetService] Error fetching interviews:', intError.message)
      throw new Error(`Failed to query interviews for dataset: ${intError.message}`)
    }

    const eligibleInterviews = (interviews || []).filter((inv) => {
      const score = inv.evaluations?.[0]?.overall_score ?? null
      if (filterConfig.minScore && score !== null) {
        if (Number(score) < Number(filterConfig.minScore)) return false
      }
      return true
    })

    const rawSamples = []

    // 2. Extract Instruction-Tuning Pairs per Interview
    for (const item of eligibleInterviews) {
      const orgName = item.jobs?.organizations?.name || 'Acme Engineering'
      const candName = item.candidates?.full_name || 'Candidate'
      const candEmail = item.candidates?.email || ''
      const jobTitle = item.jobs?.title || 'Software Engineer'
      const seniority = item.jobs?.seniority || 'MID'

      const context = {
        candidateName: candName,
        candidateEmail: candEmail,
        organizationName: orgName,
      }

      const transcripts = (item.transcripts || []).sort(
        (a, b) => (a.sequence || 0) - (b.sequence || 0)
      )

      // Task A: INTERVIEWER_POLICY (Adaptive Questioning)
      if (datasetType === 'INTERVIEWER_POLICY' || datasetType === 'HYBRID') {
        const systemInstruction =
          'You are the QualifyAI Senior Technical Interviewer. Formulate incisive, adaptive follow-up questions tailored to candidate depth and rubric benchmarks.'

        for (let i = 0; i < transcripts.length - 1; i++) {
          const current = transcripts[i]
          const next = transcripts[i + 1]

          if (current.speaker === 'CANDIDATE' && next.speaker === 'AI') {
            const sanitizedAnswer = datasetAnonymizerService.anonymizeText(current.content, context)
            const sanitizedQuestion = datasetAnonymizerService.anonymizeText(next.content, context)

            if (sanitizedAnswer.length > 20 && sanitizedQuestion.length > 10) {
              const inputPrompt = `Requisition: ${jobTitle} (${seniority})\nCandidate Technical Response:\n"${sanitizedAnswer}"\n\nGenerate the next probing follow-up question.`
              const targetOutput = sanitizedQuestion

              rawSamples.push({
                interview_id: item.id,
                organization_id: organizationId,
                task_type: 'ADAPTIVE_QUESTIONING',
                system_instruction: systemInstruction,
                input_prompt: inputPrompt,
                target_output: targetOutput,
                quality_score: item.overall_score || 85,
                anonymized: true,
              })
            }
          }
        }
      }

      // Task B: EVALUATOR_SCORING (Analytical Evaluation & Benchmark Scoring)
      if (datasetType === 'EVALUATOR_SCORING' || datasetType === 'HYBRID') {
        const evaluation = item.evaluations?.[0]
        if (evaluation && transcripts.length > 0) {
          const systemInstruction =
            'You are the QualifyAI Technical Evaluation Engine. Given candidate interview responses, synthesize objective scoring benchmarks, cited verbatim quotes, and analytical hire recommendations.'

          const candidateTurns = transcripts
            .filter((t) => t.speaker === 'CANDIDATE')
            .map((t) => datasetAnonymizerService.anonymizeText(t.content, context))
            .join('\n')

          if (candidateTurns.length > 30) {
            const inputPrompt = `Requisition: ${jobTitle} (${seniority})\nInterview Transcript Excerpt:\n${candidateTurns.slice(0, 3000)}\n\nEvaluate technical competencies and formulate decision score.`
            const rec =
              evaluation.overall_score >= 85
                ? 'STRONG_HIRE'
                : evaluation.overall_score >= 70
                ? 'HIRE'
                : 'NO_HIRE'
            const targetOutput = JSON.stringify(
              {
                overall_score: evaluation.overall_score,
                technical_score: evaluation.technical_score,
                problem_solving_score: evaluation.problem_solving_score,
                recommendation: rec,
                summary: datasetAnonymizerService.anonymizeText(evaluation.summary || '', context),
              },
              null,
              2
            )

            rawSamples.push({
              interview_id: item.id,
              organization_id: organizationId,
              task_type: 'RUBRIC_SCORING',
              system_instruction: systemInstruction,
              input_prompt: inputPrompt,
              target_output: targetOutput,
              quality_score: evaluation.overall_score || 80,
              anonymized: true,
            })
          }
        }
      }

      // Task C: DIAGNOSTIC_FEEDBACK (Constructive Growth Synthesis)
      if (datasetType === 'HYBRID') {
        const diagnostic = item.candidate_diagnostic_reports?.[0]
        if (diagnostic && diagnostic.candidate_visible_summary) {
          const systemInstruction =
            'You are the QualifyAI Candidate Diagnostic Coach. Synthesize private, constructive learning paths and resource growth vectors based on technical evaluation.'

          const inputPrompt = `Requisition: ${jobTitle}\nPillar Ratings: ${JSON.stringify(diagnostic.pillar_ratings || {})}\n\nSynthesize personalized growth roadmap.`
          const targetOutput = JSON.stringify(
            {
              summary: datasetAnonymizerService.anonymizeText(diagnostic.candidate_visible_summary, context),
              growth_areas: diagnostic.recommended_growth_areas || [],
              action_plan: diagnostic.action_plan || {},
            },
            null,
            2
          )

          rawSamples.push({
            interview_id: item.id,
            organization_id: organizationId,
            task_type: 'DIAGNOSTIC_FEEDBACK',
            system_instruction: systemInstruction,
            input_prompt: inputPrompt,
            target_output: targetOutput,
            quality_score: item.evaluations?.[0]?.overall_score || 85,
            anonymized: true,
          })
        }
      }
    }

    // 3. Fallback: If no interview turns existed in DB yet, synthesize high-fidelity canonical samples
    if (rawSamples.length === 0) {
      const canonicalSamples = [
        {
          task_type: 'ADAPTIVE_QUESTIONING',
          system_instruction:
            'You are the QualifyAI Senior Technical Interviewer. Formulate incisive, adaptive follow-up questions tailored to candidate depth and rubric benchmarks.',
          input_prompt:
            'Requisition: Staff Cryptographic Engineer (STAFF)\nCandidate Technical Response:\n"In zero-knowledge proofs like PLONK or Groth16, circuit constraints are expressed as R1CS systems."\n\nGenerate the next probing follow-up question.',
          target_output:
            'How do the permutation arguments in PLONK compare in proof size and verification complexity to the polynomial commitments used in Groth16 trusted setups?',
          quality_score: 95,
        },
        {
          task_type: 'RUBRIC_SCORING',
          system_instruction:
            'You are the QualifyAI Technical Evaluation Engine. Given candidate interview responses, synthesize objective scoring benchmarks, cited verbatim quotes, and analytical hire recommendations.',
          input_prompt:
            'Requisition: Senior Distributed Systems Architect (SENIOR)\nInterview Transcript Excerpt:\n"We implement linearizable consistency via Raft log entries and leader leases."\n\nEvaluate technical competencies and formulate decision score.',
          target_output: JSON.stringify(
            {
              overall_score: 92,
              recommendation: 'STRONG_HIRE',
              verified_strengths: [
                'Accurate architectural articulation of leader leases avoiding split-brain',
                'Strong grasp of linearizable consistency semantics in Raft',
              ],
              growth_areas: ['Did not mention clock skew hazards with NTP in leader lease renewal'],
            },
            null,
            2
          ),
          quality_score: 92,
        },
        {
          task_type: 'DIAGNOSTIC_FEEDBACK',
          system_instruction:
            'You are the QualifyAI Candidate Diagnostic Coach. Synthesize private, constructive learning paths and resource growth vectors based on technical evaluation.',
          input_prompt:
            'Requisition: Full Stack Engineer (MID)\nPillar Ratings: {"architecture": 4, "concurrency": 2, "system_design": 3}\n\nSynthesize personalized growth roadmap.',
          target_output: JSON.stringify(
            {
              summary: 'Solid architectural instincts with clear growth opportunity in concurrent state management.',
              growth_areas: ['Optimistic concurrency control and deadlock avoidance strategies'],
              action_plan: {
                phase_1_study: 'Review PostgreSQL isolation levels (Read Committed vs Repeatable Read)',
                phase_2_practice: 'Implement distributed locking with Redlock or Postgres advisory locks',
              },
            },
            null,
            2
          ),
          quality_score: 88,
        },
      ]

      for (const cs of canonicalSamples) {
        rawSamples.push({
          interview_id: null,
          organization_id: organizationId,
          ...cs,
          anonymized: true,
        })
      }
    }

    // 4. Create Dataset Record in PostgreSQL
    const { data: newDataset, error: dsError } = await supabase
      .from('ai_training_datasets')
      .insert({
        organization_id: organizationId,
        name: name || `QualifyAI_${datasetType}_${format}_${Date.now()}`,
        description,
        dataset_type: datasetType,
        format,
        sample_count: rawSamples.length,
        status: 'READY',
        filter_config: filterConfig,
        created_by: userId,
      })
      .select()
      .single()

    if (dsError) {
      console.error('[TrainingDatasetService] Error creating dataset record:', dsError.message)
      throw new Error(`Failed to create training dataset: ${dsError.message}`)
    }

    // 5. Transform and Batch Insert Samples
    const samplesToInsert = rawSamples.map((s) => ({
      dataset_id: newDataset.id,
      interview_id: s.interview_id,
      organization_id: organizationId,
      task_type: s.task_type,
      input_prompt: s.input_prompt,
      target_output: s.target_output,
      system_instruction: s.system_instruction,
      formatted_payload: this.formatSample(
        {
          systemInstruction: s.system_instruction,
          inputPrompt: s.input_prompt,
          targetOutput: s.target_output,
        },
        format
      ),
      quality_score: s.quality_score,
      anonymized: s.anonymized,
    }))

    const { error: smpError } = await supabase.from('ai_training_samples').insert(samplesToInsert)

    if (smpError) {
      console.error('[TrainingDatasetService] Error saving samples:', smpError.message)
      throw new Error(`Failed to save training samples: ${smpError.message}`)
    }

    return {
      ...newDataset,
      samples: samplesToInsert,
    }
  },

  /**
   * List datasets for active tenant organization
   */
  async listDatasets({ organizationId, limit = 50, offset = 0 }) {
    const supabase = getServiceSupabaseClient()

    const { data: datasets, error, count } = await supabase
      .from('ai_training_datasets')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw new Error(`Failed to list datasets: ${error.message}`)
    }

    return {
      datasets: datasets || [],
      total: count || 0,
      limit,
      offset,
    }
  },

  /**
   * Get single dataset by ID with tenant boundary verification
   */
  async getDatasetById({ datasetId, organizationId }) {
    const supabase = getServiceSupabaseClient()

    const { data: dataset, error } = await supabase
      .from('ai_training_datasets')
      .select('*')
      .eq('id', datasetId)
      .eq('organization_id', organizationId)
      .single()

    if (error || !dataset) {
      const err = new Error('Training dataset not found or unauthorized.')
      err.status = 404
      throw err
    }

    return dataset
  },

  /**
   * Retrieve paginated samples for a dataset
   */
  async getDatasetSamples({ datasetId, organizationId, limit = 50, offset = 0 }) {
    // Verify ownership
    await this.getDatasetById({ datasetId, organizationId })

    const supabase = getServiceSupabaseClient()
    const { data: samples, error, count } = await supabase
      .from('ai_training_samples')
      .select('*', { count: 'exact' })
      .eq('dataset_id', datasetId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      throw new Error(`Failed to get dataset samples: ${error.message}`)
    }

    return {
      samples: samples || [],
      total: count || 0,
      limit,
      offset,
    }
  },

  /**
   * Export dataset content serialized in the exact specified format
   */
  async exportDatasetContent({ datasetId, organizationId }) {
    const dataset = await this.getDatasetById({ datasetId, organizationId })
    const supabase = getServiceSupabaseClient()

    const { data: samples, error } = await supabase
      .from('ai_training_samples')
      .select('formatted_payload')
      .eq('dataset_id', datasetId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to export dataset samples: ${error.message}`)
    }

    const payloads = (samples || []).map((s) => s.formatted_payload)

    if (dataset.format === 'ALPACA_JSON') {
      return {
        filename: `${dataset.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`,
        contentType: 'application/json',
        content: JSON.stringify(payloads, null, 2),
      }
    }

    // JSONL (Gemini, OpenAI, ChatML)
    const jsonlContent = payloads.map((p) => JSON.stringify(p)).join('\n')
    return {
      filename: `${dataset.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.jsonl`,
      contentType: 'application/x-ndjson',
      content: jsonlContent,
    }
  },

  /**
   * Delete dataset and its cascading samples
   */
  async deleteDataset({ datasetId, organizationId }) {
    await this.getDatasetById({ datasetId, organizationId })
    const supabase = getServiceSupabaseClient()

    const { error } = await supabase
      .from('ai_training_datasets')
      .delete()
      .eq('id', datasetId)
      .eq('organization_id', organizationId)

    if (error) {
      throw new Error(`Failed to delete dataset: ${error.message}`)
    }

    return { success: true, message: 'Dataset successfully deleted.' }
  },
}

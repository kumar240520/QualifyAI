import { getServiceSupabaseClient } from '../../integrations/supabaseClient.js'
import { answerAnalyzer } from './answerAnalyzer.js'
import { adaptivePolicyService } from './adaptivePolicyService.js'
import { rubricService } from '../rubricService.js'
import { realtimeQuestionGenerator } from './realtimeQuestionGenerator.js'
import { randomUUID } from 'node:crypto'
import { validateActiveQuestionAnswer, parseInterviewDurationMinutes, createAnswerCommit, isRepeatQuestionRequest } from './interviewState.js'

const activeTurnPromises = new Map()
const sessionStartPromises = new Map()


/**
 * Enterprise AI-Authoritative Interview Orchestrator
 * 
 * INVARIANT: GEMINI AI is the ONE authoritative interviewer.
 * Questions are time-bound, adaptive, grounded in JD pillars and candidate responses,
 * with monotonically increasing sequence numbers and zero fixed turn limits.
 */
export const interviewEngineService = {
  _formatInterviewQuestion(decision, sequence, basedOnQuestion = null, sessionId = null) {
    const generated = decision.question
    const options = Array.isArray(generated.options)
      ? generated.options.map((option, index) => {
          if (typeof option === 'object' && option !== null) {
            return {
              id: option.id || `opt-${index + 1}`,
              key: option.key || String.fromCharCode(65 + index),
              label: String(option.label || option.text || '').replace(/^[A-D]\)\s*/i, '').trim(),
            }
          }
          const cleanLabel = String(option).replace(/^[A-D]\)\s*/i, '').trim()
          return {
            id: `opt-${index + 1}`,
            key: String.fromCharCode(65 + index),
            label: cleanLabel,
          }
        })
      : []

    const codeSnippet = generated.codeSnippet || generated.code_snippet || null

    const feedbackMsg = decision.aiMessage?.trim() || ''
    const questionText = generated.text.trim()
    let fullSpokenLeadIn = questionText

    if (feedbackMsg) {
      const cleanFeedback = feedbackMsg.replace(/^[A-Z\s]+:\s*/, '').trim()
      const feedbackWords = cleanFeedback.toLowerCase().match(/[a-z0-9]+/g) || []
      const questionWords = questionText.toLowerCase().match(/[a-z0-9]+/g) || []
      const overlapLength = Math.min(6, feedbackWords.length, questionWords.length)
      const feedbackPhrases = new Set()
      for (let i = 0; i <= feedbackWords.length - overlapLength; i++) {
        feedbackPhrases.add(feedbackWords.slice(i, i + overlapLength).join(' '))
      }
      const containsQuestion = overlapLength >= 4 && questionWords.some((_, index) =>
        index <= questionWords.length - overlapLength && feedbackPhrases.has(questionWords.slice(index, index + overlapLength).join(' '))
      )
      // Feedback often already includes the generated question after a conversational lead-in.
      // Keep that full script once instead of appending the question a second time.
      if (!containsQuestion) {
        fullSpokenLeadIn = `${cleanFeedback} ${questionText}`
      } else {
        fullSpokenLeadIn = cleanFeedback
      }
    }

    return {
      id: randomUUID(),
      sessionId,
      timestamp: new Date().toISOString(),
      sequence,
      question_text: questionText,
      spoken_lead_in: fullSpokenLeadIn,
      type: generated.type,
      difficulty: generated.difficulty || 'MEDIUM',
      rubric_criterion_id: generated.rubricCriterionId || null,
      skill: generated.skill || null,
      topic: generated.topic || null,
      relationship: decision.relationship || 'FOLLOW_UP',
      reason: generated.reason,
      based_on_question_id: generated.basedOnQuestionId || basedOnQuestion?.id || null,
      options,
      code_snippet: codeSnippet,
      codeSnippet,
      language: generated.language || 'javascript',
      expected_concepts: generated.expectedConcepts || [],
      metadata: {
        type: generated.type,
        expected_concepts: generated.expectedConcepts || [],
        rubric_focus: generated.skill || generated.topic || null,
        code_snippet: codeSnippet,
        codeSnippet,
        language: generated.language || 'javascript',
        options,
      },
    }
  },

  /**
   * Helper: verify token and load interview evaluation context. Question banks are never used at runtime.
   */
  async _resolveTokenContext(token, allowCompleted = false) {
    const supabase = getServiceSupabaseClient()

    const { data: invitation, error: invError } = await supabase
      .from('invitations')
      .select('*, jobs(*, job_requirements(*)), candidates(*)')
      .eq('token', token)
      .single()

    if (invError || !invitation) {
      console.error('[InterviewEngine._resolveTokenContext] Invitation token lookup failed:', invError?.message || 'not found')
      const err = new Error('Invalid or non-existent invitation token.')
      err.status = 404
      throw err
    }

    // Security Gate: Single-use transient session check
    if (!allowCompleted && (invitation.status === 'COMPLETED' || invitation.status === 'CANCELLED' || invitation.status === 'TERMINATED')) {
      const err = new Error('This single-use assessment session has already been completed or terminated. Re-entry is strictly prohibited.')
      err.status = 403
      throw err
    }

    // Security Gate: Token Expiration & Status Check
    const isExpiredDate = invitation.expires_at && new Date(invitation.expires_at) < new Date()
    if (invitation.status === 'EXPIRED' || isExpiredDate) {
      if (isExpiredDate && invitation.status !== 'EXPIRED') {
        supabase
          .from('invitations')
          .update({ status: 'EXPIRED' })
          .eq('id', invitation.id)
          .catch((e) => console.warn('[InterviewEngine] Error updating expired status:', e.message))
      }
      const err = new Error('This invitation link has expired. Please contact the recruiter for a new link.')
      err.status = 410
      throw err
    }

    const job = invitation.jobs
    const candidate = invitation.candidates
    const organizationId = job.organization_id

    // Ensure rubric exists for this job
    let rubric = await rubricService.getRubricByJob({ jobId: job.id, organizationId })
    if (!rubric || !rubric.rubric_criteria || rubric.rubric_criteria.length === 0) {
      rubric = await rubricService.generateRubric({ jobId: job.id, organizationId })
    }

    const { data: organization } = await supabase
      .from('organizations')
      .select('assessment_settings')
      .eq('id', organizationId)
      .maybeSingle()

    return { invitation, job, candidate, rubric, organization, organizationId }
  },

  /**
   * Start or resume interview session with canonical state and time constraints
   */
  async startOrResumeSession({ token }) {
    const inFlight = sessionStartPromises.get(token)
    if (inFlight) return inFlight
    const starting = this._startOrResumeSession({ token })
    sessionStartPromises.set(token, starting)
    try {
      return await starting
    } finally {
      if (sessionStartPromises.get(token) === starting) sessionStartPromises.delete(token)
    }
  },

  async _startOrResumeSession({ token }) {
    const supabase = getServiceSupabaseClient()
    const { invitation, job, candidate, rubric, organization, organizationId } =
      await this._resolveTokenContext(token)

    // Resolve the recruiter configured duration from job/invitation/org settings.
    const jobReqs = Array.isArray(job.job_requirements)
      ? job.job_requirements[0] || {}
      : job.job_requirements || {}

    const configuredDuration = parseInterviewDurationMinutes(
      invitation.interview_duration_minutes,
      jobReqs.interview_duration_minutes,
      job.interview_duration_minutes,
      organization?.assessment_settings?.interviewDuration
    )

    // 1. Locate or create active interview record
    let interview
    const { data: existingInterview } = await supabase
      .from('interviews')
      .select('*')
      .eq('job_id', job.id)
      .eq('candidate_id', candidate.id)
      .maybeSingle()

    const nowIso = new Date().toISOString()
    if (existingInterview) {
      interview = existingInterview
    } else {
      const { data: newInterview, error: intError } = await supabase
        .from('interviews')
        .insert({
          organization_id: organizationId,
          job_id: job.id,
          candidate_id: candidate.id,
          status: 'IN_PROGRESS',
          started_at: nowIso,
        })
        .select()
        .single()

      if (intError?.code === '23505') {
        const { data: concurrentInterview, error: retryError } = await supabase
          .from('interviews')
          .select('*')
          .eq('job_id', job.id)
          .eq('candidate_id', candidate.id)
          .single()
        if (retryError || !concurrentInterview) throw new Error(`Failed to recover concurrent interview creation: ${retryError?.message || intError.message}`)
        interview = concurrentInterview
      } else if (intError) throw new Error(`Failed to initialize interview: ${intError.message}`)
      else interview = newInterview
    }

    // 2. Locate or create interview session
    let session
    const { data: existingSession } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('interview_id', interview.id)
      .maybeSingle()

    const criteriaList = rubric.rubric_criteria || []
    const initialCoverageMatrix = adaptivePolicyService.initializeCoverageMatrix(criteriaList)

    const startedAt = interview.started_at || nowIso
    const timeConstraints = adaptivePolicyService.validateTimeConstraints({
      startedAt,
      durationMinutes: configuredDuration,
    })

    const { data: existingTranscripts } = await supabase
      .from('transcripts')
      .select('speaker, content')
      .eq('interview_id', interview.id)
    const hasCandidateTurn = (existingTranscripts || []).some((turn) => turn.speaker === 'CANDIDATE')
    const existingMeta = existingSession?.session_metadata || {}
    let initialQuestion = existingMeta.current_question || null
    const recoveringLegacyTurn = hasCandidateTurn && initialQuestion?.id === 'intro-q0'
    if (!initialQuestion || (!hasCandidateTurn && initialQuestion.id === 'intro-q0') || recoveringLegacyTurn) {
      const latestCandidateAnswer = [...(existingTranscripts || [])].reverse().find((turn) => turn.speaker === 'CANDIDATE')
      const recoverySequence = recoveringLegacyTurn ? (Number(existingMeta.current_question_sequence) || 0) + 1 : 0
      if (!recoveringLegacyTurn) {
        const candidateName = candidate?.full_name ? `, ${candidate.full_name}` : ''
        const jobRole = job?.title || 'this role'
        initialQuestion = {
          id: randomUUID(),
          sessionId: existingSession?.id || null,
          timestamp: new Date().toISOString(),
          sequence: 0,
          question_text: `Welcome to QualifyAI! Please introduce yourself, your technical background, and your key project experience for the ${jobRole} position.`,
          spoken_lead_in: `Welcome to QualifyAI, ${candidateName}. I will be your autonomous AI interviewer for the ${jobRole} position today. In this session, I will guide you through adaptive technical questions one by one. You can speak naturally or use the interactive on-screen editor, and submit your response whenever you are ready. To begin, please introduce yourself, your technical background, and your key projects.`,
          type: 'BEHAVIORAL',
          difficulty: 'MEDIUM',
          rubric_criterion_id: null,
          skill: 'Professional background',
          topic: 'Introduction & Room Guidelines',
          relationship: 'INITIAL',
          reason: 'Required interview opening introducing QualifyAI and room guidelines',
          based_on_question_id: null,
          options: [],
          metadata: {
            type: 'BEHAVIORAL',
            expected_concepts: ['Professional background', 'Project architecture', 'Technical experience'],
            rubric_focus: 'Professional background & Introduction',
            room_rules: [
              '1 question at a time with real-time adaptive follow-ups',
              'Speak aloud or type your answer in the workspace',
              'Click Submit Response when done, or pause for 5-7s to auto-submit',
              'Assessment runs in monitored fullscreen mode',
            ],
          },
        }
      } else {
      const initialDecision = await realtimeQuestionGenerator.decideNextAction({
        job,
        candidate,
        rubricCriteria: rubric.rubric_criteria || [],
        coverageMap: existingMeta.coverage_matrix || initialCoverageMatrix,
        currentQuestion: recoveringLegacyTurn ? initialQuestion : null,
        answer: recoveringLegacyTurn ? { text: latestCandidateAnswer?.content || '', questionId: initialQuestion.id, questionSequence: existingMeta.current_question_sequence || 0 } : null,
        askedQuestions: existingMeta.asked_questions || [],
        turnHistory: existingMeta.turn_history || [],
        sequence: recoverySequence,
        timeRemainingSeconds: timeConstraints.remainingSeconds,
        interviewDurationMinutes: configuredDuration,
      })
      if (initialDecision.action === 'END_INTERVIEW') {
        throw new Error('Gemini ended the interview before asking an initial question.')
      }
      initialQuestion = this._formatInterviewQuestion(initialDecision, recoverySequence, recoveringLegacyTurn ? initialQuestion : null, existingSession?.id || null)
      }
    }

    const introQuestionObj = initialQuestion

    const initialMetadata = {
      duration_minutes: configuredDuration,
      started_at: timeConstraints.startedAt,
      ends_at: timeConstraints.endsAt,
      current_question_sequence: introQuestionObj.sequence || 0,
      event_sequence: 1,
      current_question_id: introQuestionObj.id,
      current_question: introQuestionObj,
      current_difficulty: introQuestionObj.difficulty,
      coverage_matrix: initialCoverageMatrix,
      asked_questions: [{ id: introQuestionObj.id, text: introQuestionObj.question_text, type: introQuestionObj.type, skill: introQuestionObj.skill, topic: introQuestionObj.topic, sequence: introQuestionObj.sequence || 0 }],
      answered_sequences: [],
      turn_history: [],
      difficulty_history: ['MEDIUM'],
    }

    // 3. Check transcripts; if empty, seed introduction question
    const { data: transcripts } = await supabase
      .from('transcripts')
      .select('*')
      .eq('interview_id', interview.id)
      .order('sequence', { ascending: true })

    let currentTranscripts = transcripts || []
    const hasStoredCandidateTurn = currentTranscripts.some((t) => t.speaker === 'CANDIDATE')

    if (existingSession) {
      session = existingSession
      const meta = session.session_metadata || {}
      const isStartTurn = !hasStoredCandidateTurn && (meta.current_question_sequence === 0 || meta.current_question_id === 'intro-q0')
      const hasRecoveredQuestion = Number(introQuestionObj.sequence) > (Number(meta.current_question_sequence) || 0)

      const activeQSeq = (isStartTurn || hasRecoveredQuestion) ? (introQuestionObj.sequence || 0) : (meta.current_question_sequence ?? 0)
      const activeQId = (isStartTurn || hasRecoveredQuestion) ? introQuestionObj.id : (meta.current_question_id || introQuestionObj.id)
      const activeQuestion = (isStartTurn || hasRecoveredQuestion) ? introQuestionObj : (meta.current_question || introQuestionObj)

      const upgradedMeta = {
        ...meta,
        event_sequence: meta.event_sequence || 1,
        duration_minutes: meta.duration_minutes || configuredDuration,
        started_at: meta.started_at || timeConstraints.startedAt,
        ends_at: meta.ends_at || timeConstraints.endsAt,
        current_question_sequence: activeQSeq,
        current_question_id: activeQId,
        current_question: activeQuestion,
        coverage_matrix: (Array.isArray(meta.coverage_matrix) && meta.coverage_matrix.length > 0)
          ? meta.coverage_matrix
          : initialCoverageMatrix,
        asked_questions: isStartTurn
          ? [{ id: introQuestionObj.id, text: introQuestionObj.question_text, type: introQuestionObj.type, skill: introQuestionObj.skill, topic: introQuestionObj.topic, sequence: introQuestionObj.sequence || 0 }]
          : hasRecoveredQuestion
          ? [...(meta.asked_questions || []), { id: introQuestionObj.id, text: introQuestionObj.question_text, type: introQuestionObj.type, skill: introQuestionObj.skill, topic: introQuestionObj.topic, sequence: activeQSeq }]
          : (meta.asked_questions || [{ id: introQuestionObj.id, text: introQuestionObj.question_text, sequence: 0 }]),
        answered_sequences: meta.answered_sequences || [],
        current_difficulty: meta.current_difficulty || 'MEDIUM',
      }

      await supabase
        .from('interview_sessions')
        .update({
          session_metadata: upgradedMeta,
          current_question_index: activeQSeq,
        })
        .eq('id', session.id)

      session.session_metadata = upgradedMeta
    } else {
      const { data: newSession, error: sessError } = await supabase
        .from('interview_sessions')
        .insert({
          interview_id: interview.id,
          connection_state: 'ACTIVE',
          conversation_state: 'IDLE',
          current_question_index: 0,
          session_metadata: initialMetadata,
        })
        .select()
        .single()

      if (sessError) throw new Error(`Failed to create interview session: ${sessError.message}`)
      session = newSession
    }

    if (currentTranscripts.length === 0) {
      const welcomeQuestionText = introQuestionObj.spoken_lead_in
      const { data: firstTurn, error: firstTurnError } = await supabase
        .from('transcripts')
        .insert({
          interview_id: interview.id,
          speaker: 'AI',
          content: welcomeQuestionText,
          sequence: 1,
        })
        .select()
        .single()

      if (!firstTurnError && firstTurn) {
        currentTranscripts = [firstTurn]
      }
    }

    let currentMeta = session.session_metadata || initialMetadata
    const isTurn0 = !hasStoredCandidateTurn || currentMeta.current_question_sequence === 0 || currentMeta.current_question_id === 'intro-q0'
    let activeQuestionObj = isTurn0 ? introQuestionObj : (currentMeta.current_question || introQuestionObj)
    if (activeQuestionObj && activeQuestionObj.sessionId !== session.id) {
      activeQuestionObj = { ...activeQuestionObj, sessionId: session.id, timestamp: activeQuestionObj.timestamp || new Date().toISOString() }
      currentMeta = { ...currentMeta, current_question: activeQuestionObj }
      session.session_metadata = currentMeta
      await supabase.from('interview_sessions').update({ session_metadata: currentMeta }).eq('id', session.id)
    }

    const runtimeTimeConstraints = adaptivePolicyService.validateTimeConstraints({
      startedAt: currentMeta.started_at,
      durationMinutes: currentMeta.duration_minutes || configuredDuration,
      endsAt: currentMeta.ends_at,
    })

    if (runtimeTimeConstraints.isExpired) {
      const completion = await this._concludeSessionOnTimeLimit({
        interview, session, candidate, job, meta: currentMeta, token,
      })
      return {
        ...completion,
        interview: { ...interview, status: 'COMPLETED' },
        session: { ...completion.session, ...session, status: 'COMPLETED', remaining_seconds: 0 },
        currentQuestion: null,
        transcripts: currentTranscripts,
      }
    }
    return {
      interview,
      session: {
        id: session.id,
        interview_id: interview.id,
        status: interview.status,
        started_at: currentMeta.started_at,
        ends_at: currentMeta.ends_at,
        duration_minutes: currentMeta.duration_minutes || configuredDuration,
        remaining_seconds: runtimeTimeConstraints.remainingSeconds,
        warning_count: Number(interview.warning_count) || 0,
        current_question_sequence: activeQuestionObj.sequence || 0,
        session_metadata: currentMeta,
        job: { id: job.id, title: job.title, department: job.department, seniority: job.seniority },
        candidate: { id: candidate.id, full_name: candidate.full_name, email: candidate.email },
      },
      coverageMatrix: currentMeta.coverage_matrix || initialCoverageMatrix,
      currentQuestion: activeQuestionObj,
      currentQuestionEvent: {
        type: 'ai_question',
        sessionId: session.id,
        eventId: `${session.id}-${activeQuestionObj.id}`,
        sequence: currentMeta.event_sequence || 1,
        questionSequence: activeQuestionObj.sequence || 0,
        question: activeQuestionObj,
        aiMessage: activeQuestionObj.spoken_lead_in || activeQuestionObj.question_text,
        remainingSeconds: runtimeTimeConstraints.remainingSeconds,
        timestamp: activeQuestionObj.timestamp || runtimeTimeConstraints.startedAt,
      },
      sequence: activeQuestionObj.sequence || 0,
      remainingSeconds: runtimeTimeConstraints.remainingSeconds,
      transcripts: currentTranscripts,
    }
  },

  /**
   * Process Candidate Turn: Answer analysis -> Policy Guidance -> Autonomous AI Question Generation -> Atomic Broadcast
   */
  async processCandidateTurn({
    interviewId,
    ...answer
  }) {
    const inFlight = activeTurnPromises.get(interviewId)
    if (inFlight) {
      const sameSubmission =
        inFlight.token === answer.token &&
        inFlight.questionId === answer.questionId &&
        inFlight.questionSequence === answer.questionSequence &&
        inFlight.answerText === String(answer.answerText || '').trim()
      if (sameSubmission) return inFlight.promise
      const conflict = new Error('Another answer is already being committed for this interview question.')
      conflict.status = 409
      throw conflict
    }
    const processing = this._processCandidateTurn({ interviewId, ...answer })
    activeTurnPromises.set(interviewId, {
      promise: processing,
      token: answer.token,
      questionId: answer.questionId,
      questionSequence: answer.questionSequence,
      answerText: String(answer.answerText || '').trim(),
    })
    try {
      return await processing
    } catch (error) {
      try {
        const supabase = getServiceSupabaseClient()
        let sessionQuery = supabase.from('interview_sessions').select('id, session_metadata, conversation_state')
        sessionQuery = interviewId
          ? sessionQuery.eq('interview_id', interviewId)
          : sessionQuery
        let { data: failedSession } = await sessionQuery.maybeSingle()
        if (!failedSession) {
          const { data } = await supabase
            .from('interview_sessions')
            .select('id, session_metadata, conversation_state')
            .eq('id', interviewId)
            .maybeSingle()
          failedSession = data
        }

        const failedMeta = failedSession?.session_metadata || {}
        const hasCommittedAnswer = (failedMeta.answer_history || []).some((item) =>
          item.questionId === answer.questionId && item.questionSequence === answer.questionSequence
        )
        if (failedSession && hasCommittedAnswer && failedSession.conversation_state === 'AI_ANALYZING') {
          await supabase.from('interview_sessions').update({
            conversation_state: 'THINKING',
            session_metadata: {
              ...failedMeta,
              answer_processing_state: 'FAILED',
              answer_processing_failed_at: new Date().toISOString(),
            },
          }).eq('id', failedSession.id).eq('conversation_state', 'AI_ANALYZING')
        }
      } catch (recoveryMarkError) {
        console.error('[InterviewEngine] Failed to mark answer processing as recoverable:', recoveryMarkError.message)
      }
      throw error
    } finally {
      if (activeTurnPromises.get(interviewId)?.promise === processing) activeTurnPromises.delete(interviewId)
    }
  },

  async advanceAfterSilence({ interviewId, token }) {
    const supabase = getServiceSupabaseClient()
    const { job, candidate, rubric } = await this._resolveTokenContext(token)
    const { data: interview } = await supabase.from('interviews').select('*').eq('id', interviewId).maybeSingle()
    let targetInterview = interview
    if (!targetInterview) {
      const { data: sessionById } = await supabase.from('interview_sessions').select('*').eq('id', interviewId).maybeSingle()
      if (sessionById) {
        const { data: foundInterview } = await supabase.from('interviews').select('*').eq('id', sessionById.interview_id).maybeSingle()
        targetInterview = foundInterview
      }
    }
    if (!targetInterview) throw new Error('Interview session not found.')
    const { data: session } = await supabase.from('interview_sessions').select('*').eq('interview_id', targetInterview.id).maybeSingle()
    if (!session) throw new Error('Interview session not found.')
    const meta = session.session_metadata || {}
    const unansweredCount = (Number(meta.unanswered_questions_in_a_row) || 0) + 1
    if (unansweredCount >= 3) {
      return this._concludeSessionEarly({ interview: targetInterview, session, candidate, job, meta: { ...meta, unanswered_questions_in_a_row: unansweredCount }, token, reason: 'THREE_QUESTIONS_UNANSWERED' })
    }
    const timeCheck = adaptivePolicyService.validateTimeConstraints({ startedAt: meta.started_at, durationMinutes: meta.duration_minutes || 20, endsAt: meta.ends_at })
    if (timeCheck.isExpired) return this._concludeSessionOnTimeLimit({ interview: targetInterview, session, candidate, job, meta, token })
    const currentQuestion = meta.current_question
    const nextSequence = (Number(meta.current_question_sequence) || 0) + 1
    const noResponseTurn = {
      turn_sequence: meta.current_question_sequence || 0,
      question_id: currentQuestion?.id,
      question_text: currentQuestion?.question_text,
      answer_text: null,
      no_response: true,
      timestamp: new Date().toISOString(),
    }
    const turnHistory = [...(meta.turn_history || []), noResponseTurn]
    const decision = await realtimeQuestionGenerator.decideNextAction({
      job, candidate, rubricCriteria: rubric.rubric_criteria || [], coverageMap: meta.coverage_matrix || [],
      currentQuestion, answer: { text: '', noResponse: true, questionId: currentQuestion?.id, questionSequence: meta.current_question_sequence },
      answerAnalysis: null, turnHistory, sequence: nextSequence, timeRemainingSeconds: timeCheck.remainingSeconds,
      interviewDurationMinutes: meta.duration_minutes, askedQuestions: meta.asked_questions || [], noResponse: true,
    })
    if (decision.action === 'END_INTERVIEW') {
      return this._concludeSessionEarly({ interview: targetInterview, session, candidate, job, meta: { ...meta, unanswered_questions_in_a_row: unansweredCount, turn_history: turnHistory }, token, reason: decision.completionReason })
    }
    const nextQuestion = this._formatInterviewQuestion(decision, nextSequence, currentQuestion, session.id)
    const eventSequence = (Number(meta.event_sequence) || 1) + 1
    const updatedMeta = {
      ...meta, unanswered_questions_in_a_row: unansweredCount, turn_history: turnHistory,
      current_question_sequence: nextSequence, current_question_id: nextQuestion.id, current_question: nextQuestion,
      event_sequence: eventSequence + 1,
      asked_questions: [...(meta.asked_questions || []), { id: nextQuestion.id, text: nextQuestion.question_text, type: nextQuestion.type, skill: nextQuestion.skill, topic: nextQuestion.topic, sequence: nextSequence }],
    }
    await supabase.from('interview_sessions').update({ session_metadata: updatedMeta, current_question_index: nextSequence, conversation_state: 'AI_SPEAKING' }).eq('id', session.id)
    const { data: lastTranscript } = await supabase.from('transcripts').select('sequence').eq('interview_id', targetInterview.id).order('sequence', { ascending: false }).limit(1)
    const spoken = nextQuestion.spoken_lead_in || nextQuestion.question_text
    await supabase.from('transcripts').insert({ interview_id: targetInterview.id, speaker: 'AI', content: spoken, sequence: (lastTranscript?.[0]?.sequence || 0) + 1 })
    const questionEvent = { type: 'ai_question', sessionId: session.id, eventId: `${session.id}-${nextQuestion.id}`, sequence: eventSequence + 1, questionSequence: nextSequence, question: nextQuestion, aiMessage: spoken, remainingSeconds: timeCheck.remainingSeconds, speakAloud: true, timestamp: new Date().toISOString() }
    return { isCompleted: false, sequence: nextSequence, nextQuestion, remainingSeconds: timeCheck.remainingSeconds, coverageMatrix: meta.coverage_matrix || [], session: { id: session.id, interview_id: targetInterview.id, session_metadata: updatedMeta } }
  },

  async startWrapUp({ interviewId, token }) {
    const supabase = getServiceSupabaseClient()
    const { job, candidate, rubric } = await this._resolveTokenContext(token)
    let { data: interview } = await supabase.from('interviews').select('*').eq('id', interviewId).maybeSingle()
    if (!interview) {
      const { data: bySession } = await supabase.from('interview_sessions').select('interview_id').eq('id', interviewId).maybeSingle()
      if (bySession) ({ data: interview } = await supabase.from('interviews').select('*').eq('id', bySession.interview_id).maybeSingle())
    }
    if (!interview) throw new Error('Interview session not found.')
    const { data: session } = await supabase.from('interview_sessions').select('*').eq('interview_id', interview.id).maybeSingle()
    if (!session) throw new Error('Interview session not found.')
    const meta = session.session_metadata || {}
    if (meta.wrap_up_started) return { sequence: meta.current_question_sequence, nextQuestion: meta.current_question, remainingSeconds: adaptivePolicyService.validateTimeConstraints({ startedAt: meta.started_at, durationMinutes: meta.duration_minutes || 20, endsAt: meta.ends_at }).remainingSeconds, coverageMatrix: meta.coverage_matrix || [], isDuplicate: true }
    const timeCheck = adaptivePolicyService.validateTimeConstraints({ startedAt: meta.started_at, durationMinutes: meta.duration_minutes || 20, endsAt: meta.ends_at })
    if (timeCheck.isExpired) return this._concludeSessionOnTimeLimit({ interview, session, candidate, job, meta, token })
    if (timeCheck.remainingSeconds > 120) return { isCompleted: false, skipped: true, remainingSeconds: timeCheck.remainingSeconds }
    const currentQuestion = meta.current_question
    const nextSequence = (Number(meta.current_question_sequence) || 0) + 1
    const decision = await realtimeQuestionGenerator.decideNextAction({
      job, candidate, rubricCriteria: rubric.rubric_criteria || [], coverageMap: meta.coverage_matrix || [],
      currentQuestion, answer: null, answerAnalysis: null, turnHistory: meta.turn_history || [],
      sequence: nextSequence, timeRemainingSeconds: timeCheck.remainingSeconds,
      interviewDurationMinutes: meta.duration_minutes, askedQuestions: meta.asked_questions || [], wrapUpMode: true,
    })
    if (decision.action === 'END_INTERVIEW') return this._concludeSessionEarly({ interview, session, candidate, job, meta: { ...meta, wrap_up_started: true }, token, reason: decision.completionReason })
    const nextQuestion = this._formatInterviewQuestion(decision, nextSequence, currentQuestion, session.id)
    const eventSequence = (Number(meta.event_sequence) || 1) + 1
    const updatedMeta = {
      ...meta, wrap_up_started: true, current_question_sequence: nextSequence, current_question_id: nextQuestion.id,
      current_question: nextQuestion, event_sequence: eventSequence + 1,
      asked_questions: [...(meta.asked_questions || []), { id: nextQuestion.id, text: nextQuestion.question_text, type: nextQuestion.type, skill: nextQuestion.skill, topic: nextQuestion.topic, sequence: nextSequence }],
    }
    await supabase.from('interview_sessions').update({ session_metadata: updatedMeta, current_question_index: nextSequence, conversation_state: 'AI_SPEAKING' }).eq('id', session.id)
    const { data: lastTranscript } = await supabase.from('transcripts').select('sequence').eq('interview_id', interview.id).order('sequence', { ascending: false }).limit(1)
    const spoken = nextQuestion.spoken_lead_in || nextQuestion.question_text
    await supabase.from('transcripts').insert({ interview_id: interview.id, speaker: 'AI', content: spoken, sequence: (lastTranscript?.[0]?.sequence || 0) + 1 })
    const packet = { type: 'ai_question', sessionId: session.id, eventId: `${session.id}-${nextQuestion.id}`, sequence: eventSequence + 1, questionSequence: nextSequence, question: nextQuestion, aiMessage: spoken, remainingSeconds: timeCheck.remainingSeconds, speakAloud: true, timestamp: new Date().toISOString() }
    return { isCompleted: false, sequence: nextSequence, nextQuestion, remainingSeconds: timeCheck.remainingSeconds, coverageMatrix: meta.coverage_matrix || [], session: { id: session.id, interview_id: interview.id, session_metadata: updatedMeta } }
  },

  async _processCandidateTurn({
    interviewId,
    token,
    answerText,
    questionSequence,
    questionId,
    inputMethod = 'VOICE',
  }) {
    const supabase = getServiceSupabaseClient()
    const { job, candidate, rubric } = await this._resolveTokenContext(token)

    // 1. Fetch interview & session
    let interview = null
    let session = null

    const { data: directInt } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', interviewId)
      .maybeSingle()

    if (directInt) {
      interview = directInt
      const { data: s } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('interview_id', interview.id)
        .maybeSingle()
      session = s
    } else {
      const { data: directSess } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', interviewId)
        .maybeSingle()

      if (directSess) {
        session = directSess
        const { data: int } = await supabase
          .from('interviews')
          .select('*')
          .eq('id', directSess.interview_id)
          .maybeSingle()
        interview = int
      }
    }

    if (!interview || !session) {
      throw new Error('Interview or session record not found.')
    }

    let meta = session.session_metadata || {}
    const answerState = validateActiveQuestionAnswer(meta, { questionId, questionSequence })
    const currentSeq = answerState.currentSequence
    const answeredSequences = Array.isArray(meta.answered_sequences) ? meta.answered_sequences : []
    const existingCommit = (meta.answer_history || []).find((answer) => answer.questionSequence === questionSequence && answer.questionId === questionId)
    const committedAtMs = existingCommit?.committedAt ? new Date(existingCommit.committedAt).getTime() : 0
    const isProcessingAnswer = answerState.duplicate && meta.conversation_state === 'AI_ANALYZING' && Date.now() - committedAtMs < 60_000
    const recoveringCommittedAnswer = answerState.duplicate && (
      (meta.conversation_state === 'AI_ANALYZING' && !isProcessingAnswer) ||
      meta.answer_processing_state === 'FAILED'
    )

    // Idempotently return canonical state when a committed answer is retried.
    if (answerState.duplicate && !recoveringCommittedAnswer) {
      console.log(`[InterviewEngine] Duplicate submission detected for sequence ${questionSequence}. Returning existing state.`)
      const timeCheck = adaptivePolicyService.validateTimeConstraints({
        startedAt: meta.started_at,
        durationMinutes: meta.duration_minutes || 20,
        endsAt: meta.ends_at,
      })
      if (timeCheck.isExpired) {
        return this._concludeSessionOnTimeLimit({ interview, session, candidate, job, meta, token })
      }
      return {
        isDuplicate: true,
        isProcessing: isProcessingAnswer,
        isCompleted: interview.status === 'COMPLETED',
        sequence: currentSeq,
        nextQuestion: meta.current_question,
        remainingSeconds: timeCheck.remainingSeconds,
        session: {
          id: session.id,
          interview_id: interview.id,
          status: interview.status,
          session_metadata: meta,
        },
        coverageMatrix: meta.coverage_matrix,
      }
    }

    const committedAnswer = recoveringCommittedAnswer ? existingCommit : null
    if (recoveringCommittedAnswer && !committedAnswer) {
      throw new Error('The committed answer is missing from interview state and cannot be safely replayed.')
    }
    if (committedAnswer) {
      answerText = committedAnswer.answerText
      inputMethod = committedAnswer.inputMode
    }

    const activeQuestion = answerState.activeQuestion

    // 3. SERVER-AUTHORITATIVE TIME LIMIT CHECK
    const timeCheck = adaptivePolicyService.validateTimeConstraints({
      startedAt: meta.started_at,
      durationMinutes: meta.duration_minutes || 20,
      endsAt: meta.ends_at,
    })

    if (timeCheck.isExpired) {
      console.log(`[InterviewEngine] Session deadline reached (${timeCheck.remainingSeconds}s remaining). Gracefully completing interview.`)
      return this._concludeSessionOnTimeLimit({
        interview,
        session,
        candidate,
        job,
        meta,
        token,
        answerText,
      })
    }

    // 3.5. CANDIDATE REPEAT REQUEST HANDLING:
    // If candidate asked the AI to repeat the question, DO NOT advance or commit an answer!
    if (isRepeatQuestionRequest(answerText)) {
      console.log(`[InterviewEngine] Candidate requested to repeat active question #${currentSeq} for session ${session.id}.`)
      const activeQ = activeQuestion || meta.current_question
      const rawPrompt = activeQ?.question_text || activeQ?.prompt || ''
      const repeatLeadIn = `Sure, let me repeat that: ${rawPrompt}`

      return {
        isRepeat: true,
        isCompleted: false,
        sequence: currentSeq,
        nextQuestion: {
          ...activeQ,
          spoken_lead_in: repeatLeadIn,
        },
        remainingSeconds: timeCheck.remainingSeconds,
        session: {
          id: session.id,
          interview_id: interview.id,
          status: interview.status,
          session_metadata: meta,
        },
        coverageMatrix: meta.coverage_matrix,
      }
    }

    // 4. Mark sequence as answered in session metadata
    const activeAnsweringSeq = currentSeq
    const updatedAnsweredSequences = recoveringCommittedAnswer
      ? answeredSequences
      : [...new Set([...answeredSequences, activeAnsweringSeq])]
    const answerId = committedAnswer?.answerId || randomUUID()

    // 5. Append candidate answer to transcripts
    const { data: latestTranscripts } = await supabase
      .from('transcripts')
      .select('sequence, speaker, content')
      .eq('interview_id', interview.id)
      .order('sequence', { ascending: false })
      .limit(1)

    const lastTx = latestTranscripts?.[0]
    const nextTxSeq = (lastTx?.sequence || 0) + 1

    if (!recoveringCommittedAnswer && (!lastTx || lastTx.speaker !== 'CANDIDATE' || lastTx.content.trim() !== answerText.trim())) {
      await supabase.from('transcripts').insert({
        interview_id: interview.id,
        speaker: 'CANDIDATE',
        content: answerText.trim(),
        sequence: nextTxSeq,
      })
    }

    const answerCommit = committedAnswer || createAnswerCommit({
      sessionId: session.id,
      answerId,
      question: { id: activeQuestion.id, sequence: activeAnsweringSeq },
      answerText,
      inputMode: inputMethod,
      committedAt: new Date().toISOString(),
    })
    if (!recoveringCommittedAnswer) {
      meta = {
        ...meta,
        answered_sequences: updatedAnsweredSequences,
        answer_history: [...(meta.answer_history || []), answerCommit],
        event_sequence: (Number(meta.event_sequence) || 1) + 1,
      }
      let claim = supabase
        .from('interview_sessions')
        .update({ session_metadata: meta, conversation_state: 'AI_ANALYZING' })
        .eq('id', session.id)
      claim = session.conversation_state == null
        ? claim.is('conversation_state', null)
        : claim.eq('conversation_state', session.conversation_state)
      const { data: claimed, error: claimError } = await claim.select('id').maybeSingle()
      if (claimError || !claimed) {
        const conflict = new Error('Another answer is already being committed for this interview question.')
        conflict.status = 409
        throw conflict
      }
    }

    // 6. Active Question & Criterion Resolution
    const currentQuestion = meta.current_question

    const currentCriterion = (rubric.rubric_criteria || []).find(
      (c) => c.id === currentQuestion.rubric_criterion_id
    )

    // 7. Answer Analysis
    const analysis = await answerAnalyzer.analyzeAnswer({
      question: currentQuestion,
      rubricCriterion: currentCriterion,
      candidateAnswer: answerText,
      previousContext: meta.turn_history || [],
    })

    // 8. Policy Guidance Calculation (evidence tracking, adaptive difficulty, topic priority)
    const policyGuidance = adaptivePolicyService.computePolicyGuidance({
      coverageMatrix: meta.coverage_matrix || adaptivePolicyService.initializeCoverageMatrix(rubric.rubric_criteria || []),
      currentCriterionId: currentCriterion?.id,
      answerAnalysis: analysis,
      turnSequence: activeAnsweringSeq,
      candidateAnswer: answerText,
      jobTitle: job?.title,
      askedQuestions: meta.asked_questions || [],
    })

    // 9. Autonomous AI Question Synthesis (Gemini AI Interviewer)
    const nextQuestionSequence = currentSeq + 1
    const turnRecord = {
      turn_sequence: activeAnsweringSeq,
      question_id: currentQuestion.id,
      question_text: currentQuestion.question_text,
      answer_id: answerId,
      answer_text: answerText.trim(),
      criterion_name: currentCriterion?.name || currentQuestion.skill || currentQuestion.topic || 'General Engineering',
      answer_length: answerText.length,
      input_method: inputMethod,
      analysis,
      timestamp: new Date().toISOString(),
    }
    const updatedTurnHistory = [...(meta.turn_history || []), turnRecord]
    const decisionTime = adaptivePolicyService.validateTimeConstraints({
      startedAt: meta.started_at,
      durationMinutes: meta.duration_minutes,
      endsAt: meta.ends_at,
    })
    if (decisionTime.isExpired) {
      return this._concludeSessionOnTimeLimit({ interview, session, candidate, job, meta, token })
    }
    const decision = await realtimeQuestionGenerator.decideNextAction({
      job,
      candidate,
      rubricCriteria: rubric.rubric_criteria || [],
      coverageMap: policyGuidance.updatedMatrix,
      policyGuidance,
      currentQuestion,
      answer: { id: answerId, text: answerText.trim(), questionId: currentQuestion.id, questionSequence: activeAnsweringSeq },
      answerAnalysis: analysis,
      turnHistory: updatedTurnHistory,
      sequence: nextQuestionSequence,
      timeRemainingSeconds: decisionTime.remainingSeconds,
      interviewDurationMinutes: meta.duration_minutes,
      askedQuestions: meta.asked_questions || [],
      wrapUpMode: Boolean(meta.wrap_up_started),
    })

    const postDecisionTimeCheck = adaptivePolicyService.validateTimeConstraints({
      startedAt: meta.started_at,
      durationMinutes: meta.duration_minutes,
      endsAt: meta.ends_at,
    })
    if (postDecisionTimeCheck.isExpired) {
      return this._concludeSessionOnTimeLimit({ interview, session, candidate, job, meta, token })
    }

    const decisionEventSequence = (Number(meta.event_sequence) || 1) + 1

    if (decision.action === 'END_INTERVIEW') {
      return this._concludeSessionEarly({ interview, session, candidate, job, meta, token, reason: decision.completionReason })
    }
    const dynamicQuestion = this._formatInterviewQuestion(decision, nextQuestionSequence, currentQuestion, session.id)

    // 10. Record turn in turn history
    const updatedAskedQuestions = [
      ...(meta.asked_questions || []),
      { id: dynamicQuestion.id, text: dynamicQuestion.question_text, type: dynamicQuestion.type, skill: dynamicQuestion.skill, topic: dynamicQuestion.topic, sequence: nextQuestionSequence },
    ]

    // 11. Atomic Session Metadata Update with Monotonic Sequence
    const updatedMetadata = {
      ...meta,
      answer_processing_state: undefined,
      answer_processing_failed_at: undefined,
      event_sequence: decisionEventSequence + 1,
      current_question_sequence: nextQuestionSequence,
      current_question_id: dynamicQuestion.id,
      current_question: dynamicQuestion,
      current_criterion_id: dynamicQuestion.rubric_criterion_id || null,
      current_difficulty: dynamicQuestion.difficulty,
      coverage_matrix: policyGuidance.updatedMatrix,
      answered_sequences: updatedAnsweredSequences,
      unanswered_questions_in_a_row: 0,
      answer_history: meta.answer_history,
      asked_questions: updatedAskedQuestions,
      turn_history: updatedTurnHistory,
      difficulty_history: [...(meta.difficulty_history || []), dynamicQuestion.difficulty],
    }

    await supabase
      .from('interview_sessions')
      .update({
        session_metadata: updatedMetadata,
        current_question_index: nextQuestionSequence,
        conversation_state: 'AI_SPEAKING',
      })
      .eq('id', session.id)

    // 12. Insert Spoken Prompt into Transcripts
    const spokenPrompt = dynamicQuestion.spoken_lead_in || dynamicQuestion.question_text
    await supabase.from('transcripts').insert({
      interview_id: interview.id,
      speaker: 'AI',
      content: spokenPrompt,
      sequence: nextTxSeq + 1,
    })

    // 13. Canonical AI Question Event Broadcast via WebSocket
    const questionEventPacket = {
      type: 'ai_question',
      sessionId: session.id,
      interviewId: interview.id,
      eventId: randomUUID(),
      sequence: updatedMetadata.event_sequence,
      questionSequence: nextQuestionSequence,
      question: dynamicQuestion,
      aiMessage: spokenPrompt,
      remainingSeconds: timeCheck.remainingSeconds,
      speakAloud: true,
      timestamp: new Date().toISOString(),
    }


    return {
      isCompleted: false,
      sequence: nextQuestionSequence,
      nextQuestion: dynamicQuestion,
      remainingSeconds: timeCheck.remainingSeconds,
      answerAnalysis: analysis,
      policyGuidance,
      session: {
        id: session.id,
        interview_id: interview.id,
        status: interview.status,
        session_metadata: updatedMetadata,
      },
      coverageMatrix: updatedMetadata.coverage_matrix,
      transcripts: [],
    }
  },

  /**
   * Graceful conclusion when server time limit is reached
   */
  async _concludeSessionOnTimeLimit({ interview, session, candidate, job, meta, token }) {
    const supabase = getServiceSupabaseClient()
    const { data: latestSession } = await supabase
      .from('interview_sessions').select('session_metadata').eq('id', session.id).maybeSingle()
    const completionMeta = latestSession?.session_metadata || meta
    const completionEventSequence = (Number(completionMeta.event_sequence) || 0) + 1

    await supabase
      .from('interviews')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      })
      .eq('id', interview.id)

    if (token) {
      await supabase.from('invitations').update({ status: 'COMPLETED' }).eq('token', token)
    }
    await supabase
      .from('interview_sessions')
      .update({
        connection_state: 'DISCONNECTED',
        conversation_state: 'IDLE',
        session_metadata: { ...completionMeta, event_sequence: completionEventSequence },
      })
      .eq('id', session.id)

    const closingMessage = `Thank you, ${candidate.full_name}. That concludes your technical assessment for the ${job.title} role. Your answers have been saved and forwarded to the hiring team.`

    const { data: lastTranscript } = await supabase.from('transcripts')
      .select('sequence').eq('interview_id', interview.id).order('sequence', { ascending: false }).limit(1)
    await supabase.from('transcripts').insert({
      interview_id: interview.id,
      speaker: 'AI',
      content: closingMessage,
      sequence: (lastTranscript?.[0]?.sequence || 0) + 1,
    })

    const completionPacket = {
      type: 'interview_completed',
      sessionId: session.id,
      eventId: randomUUID(),
      sequence: completionEventSequence,
      reason: 'TIME_LIMIT_REACHED',
      closingMessage,
      remainingSeconds: 0,
      timestamp: new Date().toISOString(),
    }


    return {
      isCompleted: true,
      reason: 'TIME_LIMIT_REACHED',
      sequence: completionEventSequence,
      nextQuestion: null,
      remainingSeconds: 0,
      closingMessage,
      session: {
        id: session.id,
        interview_id: interview.id,
        status: 'COMPLETED',
        session_metadata: { ...completionMeta, event_sequence: completionEventSequence },
      },
      coverageMatrix: completionMeta.coverage_matrix || [],
    }
  },

  async _concludeSessionEarly({ interview, session, candidate, job, meta, token, reason }) {
    const supabase = getServiceSupabaseClient()
    const completedAt = new Date().toISOString()
    const closingMessage = `Thank you, ${candidate.full_name}. That concludes your technical assessment for the ${job.title} role. Your answers have been saved and forwarded to the hiring team.`
    const eventSequence = (Number(meta.event_sequence) || 0) + 2
    await supabase.from('interviews').update({ status: 'COMPLETED', completed_at: completedAt }).eq('id', interview.id)
    await supabase.from('interview_sessions').update({
      connection_state: 'DISCONNECTED',
      conversation_state: 'IDLE',
      session_metadata: { ...meta, event_sequence: eventSequence },
    }).eq('id', session.id)
    await supabase.from('invitations').update({ status: 'COMPLETED' }).eq('token', token)
    const { data: lastTranscript } = await supabase.from('transcripts')
      .select('sequence').eq('interview_id', interview.id).order('sequence', { ascending: false }).limit(1)
    await supabase.from('transcripts').insert({
      interview_id: interview.id,
      speaker: 'AI',
      content: closingMessage,
      sequence: (lastTranscript?.[0]?.sequence || 0) + 1,
    })
    return {
      isCompleted: true, reason: 'AI_COMPLETED', closingMessage, nextQuestion: null,
      remainingSeconds: adaptivePolicyService.validateTimeConstraints({
        startedAt: meta.started_at, durationMinutes: meta.duration_minutes, endsAt: meta.ends_at,
      }).remainingSeconds,
      session: { id: session.id, interview_id: interview.id, status: 'COMPLETED', session_metadata: meta },
      coverageMatrix: meta.coverage_matrix || [],
    }
  },

  /**
   * Explicit interview completion
   */
  async completeInterview({ interviewId, token, feedback, feedbackRating }) {
    const supabase = getServiceSupabaseClient()
    const { job, candidate } = await this._resolveTokenContext(token, true)

    let targetInterviewId = interviewId

    if (interviewId) {
      const { data: directInt } = await supabase
        .from('interviews')
        .select('id')
        .eq('id', interviewId)
        .maybeSingle()

      if (directInt) {
        targetInterviewId = directInt.id
      } else {
        const { data: directSess } = await supabase
          .from('interview_sessions')
          .select('interview_id')
          .eq('id', interviewId)
          .maybeSingle()
        if (directSess) {
          targetInterviewId = directSess.interview_id
        }
      }
    }

    if (!targetInterviewId && job?.id && candidate?.id) {
      const { data: matchInt } = await supabase
        .from('interviews')
        .select('id')
        .eq('job_id', job.id)
        .eq('candidate_id', candidate.id)
        .maybeSingle()
      if (matchInt) {
        targetInterviewId = matchInt.id
      }
    }

    let completedInterview = null
    if (targetInterviewId) {
      const { data: interview, error } = await supabase
        .from('interviews')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
        })
        .eq('id', targetInterviewId)
        .select()
        .maybeSingle()

      if (error) {
        console.warn(`[completeInterview] Notice updating interview: ${error.message}`)
      } else {
        completedInterview = interview
      }

      const { data: targetSessions } = await supabase
        .from('interview_sessions').select('id, session_metadata').eq('interview_id', targetInterviewId)
      for (const targetSession of targetSessions || []) {
        const metadata = targetSession.session_metadata || {}
        const normalizedRating = feedbackRating === null || feedbackRating === '' || feedbackRating === undefined
          ? null
          : Number(feedbackRating)
        const hasFeedback = typeof feedback === 'string' && feedback.trim().length > 0
        const hasValidRating = Number.isInteger(normalizedRating) && normalizedRating >= 1 && normalizedRating <= 5
        if (hasFeedback || hasValidRating) {
          await supabase.from('interview_sessions').update({
            session_metadata: {
              ...metadata,
              ...(hasFeedback ? { candidate_feedback: feedback.trim().slice(0, 4000) } : {}),
              ...(hasValidRating ? { candidate_ai_rating: normalizedRating } : {}),
              feedback_submitted_at: new Date().toISOString(),
            },
          }).eq('id', targetSession.id)
        }
      }
      await supabase
        .from('interview_sessions')
        .update({ connection_state: 'DISCONNECTED', conversation_state: 'IDLE' })
        .eq('interview_id', targetInterviewId)
    }

    if (token) {
      await supabase
        .from('invitations')
        .update({ status: 'COMPLETED' })
        .eq('token', token)
    }

    return completedInterview || { id: targetInterviewId, status: 'COMPLETED' }
  },

  /**
   * Retrieve current canonical interview state (Hydration & Reconnection)
   */
  async getInterviewState({ interviewId, token }) {
    const supabase = getServiceSupabaseClient()
    const { job, candidate } = await this._resolveTokenContext(token)

    let interview = null
    let session = null

    const { data: directInt } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', interviewId)
      .maybeSingle()

    if (directInt) {
      interview = directInt
      const { data: s } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('interview_id', interview.id)
        .maybeSingle()
      session = s
    } else {
      const { data: directSess } = await supabase
        .from('interview_sessions')
        .select('*')
        .eq('id', interviewId)
        .maybeSingle()

      if (directSess) {
        session = directSess
        const { data: int } = await supabase
          .from('interviews')
          .select('*')
          .eq('id', directSess.interview_id)
          .maybeSingle()
        interview = int
      }
    }

    if (!interview && job?.id && candidate?.id) {
      const { data: matchInt } = await supabase
        .from('interviews')
        .select('*')
        .eq('job_id', job.id)
        .eq('candidate_id', candidate.id)
        .maybeSingle()
      if (matchInt) {
        interview = matchInt
        const { data: s } = await supabase
          .from('interview_sessions')
          .select('*')
          .eq('interview_id', matchInt.id)
          .maybeSingle()
        session = s
      }
    }

    const targetIntId = interview?.id || interviewId

    const { data: transcripts } = await supabase
      .from('transcripts')
      .select('*')
      .eq('interview_id', targetIntId)
      .order('sequence', { ascending: true })

    const meta = session?.session_metadata || {}
    const timeCheck = adaptivePolicyService.validateTimeConstraints({
      startedAt: meta.started_at || interview?.started_at,
      durationMinutes: meta.duration_minutes || 20,
      endsAt: meta.ends_at,
    })

    return {
      interview,
      session: {
        ...session,
        job,
        candidate,
        started_at: meta.started_at,
        ends_at: meta.ends_at,
        duration_minutes: meta.duration_minutes || 20,
        remaining_seconds: timeCheck.remainingSeconds,
        current_question_sequence: meta.current_question_sequence || 0,
      },
      sequence: meta.current_question_sequence || 0,
      coverageMatrix: meta.coverage_matrix || [],
      currentQuestion: meta.current_question || null,
      remainingSeconds: timeCheck.remainingSeconds,
      transcripts: transcripts || [],
    }
  },
}

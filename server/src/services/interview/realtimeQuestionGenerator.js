import { aiOrchestrator } from '../../integrations/ai/index.js'
import {
  CANONICAL_QUESTION_TYPES,
  normalizeQuestionType,
  normalizeQuestionPayload,
  validateQuestionSchema,
  isValidQuestionType,
} from './questionTypeRegistry.js'
import { resolveFoundationalBackground } from './foundationalBackgroundResolver.js'
import { resolvePillarTaxonomy } from './pillarTaxonomyService.js'
import { checkDuplicateQuestion } from './questionDeduplicationService.js'

const ACTIONS = ['ASK_QUESTION', 'FOLLOW_UP', 'DEEPEN', 'SWITCH_TOPIC']
const RELATIONSHIPS = ['INITIAL', 'FOLLOW_UP', 'DEEPEN', 'SWITCH_TOPIC']

export const STANDARD_QUESTION_TYPES = CANONICAL_QUESTION_TYPES

/**
 * Resolves permitted question types from job configuration (predefined + custom)
 */
export function resolvePermittedQuestionTypes(job) {
  const allowed = Array.isArray(job?.allowed_question_types) && job.allowed_question_types.length > 0
    ? job.allowed_question_types.map((t) => normalizeQuestionType(t))
    : ['SHORT_ANSWER', 'DESCRIPTIVE', 'MULTIPLE_CHOICE', 'SELECT_MOST_APPROPRIATE']
  const custom = Array.isArray(job?.custom_question_types)
    ? job.custom_question_types.map((c) => String(c).trim().toUpperCase().replace(/\s+/g, '_')).filter(Boolean)
    : []
  const allPermitted = [...new Set([...allowed, ...custom])]
  return {
    allowedTypes: allowed,
    customTypes: custom,
    allPermittedTypes: allPermitted.length > 0 ? allPermitted : CANONICAL_QUESTION_TYPES,
  }
}

const QUESTION_FORMAT_SPECIFICATIONS = `
QUESTION FORMAT SPECIFICATIONS (15 CANONICAL ENTERPRISE TYPES):
- 'MULTIPLE_CHOICE':
  Provide 'options' array containing 4 clear, distinct choices.
  In spoken aiMessage, state question context and say: "Take a look at the options on your screen and let me know your choice."
- 'MULTI_SELECT':
  Provide 'options' array containing 4 distinct choices where candidate selects one or more valid options.
- 'TRUE_FALSE':
  Pose a clear technical or domain assertion in text. Options default to ["True", "False"].
- 'SHORT_ANSWER':
  Ask a concise question requiring only a 1-2 sentence direct response.
- 'DESCRIPTIVE':
  Architectural, systemic, or strategic in-depth discussion.
- 'FILL_IN_THE_BLANK':
  Provide sentence or expression with '___' indicating the missing keyword or value to fill in.
- 'CODING_CHALLENGE' (or 'CODE_WRITING'):
  Provide starter 'codeSnippet' template, specify 'language', and explain requirements and constraints.
- 'PREDICT_CODE_OUTPUT' (or 'CODE_OUTPUT'):
  Provide read-only 'codeSnippet', specify 'language', and ask candidate to analyze execution and predict exact terminal output.
- 'DEBUGGING':
  Provide code containing an error in 'codeSnippet', specify 'language', and ask candidate to pinpoint the bug, explain root cause, and provide the fix.
- 'COMPLETE_THE_CODE':
  Provide partial code snippet with '/* TODO: Complete missing implementation */' in 'codeSnippet', and ask candidate to write the missing portion.
- 'ARRANGE_ORDER':
  Provide 'items' array with 3 to 5 actual distinct items (e.g. sequence numbers/letters, terms, lifecycle phases, or algorithm steps) to arrange. Also provide 'expectedAnswer' array containing the strictly correct sequence. Never use generic placeholders like 'Step 1'.
- 'SELECT_MOST_APPROPRIATE' (or 'SCENARIO'):
  Present a realistic domain incident or trade-off scenario and 4 concrete tactical actions in 'options'.
- 'SLIDER_SCALE':
  Pose an architectural priority, latency vs throughput trade-off, or scale rating. Provide 'sliderConfig': { min: 1, max: 10, step: 1, minLabel: "Low", maxLabel: "High" }.
- 'MATCHING_PAIRS':
  Provide 3 to 4 related pairs: 'leftItems' array of concepts/terms and 'rightItems' array of corresponding definitions/roles.
- 'NUMERICAL_APTITUDE':
  Pose a quantitative reasoning, complexity calculation, or math problem. Provide 'numericalConfig': { unit: "ms", tolerance: 0.05 }.
`

/** Gemini chooses both the next action and the content. The server only validates and assigns identity. */
export const createRealtimeQuestionGenerator = (ai = aiOrchestrator) => ({
  async decideNextAction({
    job,
    candidate,
    rubricCriteria = [],
    coverageMap = [],
    currentQuestion = null,
    answer = null,
    answerAnalysis = null,
    policyGuidance = null,
    turnHistory = [],
    askedQuestions = [],
    sequence = 0,
    timeRemainingSeconds = 0,
    interviewDurationMinutes = null,
    noResponse = false,
    wrapUpMode = false,
  }) {
    const recentQuestions = askedQuestions.slice(-6).map((item) => ({
      text: String(item.text || item.question_text || '').slice(0, 350),
      type: item.type,
      skill: item.skill,
      topic: item.topic,
    }))
    const compactTurnHistory = turnHistory.slice(-3).map((turn) => ({
      question_text: String(turn.question_text || '').slice(0, 500),
      answer_text: String(turn.answer_text || '').slice(0, 900),
      criterion_name: turn.criterion_name,
      analysis: turn.analysis ? {
        correctness: turn.analysis.correctness,
        relevance: turn.analysis.relevance,
        depth: turn.analysis.depth,
        concepts_detected: (turn.analysis.concepts_detected || []).slice(0, 8),
        missing_concepts: (turn.analysis.missing_concepts || []).slice(0, 5),
        feedback_summary: String(turn.analysis.feedback_summary || '').slice(0, 350),
      } : undefined,
    }))
    const resumeContext = candidate?.resume_text || candidate?.resume || null
    const compactResume = resumeContext
      ? (typeof resumeContext === 'string' ? resumeContext : JSON.stringify(resumeContext)).slice(0, 1800)
      : null
    const jobRequirements = job?.job_requirements
      ? (typeof job.job_requirements === 'string' ? job.job_requirements : JSON.stringify(job.job_requirements)).slice(0, 1200)
      : null

    const { allowedTypes, customTypes, allPermittedTypes } = resolvePermittedQuestionTypes(job)
    const foundationalBackground = resolveFoundationalBackground(job)
    const askAboutProjects = job?.ask_about_projects !== false
    const targetDifficulty = policyGuidance?.targetDifficulty || job?.target_difficulty || 'MEDIUM'
    const recommendedTargetCriterion = policyGuidance?.targetCriterion
    const recommendedQuestionType = policyGuidance?.recommendedQuestionType || allowedTypes[0]

    const targetTaxonomy = recommendedTargetCriterion
      ? resolvePillarTaxonomy(recommendedTargetCriterion, foundationalBackground)
      : null

    const prompt = `You are the autonomous senior interviewer for ${candidate?.full_name || 'the candidate'} applying for ${job?.title || 'this role'}.

The job description, resume, rubric, and coverage map define WHAT to evaluate. You conduct an intelligent, adaptive, conversational interview with natural active listening and rigorous follow-ups.
${noResponse ? 'The candidate did not answer the current question after two conversational check-ins. Do not repeat the question or scold them; choose a natural next interview question grounded in the role, rubric and prior answers.' : ''}
${wrapUpMode ? 'This is the final interview conclusion. Say: "Thank you for sharing your technical insights. We have reserved our final minute for candidate feedback. Please provide me feedback on the interview experience and rate the AI interviewer from 1 to 5." Keep it warm and concise.' : ''}

REQUISITION CONFIGURATION:
- Foundational Background: ${foundationalBackground.toUpperCase()}
- Target Difficulty: ${targetDifficulty}
- Project Discussion Policy: ${askAboutProjects ? 'Enabled (Ask about relevant projects/experience where appropriate)' : 'DISABLED (Do NOT probe dedicated project architecture or software contribution; focus on role competencies, scenarios, and problem solving)'}
- STRICT PERMITTED QUESTION TYPES: ${allPermittedTypes.join(', ')}
${customTypes.length > 0 ? `- Custom Question Formats Configured by Recruiter: ${customTypes.join(', ')}` : ''}

${targetTaxonomy ? `TARGET RUBRIC PILLAR & INDEPENDENT TAXONOMY (MANDATORY):
Pillar Name: "${targetTaxonomy.criterionName || targetTaxonomy.name}" (Weight: ${recommendedTargetCriterion.weight})
Assessment Objective: ${targetTaxonomy.objective}
Target Subtopics: ${(targetTaxonomy.subtopics || []).map((s) => s.name).join(', ') || 'Core fundamentals'}
EXCLUDED TOPICS (STRICTLY PROHIBITED): [${(targetTaxonomy.excludedTopics || []).join(', ')}]
JOB CONTEXT ALLOWED: ${targetTaxonomy.allowsJobContext ? 'YES (Frame within realistic role scenario)' : 'NO (PURE FUNDAMENTALS: Do NOT frame around job operational duties or sprint velocity!)'}
Recommended Question Type for this Pillar: ${recommendedQuestionType}

CRITICAL PILLAR INDEPENDENCE INSTRUCTION:
- If the pillar is Quantitative Aptitude: Test arithmetic and quantitative reasoning fundamentals (percentages, ratios, averages, profit & loss, time & work, speed/distance, ages, family relationships). DO NOT ask Agile metrics, story points, sprint costs, or team velocity, even if the role is Team Manager!
- If the pillar is Logical Reasoning: Test deductions, sequences, syllogisms, and patterns. DO NOT turn it into team management.
- If the pillar is Verbal Ability: Test vocabulary, grammar, and comprehension.
- If the pillar is Data Interpretation: Provide actual tabular data or chart trends requiring interpretation.
- If the pillar is Behavioral: Use the job context to frame realistic interpersonal, decision-making, and collaboration scenarios.` : ''}

CRITICAL QUESTION TYPE ENFORCEMENT:
The recruiter has configured this requisition to ONLY permit questions of the following types:
[${allPermittedTypes.join(', ')}]
You are STRICTLY FORBIDDEN from generating any question type outside this permitted list. If only one type is permitted, you must use that type.

${QUESTION_FORMAT_SPECIFICATIONS}

ACTIVE LISTENING & GROUNDED FOLLOW-UP PROTOCOL (MANDATORY):
1. In your spoken lead-in (aiMessage), explicitly ACKNOWLEDGE the candidate's answer:
   - Name specific tools, concepts, or details the candidate just mentioned.
   - Connect their answer to the responsibilities of the "${job?.title || 'this'}" role.
   - Formulate ONE clear, focused question for them to address.
2. When the recommended action is 'FOLLOW_UP' or 'DEEPEN':
   - Drill down directly into the candidate's exact statements, trade-offs, or omissions.
3. Keep spoken response natural, warm, professional, and concise (under 3 sentences total). Never speak markdown tags.

ROLE CONTEXT:
${JSON.stringify({ title: job?.title, description: String(job?.description || '').slice(0, 1200), seniority: job?.seniority, department: job?.department, background: foundationalBackground, requirements: jobRequirements, resume: compactResume })}

RUBRIC CRITERIA:
${JSON.stringify(rubricCriteria.map(({ id, name, description, weight, expected_competency }) => ({ id, name, description, weight, expected_competency })))}

COVERAGE EVIDENCE:
${JSON.stringify(coverageMap)}

CURRENT QUESTION:
${JSON.stringify(currentQuestion)}

LATEST COMMITTED ANSWER:
${JSON.stringify(answer)}

ANSWER EVIDENCE:
${JSON.stringify(answerAnalysis)}

PRIOR TURN EVIDENCE:
${JSON.stringify(compactTurnHistory)}

TIME: ${JSON.stringify({ interviewDurationMinutes, remainingSeconds: timeRemainingSeconds, remainingMinutes: Math.ceil(timeRemainingSeconds / 60) })}
NEXT QUESTION SEQUENCE: ${sequence}

Return one structured decision adhering to the schema.`

    const schema = {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ACTIONS },
        relationship: { type: 'string', enum: ['INITIAL', 'FOLLOW_UP', 'DEEPEN', 'SWITCH_TOPIC'] },
        question: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            type: { type: 'string', enum: allPermittedTypes },
            skill: { type: 'string' },
            topic: { type: 'string' },
            difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
            rubricCriterionId: { type: 'string' },
            reason: { type: 'string' },
            basedOnQuestionId: { type: ['string', 'null'] },
            options: { type: 'array', items: { type: 'string' } },
            codeSnippet: { type: 'string' },
            language: { type: 'string' },
            items: { type: 'array', items: { type: 'string' } },
            expectedAnswer: { type: 'array', items: { type: 'string' } },
            leftItems: { type: 'array', items: { type: 'string' } },
            rightItems: { type: 'array', items: { type: 'string' } },
            sliderConfig: {
              type: 'object',
              properties: {
                min: { type: 'number' },
                max: { type: 'number' },
                step: { type: 'number' },
                minLabel: { type: 'string' },
                maxLabel: { type: 'string' },
              },
            },
            numericalConfig: {
              type: 'object',
              properties: {
                unit: { type: 'string' },
                tolerance: { type: 'number' },
              },
            },
            expectedConcepts: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'type', 'skill', 'topic', 'difficulty', 'reason', 'basedOnQuestionId'],
        },
        aiMessage: { type: 'string' },
        completionReason: { type: 'string' },
      },
      required: ['action'],
    }

    let attempts = 0
    let decision = null
    let lastError = null

    while (attempts < 2) {
      attempts++
      try {
        const result = await ai.generateStructured({
          prompt,
          schema,
          model: 'gemini-3.5-flash-lite',
          systemInstruction: 'You are the sole interviewer. Make one contextual decision based on the complete committed conversation. Return only the requested structured JSON. Never generate multiple questions or follow a fixed question list.',
        })
        const candidateDecision = result?.data
        if (!candidateDecision || !ACTIONS.includes(candidateDecision.action)) {
          throw new Error('Gemini returned an invalid interview action.')
        }
        if (candidateDecision.action === 'END_INTERVIEW') {
          decision = candidateDecision
          break
        }
        if (!candidateDecision.question?.text?.trim()) {
          throw new Error('Gemini decision did not include an active question text.')
        }

        // 1. Strict Recruiter Question-Type Enforcement
        let qType = normalizeQuestionType(candidateDecision.question.type)
        if (!allPermittedTypes.includes(qType)) {
          qType = allPermittedTypes[0]
        }
        candidateDecision.question.type = qType

        // 2. Strict Recruiter Difficulty Enforcement
        candidateDecision.question.difficulty = targetDifficulty

        // 3. Reliable Rubric Criterion Binding
        const validCriterionIds = new Set(rubricCriteria.map((criterion) => criterion.id).filter(Boolean))
        if (!candidateDecision.question.rubricCriterionId || !validCriterionIds.has(candidateDecision.question.rubricCriterionId)) {
          candidateDecision.question.rubricCriterionId = recommendedTargetCriterion?.id || rubricCriteria[0]?.id || null
        }

        // 4. Deep Deduplication and Repeated Calculation Guard
        const dupCheck = checkDuplicateQuestion(candidateDecision.question, askedQuestions)
        if (dupCheck.isDuplicate) {
          throw new Error(`Duplicate question rejected before activation: ${dupCheck.reason}`)
        }

        // 5. Stale question association protection
        if (
          currentQuestion?.id &&
          candidateDecision.question.basedOnQuestionId &&
          candidateDecision.question.basedOnQuestionId !== currentQuestion.id &&
          candidateDecision.action !== 'SWITCH_TOPIC' &&
          candidateDecision.relationship !== 'SWITCH_TOPIC'
        ) {
          throw new Error(`Stale question rejected before activation: basedOnQuestionId "${candidateDecision.question.basedOnQuestionId}" does not match active question "${currentQuestion.id}".`)
        }
        if (currentQuestion?.id && !candidateDecision.question.basedOnQuestionId && candidateDecision.action !== 'SWITCH_TOPIC') {
          candidateDecision.question.basedOnQuestionId = currentQuestion.id
        }

        // Anti-monotony guard: If consecutive DESCRIPTIVE questions occur and SCENARIO/SELECT_MOST_APPROPRIATE is permitted
        const lastAsked = askedQuestions?.[askedQuestions.length - 1]
        const canUseScenario = allPermittedTypes.includes('SCENARIO') || allPermittedTypes.includes('SELECT_MOST_APPROPRIATE')
        if (
          lastAsked &&
          (lastAsked.type === 'DESCRIPTIVE' || lastAsked.question_type === 'DESCRIPTIVE') &&
          candidateDecision.question.type === 'DESCRIPTIVE' &&
          canUseScenario
        ) {
          candidateDecision.question.type = 'SCENARIO'
        }

        // 6. Structure Normalization and Schema Validation
        candidateDecision.question = normalizeQuestionPayload(candidateDecision.question, allowedTypes[0])
        const schemaValidation = validateQuestionSchema(candidateDecision.question)
        if (!schemaValidation.valid) {
          throw new Error(`Question schema validation failed for ${candidateDecision.question.type}: ${schemaValidation.error}`)
        }

        decision = candidateDecision
        break
      } catch (err) {
        lastError = err
        if (/duplicate/i.test(err.message) || /stale question/i.test(err.message)) {
          throw err
        }
        console.warn(`[QuestionGenerator] Generation attempt ${attempts} warning: ${err.message}`)
      }
    }

    if (!decision) {
      console.warn(`[QuestionGenerator] Bounded retries exhausted (${lastError?.message}). Recovering safely with strictly permitted question format.`)
      const fallbackType = allPermittedTypes[0] || 'SHORT_ANSWER'
      const fallbackCriterion = policyGuidance?.targetCriterion || rubricCriteria[0] || { name: 'Core Competencies' }
      const fallbackText = `Could you explain your core architectural and technical approach regarding ${fallbackCriterion.name} for the ${job?.title || 'position'}?`
      decision = {
        action: 'ASK_QUESTION',
        relationship: 'INITIAL',
        question: normalizeQuestionPayload({
          text: fallbackText,
          type: fallbackType,
          skill: fallbackCriterion.name || 'Core Competency',
          topic: fallbackCriterion.name || 'Assessment',
          difficulty: targetDifficulty || 'MEDIUM',
          reason: 'Safely bounded question recovery within recruiter permitted types',
          basedOnQuestionId: currentQuestion?.id || null,
        }, fallbackType),
        aiMessage: `Let's discuss ${fallbackCriterion.name}. ${fallbackText}`,
      }
    }

    return decision
  },

  /**
   * Unified Single-Call Turn Processor:
   * Evaluates the candidate answer AND generates the adaptive next question in ONE Gemini call.
   */
  async evaluateTurnAndDecideNextAction({
    job,
    candidate,
    rubricCriteria = [],
    currentCriterion = null,
    coverageMap = [],
    currentQuestion = null,
    candidateAnswer = '',
    policyGuidance = null,
    turnHistory = [],
    askedQuestions = [],
    sequence = 0,
    timeRemainingSeconds = 0,
    interviewDurationMinutes = null,
    wrapUpMode = false,
  }) {
    const { allowedTypes, customTypes, allPermittedTypes } = resolvePermittedQuestionTypes(job)
    const foundationalBackground = resolveFoundationalBackground(job)
    const askAboutProjects = job?.ask_about_projects !== false
    const targetDifficulty = policyGuidance?.targetDifficulty || job?.target_difficulty || 'MEDIUM'
    const guidance = currentCriterion?.evaluation_guidance || {}
    const expectedConcepts = currentQuestion?.metadata?.expected_concepts || []
    const recommendedTargetCriterion = policyGuidance?.targetCriterion
    const recommendedQuestionType = policyGuidance?.recommendedQuestionType || allowedTypes[0]

    const targetTaxonomy = recommendedTargetCriterion
      ? resolvePillarTaxonomy(recommendedTargetCriterion, foundationalBackground)
      : null

    const compactTurnHistory = turnHistory.slice(-3).map((turn) => ({
      question_text: String(turn.question_text || '').slice(0, 400),
      answer_text: String(turn.answer_text || '').slice(0, 600),
      criterion_name: turn.criterion_name,
    }))

    const prompt = `You are QualifyAI's authoritative evaluation and interview decision engine.
Perform BOTH:
1. Rigorous, evidence-based rubric evaluation of the candidate's latest answer.
2. The contextual next interview question decision based on that evaluation.

CANDIDATE: ${candidate?.full_name || 'Candidate'}
POSITION: ${job?.title || 'Position'} (${job?.seniority || 'MID-SENIOR'})
BACKGROUND: ${foundationalBackground.toUpperCase()}
TARGET DIFFICULTY: ${targetDifficulty}
PROJECT DISCUSSION: ${askAboutProjects ? 'Enabled' : 'Disabled (Do not ask dedicated project questions; focus on competencies and practical scenarios)'}
STRICT PERMITTED QUESTION TYPES: [${allPermittedTypes.join(', ')}]

ACTIVE QUESTION:
"""
${currentQuestion?.question_text}
"""
CRITERION EVALUATED: ${currentCriterion?.name || 'Core Competency'}
EXPECTED KEY CONCEPTS: ${expectedConcepts.join(', ') || 'Fundamental principles and trade-offs'}
BENCHMARKS:
- Level 1 (Novice): ${guidance.level1 || 'Superficial answers, confusion'}
- Level 3 (Competent): ${guidance.level3 || 'Solid functional understanding and typical trade-offs'}
- Level 5 (Expert): ${guidance.level5 || 'Deep systems mastery, edge cases, trade-offs'}

CANDIDATE'S COMMITTED ANSWER:
"""
${candidateAnswer || '(Candidate provided empty/silent response)'}
"""

${targetTaxonomy ? `TARGET RUBRIC PILLAR & INDEPENDENT TAXONOMY (MANDATORY):
Pillar Name: "${targetTaxonomy.criterionName || targetTaxonomy.name}" (Weight: ${recommendedTargetCriterion.weight})
Assessment Objective: ${targetTaxonomy.objective}
Target Subtopics: ${(targetTaxonomy.subtopics || []).map((s) => s.name).join(', ') || 'Core fundamentals'}
EXCLUDED TOPICS (STRICTLY PROHIBITED): [${(targetTaxonomy.excludedTopics || []).join(', ')}]
JOB CONTEXT ALLOWED: ${targetTaxonomy.allowsJobContext ? 'YES (Frame within realistic role scenario)' : 'NO (PURE FUNDAMENTALS: Do NOT frame around job operational duties or sprint velocity!)'}
Recommended Question Type for this Pillar: ${recommendedQuestionType}

CRITICAL PILLAR INDEPENDENCE INSTRUCTION:
- If the pillar is Quantitative Aptitude: Test arithmetic and quantitative reasoning fundamentals (percentages, ratios, averages, profit & loss, time & work, speed/distance, ages, family relationships). DO NOT ask Agile metrics, story points, sprint costs, or team velocity, even if the role is Team Manager!
- If the pillar is Logical Reasoning: Test deductions, sequences, syllogisms, and patterns. DO NOT turn it into team management.
- If the pillar is Verbal Ability: Test vocabulary, grammar, and comprehension.
- If the pillar is Data Interpretation: Provide actual tabular data or chart trends requiring interpretation.
- If the pillar is Behavioral: Use the job context to frame realistic interpersonal, decision-making, and collaboration scenarios.` : ''}

PRIOR TURNS CONTEXT:
${JSON.stringify(compactTurnHistory)}

TIME REMAINING: ${timeRemainingSeconds}s (Duration: ${interviewDurationMinutes}m)
${wrapUpMode ? 'FINAL WRAP-UP: The interview assessment is ending. Provide concise feedback invitation rating 1-5.' : ''}

${QUESTION_FORMAT_SPECIFICATIONS}

INSTRUCTIONS:
1. Evaluate the answer strictly against the criterion. Assign correctness (1-10), relevance (1-10), depth (1-10), concepts_detected, missing_concepts, skill_estimate ('NOVICE' | 'COMPETENT' | 'EXPERT'), and concise feedback_summary.
2. Synthesize the NEXT single interview question.
   - You MUST pick a question type strictly from: [${allPermittedTypes.join(', ')}].
   - Spoken aiMessage: warm, conversational interviewer response acknowledging their specific answer before delivering the question (under 3 sentences).

Return strictly valid JSON adhering to the schema.`

    const schema = {
      type: 'object',
      properties: {
        analysis: {
          type: 'object',
          properties: {
            correctness: { type: 'integer' },
            relevance: { type: 'integer' },
            depth: { type: 'integer' },
            concepts_detected: { type: 'array', items: { type: 'string' } },
            missing_concepts: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'number' },
            skill_estimate: { type: 'string', enum: ['NOVICE', 'COMPETENT', 'EXPERT'] },
            feedback_summary: { type: 'string' },
            strengths: { type: 'array', items: { type: 'string' } },
            weaknesses: { type: 'array', items: { type: 'string' } },
          },
          required: ['correctness', 'relevance', 'depth', 'concepts_detected', 'missing_concepts', 'skill_estimate', 'feedback_summary'],
        },
        decision: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ACTIONS },
            relationship: { type: 'string', enum: ['INITIAL', 'FOLLOW_UP', 'DEEPEN', 'SWITCH_TOPIC'] },
            question: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                type: { type: 'string', enum: allPermittedTypes },
                skill: { type: 'string' },
                topic: { type: 'string' },
                difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
                rubricCriterionId: { type: 'string' },
                reason: { type: 'string' },
                basedOnQuestionId: { type: ['string', 'null'] },
                options: { type: 'array', items: { type: 'string' } },
                codeSnippet: { type: 'string' },
                language: { type: 'string' },
                items: { type: 'array', items: { type: 'string' } },
                expectedAnswer: { type: 'array', items: { type: 'string' } },
                leftItems: { type: 'array', items: { type: 'string' } },
                rightItems: { type: 'array', items: { type: 'string' } },
                sliderConfig: {
                  type: 'object',
                  properties: {
                    min: { type: 'number' },
                    max: { type: 'number' },
                    step: { type: 'number' },
                    minLabel: { type: 'string' },
                    maxLabel: { type: 'string' },
                  },
                },
                numericalConfig: {
                  type: 'object',
                  properties: {
                    unit: { type: 'string' },
                    tolerance: { type: 'number' },
                  },
                },
                expectedConcepts: { type: 'array', items: { type: 'string' } },
              },
              required: ['text', 'type', 'skill', 'topic', 'difficulty', 'reason'],
            },
            aiMessage: { type: 'string' },
            completionReason: { type: 'string' },
          },
          required: ['action', 'question', 'aiMessage'],
        },
      },
      required: ['analysis', 'decision'],
    }

    const result = await ai.generateStructured({
      prompt,
      schema,
      model: 'gemini-3.5-flash-lite',
      systemInstruction: 'You are QualifyAI. Perform unified answer evaluation and next question synthesis. Return strictly valid JSON.',
    })

    const data = result?.data
    if (!data?.analysis || !data?.decision?.question?.text?.trim()) {
      throw new Error('Unified turn evaluation returned incomplete decision.')
    }

    // Normalize analysis
    const parsedAnalysis = {
      correctness: Math.min(Math.max(Number(data.analysis.correctness) || 5, 1), 10),
      relevance: Math.min(Math.max(Number(data.analysis.relevance) || 5, 1), 10),
      depth: Math.min(Math.max(Number(data.analysis.depth) || 5, 1), 10),
      concepts_detected: Array.isArray(data.analysis.concepts_detected) ? data.analysis.concepts_detected : [],
      missing_concepts: Array.isArray(data.analysis.missing_concepts) ? data.analysis.missing_concepts : [],
      confidence: Math.min(Math.max(Number(data.analysis.confidence) || 0.9, 0.1), 1.0),
      skill_estimate: data.analysis.skill_estimate || 'COMPETENT',
      feedback_summary: data.analysis.feedback_summary || 'Answer evaluated.',
      strengths: Array.isArray(data.analysis.strengths) ? data.analysis.strengths : [],
      weaknesses: Array.isArray(data.analysis.weaknesses) ? data.analysis.weaknesses : [],
      claims_requiring_verification: [],
      topics_mentioned: [],
      skills_demonstrated: [],
      skills_not_demonstrated: [],
    }

    // Normalize decision
    const decision = data.decision
    if (decision.question) {
      let qType = normalizeQuestionType(decision.question.type)
      if (!allPermittedTypes.includes(qType)) {
        qType = allowedTypes[0]
      }
      decision.question.type = qType
      decision.question.difficulty = targetDifficulty
      decision.question.rubricCriterionId = decision.question.rubricCriterionId || recommendedTargetCriterion?.id || currentCriterion?.id || rubricCriteria[0]?.id || null

      if (!decision.question.basedOnQuestionId && currentQuestion?.id) {
        decision.question.basedOnQuestionId = currentQuestion.id
      }
      decision.question.skill = targetTaxonomy?.criterionName || targetTaxonomy?.name || decision.question.skill || 'Core Competency'
      decision.question.topic = targetTaxonomy?.subtopics?.[0]?.name || decision.question.topic || 'Assessment'

      // Structure normalization & validation for all 15 question types
      decision.question = normalizeQuestionPayload(decision.question, allowedTypes[0])
      const schemaCheck = validateQuestionSchema(decision.question)
      if (!schemaCheck.valid) {
        console.warn(`[evaluateTurnAndDecideNextAction] Schema check warning for ${decision.question.type}: ${schemaCheck.error}`)
      }

      // Deduplication check
      const dupCheck = checkDuplicateQuestion(decision.question, askedQuestions)
      if (dupCheck.isDuplicate) {
        console.warn(`[evaluateTurnAndDecideNextAction] Duplicate question detected in turn decision: ${dupCheck.reason}`)
      }
    }

    return {
      analysis: parsedAnalysis,
      decision,
    }
  },
})

export const realtimeQuestionGenerator = createRealtimeQuestionGenerator()

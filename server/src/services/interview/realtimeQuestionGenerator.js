import { aiOrchestrator } from '../../integrations/ai/index.js'

const ACTIONS = ['ASK_QUESTION', 'FOLLOW_UP', 'DEEPEN', 'SWITCH_TOPIC']
const RELATIONSHIPS = ['INITIAL', 'FOLLOW_UP', 'DEEPEN', 'SWITCH_TOPIC']
const QUESTION_TYPES = [
  'DESCRIPTIVE', 'SHORT_ANSWER', 'MULTIPLE_CHOICE', 'MULTI_SELECT', 'TRUE_FALSE',
  'SCENARIO', 'BEHAVIORAL', 'CODE_OUTPUT', 'CODE_WRITING', 'SQL', 'FILL_IN_THE_BLANK',
]

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
    const recentQuestions = askedQuestions.slice(-12).map((item) => ({
      id: item.id,
      text: item.text || item.question_text,
      type: item.type,
      skill: item.skill,
      topic: item.topic,
    }))

    const prompt = `You are the autonomous senior technical interviewer for ${candidate?.full_name || 'the candidate'} applying for ${job?.title || 'this role'}.

The job description, resume, rubric, and coverage map define WHAT to evaluate. You conduct an intelligent, adaptive, conversational technical interview with natural active listening and rigorous follow-ups.
${noResponse ? 'The candidate did not answer the current question after two conversational check-ins. Do not repeat the question or scold them; choose a natural next interview question grounded in the role, rubric and prior answers.' : ''}
${wrapUpMode ? 'This is the final two-minute wrap-up. Say: "If you can provide me feedback, I will be better to work with you." Ask what could make the AI interviewer more helpful and invite the candidate to rate the AI interviewer from 1 to 5. Keep it concise and conversational.' : ''}

ADAPTIVE POLICY DIRECTIVE:
- Recommended Action: ${policyGuidance?.recommendedAction || 'FOLLOW_UP'}
- Target Rubric Pillar: ${policyGuidance?.targetCriterion?.name || 'Core Technical Pillar'}
- Target Difficulty: ${policyGuidance?.targetDifficulty || 'MEDIUM'}
- Policy Rationale: ${policyGuidance?.reason || 'Evaluate depth'}
- Policy Active Listening Guidance: ${policyGuidance?.activeListeningGuidance || 'Acknowledge candidate response and probe details.'}
- Target Question Type: ${policyGuidance?.recommendedQuestionType || 'MULTIPLE_CHOICE'}

QUESTION TYPE DIVERSITY DIRECTIVE (CRITICAL - AVOID MONOTONY & USER BURDEN):
Candidates must NEVER feel the fatigue of answering only long descriptive essay questions. You MUST vary the question type across turns dynamically so the candidate feels engaged and refreshed:
1. FORBIDDEN: NEVER generate two consecutive 'DESCRIPTIVE' questions. If recent questions ended in DESCRIPTIVE or BEHAVIORAL, you MUST choose an interactive type such as MULTIPLE_CHOICE, SCENARIO, CODE_OUTPUT, SHORT_ANSWER, TRUE_FALSE, CODE_WRITING, or SQL.
2. If type is 'MULTIPLE_CHOICE' or 'MULTI_SELECT':
   - Provide an 'options' array containing 4 clear, distinct choices (e.g. ["A...", "B...", "C...", "D..."]).
   - In spoken aiMessage, state the question context and prompt the candidate: "Take a look at the options on your screen and let me know your choice."
3. If type is 'CODE_OUTPUT':
   - Provide a realistic, concise 'codeSnippet' in the role's primary programming language (e.g. JavaScript, Python, Java) and specify 'language'.
   - Ask what the snippet outputs or what bug/edge-case behavior it triggers.
4. If type is 'CODE_WRITING':
   - Provide a starter 'codeSnippet' function template and specify 'language'.
   - Ask the candidate to implement the logic.
5. If type is 'SQL':
   - Provide table schema context and ask for the appropriate query.
6. If type is 'TRUE_FALSE':
   - Formulate a clear, specific technical proposition testing edge cases or architectural trade-offs.
7. If type is 'SHORT_ANSWER':
   - Ask a concise question requiring only a 1-2 sentence direct response.
8. If type is 'SCENARIO':
   - Present a concrete production problem or incident (e.g. database deadlocks, cache stampede, microservice latency spike) and ask how they would diagnose or resolve it.

ACTIVE LISTENING & GROUNDED FOLLOW-UP PROTOCOL (MANDATORY):
1. In your spoken lead-in (aiMessage), explicitly ACKNOWLEDGE the candidate's answer:
   - Name the specific tools, libraries, architectural components, or project details the candidate just mentioned (e.g. if they mentioned Redis, PostgreSQL, WebSockets, collaboration platforms, say so directly).
   - In 1 sentence, connect their answer to the actual responsibilities of the "${job?.title || 'this'}" role.
   - Formulate ONE clear, focused technical question or deep-dive scenario for them to address.
2. When the recommended action is 'FOLLOW_UP' or 'DEEPEN':
   - Do NOT abruptly switch to a completely disconnected topic!
   - Drill down directly into the candidate's exact technical statements, architectural trade-offs, failure modes, scalability limits, or edge cases.
3. Keep the spoken response natural, warm, professional, and concise (under 3 sentences total). Never speak monologues or markdown tags.

ROLE CONTEXT:
${JSON.stringify({ title: job?.title, description: job?.description, seniority: job?.seniority, department: job?.department, requirements: job?.job_requirements, resume: candidate?.resume_text || candidate?.resume || null })}

RUBRIC CRITERIA (evaluation goals, not questions):
${JSON.stringify(rubricCriteria.map(({ id, name, description, weight, expected_competency }) => ({ id, name, description, weight, expected_competency })))}

COVERAGE EVIDENCE:
${JSON.stringify(coverageMap)}

CURRENT QUESTION:
${JSON.stringify(currentQuestion)}

LATEST COMMITTED ANSWER:
${JSON.stringify(answer)}

ANSWER EVIDENCE (analysis only; do not reuse any suggested question):
${JSON.stringify(answerAnalysis)}

PRIOR TURN EVIDENCE:
${JSON.stringify(turnHistory.slice(-8))}

RECENT QUESTIONS (avoid repeats; these are history, not a queue):
${JSON.stringify(recentQuestions)}

TIME: ${JSON.stringify({ interviewDurationMinutes, remainingSeconds: timeRemainingSeconds, remainingMinutes: Math.ceil(timeRemainingSeconds / 60) })}
NEXT QUESTION SEQUENCE: ${sequence}

Return one structured decision. For a question, choose a type appropriate to the evidence and return the active question text. The conversational aiMessage must be the complete spoken interviewer delivery that includes both the brief transition/acknowledgement AND reads the full question aloud to the candidate. The reason is internal audit metadata. For basedOnQuestionId: set to "${currentQuestion?.id || 'null'}" when following up on the current question, or null if switching topic or no current question. Pick a rubricCriterionId only when the question assesses that criterion. Never invent a question bank or follow a predetermined progression.`

    const schema = {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ACTIONS },
        relationship: { type: 'string', enum: ['INITIAL', 'FOLLOW_UP', 'DEEPEN', 'SWITCH_TOPIC'] },
        question: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            type: { type: 'string', enum: QUESTION_TYPES },
            skill: { type: 'string' },
            topic: { type: 'string' },
            difficulty: { type: 'string', enum: ['EASY', 'MEDIUM', 'HARD'] },
            rubricCriterionId: { type: 'string' },
            reason: { type: 'string' },
            basedOnQuestionId: { type: ['string', 'null'] },
            options: { type: 'array', items: { type: 'string' } },
            codeSnippet: { type: 'string' },
            language: { type: 'string' },
            expectedConcepts: { type: 'array', items: { type: 'string' } },
          },
          required: ['text', 'type', 'skill', 'topic', 'difficulty', 'reason', 'basedOnQuestionId'],
        },
        aiMessage: { type: 'string' },
        completionReason: { type: 'string' },
      },
      required: ['action'],
    }

    const result = await ai.generateStructured({
      prompt,
      schema,
      systemInstruction: 'You are the sole interviewer. Make one contextual decision based on the complete committed conversation. Return only the requested structured JSON. Never generate multiple questions or follow a fixed question list.',
    })
    const decision = result?.data
    if (!decision || !ACTIONS.includes(decision.action)) {
      throw new Error('Gemini returned an invalid interview decision.')
    }
    if (decision.action !== 'END_INTERVIEW' && !decision.question?.text?.trim()) {
      throw new Error('Gemini decision did not include an active question.')
    }
    if (decision.question && !RELATIONSHIPS.includes(decision.relationship)) {
      throw new Error('Gemini returned an invalid question relationship.')
    }
    if (decision.question && !QUESTION_TYPES.includes(String(decision.question.type || '').toUpperCase())) {
      throw new Error('Gemini selected an unsupported question type.')
    }
    if (decision.question) {
      if (!decision.question.skill?.trim() || !decision.question.topic?.trim()) {
        throw new Error('Gemini question must identify its skill and topic.')
      }
      const questionText = decision.question.text.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ')
      const duplicate = recentQuestions.some((item) => {
        const priorText = String(item.text || '').trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ')
        return priorText && priorText === questionText
      })
      if (duplicate) throw new Error('Gemini returned a duplicate of a recent interview question.')
      if (
        currentQuestion?.id &&
        decision.question.basedOnQuestionId &&
        decision.question.basedOnQuestionId !== currentQuestion.id &&
        decision.action !== 'SWITCH_TOPIC' &&
        decision.relationship !== 'SWITCH_TOPIC'
      ) {
        throw new Error('Gemini decision references a stale question.')
      }
      if (currentQuestion?.id && !decision.question.basedOnQuestionId && decision.action !== 'SWITCH_TOPIC') {
        decision.question.basedOnQuestionId = currentQuestion.id
      }
      const validCriterionIds = new Set(rubricCriteria.map((criterion) => criterion.id).filter(Boolean))
      if (decision.question.rubricCriterionId && !validCriterionIds.has(decision.question.rubricCriterionId)) {
        throw new Error('Gemini selected an unknown rubric criterion.')
      }

      // Structure normalization & fallbacks for non-descriptive types
      const qType = String(decision.question.type || '').toUpperCase()
      if (qType === 'MULTIPLE_CHOICE' || qType === 'MULTI_SELECT') {
        if (!Array.isArray(decision.question.options) || decision.question.options.length < 2) {
          decision.question.options = [
            'Optimal architectural approach with minimal latency',
            'Suboptimal implementation causing potential resource contention',
            'Synchronous blocking alternative with high reliability',
            'None of the above',
          ]
        }
      } else if (qType === 'CODE_OUTPUT' && !decision.question.codeSnippet) {
        decision.question.codeSnippet = '// Analyze the execution of this snippet\nconsole.log([1, 2, 3].map(n => n * 2));'
        decision.question.language = decision.question.language || 'javascript'
      } else if (qType === 'CODE_WRITING' && !decision.question.codeSnippet) {
        decision.question.codeSnippet = '// Implement your solution\nfunction solution(input) {\n  return null;\n}'
        decision.question.language = decision.question.language || 'javascript'
      }

      // Anti-monotony guard: If last question was DESCRIPTIVE and Gemini returned DESCRIPTIVE again, convert to SCENARIO
      const lastQ = recentQuestions[recentQuestions.length - 1]
      const lastType = String(lastQ?.type || '').toUpperCase()
      if (qType === 'DESCRIPTIVE' && (lastType === 'DESCRIPTIVE' || lastType === 'BEHAVIORAL')) {
        decision.question.type = 'SCENARIO'
      }
    }
    return decision
  },
})

export const realtimeQuestionGenerator = createRealtimeQuestionGenerator()

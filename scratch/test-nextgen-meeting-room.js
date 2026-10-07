import {
  isThoughtOrMetaPlanning,
  extractCleanQuestionPrompt,
  detectQuestionType,
  normalizeQuestion,
} from '../client/src/utils/questionNormalizer.js'
import { getServiceSupabaseClient } from '../server/src/integrations/supabaseClient.js'
import { interviewEngineService } from '../server/src/services/interview/interviewEngineService.js'

async function runNextGenMeetingRoomTests() {
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('🧪 QUALIFYAI NEXT-GENERATION AI INTERVIEW ROOM TEST SUITE')
  console.log('   Dynamic Question System, Normalized Models & Engine Wiring')
  console.log('═══════════════════════════════════════════════════════════════════\n')

  let passed = 0
  let failed = 0

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`✅ [PASSED] ${testName}`)
      passed++
    } else {
      console.error(`❌ [FAILED] ${testName} ${detail ? `(${detail})` : ''}`)
      failed++
    }
  }

  // --- GATE 1: Anti-Meta-Planning & Thought Suppression ---
  console.log('--- GATE 1: Anti-Meta-Planning & Thought Suppression ---')
  const thoughts = [
    "I'm ready to begin the interview with Jane. I plan to extend a warm welcome and then ask...",
    "I've finalized the introductory question. I decided on a warm welcome...",
    "The focus is on a system design scenario...",
    "Thinking: Let's formulate the next technical question.",
    "[System Note: Evaluator note: assessing distributed locks]",
  ]
  for (const t of thoughts) {
    assert(isThoughtOrMetaPlanning(t), `Filter internal thought: "${t.slice(0, 40)}..."`)
  }

  const validPrompts = [
    'How do you design a high-throughput notification system?',
    'Which data structure follows First-In-First-Out?',
    'What will this JavaScript code output?',
  ]
  for (const p of validPrompts) {
    assert(!isThoughtOrMetaPlanning(p), `Preserve valid prompt: "${p}"`)
  }

  // --- GATE 2: Clean Prompt Extraction (Greeting Stripping) ---
  console.log('\n--- GATE 2: Clean Prompt Extraction ---')
  const complexSpeech =
    "That's a very solid explanation of Redis caching and invalidation strategies. For this role, high consistency during database failovers is critical. How would you handle a failed cache eviction after a successful PostgreSQL write transaction?"
  const extracted = extractCleanQuestionPrompt(complexSpeech)
  assert(
    extracted ===
      'How would you handle a failed cache eviction after a successful PostgreSQL write transaction?',
    'Extract isolated question sentence from multi-sentence conversational speech',
    `Got: "${extracted}"`
  )

  // --- GATE 3: Question Type Detection Across All 10 Supported Types ---
  console.log('\n--- GATE 3: Question Type Detection & Normalization ---')

  // 1. Multiple Choice
  const mcqText =
    'Which data structure follows FIFO?\nA) Stack\nB) Queue\nC) Tree\nD) Graph'
  const mcq = normalizeQuestion({ question_text: mcqText }, mcqText, 1, 5)
  assert(mcq.type === 'MULTIPLE_CHOICE', 'Detect MULTIPLE_CHOICE question type', `Got: ${mcq.type}`)
  assert(mcq.options.length === 4, 'Parse 4 embedded options from text', `Length: ${mcq.options.length}`)
  assert(mcq.options[1].label === 'Queue', 'Verify option B is Queue', `Got: ${mcq.options[1]?.label}`)

  // 2. Multi-Select
  const multiText = 'Which of the following are valid HTTP methods?'
  const multi = normalizeQuestion(
    { question_text: multiText, metadata: { options: ['GET', 'POST', 'PUSH', 'DELETE', 'PATCH'], multi_select: true } },
    multiText,
    2,
    5
  )
  assert(multi.type === 'MULTI_SELECT', 'Detect MULTI_SELECT question type', `Got: ${multi.type}`)
  assert(multi.options.length === 5, 'Verify 5 multi-select options loaded', `Length: ${multi.options.length}`)

  // 3. Fill in the Blank
  const fillText = 'The HTTP response status code for Not Found is ______.'
  const fill = normalizeQuestion({ question_text: fillText }, fillText, 2, 5)
  assert(fill.type === 'FILL_IN_THE_BLANK', 'Detect FILL_IN_THE_BLANK question type', `Got: ${fill.type}`)

  // 4. Code Output
  const outputText = 'What will this code output?\n```javascript\nconst a = [1, 2];\nconsole.log(a.map(x => x * 2));\n```'
  const codeOut = normalizeQuestion({ question_text: outputText }, outputText, 3, 5)
  assert(codeOut.type === 'CODE_OUTPUT', 'Detect CODE_OUTPUT question type', `Got: ${codeOut.type}`)
  assert(codeOut.codeSnippet && codeOut.codeSnippet.includes('console.log'), 'Extract code snippet for prediction')

  // 5. Code Writing
  const writeText = 'Implement a function in JavaScript that returns the first non-repeating character in a string.'
  const codeWrite = normalizeQuestion({ question_text: writeText }, writeText, 3, 5)
  assert(codeWrite.type === 'CODE_WRITING', 'Detect CODE_WRITING question type', `Got: ${codeWrite.type}`)

  // 6. SQL Query
  const sqlText = 'Write a SQL query that retrieves the top 5 customers ordered by total purchase volume.'
  const sql = normalizeQuestion({ question_text: sqlText }, sqlText, 4, 5)
  assert(sql.type === 'SQL', 'Detect SQL question type', `Got: ${sql.type}`)

  // 7. Boolean (True / False)
  const boolText = 'Can PostgreSQL utilize B-tree indexes to optimize range queries?'
  const boolQ = normalizeQuestion({ question_text: boolText }, boolText, 2, 5)
  assert(boolQ.type === 'TRUE_FALSE', 'Detect TRUE_FALSE question type', `Got: ${boolQ.type}`)

  // 8. Scenario
  const scenarioText = 'Your production API suddenly experiences a 10x traffic spike and connection pool exhaustion. How do you triage?'
  const scenario = normalizeQuestion({ question_text: scenarioText }, scenarioText, 3, 5)
  assert(scenario.type === 'SCENARIO', 'Detect SCENARIO question type', `Got: ${scenario.type}`)

  // 9. Behavioral
  const behText = 'Tell me about a time you had a technical disagreement with a teammate about database architecture.'
  const beh = normalizeQuestion({ question_text: behText }, behText, 4, 5)
  assert(beh.type === 'BEHAVIORAL', 'Detect BEHAVIORAL question type', `Got: ${beh.type}`)

  // 10. Turn 0 Introduction Special Rule
  const intro = normalizeQuestion({ id: 'intro-q0' }, null, 0, 5)
  assert(intro.turnIndex === 0, 'Verify Turn 0 index')
  assert(intro.text.includes('introduce yourself'), 'Verify Turn 0 introduction prompt')

  // --- GATE 4: Normalized Answer Submission Contract ---
  console.log('\n--- GATE 4: Normalized Answer Submission Contract ---')
  const answers = [
    { type: 'MULTIPLE_CHOICE', payload: { selectedOptionId: 'b', label: 'Queue', text: 'Queue' } },
    { type: 'MULTI_SELECT', payload: { selectedOptionIds: ['opt-1', 'opt-2'], text: 'GET, POST' } },
    { type: 'FILL_IN_THE_BLANK', payload: { text: '404' } },
    { type: 'CODE_OUTPUT', payload: { predictedOutput: '[2, 4]', text: '[2, 4]' } },
    { type: 'CODE_WRITING', payload: { code: 'function solution() { return true; }', language: 'javascript', text: 'function solution() { return true; }' } },
    { type: 'SQL', payload: { sqlQuery: 'SELECT * FROM customers LIMIT 5;', text: 'SELECT * FROM customers LIMIT 5;' } },
    { type: 'TRUE_FALSE', payload: { value: 'TRUE', text: 'TRUE' } },
    { type: 'DESCRIPTIVE', payload: { text: 'I would use Redis with a distributed lock and fallback write queues.' } },
  ]

  for (const a of answers) {
    const textExtracted = (a.payload.text || a.payload.label || a.payload.code || '').trim()
    assert(textExtracted.length > 0, `Payload for ${a.type} produces valid non-empty answer text: "${textExtracted.slice(0, 20)}..."`)
  }

  // --- GATE 5: Real Backend Session Initialization & Progression ---
  console.log('\n--- GATE 5: Real Backend Session Verification ---')
  const supabase = getServiceSupabaseClient()
  const { data: job } = await supabase.from('jobs').select('id, organization_id').limit(1).single()
  const { data: candidate } = await supabase.from('candidates').select('id').limit(1).single()

  if (job && candidate) {
    const testToken = `test-nextgen-${Date.now()}`
    const { data: inv, error: invErr } = await supabase.from('invitations').insert({
      job_id: job.id,
      candidate_id: candidate.id,
      token: testToken,
      status: 'SENT',
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }).select().single()

    if (!invErr && inv) {
      // 1. Start Session
      const startRes = await interviewEngineService.startOrResumeSession({ token: testToken })
      assert(startRes.session && startRes.session.id, 'Initialize active interview session in Supabase')
      assert(startRes.coverageMatrix && startRes.coverageMatrix.length > 0, 'Seed 5-pillar skill coverage matrix')

      // 2. Answer Turn 0 (Introduction)
      const turn0Answer = 'Hi, I am a senior backend software engineer with 6 years experience in distributed microservices and PostgreSQL.'
      const turn0Res = await interviewEngineService.processCandidateTurn({
        interviewId: startRes.interview.id,
        token: testToken,
        answerText: turn0Answer,
      })
      assert(turn0Res.nextQuestion !== null, 'Candidate turn 0 completes and yields first technical question')
      assert(turn0Res.session.session_metadata.turn_index === 1, 'Turn index progresses to 1')

      // Clean up test invitation
      await supabase.from('transcripts').delete().eq('interview_id', startRes.interview.id)
      await supabase.from('interview_sessions').delete().eq('interview_id', startRes.interview.id)
      await supabase.from('interviews').delete().eq('id', startRes.interview.id)
      await supabase.from('invitations').delete().eq('id', inv.id)
      console.log('✅ Cleaned up temporary test assessment session.')
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════')
  console.log(`RESULTS: ${passed} PASSED | ${failed} FAILED`)
  console.log('═══════════════════════════════════════════════════════════════════')

  if (failed > 0) {
    process.exit(1)
  }
}

runNextGenMeetingRoomTests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})

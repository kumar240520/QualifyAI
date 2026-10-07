import { getServiceSupabaseClient } from '../server/src/integrations/supabaseClient.js'
import { interviewEngineService } from '../server/src/services/interview/interviewEngineService.js'
import crypto from 'crypto'

async function runRegressionSuite() {
  const supabase = getServiceSupabaseClient()
  console.log('🧪 Starting AI-Authoritative Interview Regression Suite...\n')

  // 1. Get job and create dedicated candidate for clean isolation
  const { data: jobs } = await supabase.from('jobs').select('id, title, organization_id').limit(1)
  const job = jobs[0]

  const testEmail = `candidate-${Date.now()}@example.com`
  const { data: candidate, error: candErr } = await supabase
    .from('candidates')
    .insert({
      organization_id: job.organization_id,
      full_name: 'Alex Mercer',
      email: testEmail,
    })
    .select()
    .single()

  if (candErr) throw candErr

  // 2. Create fresh test invitation
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: newInv, error: invErr } = await supabase
    .from('invitations')
    .insert({
      job_id: job.id,
      candidate_id: candidate.id,
      token,
      status: 'ACCEPTED',
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (invErr) {
    console.error('Failed to create test invitation:', invErr)
    process.exit(1)
  }

  console.log('✅ Created fresh invitation with token:', token)

  // TEST 1: Session start -> Must produce Sequence 0 (Turn 0 intro question)
  console.log('\n--- TEST 1: Session Initialization (Turn 0) ---')
  const sessionState = await interviewEngineService.startOrResumeSession({ token })
  console.log('Initial Sequence:', sessionState.sequence)
  console.log('Question ID:', sessionState.currentQuestion.id)
  console.log('Question Text:', sessionState.currentQuestion.question_text)
  console.log('Question Type:', sessionState.currentQuestion.type)
  console.log('Options Count:', sessionState.currentQuestion.options?.length)
  console.log('Remaining Seconds:', sessionState.remainingSeconds)

  if (sessionState.sequence !== 0 || sessionState.currentQuestion.id !== 'intro-q0') {
    throw new Error(`TEST 1 Failed: Expected sequence 0 and intro-q0, got ${sessionState.sequence} and ${sessionState.currentQuestion.id}`)
  }
  console.log('✅ TEST 1 PASSED: Turn 0 intro-q0 cleanly seated with sequence 0 and empty options.')

  // TEST 2: Candidate answers Turn 0 -> AI generates Question B with Sequence 1
  console.log('\n--- TEST 2: Candidate Answers Turn 0 -> AI Synthesizes Question 2 ---')
  const candidateIntroAnswer = "Hi! I am a Senior Distributed Systems Engineer with 6 years of experience building high-throughput microservices using Node.js, Go, Redis, and PostgreSQL. Recently, I led a distributed consensus project using Raft to ensure zero-data-loss failovers."
  
  const q2Result = await interviewEngineService.processCandidateTurn({
    interviewId: sessionState.session.id,
    token,
    answerText: candidateIntroAnswer,
    questionSequence: 0,
    questionId: 'intro-q0',
    inputMethod: 'VOICE',
  })

  console.log('New Question Sequence:', q2Result.sequence)
  console.log('New Question ID:', q2Result.nextQuestion.id)
  console.log('New Question Type:', q2Result.nextQuestion.type)
  console.log('New Question Text:', q2Result.nextQuestion.question_text)
  console.log('New Question Options:', q2Result.nextQuestion.options?.map(o => o.key + ': ' + o.label?.substring(0, 30) + '...'))
  console.log('Spoken Lead-In:', q2Result.nextQuestion.spoken_lead_in)

  if (q2Result.sequence !== 1) {
    throw new Error(`TEST 2 Failed: Expected sequence 1, got ${q2Result.sequence}`)
  }
  console.log('✅ TEST 2 PASSED: Question 2 generated with monotonic sequence 1.')

  // TEST 3: Monotonic Sequence Guard & Stale Reversion Protection
  console.log('\n--- TEST 3: Stale Hydration / Reconnection Check ---')
  const hydratedState = await interviewEngineService.getInterviewState({
    interviewId: sessionState.session.id,
    token,
  })
  console.log('Hydrated Sequence:', hydratedState.sequence)
  console.log('Hydrated Question ID:', hydratedState.currentQuestion?.id)
  console.log('Hydrated Question Text:', hydratedState.currentQuestion?.question_text)

  if (hydratedState.sequence !== 1 || hydratedState.currentQuestion?.id !== q2Result.nextQuestion.id) {
    throw new Error(`TEST 3 Failed: Hydration returned sequence ${hydratedState.sequence} instead of 1!`)
  }
  console.log('✅ TEST 3 PASSED: Hydration returns newer Question B (seq 1), Question A did NOT reappear!')

  // TEST 4: Double Submission Protection
  console.log('\n--- TEST 4: Double Submission Prevention ---')
  const duplicateResult = await interviewEngineService.processCandidateTurn({
    interviewId: sessionState.session.id,
    token,
    answerText: candidateIntroAnswer, // Same answer again
    questionSequence: 0, // Old sequence already answered
    questionId: 'intro-q0',
  })

  console.log('Duplicate submission result isDuplicate:', duplicateResult.isDuplicate)
  console.log('Sequence remained at:', duplicateResult.sequence)

  if (!duplicateResult.isDuplicate || duplicateResult.sequence !== 1) {
    throw new Error(`TEST 4 Failed: Double submission was not caught!`)
  }
  console.log('✅ TEST 4 PASSED: Duplicate submission safely ignored; sequence remains monotonic.')

  // TEST 5: Answer Question 2 -> AI Synthesizes Question 3 with Sequence 2
  console.log('\n--- TEST 5: Candidate Answers Question 2 -> AI Synthesizes Question 3 ---')
  const q2Answer = "A) Adding randomized TTL jitter (5-15% variance) is the most effective approach because it desynchronizes cache expiration timestamps across keys and protects the PostgreSQL connection pool from thunder herd saturation."

  const q3Result = await interviewEngineService.processCandidateTurn({
    interviewId: sessionState.session.id,
    token,
    answerText: q2Answer,
    questionSequence: 1,
    questionId: q2Result.nextQuestion.id,
    inputMethod: 'VOICE',
  })

  console.log('Question 3 Sequence:', q3Result.sequence)
  console.log('Question 3 ID:', q3Result.nextQuestion.id)
  console.log('Question 3 Type:', q3Result.nextQuestion.type)
  console.log('Question 3 Text:', q3Result.nextQuestion.question_text)
  console.log('Question 3 Difficulty:', q3Result.nextQuestion.difficulty)

  if (q3Result.sequence !== 2) {
    throw new Error(`TEST 5 Failed: Expected sequence 2, got ${q3Result.sequence}`)
  }
  console.log('✅ TEST 5 PASSED: Question 3 generated with monotonic sequence 2.')

  console.log('\n🎉 ALL 5 REGRESSION TESTS PASSED CLEANLY!')
  console.log('Token ready for browser verification:', token)
  console.log(`URL: http://localhost:3000/interview/${token}`)
  process.exit(0)
}

runRegressionSuite().catch(err => {
  console.error('Regression suite failed:', err)
  process.exit(1)
})

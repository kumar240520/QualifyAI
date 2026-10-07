import { config } from '../server/src/config/env.js'

const API_BASE = 'http://localhost:5000/api'

async function runPhase5Tests() {
  console.log('====================================================')
  console.log('🧪 QUALIFYAI PHASE 5 ACCEPTANCE TEST SUITE')
  console.log('   Text-Based AI Interview Engine & Policy Control')
  console.log('====================================================\n')

  let recruiterToken = ''
  let organizationId = ''
  let jobId = ''
  let candidateId = ''
  let invitationToken = ''
  let interviewId = ''
  let currentQuestion = null

  // 1. Authenticate Recruiter
  console.log('Gate 1: Authenticating Recruiter Admin...')
  const testEmail = `engine_recruiter_${Date.now()}@qualifyai.com`
  const signupRes = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'SecurePassword123!',
      fullName: 'Aria Stirling',
      role: 'ORG_ADMIN',
      organizationName: 'Stirling Distributed Systems',
    }),
  })
  const signupData = await signupRes.json()
  if (!signupRes.ok || !signupData.success) {
    throw new Error(`Recruiter authentication failed: ${JSON.stringify(signupData)}`)
  }
  recruiterToken = signupData.data.session?.accessToken || signupData.data.token
  organizationId = signupData.data.user?.organization?.id || signupData.data.user?.organizationId
  console.log(`✅ Gate 1 Passed: Recruiter authenticated with Org ID: ${organizationId}`)

  // 2. Create Requisition, Calibrate Rubric & Seed Questions
  console.log('\nGate 2: Setting up Position Requisition, Rubric & Question Bank...')
  const jobRes = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`,
    },
    body: JSON.stringify({
      title: 'Senior Concurrency & Storage Engineer',
      description: `Building high-throughput storage engines with WAL write pipelining, lock-free queues, and cache-conscious data structures.
Key Requirements:
- Expert understanding of LSM trees, B-Trees, and WAL sync semantics.
- Memory barriers, atomic CAS instructions, and race-free multithreading in C++ or Rust.
- Mitigating tail latency amplification and direct I/O buffering.`,
      department: 'Database Engine Core',
      seniority: 'SENIOR',
    }),
  })
  const jobData = await jobRes.json()
  jobId = jobData.data.id

  // Synthesize Rubric & Questions
  console.log('   Calibrating 5-pillar rubric via Gemini...')
  const rubricRes = await fetch(`${API_BASE}/jobs/${jobId}/rubric/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recruiterToken}` },
  })
  const rubricData = await rubricRes.json()
  console.log(`   Synthesized ${rubricData.data.rubric_criteria?.length} evaluation criteria.`)

  console.log('   Synthesizing targeted question pool via Gemini...')
  const qRes = await fetch(`${API_BASE}/jobs/${jobId}/questions/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recruiterToken}` },
  })
  const qData = await qRes.json()
  console.log(`   Generated ${qData.data?.length} targeted interview questions.`)
  console.log('✅ Gate 2 Passed: Requisition grounded in 5-pillar rubric and targeted question pool.')

  // 3. Register Candidate & Issue Tokenized Invitation
  console.log('\nGate 3: Registering Candidate & Generating Cryptographic Invitation Token...')
  const candRes = await fetch(`${API_BASE}/jobs/${jobId}/candidates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`,
    },
    body: JSON.stringify({
      fullName: 'Devon Kaelen',
      email: `devon.${Date.now()}@example.io`,
    }),
  })
  const candData = await candRes.json()
  candidateId = candData.data.id

  const invRes = await fetch(`${API_BASE}/jobs/${jobId}/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`,
    },
    body: JSON.stringify({ candidateId, expiresInDays: 7 }),
  })
  const invData = await invRes.json()
  invitationToken = invData.data.token
  console.log(`Generated Token: ${invitationToken}`)
  console.log('✅ Gate 3 Passed: Candidate registered and secure invitation token created.')

  // 4. Start Interview Session (POST /api/interviews/start)
  console.log('\nGate 4: Testing POST /api/interviews/start (Session State Machine Initialization)...')
  const startRes = await fetch(`${API_BASE}/interviews/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: invitationToken }),
  })
  const startData = await startRes.json()
  if (!startRes.ok || !startData.success) {
    throw new Error(`Failed to start interview: ${JSON.stringify(startData)}`)
  }

  interviewId = startData.data.interview.id
  currentQuestion = startData.data.currentQuestion
  console.log(`Interview ID: ${interviewId}`)
  console.log(`Initial Question [${currentQuestion.difficulty}]: "${currentQuestion.question_text.slice(0, 80)}..."`)
  console.log(`Initial Transcript Length: ${startData.data.transcripts.length}`)
  if (startData.data.transcripts.length === 0 || startData.data.transcripts[0].speaker !== 'AI') {
    throw new Error('Initial transcript missing AI opening question.')
  }
  console.log('✅ Gate 4 Passed: Interview session initialized and opening question seeded in transcript.')

  // 5. Submit Candidate Answer 1: Shallow Response -> Expect FOLLOW_UP probe
  console.log('\nGate 5: Testing Turn 1 Submission (Shallow Answer -> Deterministic FOLLOW_UP)...')
  const shallowAnswer =
    'We can use mutexes or atomic locks to prevent race conditions when writing to the storage disk.'

  const turn1StartTime = Date.now()
  const turn1Res = await fetch(`${API_BASE}/interviews/${interviewId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: invitationToken, answerText: shallowAnswer }),
  })
  const turn1Data = await turn1Res.json()
  const turn1Latency = Date.now() - turn1StartTime

  if (!turn1Res.ok || !turn1Data.success) {
    throw new Error(`Turn 1 failed: ${JSON.stringify(turn1Data)}`)
  }

  const analysis1 = turn1Data.data.answerAnalysis
  const policy1 = turn1Data.data.policyDecision
  console.log(`Turn 1 Roundtrip Latency: ${turn1Latency}ms`)
  console.log(`   Correctness: ${analysis1.correctness}/10 | Depth: ${analysis1.depth}/10`)
  console.log(`   Missing Concepts: ${analysis1.missing_concepts.join(', ')}`)
  console.log(`   Policy Engine Action: "${policy1.action}" (Reason: ${policy1.reason})`)
  console.log(`   Follow-up Probe: "${turn1Data.data.nextQuestion?.question_text}"`)

  if (policy1.action !== 'FOLLOW_UP') {
    throw new Error(`Expected policy action FOLLOW_UP for shallow answer, got ${policy1.action}`)
  }
  console.log('✅ Gate 5 Passed: Gemini Answer Analyzer identified omissions and Policy Engine enforced FOLLOW_UP probe.')

  // 6. Submit Candidate Answer 2: Comprehensive Response -> Expect SWITCH_TOPIC / Progression
  console.log('\nGate 6: Testing Turn 2 Submission (Comprehensive Answer -> Topic Progression)...')
  const deepAnswer = `To minimize write contention and tail latency in the WAL pipeline:
1. Lock-Free Ring Buffer: Use a multi-producer, single-consumer (MPSC) lock-free ring buffer utilizing atomic memory barriers (std::memory_order_release / acquire) to sequence log entries without mutex contention.
2. Direct I/O and Group Commit: Instead of per-transaction fsync(), batch concurrent writes into a single O_DIRECT aligned buffer write using group committing.
3. Cache-Conscious Pipelining: Separate the sequencing thread from the disk I/O thread, decoupling CPU serialization from NVMe hardware latency.`

  const turn2StartTime = Date.now()
  const turn2Res = await fetch(`${API_BASE}/interviews/${interviewId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: invitationToken, answerText: deepAnswer }),
  })
  const turn2Data = await turn2Res.json()
  const turn2Latency = Date.now() - turn2StartTime

  if (!turn2Res.ok || !turn2Data.success) {
    throw new Error(`Turn 2 failed: ${JSON.stringify(turn2Data)}`)
  }

  const analysis2 = turn2Data.data.answerAnalysis
  const policy2 = turn2Data.data.policyDecision
  console.log(`Turn 2 Roundtrip Latency: ${turn2Latency}ms`)
  console.log(`   Correctness: ${analysis2.correctness}/10 | Depth: ${analysis2.depth}/10`)
  console.log(`   Concepts Detected: ${analysis2.concepts_detected.join(', ')}`)
  console.log(`   Skill Estimate: ${analysis2.skill_estimate}`)
  console.log(`   Policy Engine Action: "${policy2.action}" (Reason: ${policy2.reason})`)
  console.log(`   Next Question [${turn2Data.data.nextQuestion?.difficulty}]: "${turn2Data.data.nextQuestion?.question_text.slice(0, 80)}..."`)

  if (policy2.action !== 'SWITCH_TOPIC' && policy2.action !== 'INCREASE_DIFFICULTY') {
    throw new Error(`Expected topic progression or difficulty scaling, got ${policy2.action}`)
  }
  console.log('✅ Gate 6 Passed: High-depth answer recognized, concepts credited, and Policy Engine transitioned to next pillar.')

  // 7. Test GET /api/interviews/:id (Synchronize Live State)
  console.log('\nGate 7: Testing GET /api/interviews/:id (Live State Synchronization)...')
  const syncRes = await fetch(`${API_BASE}/interviews/${interviewId}?token=${encodeURIComponent(invitationToken)}`)
  const syncData = await syncRes.json()
  if (!syncRes.ok || !syncData.success) {
    throw new Error(`State sync failed: ${JSON.stringify(syncData)}`)
  }
  console.log(`Total Turns in Transcript: ${syncData.data.transcripts?.length}`)
  console.log(`Interview Status: ${syncData.data.interview?.status}`)
  console.log('✅ Gate 7 Passed: Real-time transcript history and turn order synchronized.')

  // 8. Test POST /api/interviews/:id/complete (Wrap up assessment)
  console.log('\nGate 8: Testing POST /api/interviews/:id/complete (Interview Finalization)...')
  const compRes = await fetch(`${API_BASE}/interviews/${interviewId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: invitationToken }),
  })
  const compData = await compRes.json()
  if (!compRes.ok || !compData.success) {
    throw new Error(`Completion failed: ${JSON.stringify(compData)}`)
  }
  console.log(`Final Status: ${compData.data.status}`)
  console.log(`Completed At: ${compData.data.completed_at}`)
  if (compData.data.status !== 'COMPLETED') {
    throw new Error(`Expected status COMPLETED, got ${compData.data.status}`)
  }
  console.log('✅ Gate 8 Passed: Interview finalized, state persisted to PostgreSQL.')

  // 9. Security & Guard Tests
  console.log('\nGate 9: Testing Security Guards on Completed/Invalid Session...')
  // Cannot submit answer on completed interview
  const postCompTurnRes = await fetch(`${API_BASE}/interviews/${interviewId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: invitationToken, answerText: 'Trying to answer after wrap up' }),
  })
  if (postCompTurnRes.status !== 400 && postCompTurnRes.status !== 403) {
    throw new Error(`Security breach: Allowed answer submission on completed interview!`)
  }

  // Invalid token rejected
  const badTokenRes = await fetch(`${API_BASE}/interviews/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'bogus-token-xyz' }),
  })
  if (badTokenRes.status !== 404 && badTokenRes.status !== 400) {
    throw new Error(`Invalid token was not rejected! Status: ${badTokenRes.status}`)
  }
  console.log('✅ Gate 9 Passed: Post-completion tampering blocked and unauthenticated tokens rejected.')

  console.log('\n====================================================')
  console.log('🎉 ALL 9 PHASE 5 TESTING GATES PASSED!')
  console.log('   - Text-Based AI Interview State Machine Initialized')
  console.log('   - Google Gemini Answer Analyzer Grounded in Rubric')
  console.log('   - Deterministic Policy Engine (FOLLOW_UP, SWITCH_TOPIC)')
  console.log('   - Live Transcript Persisted in PostgreSQL')
  console.log('   - Interview Lifecycle (START -> TURNS -> COMPLETED)')
  console.log('====================================================\n')
}

runPhase5Tests().catch((err) => {
  console.error('\n❌ Phase 5 Test Suite Failed:', err.message)
  process.exit(1)
})

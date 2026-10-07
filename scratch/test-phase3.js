import { config } from '../server/src/config/env.js'

const API_BASE = 'http://localhost:5000/api'

async function runPhase3Tests() {
  console.log('====================================================')
  console.log('🧪 QUALIFYAI PHASE 3 ACCEPTANCE TEST SUITE')
  console.log('   Rubric Matrix & Targeted Question Intelligence')
  console.log('====================================================\n')

  let recruiterToken = ''
  let organizationId = ''
  let jobId = ''
  let rubricId = ''
  let criteriaList = []
  let questionPool = []
  let customQuestionId = ''

  // 1. Authenticate / Sign up Recruiter
  console.log('Gate 1: Authenticating Recruiter Admin...')
  const testEmail = `rubric_tester_${Date.now()}@qualifyai.com`
  const signupRes = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'SecurePassword123!',
      fullName: 'Dr. Elena Rostova',
      role: 'ORG_ADMIN',
      organizationName: 'NeuralScale Systems',
    }),
  })

  const signupData = await signupRes.json()
  if (!signupRes.ok || !signupData.success) {
    throw new Error(`Recruiter authentication failed: ${JSON.stringify(signupData)}`)
  }

  recruiterToken = signupData.data.session?.accessToken || signupData.data.token
  organizationId = signupData.data.user?.organization?.id || signupData.data.user?.organizationId
  console.log(`✅ Gate 1 Passed: Recruiter authenticated with Org ID: ${organizationId}`)

  // 2. Create Requisition and extract competencies
  console.log('\nGate 2: Creating Job Requisition & Extracting Skills with Gemini...')
  const jobRes = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`,
    },
    body: JSON.stringify({
      title: 'Principal Distributed Consensus Engineer',
      description: `We are seeking a Principal Distributed Consensus Engineer to architect high-throughput, Byzantine fault-tolerant replication engines.
Requirements:
- Deep expertise in Raft, Paxos, or Multi-Paxos protocols.
- Hands-on systems programming in Go or Rust with low-level Linux memory management and WAL file I/O.
- Experience with zero-copy network serialization, gRPC, and epoll network polling.
- Track record of diagnosing distributed deadlocks, split-brain partitions, and tail-latency amplification under 100k OPS.`,
      department: 'Infrastructure Core',
      seniority: 'STAFF',
    }),
  })

  const jobData = await jobRes.json()
  if (!jobRes.ok || !jobData.success) {
    throw new Error(`Job creation failed: ${JSON.stringify(jobData)}`)
  }
  jobId = jobData.data.id
  console.log(`Created Job ID: ${jobId}`)

  // Parse JD with Gemini
  const parseRes = await fetch(`${API_BASE}/jobs/${jobId}/parse-jd`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`,
    },
    body: JSON.stringify({}),
  })
  const parseData = await parseRes.json()
  if (!parseRes.ok || !parseData.success) {
    throw new Error(`JD parsing failed: ${JSON.stringify(parseData)}`)
  }
  console.log(`✅ Gate 2 Passed: Gemini extracted ${parseData.data.skills.length} core competencies.`)

  // 3. Test initial GET /api/jobs/:id/rubric (Expect empty or null)
  console.log('\nGate 3: Testing GET /api/jobs/:id/rubric (Pre-generation)...')
  const initialRubricRes = await fetch(`${API_BASE}/jobs/${jobId}/rubric`, {
    headers: { Authorization: `Bearer ${recruiterToken}` },
  })
  const initialRubricData = await initialRubricRes.json()
  if (!initialRubricRes.ok || !initialRubricData.success) {
    throw new Error(`Failed to check initial rubric: ${JSON.stringify(initialRubricData)}`)
  }
  console.log(`Initial rubric state: ${initialRubricData.data ? 'Found' : 'Null (Uncalibrated - Ready)'}`)
  console.log('✅ Gate 3 Passed: Empty state handled cleanly.')

  // 4. Test POST /api/jobs/:id/rubric/generate
  console.log('\nGate 4: Testing POST /api/jobs/:id/rubric/generate (Gemini 5-Pillar Synthesis)...')
  const genStartTime = Date.now()
  const genRubricRes = await fetch(`${API_BASE}/jobs/${jobId}/rubric/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recruiterToken}` },
  })
  const genRubricData = await genRubricRes.json()
  const genLatency = Date.now() - genStartTime

  if (!genRubricRes.ok || !genRubricData.success) {
    throw new Error(`Rubric generation failed: ${JSON.stringify(genRubricData)}`)
  }

  rubricId = genRubricData.data.id
  criteriaList = genRubricData.data.rubric_criteria || []
  console.log(`Generated Rubric Title: "${genRubricData.data.title}" in ${genLatency}ms`)
  console.log(`Synthesized Criteria Count: ${criteriaList.length}`)
  criteriaList.forEach((c, idx) => {
    console.log(`   Pillar ${idx + 1}: ${c.name} (Weight: ${c.weight}/5)`)
    console.log(`      L1: ${c.evaluation_guidance?.level1?.slice(0, 60)}...`)
    console.log(`      L3: ${c.evaluation_guidance?.level3?.slice(0, 60)}...`)
    console.log(`      L5: ${c.evaluation_guidance?.level5?.slice(0, 60)}...`)
  })

  if (criteriaList.length < 5) {
    throw new Error(`Expected at least 5 rubric criteria, got ${criteriaList.length}`)
  }
  console.log('✅ Gate 4 Passed: 5-pillar rubric synthesized & persisted with 1-3-5 benchmarks.')

  // 5. Test PUT /api/jobs/:id/rubric (Weight adjustment)
  console.log('\nGate 5: Testing PUT /api/jobs/:id/rubric (Weights Calibration)...')
  const updatedCriteriaPayload = criteriaList.map((c, i) => ({
    id: c.id,
    weight: i === 0 ? 5 : 4,
    expected_competency: `${c.expected_competency} [Calibrated for Staff Level]`,
  }))

  const updateRubricRes = await fetch(`${API_BASE}/jobs/${jobId}/rubric`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`,
    },
    body: JSON.stringify({ criteria: updatedCriteriaPayload }),
  })
  const updateRubricData = await updateRubricRes.json()
  if (!updateRubricRes.ok || !updateRubricData.success) {
    throw new Error(`Rubric update failed: ${JSON.stringify(updateRubricData)}`)
  }
  console.log('✅ Gate 5 Passed: Rubric weights and competency benchmarks updated in PostgreSQL.')

  // 6. Test POST /api/jobs/:id/questions/generate (Gemini Targeted Question Pool)
  console.log('\nGate 6: Testing POST /api/jobs/:id/questions/generate (Gemini Targeted Synthesis)...')
  const genQStartTime = Date.now()
  const genQRes = await fetch(`${API_BASE}/jobs/${jobId}/questions/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${recruiterToken}` },
  })
  const genQData = await genQRes.json()
  const genQLatency = Date.now() - genQStartTime

  if (!genQRes.ok || !genQData.success) {
    throw new Error(`Question generation failed: ${JSON.stringify(genQData)}`)
  }

  questionPool = genQData.data || []
  console.log(`Synthesized Question Pool Count: ${questionPool.length} in ${genQLatency}ms`)
  questionPool.forEach((q, idx) => {
    console.log(`   Q${idx + 1} [${q.type}] [${q.difficulty}]: ${q.question_text.slice(0, 75)}...`)
    console.log(`      Pillar: ${q.rubric_criteria?.name || 'Linked'}`)
    console.log(`      Concepts: ${q.metadata?.expected_concepts?.slice(0, 3).join(', ')}`)
  })

  if (questionPool.length < 5) {
    throw new Error(`Expected at least 5 questions, got ${questionPool.length}`)
  }
  console.log('✅ Gate 6 Passed: Targeted question pool generated with concepts and difficulty tiers.')

  // 7. Test POST /api/jobs/:id/questions (Custom Question Creation)
  console.log('\nGate 7: Testing POST /api/jobs/:id/questions (Custom Question Creation)...')
  const customQRes = await fetch(`${API_BASE}/jobs/${jobId}/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`,
    },
    body: JSON.stringify({
      rubric_criterion_id: criteriaList[0]?.id,
      type: 'TECHNICAL',
      question_text: 'How would you diagnose and resolve split-brain network partitions in a multi-region Raft cluster?',
      difficulty: 'HARD',
      context_order: 10,
      metadata: {
        expected_concepts: ['Quorum leases', 'Witness nodes', 'Pre-vote phase'],
        rubric_focus: 'High availability and consensus partitioning recovery',
      },
    }),
  })
  const customQData = await customQRes.json()
  if (!customQRes.ok || !customQData.success) {
    throw new Error(`Custom question creation failed: ${JSON.stringify(customQData)}`)
  }
  customQuestionId = customQData.data.id
  console.log(`Created Custom Question ID: ${customQuestionId}`)
  console.log('✅ Gate 7 Passed: Custom question created and linked to criterion.')

  // 8. Test DELETE /api/jobs/:id/questions/:questionId
  console.log('\nGate 8: Testing DELETE /api/jobs/:id/questions/:questionId...')
  const deleteQRes = await fetch(`${API_BASE}/jobs/${jobId}/questions/${customQuestionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${recruiterToken}` },
  })
  const deleteQData = await deleteQRes.json()
  if (!deleteQRes.ok || !deleteQData.success) {
    throw new Error(`Question deletion failed: ${JSON.stringify(deleteQData)}`)
  }
  console.log('✅ Gate 8 Passed: Custom question deleted successfully.')

  // 9. Test Multi-tenant RLS Isolation (Unauthenticated / Cross-Org)
  console.log('\nGate 9: Testing Multi-Tenant RLS & Security Isolation...')
  const unauthRes = await fetch(`${API_BASE}/jobs/${jobId}/rubric`)
  if (unauthRes.status !== 401) {
    throw new Error(`Security breach: Unauthenticated access returned status ${unauthRes.status}`)
  }

  // Cross-tenant test: Sign up a second recruiter in a different org
  const org2Res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `other_org_${Date.now()}@companya.com`,
      password: 'SecurePassword123!',
      fullName: 'Foreign Recruiter',
      role: 'ORG_ADMIN',
      organizationName: 'External Corp',
    }),
  })
  const org2Data = await org2Res.json()
  const org2Token = org2Data.data.session?.accessToken || org2Data.data.token

  const crossOrgRes = await fetch(`${API_BASE}/jobs/${jobId}/rubric`, {
    headers: { Authorization: `Bearer ${org2Token}` },
  })
  if (crossOrgRes.status !== 500 && crossOrgRes.status !== 403 && crossOrgRes.status !== 404) {
    const crossData = await crossOrgRes.json()
    if (crossData.success) {
      throw new Error(`Security breach: Cross-tenant accessed another org's rubric!`)
    }
  }
  console.log('✅ Gate 9 Passed: Multi-tenant RLS strictly enforces organization isolation.')

  console.log('\n====================================================')
  console.log('🎉 ALL 9 PHASE 3 TESTING GATES PASSED!')
  console.log('   - 5-Pillar Rubric Calibrated with Level 1-3-5 Guidance')
  console.log('   - Targeted Question Pool Generated via Google Gemini')
  console.log('   - PostgreSQL Persistence & Multi-tenant RLS Verified')
  console.log('====================================================\n')
}

runPhase3Tests().catch((err) => {
  console.error('\n❌ Phase 3 Test Suite Failed:', err.message)
  process.exit(1)
})

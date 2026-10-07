// Phase 10 Reports + Recruiter Analytics Automated Acceptance Test Suite
const API_URL = 'http://localhost:5000/api'

async function runPhase10Acceptance() {
  console.log('===========================================================')
  console.log('🧪 Starting Phase 10: Reports + Recruiter Analytics Test')
  console.log('===========================================================')

  const testSuffix = Date.now()
  const recruiterEmail = `recruiter_p10_${testSuffix}@qualifyai.test`
  const password = 'TestSecurePassword123!'

  // Gate 1: Recruiter Auth
  console.log('\n[Gate 1/8] Registering recruiter user...')
  const signupRes = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: recruiterEmail,
      password,
      fullName: 'Sarah Sterling (VP Engineering)',
      organizationName: 'QualifyAI Scale Systems',
      role: 'ORG_ADMIN',
    }),
  })
  const signupData = await signupRes.json()
  if (!signupRes.ok || !signupData.success) {
    throw new Error(`Signup failed: ${signupData.error}`)
  }

  // Login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: recruiterEmail,
      password,
    }),
  })
  const loginData = await loginRes.json()
  if (!loginRes.ok || !loginData.success) {
    throw new Error(`Login failed: ${loginData.error}`)
  }

  const token = loginData.data?.session?.accessToken
  if (!token) {
    throw new Error('No accessToken found in login response.')
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
  console.log('✅ Recruiter authenticated with session token.')

  // Gate 2: Create Requisition & Generate Rubric
  console.log('\n[Gate 2/8] Creating Job Requisition & AI Rubric Criteria...')
  const jobRes = await fetch(`${API_URL}/jobs`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Principal Distributed Systems Architect',
      department: 'Cloud Platform Infrastructure',
      seniority: 'STAFF',
      location: 'Remote, US',
      description:
        'We require a seasoned architect in high-throughput distributed systems, event-driven architectures with Apache Kafka, Raft consensus algorithms, Redis distributed locking, and resilient circuit breaker patterns.',
    }),
  })
  const jobData = await jobRes.json()
  if (!jobRes.ok || !jobData.success) {
    throw new Error(`Job creation failed: ${jobData.error}`)
  }
  const jobId = jobData.data.id
  console.log(`✅ Created Job Requisition: ${jobId}`)

  // Generate Rubric
  const rubricRes = await fetch(`${API_URL}/jobs/${jobId}/rubric/generate`, {
    method: 'POST',
    headers: authHeaders,
  })
  const rubricData = await rubricRes.json()
  console.log(`✅ Generated AI Rubric matrix.`)

  // Gate 3: Register Candidate & Issue Token
  console.log('\n[Gate 3/8] Enrolling Candidate & Issuing Invitation Token...')
  const candRes = await fetch(`${API_URL}/jobs/${jobId}/candidates`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email: `candidate_p10_${testSuffix}@talent.io`,
      fullName: 'Alex Rivera',
      phone: '+1 (555) 345-6789',
    }),
  })
  const candData = await candRes.json()
  if (!candRes.ok || !candData.success) {
    throw new Error(`Candidate creation failed: ${candData.error}`)
  }
  const candidateId = candData.data.id

  const invRes = await fetch(`${API_URL}/jobs/${jobId}/invitations`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ candidateId, expiresInDays: 7 }),
  })
  const invData = await invRes.json()
  const inviteToken = invData.data?.token || invData.data?.invitation?.token
  console.log(`✅ Candidate ${candidateId} invited with token: ${inviteToken.substring(0, 12)}...`)

  // Gate 4: Start Interview Session
  console.log('\n[Gate 4/8] Starting candidate interview session...')
  const startRes = await fetch(`${API_URL}/interviews/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: inviteToken }),
  })
  const startData = await startRes.json()
  if (!startRes.ok || !startData.success) {
    throw new Error(`Start interview failed: ${startData.error}`)
  }
  const interviewId = startData.data.interview.id
  console.log(`✅ Interview session active: ${interviewId}`)

  // Gate 5: Proctoring Telemetry
  console.log('\n[Gate 5/8] Streaming Proctoring Telemetry...')
  const proctorRes = await fetch(`${API_URL}/interviews/${interviewId}/proctoring/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: [
        { event_type: 'TAB_BLUR', timestamp_ms: Date.now() - 30000, metadata: { reason: 'alt_tab' } },
        { event_type: 'TAB_FOCUS', timestamp_ms: Date.now() - 28000, metadata: { duration_away_ms: 2000 } },
      ],
    }),
  })
  const proctorData = await proctorRes.json()
  if (!proctorRes.ok || !proctorData.success) {
    throw new Error(`Proctoring telemetry submission failed: ${proctorData.error}`)
  }
  console.log(`✅ Proctoring telemetry ingested (Risk score computed: ${proctorData.data?.risk_score}%, Trust: ${proctorData.data?.trust_level})`)

  // Gate 6: Answer Dialogue & Evaluation
  console.log('\n[Gate 6/8] Submitting technical answer & evaluating interview...')
  const ansRes = await fetch(`${API_URL}/interviews/${interviewId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: inviteToken,
      answerText:
        'In Raft distributed consensus, leader election relies on randomized election timeouts to prevent split votes. When a follower suspects the leader is partitioned due to heartbeat timeout, it increments term, transitions to candidate, and broadcasts RequestVote RPCs. Upon majority approval, it issues AppendEntries heartbeats. For data replication, logs are committed only once acknowledged by a quorum, preserving linearizability.',
    }),
  })
  const ansData = await ansRes.json()
  if (!ansRes.ok || !ansData.success) {
    throw new Error(`Answer failed: ${ansData.error}`)
  }

  // Run Rubric Evaluation
  const evalRes = await fetch(`${API_URL}/interviews/${interviewId}/evaluate`, {
    method: 'POST',
    headers: authHeaders,
  })
  const evalData = await evalRes.json()
  if (!evalRes.ok || !evalData.success) {
    throw new Error(`Evaluation failed: ${evalData.error}`)
  }
  console.log(`✅ Rubric evaluation completed: Overall Score = ${evalData.data.evaluation.overall_score}/100, Rec: ${evalData.data.evaluation.recommendation}`)

  // Gate 7: Generate & Retrieve Phase 10 Executive Report
  console.log('\n[Gate 7/8] Generating Executive Recruiter Report...')
  const genReportRes = await fetch(`${API_URL}/interviews/${interviewId}/report/generate`, {
    method: 'POST',
    headers: authHeaders,
  })
  const genReportData = await genReportRes.json()
  if (!genReportRes.ok || !genReportData.success) {
    throw new Error(`Executive report generation failed: ${genReportData.error}`)
  }
  const report = genReportData.data
  console.log(`✅ Executive report generated:`)
  console.log(`   - Summary: "${report.executive_summary?.slice(0, 100)}..."`)
  console.log(`   - Strengths Count: ${report.strengths?.length || 0}`)
  console.log(`   - Growth Areas Count: ${report.growth_areas?.length || 0}`)
  console.log(`   - Key Quotes Count: ${report.key_quotes?.length || 0}`)

  // Verify GET /api/interviews/:id/report
  const getReportRes = await fetch(`${API_URL}/interviews/${interviewId}/report`, {
    headers: authHeaders,
  })
  const getReportData = await getReportRes.json()
  if (!getReportRes.ok || !getReportData.success) {
    throw new Error(`Get report failed: ${getReportData.error}`)
  }
  console.log(`✅ Executive report retrieved successfully from database (ID: ${getReportData.data.id})`)

  // Gate 8: Verify Cohort Analytics & Ranked Leaderboard
  console.log('\n[Gate 8/8] Querying Requisition Cohort Analytics & Ranked Leaderboard...')
  const cohortRes = await fetch(`${API_URL}/jobs/${jobId}/analytics/cohort`, {
    headers: authHeaders,
  })
  const cohortData = await cohortRes.json()
  if (!cohortRes.ok || !cohortData.success) {
    throw new Error(`Cohort analytics failed: ${cohortData.error}`)
  }

  const cohort = cohortData.data
  console.log(`✅ Cohort Analytics aggregated successfully:`)
  console.log(`   - Total Candidates: ${cohort.total_candidates}`)
  console.log(`   - Completed Interviews: ${cohort.completed_interviews}`)
  console.log(`   - Average Score: ${cohort.average_score}%`)
  console.log(`   - Top Score: ${cohort.top_score}%`)
  console.log(`   - Hire Rate: ${cohort.hire_rate_percentage}%`)
  console.log(`   - Recommendation Dist:`, cohort.recommendation_distribution)

  if (!cohort.leaderboard || cohort.leaderboard.length === 0) {
    throw new Error('Expected at least 1 candidate on the ranked leaderboard')
  }

  const rank1 = cohort.leaderboard[0]
  console.log(`\n🏆 Leaderboard Rank 1:`)
  console.log(`   - Full Name: ${rank1.full_name}`)
  console.log(`   - Rank: #${rank1.rank}`)
  console.log(`   - Overall Score: ${rank1.overall_score}%`)
  console.log(`   - Technical Depth: ${rank1.technical_depth}%`)
  console.log(`   - Problem Solving: ${rank1.problem_solving}%`)
  console.log(`   - Communication: ${rank1.communication}%`)
  console.log(`   - Recommendation: ${rank1.recommendation}`)
  console.log(`   - Proctoring Trust Level: ${rank1.proctoring_trust_level}`)

  console.log('\n===========================================================')
  console.log('🎉 ALL 8/8 PHASE 10 ACCEPTANCE GATES PASSED 100%!')
  console.log('===========================================================')
}

runPhase10Acceptance().catch((err) => {
  console.error('\n❌ Phase 10 Acceptance Test Failed:', err)
  process.exit(1)
})

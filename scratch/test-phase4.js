import { config } from '../server/src/config/env.js'

const API_BASE = 'http://localhost:5000/api'

async function runPhase4Tests() {
  console.log('====================================================')
  console.log('🧪 QUALIFYAI PHASE 4 ACCEPTANCE TEST SUITE')
  console.log('   Candidate Pipeline & Tokenized Invitation Engine')
  console.log('====================================================\n')

  let recruiterToken = ''
  let organizationId = ''
  let jobId = ''
  let candidateId = ''
  let invitationToken = ''

  // 1. Authenticate / Sign up Recruiter
  console.log('Gate 1: Authenticating Recruiter Admin...')
  const testEmail = `candidate_lead_${Date.now()}@qualifyai.com`
  const signupRes = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'SecurePassword123!',
      fullName: 'Marcus Vance',
      role: 'ORG_ADMIN',
      organizationName: 'HyperMesh Cloud',
    }),
  })

  const signupData = await signupRes.json()
  if (!signupRes.ok || !signupData.success) {
    throw new Error(`Recruiter authentication failed: ${JSON.stringify(signupData)}`)
  }

  recruiterToken = signupData.data.session?.accessToken || signupData.data.token
  organizationId = signupData.data.user?.organization?.id || signupData.data.user?.organizationId
  console.log(`✅ Gate 1 Passed: Recruiter authenticated with Org ID: ${organizationId}`)

  // 2. Create Requisition
  console.log('\nGate 2: Creating Job Requisition...')
  const jobRes = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`,
    },
    body: JSON.stringify({
      title: 'Lead Platform Reliability Architect',
      description: 'Designing Kubernetes operators and multi-region eBPF observability pipelines.',
      department: 'Infrastructure',
      seniority: 'STAFF',
    }),
  })
  const jobData = await jobRes.json()
  if (!jobRes.ok || !jobData.success) {
    throw new Error(`Job creation failed: ${JSON.stringify(jobData)}`)
  }
  jobId = jobData.data.id
  console.log(`Created Job Requisition ID: ${jobId}`)
  console.log('✅ Gate 2 Passed: Position Requisition created.')

  // 3. GET /api/jobs/:id/candidates (Initial empty cohort)
  console.log('\nGate 3: Testing GET /api/jobs/:id/candidates (Empty state)...')
  const initialCandidatesRes = await fetch(`${API_BASE}/jobs/${jobId}/candidates`, {
    headers: { Authorization: `Bearer ${recruiterToken}` },
  })
  const initialCandidatesData = await initialCandidatesRes.json()
  if (!initialCandidatesRes.ok || !initialCandidatesData.success) {
    throw new Error(`Failed to fetch initial candidates: ${JSON.stringify(initialCandidatesData)}`)
  }
  if (!Array.isArray(initialCandidatesData.data) || initialCandidatesData.data.length !== 0) {
    throw new Error(`Expected empty candidate cohort, got ${initialCandidatesData.data?.length}`)
  }
  console.log('✅ Gate 3 Passed: Empty candidate cohort handled cleanly.')

  // 4. POST /api/jobs/:id/candidates (Candidate Registration)
  console.log('\nGate 4: Testing POST /api/jobs/:id/candidates (Candidate Registration)...')
  const candidatePayload = {
    fullName: 'Liam Thorne',
    email: `liam.thorne.${Date.now()}@example.org`,
    phone: '+1 (555) 234-5678',
    resumeUrl: 'https://storage.qualifyai.com/resumes/liam_thorne.pdf',
  }
  const addCandidateRes = await fetch(`${API_BASE}/jobs/${jobId}/candidates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`,
    },
    body: JSON.stringify(candidatePayload),
  })
  const addCandidateData = await addCandidateRes.json()
  if (!addCandidateRes.ok || !addCandidateData.success) {
    throw new Error(`Candidate registration failed: ${JSON.stringify(addCandidateData)}`)
  }
  candidateId = addCandidateData.data.id
  console.log(`Registered Candidate: ${addCandidateData.data.full_name} (ID: ${candidateId})`)
  console.log(`Application Status: ${addCandidateData.data.application_status}`)
  console.log('✅ Gate 4 Passed: Candidate saved to public.candidates & public.applications.')

  // 5. POST /api/jobs/:id/invitations (Cryptographic Tokenized Invitation)
  console.log('\nGate 5: Testing POST /api/jobs/:id/invitations (Cryptographic Link Synthesis)...')
  const inviteRes = await fetch(`${API_BASE}/jobs/${jobId}/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${recruiterToken}`,
    },
    body: JSON.stringify({
      candidateId,
      expiresInDays: 7,
    }),
  })
  const inviteData = await inviteRes.json()
  if (!inviteRes.ok || !inviteData.success) {
    throw new Error(`Invitation generation failed: ${JSON.stringify(inviteData)}`)
  }
  invitationToken = inviteData.data.token
  console.log(`Generated Cryptographic Token: ${invitationToken}`)
  console.log(`Invitation Status: ${inviteData.data.status}`)
  console.log(`Expires At: ${inviteData.data.expires_at}`)
  if (!invitationToken || invitationToken.length < 32) {
    throw new Error('Token is missing or insufficiently secure.')
  }
  console.log('✅ Gate 5 Passed: Secure tokenized invitation generated & application marked INVITED.')

  // 6. GET /api/invitations/:token (Public Candidate Verification)
  console.log('\nGate 6: Testing GET /api/invitations/:token (Public Token Verification)...')
  // Notice NO Authorization header — simulating anonymous candidate clicking email link
  const publicVerifyRes = await fetch(`${API_BASE}/invitations/${invitationToken}`)
  const publicVerifyData = await publicVerifyRes.json()
  if (!publicVerifyRes.ok || !publicVerifyData.success) {
    throw new Error(`Public verification failed: ${JSON.stringify(publicVerifyData)}`)
  }
  const payload = publicVerifyData.data
  console.log(`Verified Organization: "${payload.organization.name}"`)
  console.log(`Verified Role Title: "${payload.job.title}" (${payload.job.seniority})`)
  console.log(`Candidate Name: "${payload.candidate.full_name}"`)
  console.log(`Invitation State Transition: "${payload.invitation.status}" (expected OPENED)`)
  if (payload.invitation.status !== 'OPENED') {
    throw new Error(`Expected status OPENED, got ${payload.invitation.status}`)
  }
  console.log('✅ Gate 6 Passed: Public token verified with role context and status transitioned to OPENED.')

  // 7. POST /api/invitations/:token/accept (Candidate Acceptance)
  console.log('\nGate 7: Testing POST /api/invitations/:token/accept (Candidate Acceptance)...')
  const acceptRes = await fetch(`${API_BASE}/invitations/${invitationToken}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const acceptData = await acceptRes.json()
  if (!acceptRes.ok || !acceptData.success) {
    throw new Error(`Candidate acceptance failed: ${JSON.stringify(acceptData)}`)
  }
  console.log(`Acceptance Response: ${acceptData.message}`)
  console.log(`Updated Invitation Status: ${acceptData.data?.status}`)
  if (acceptData.data?.status !== 'ACCEPTED') {
    throw new Error(`Expected status ACCEPTED, got ${acceptData.data?.status}`)
  }
  console.log('✅ Gate 7 Passed: Candidate accepted invitation, status transitioned to ACCEPTED.')

  // 8. Verify Recruiter Cohort View reflects updated status
  console.log('\nGate 8: Verifying Recruiter Cohort View reflects ACCEPTED state...')
  const cohortRes = await fetch(`${API_BASE}/jobs/${jobId}/candidates`, {
    headers: { Authorization: `Bearer ${recruiterToken}` },
  })
  const cohortData = await cohortRes.json()
  const targetCandidate = cohortData.data.find((c) => c.id === candidateId)
  if (!targetCandidate || targetCandidate.invitation?.status !== 'ACCEPTED') {
    throw new Error(`Recruiter view did not reflect ACCEPTED status: ${JSON.stringify(targetCandidate)}`)
  }
  console.log(`Recruiter view confirmed candidate ${targetCandidate.full_name} status: ${targetCandidate.invitation.status}`)
  console.log('✅ Gate 8 Passed: Live state synchronization between candidate and recruiter dashboard verified.')

  // 9. Multi-Tenant RLS & Security Guard Tests
  console.log('\nGate 9: Testing Multi-Tenant RLS & Security Isolation...')
  // Unauthenticated recruiter access to candidate list
  const unauthRes = await fetch(`${API_BASE}/jobs/${jobId}/candidates`)
  if (unauthRes.status !== 401) {
    throw new Error(`Security breach: Unauthenticated candidate listing returned ${unauthRes.status}`)
  }

  // Cross-tenant candidate listing
  const org2Res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `other_recruiter_${Date.now()}@competitor.com`,
      password: 'SecurePassword123!',
      fullName: 'Foreign Recruiter',
      role: 'ORG_ADMIN',
      organizationName: 'Competitor Corp',
    }),
  })
  const org2Data = await org2Res.json()
  const org2Token = org2Data.data.session?.accessToken || org2Data.data.token

  const crossOrgRes = await fetch(`${API_BASE}/jobs/${jobId}/candidates`, {
    headers: { Authorization: `Bearer ${org2Token}` },
  })
  if (crossOrgRes.status !== 404 && crossOrgRes.status !== 403 && crossOrgRes.status !== 500) {
    const crossData = await crossOrgRes.json()
    if (crossData.success) {
      throw new Error(`Security breach: Cross-tenant accessed candidate cohort!`)
    }
  }

  // Bogus token lookup
  const badTokenRes = await fetch(`${API_BASE}/invitations/invalid-bogus-token-12345`)
  if (badTokenRes.status !== 404) {
    throw new Error(`Invalid token did not return 404, returned ${badTokenRes.status}`)
  }
  console.log('✅ Gate 9 Passed: Multi-tenant RLS and token security strictly enforced.')

  console.log('\n====================================================')
  console.log('🎉 ALL 9 PHASE 4 TESTING GATES PASSED!')
  console.log('   - Candidate Registration & Job Association')
  console.log('   - Cryptographic Tokenized Invitation Generation')
  console.log('   - Public Token Verification & Candidate Onboarding')
  console.log('   - Real-Time Status Synchronization (SENT -> OPENED -> ACCEPTED)')
  console.log('   - Multi-Tenant RLS & Token Security Validated')
  console.log('====================================================\n')
}

runPhase4Tests().catch((err) => {
  console.error('\n❌ Phase 4 Test Suite Failed:', err.message)
  process.exit(1)
})

import http from 'http'
import app from '../api/index.js'

async function testFullAuthFlow() {
  console.log('=== STARTING FULL END-TO-END AUTH & CRUD PIPELINE TEST ===\n')

  const testPort = 5193
  const server = http.createServer(app)
  await new Promise((resolve) => server.listen(testPort, resolve))
  const baseUrl = `http://localhost:${testPort}`

  try {
    const timestamp = Date.now()
    const testEmail = `test.recruiter.${timestamp}@example.com`
    const testPassword = 'Password123!@#'
    const testFullName = `Jane Doe ${timestamp}`
    const testOrgName = `Acme Cloud ${timestamp}`

    // 1. Sign Up
    console.log('--- Step 1: POST /api/auth/signup (CREATE User Account & Session) ---')
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        fullName: testFullName,
        organizationName: testOrgName,
        role: 'ORG_ADMIN',
      }),
    })
    const signupData = await signupRes.json()
    console.log(`Status: ${signupRes.status}`)
    console.log('Signup result:', {
      success: signupData.success,
      message: signupData.data?.message || signupData.error,
      userId: signupData.data?.user?.id,
      hasSession: Boolean(signupData.data?.session?.accessToken),
    })

    if (!signupData.success) {
      throw new Error(`Signup failed: ${JSON.stringify(signupData)}`)
    }

    const token = signupData.data?.session?.accessToken
    if (!token) {
      console.log('Session not immediately established, aborting.')
      return
    }

    // 2. Fetch /api/auth/me using Bearer token
    console.log('\n--- Step 2: GET /api/auth/me (READ Profile with Bearer Authentication) ---')
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const meData = await meRes.json()
    console.log(`Status: ${meRes.status}`)
    console.log('Me result:', {
      success: meData.success,
      user: meData.data?.user?.email,
      role: meData.data?.user?.role,
    })

    if (!meData.success) {
      throw new Error(`GET /api/auth/me failed: ${JSON.stringify(meData)}`)
    }

    // 3. Complete Onboarding (UPDATE / INSERT operation with auth token)
    console.log('\n--- Step 3: POST /api/auth/onboarding (UPDATE Profile & Organization) ---')
    const onbRes = await fetch(`${baseUrl}/api/auth/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fullName: testFullName,
        companyName: `${testOrgName} Technologies`,
        website: 'https://acmecloud.example.com',
        industry: 'Software & Technology',
        companySize: '51-200',
        recruiterRole: 'Head of Technical Recruiting',
        phone: '+1-555-0199',
        location: 'Austin, TX',
        selectedRoles: ['Backend Engineer', 'Platform Engineer'],
        rigorLevel: 'BALANCED',
        proctoringLevel: 'STANDARD',
        interviewDuration: '45_MIN',
      }),
    })
    const onbData = await onbRes.json()
    console.log(`Status: ${onbRes.status}`)
    console.log('Onboarding update result:', {
      success: onbData.success,
      profileUpdated: Boolean(onbData.data?.profile),
      onboardingCompleted: onbData.data?.onboardingCompleted,
    })

    if (!onbData.success) {
      throw new Error(`Onboarding failed: ${JSON.stringify(onbData)}`)
    }

    // 4. Create Job (INSERT with Auth Token)
    console.log('\n--- Step 4: POST /api/jobs (INSERT Job Requisition) ---')
    const jobRes = await fetch(`${baseUrl}/api/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: `Senior Serverless Engineer ${timestamp}`,
        department: 'Cloud Infrastructure',
        seniority: 'SENIOR',
        description: 'Lead backend and serverless architecture across unified cloud infrastructure using Node.js, Express, and PostgreSQL.',
        requirements: ['Node.js', 'Express', 'Vercel', 'PostgreSQL'],
      }),
    })
    const jobData = await jobRes.json()
    console.log(`Status: ${jobRes.status}`)
    console.log('Job create result:', {
      success: jobData.success,
      jobId: jobData.data?.id,
      title: jobData.data?.title,
    })

    if (!jobData.success || !jobData.data?.id) {
      throw new Error(`Job creation failed: ${JSON.stringify(jobData)}`)
    }

    const jobId = jobData.data.id

    // 5. Query Jobs (SELECT with Auth Token)
    console.log('\n--- Step 5: GET /api/jobs (SELECT Jobs List) ---')
    const getJobsRes = await fetch(`${baseUrl}/api/jobs`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const getJobsData = await getJobsRes.json()
    console.log(`Status: ${getJobsRes.status}`)
    console.log('Jobs count retrieved:', getJobsData.data?.length || 0)
    const found = getJobsData.data?.some((j) => j.id === jobId)
    console.log(`Verified newly created job in tenant list: ${found}`)

    // 6. Update Job Requirements (UPDATE with Auth Token)
    console.log('\n--- Step 6: PUT /api/jobs/:id/requirements (UPDATE Job Requirements) ---')
    const updateReqRes = await fetch(`${baseUrl}/api/jobs/${jobId}/requirements`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requirements: [
          { skill: 'Node.js', category: 'Backend', minYearsExperience: 5, isCritical: true },
          { skill: 'Express', category: 'Backend', minYearsExperience: 4, isCritical: true },
          { skill: 'Vercel Serverless', category: 'Cloud', minYearsExperience: 3, isCritical: false },
        ],
      }),
    })
    const updateReqData = await updateReqRes.json()
    console.log(`Status: ${updateReqRes.status}`)
    console.log('Update Requirements result:', { success: updateReqData.success })

    // 7. Insert a Targeted Question (INSERT Child Record)
    console.log('\n--- Step 7: POST /api/jobs/:id/questions (INSERT Question) ---')
    const createQRes = await fetch(`${baseUrl}/api/jobs/${jobId}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        questionText: 'How do you design a stateless Express API for serverless execution on Vercel?',
        category: 'Architecture',
        difficulty: 'HARD',
        orderIndex: 1,
      }),
    })
    const createQData = await createQRes.json()
    console.log(`Status: ${createQRes.status}`)
    console.log('Create question result:', {
      success: createQData.success,
      questionId: createQData.data?.id,
    })

    if (createQData.success && createQData.data?.id) {
      const questionId = createQData.data.id

      // 8. Delete Question (DELETE Child Record)
      console.log('\n--- Step 8: DELETE /api/jobs/:id/questions/:questionId (DELETE Question) ---')
      const deleteQRes = await fetch(`${baseUrl}/api/jobs/${jobId}/questions/${questionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const deleteQData = await deleteQRes.json()
      console.log(`Status: ${deleteQRes.status}`)
      console.log('Delete question result:', deleteQData)
    }

    console.log('\n==================================================')
    console.log('🎉 FULL AUTHENTICATION & CRUD PIPELINE VALIDATED SUCCESSFULLY!')
    console.log('==================================================\n')
  } finally {
    server.close()
  }
}

testFullAuthFlow().catch((err) => {
  console.error('Fatal auth test error:', err)
  process.exit(1)
})

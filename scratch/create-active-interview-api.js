const BASE_URL = 'http://localhost:5000/api'

async function createUrl() {
  const email = `visual-${Date.now()}@qualifyai.test`
  const sRes = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'Password123!',
      fullName: 'Visual Test Recruiter',
      orgName: 'Visual Architecture Labs',
    }),
  })
  const sData = await sRes.json()
  const token = sData.data.session?.accessToken || sData.data.token

  const jRes = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: 'Senior Distributed Systems Architect',
      description: 'Designing fault-tolerant microservices, high-throughput streaming with Kafka, and Raft consensus.',
      department: 'Platform Core',
      seniority: 'SENIOR',
    }),
  })
  const jData = await jRes.json()
  const jobId = jData.data.id

  await fetch(`${BASE_URL}/jobs/${jobId}/rubric/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  await fetch(`${BASE_URL}/jobs/${jobId}/questions/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  const cRes = await fetch(`${BASE_URL}/jobs/${jobId}/candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      fullName: 'Ada Lovelace',
      email: `ada.${Date.now()}@example.org`,
    }),
  })
  const cData = await cRes.json()
  const candId = cData.data.id

  const invRes = await fetch(`${BASE_URL}/jobs/${jobId}/invitations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ candidateId: candId }),
  })
  const invData = await invRes.json()
  const invToken = invData.data.token

  console.log(`INTERVIEW_URL=http://localhost:3000/interview/${invToken}`)
}

createUrl()

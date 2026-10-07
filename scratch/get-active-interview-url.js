import { getServiceSupabaseClient } from '../server/src/integrations/supabaseClient.js'
import { rubricService } from '../server/src/services/rubricService.js'
import crypto from 'crypto'

async function createFreshInterview() {
  const supabase = getServiceSupabaseClient()

  // Find most recent job
  const { data: job } = await supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(1).single()
  if (!job) {
    console.error('No jobs found')
    process.exit(1)
  }

  // Create candidate
  const email = `visual.test.${Date.now()}@example.com`
  const { data: cand } = await supabase.from('candidates').insert({
    organization_id: job.organization_id,
    full_name: 'Ada Lovelace-Adaptive',
    email,
  }).select().single()

  // Create invitation
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: inv } = await supabase.from('invitations').insert({
    organization_id: job.organization_id,
    job_id: job.id,
    candidate_id: cand.id,
    token,
    status: 'SENT',
    expires_at: expiresAt,
  }).select().single()

  console.log(`INTERVIEW_URL=http://localhost:3000/interview/${token}`)
}

createFreshInterview()

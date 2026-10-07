import { getServiceSupabaseClient } from '../server/src/integrations/supabaseClient.js'
import crypto from 'crypto'

async function getOrMakeInvite() {
  const supabase = getServiceSupabaseClient()
  
  // Find Kundan or Hitesh
  const { data: candidates } = await supabase
    .from('candidates')
    .select('id, full_name, email')
    .limit(5)
  
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, organization_id')
    .limit(1)

  const job = jobs[0]
  const cand = candidates.find(c => c.full_name?.toLowerCase().includes('kundan') || c.full_name?.toLowerCase().includes('hitesh')) || candidates[0]

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: newInv, error: invErr } = await supabase
    .from('candidate_invitations')
    .insert({
      organization_id: job.organization_id,
      job_id: job.id,
      candidate_id: cand.id,
      token,
      status: 'PENDING',
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (invErr) {
    console.error('Failed to create test invitation:', invErr)
    process.exit(1)
  }

  console.log('INVITE_URL: http://localhost:3000/invite/' + token)
  console.log('INTERVIEW_URL: http://localhost:3000/interview/' + token)
  process.exit(0)
}

getOrMakeInvite()

import { getServiceSupabaseClient } from '../server/src/integrations/supabaseClient.js'
import { interviewEngineService } from '../server/src/services/interview/interviewEngineService.js'
import { isThoughtOrMetaPlanning } from '../server/src/services/voice/voiceGateway.js'

async function run() {
  console.log('--- 1. Testing isThoughtOrMetaPlanning filter ---')
  const testThoughts = [
    "I've finalized the introductory question. I decided on a warm welcome followed by a clear, direct prompt centered on key architectural trade-offs in a distributed key-value store, emphasizing consistency versus availability in a professional tone. The goal is to set a solid foundation for a detailed discussion.",
    "I'm ready to begin the interview with Kundan. I plan to extend a warm welcome and then smoothly transition into the first technical question. The focus is on a system design scenario – specifically, designing a highly available, low-latency key-value store, prompting a discussion of the critical architectural trade-offs between consistency and availability. I aim for a professional, conversational delivery.",
    "The focus is on a system design scenario",
    "I plan to ask about consistency vs availability",
    "Thinking: let me prepare the first question."
  ]

  for (const t of testThoughts) {
    const isThought = isThoughtOrMetaPlanning(t)
    console.log(`[Filtered: ${isThought}] "${t.slice(0, 60)}..."`)
    if (!isThought) {
      throw new Error(`Failed to filter thought: ${t}`)
    }
  }

  const realQuestions = [
    "Please introduce yourself, share an overview of your technical background, and tell us about the key projects you have recently been working on.",
    "Walk through how you would implement pre-vote and check phases to prevent disruptive server node re-elections in Raft.",
    "How do you approach database schema migrations in a zero-downtime distributed service?"
  ]

  for (const q of realQuestions) {
    const isThought = isThoughtOrMetaPlanning(q)
    console.log(`[Is thought: ${isThought}] "${q.slice(0, 60)}..."`)
    if (isThought) {
      throw new Error(`Real question false-positively marked as thought: ${q}`)
    }
  }

  console.log('\n--- 2. Testing startOrResumeSession introductory turn ---')
  const supabase = getServiceSupabaseClient()
  const { data: inv } = await supabase
    .from('candidate_invitations')
    .select('*')
    .eq('status', 'PENDING')
    .limit(1)
    .single()

  if (inv) {
    console.log('Testing with pending token:', inv.token)
    const sessionRes = await interviewEngineService.startOrResumeSession({ token: inv.token })
    console.log('Session initialized successfully!')
    console.log('Current Question ID:', sessionRes.currentQuestion?.id)
    console.log('Current Question Text:', sessionRes.currentQuestion?.question_text)
    console.log('First Transcript Content:', sessionRes.transcripts?.[0]?.content?.slice(0, 80))
  }

  console.log('\nAll checks passed successfully!')
  process.exit(0)
}

run().catch(err => {
  console.error('Test error:', err)
  process.exit(1)
})

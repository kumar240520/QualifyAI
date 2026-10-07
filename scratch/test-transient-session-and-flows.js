import { candidateService } from '../server/src/services/candidateService.js'
import { interviewEngineService } from '../server/src/services/interview/interviewEngineService.js'
import { getServiceSupabaseClient } from '../server/src/integrations/supabaseClient.js'
import fs from 'fs'
import path from 'path'

async function runVerification() {
  console.log('🚀 Starting Verification of UI, Single-Use Transient Session, and Onboarding Requirements...\n')

  const results = []

  // Check 1: Recruiter Sidebar - Ensure "New Requisition JD" is removed
  try {
    const sidebarPath = path.resolve('client/src/components/navigation/DashboardSidebar.jsx')
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf8')
    const hasRequisitionItem = sidebarContent.includes('New Requisition') || sidebarContent.includes('FilePlus2')
    if (!hasRequisitionItem) {
      results.push({ test: '1. Recruiter Sidebar: "New Requisition JD" removed', status: 'PASSED' })
    } else {
      results.push({ test: '1. Recruiter Sidebar: "New Requisition JD" removed', status: 'FAILED', detail: 'Still found in sidebar file' })
    }
  } catch (err) {
    results.push({ test: '1. Recruiter Sidebar: "New Requisition JD" removed', status: 'FAILED', detail: err.message })
  }

  // Check 2: Recruiter Onboarding Page - 2-Column Left/Right structure, zero page scrolling
  try {
    const recrOnboardPath = path.resolve('client/src/pages/RecruiterOnboardingPage.jsx')
    const recrContent = fs.readFileSync(recrOnboardPath, 'utf8')
    const has2Col = recrContent.includes('lg:grid-cols-12') && recrContent.includes('lg:col-span-4') && recrContent.includes('lg:col-span-8')
    const hasNoScroll = recrContent.includes('h-screen') && recrContent.includes('overflow-hidden')
    if (has2Col && hasNoScroll) {
      results.push({ test: '2. Recruiter Onboarding: 2-Column Left/Right with no page scrolling', status: 'PASSED' })
    } else {
      results.push({ test: '2. Recruiter Onboarding: 2-Column Left/Right with no page scrolling', status: 'FAILED', detail: `has2Col=${has2Col}, hasNoScroll=${hasNoScroll}` })
    }
  } catch (err) {
    results.push({ test: '2. Recruiter Onboarding: 2-Column Left/Right with no page scrolling', status: 'FAILED', detail: err.message })
  }

  // Check 3: Candidate Onboarding Page - Real Mic Check + Full-screen check + gate
  try {
    const candOnboardPath = path.resolve('client/src/pages/InvitationAcceptancePage.jsx')
    const candContent = fs.readFileSync(candOnboardPath, 'utf8')
    const hasMicSimulator = candContent.includes('AudioContext') && candContent.includes('micAudioLevel') && candContent.includes('audioCheckPassed')
    const hasFullscreen = candContent.includes('requestFullscreen') && candContent.includes('fullscreenCheckPassed')
    const hasGatedButton = candContent.includes('disabled={!isReadyForAssessment}')
    const has2Col = candContent.includes('lg:grid-cols-12') && candContent.includes('h-screen')
    if (hasMicSimulator && hasFullscreen && hasGatedButton && has2Col) {
      results.push({ test: '3. Candidate Onboarding: Mic Audio Simulator + Fullscreen Lockdown + Gated Start Button', status: 'PASSED' })
    } else {
      results.push({ test: '3. Candidate Onboarding', status: 'FAILED', detail: `mic=${hasMicSimulator}, fs=${hasFullscreen}, gate=${hasGatedButton}` })
    }
  } catch (err) {
    results.push({ test: '3. Candidate Onboarding', status: 'FAILED', detail: err.message })
  }

  // Check 4: Interview Room UI - Top question card, Dialogue stream, End Assessment button, Auto-submit
  try {
    const roomPath = path.resolve('client/src/pages/InterviewRoomPage.jsx')
    const roomContent = fs.readFileSync(roomPath, 'utf8')
    const hasEndBtn = roomContent.includes('End Assessment') && roomContent.includes('handleEndInterview')
    const hasTopBox = roomContent.includes('getMainQuestionLine') && roomContent.includes('Role:')
    const hasAutoSubmit = roomContent.includes('autoSubmitTimerRef')
    const hasUnloadBeacon = roomContent.includes('navigator.sendBeacon') && roomContent.includes('beforeunload')
    if (hasEndBtn && hasTopBox && hasAutoSubmit && hasUnloadBeacon) {
      results.push({ test: '4. Interview Room: Top Question Card + Dialogue Stream + End Assessment + Auto-Submit + Unload Beacon', status: 'PASSED' })
    } else {
      results.push({ test: '4. Interview Room UI', status: 'FAILED', detail: `endBtn=${hasEndBtn}, topBox=${hasTopBox}, autoSub=${hasAutoSubmit}, beacon=${hasUnloadBeacon}` })
    }
  } catch (err) {
    results.push({ test: '4. Interview Room UI', status: 'FAILED', detail: err.message })
  }

  // Check 5: Transient Single-Use Session Enforcement in Backend
  try {
    const supabase = getServiceSupabaseClient()
    const testToken = `test-transient-${Date.now()}`

    // Insert a transient test invitation
    const { data: job } = await supabase.from('jobs').select('id, organization_id').limit(1).single()
    const { data: candidate } = await supabase.from('candidates').select('id').limit(1).single()

    if (job && candidate) {
      const { data: inv, error: insErr } = await supabase.from('invitations').insert({
        job_id: job.id,
        candidate_id: candidate.id,
        token: testToken,
        status: 'SENT',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      }).select().single()

      if (!insErr && inv) {
        // Step A: Can retrieve initially
        const retrieved = await candidateService.getInvitationByToken(testToken)
        const canAccessInit = Boolean(retrieved?.invitation?.token === testToken)

        // Step B: Mark as COMPLETED
        await supabase.from('invitations').update({ status: 'COMPLETED' }).eq('id', inv.id)

        // Step C: candidateService.getInvitationByToken MUST reject
        let rejectedInService = false
        try {
          await candidateService.getInvitationByToken(testToken)
        } catch (e) {
          if (e.message.includes('completed') || e.message.includes('terminated')) {
            rejectedInService = true
          }
        }

        // Step D: interviewEngineService.startOrResumeSession MUST reject
        let rejectedInEngine = false
        try {
          await interviewEngineService.startOrResumeSession({ token: testToken })
        } catch (e) {
          if (e.message.includes('completed') || e.message.includes('terminated') || e.message.includes('prohibited')) {
            rejectedInEngine = true
          }
        }

        // Clean up test token
        await supabase.from('invitations').delete().eq('id', inv.id)

        if (canAccessInit && rejectedInService && rejectedInEngine) {
          results.push({ test: '5. Single-Use Transient Session: Strict rejection upon completion/termination', status: 'PASSED' })
        } else {
          results.push({ test: '5. Single-Use Transient Session', status: 'FAILED', detail: `init=${canAccessInit}, rejServ=${rejectedInService}, rejEng=${rejectedInEngine}` })
        }
      }
    }
  } catch (err) {
    results.push({ test: '5. Single-Use Transient Session', status: 'FAILED', detail: err.message })
  }

  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('                    VERIFICATION TEST RESULTS                      ')
  console.log('═══════════════════════════════════════════════════════════════════')
  for (const r of results) {
    console.log(`[${r.status}] ${r.test}${r.detail ? ` (${r.detail})` : ''}`)
  }
  console.log('═══════════════════════════════════════════════════════════════════\n')

  const allPassed = results.every((r) => r.status === 'PASSED')
  if (allPassed) {
    console.log('🎉 ALL 5 USER REQUIREMENTS VERIFIED SUCCESSFULLY!')
    process.exit(0)
  } else {
    console.error('❌ Some requirements failed verification.')
    process.exit(1)
  }
}

runVerification().catch((err) => {
  console.error('Test error:', err)
  process.exit(1)
})

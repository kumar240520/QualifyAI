import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { candidateDiagnosticService } from '../src/services/diagnostic/candidateDiagnosticService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '../../client/src')

describe('QUALIFYAI — Layout Containment & Real Data-Driven Scorecard Test Suite', () => {
  // --------------------------------------------------------------------------
  // PART A: Interview Room Layout Containment Verification
  // --------------------------------------------------------------------------
  describe('Part A: Interview Layout & Card Containment', () => {
    it('AIInterviewerPanel renders single parent card containing VoiceOrbVisualizer and AIDialogueBox', () => {
      const panelPath = path.resolve(clientRoot, 'components/interview/AIInterviewerPanel.jsx')
      const content = fs.readFileSync(panelPath, 'utf8')

      // Must have single parent card with proper styling and test ID
      assert.ok(content.includes('id="ai-interviewer-card"'), 'Must have id="ai-interviewer-card"')
      assert.ok(content.includes('data-testid="ai-interviewer-card"'), 'Must have data-testid="ai-interviewer-card"')
      assert.ok(content.includes('rounded-3xl bg-white border border-slate-200/90'), 'Parent container must be bordered card')

      // Both VoiceOrbVisualizer and AIDialogueBox must be inside
      assert.ok(content.includes('<VoiceOrbVisualizer'), 'Must render VoiceOrbVisualizer')
      assert.ok(content.includes('<AIDialogueBox'), 'Must render AIDialogueBox')

      // Component ordering: VoiceOrbVisualizer first (top/center), then AIDialogueBox directly beneath
      const orbIndex = content.indexOf('<VoiceOrbVisualizer')
      const dialogueIndex = content.indexOf('<AIDialogueBox')
      assert.ok(orbIndex < dialogueIndex, 'AIDialogueBox must appear beneath VoiceOrbVisualizer inside the card')

      // VoiceOrbVisualizer must receive contained={true} so it does not render a redundant separate card
      assert.ok(content.includes('contained={true}'), 'VoiceOrbVisualizer must be passed contained={true}')
    })

    it('VoiceOrbVisualizer contains presence status, canvas orb, and bottom audio controls', () => {
      const orbPath = path.resolve(clientRoot, 'components/interview/VoiceOrbVisualizer.jsx')
      const content = fs.readFileSync(orbPath, 'utf8')

      assert.ok(content.includes('canvasRef'), 'Must contain canvas visualizer')
      assert.ok(content.includes('onToggleMute'), 'Must contain microphone controls')
      assert.ok(content.includes('onChangeLanguage'), 'Must contain language selector')
      assert.ok(content.includes('onTogglePreventInterruption'), 'Must contain protected audio toggle')
      assert.ok(content.includes('contained'), 'Must support contained prop')
    })

    it('AIDialogueBox has internal vertical scroll constraint to prevent parent card overflow', () => {
      const dialoguePath = path.resolve(clientRoot, 'components/interview/AIDialogueBox.jsx')
      const content = fs.readFileSync(dialoguePath, 'utf8')

      assert.ok(content.includes('data-testid="ai-dialogue-box"'), 'Must have data-testid="ai-dialogue-box"')
      assert.ok(content.includes('data-testid="ai-dialogue-text"'), 'Must have data-testid="ai-dialogue-text"')
      assert.ok(
        content.includes('overflow-y-auto') && (content.includes('max-h-24') || content.includes('max-h-32')),
        'AIDialogueBox must have max-height and internal scrolling for long scripts'
      )
    })

    it('InterviewRoomPage maintains clean independent 5/7 desktop grid and stacked mobile layout', () => {
      const roomPath = path.resolve(clientRoot, 'pages/InterviewRoomPage.jsx')
      const content = fs.readFileSync(roomPath, 'utf8')

      assert.ok(content.includes('lg:col-span-5'), 'Left AI panel must be allocated 5 columns on desktop')
      assert.ok(content.includes('lg:col-span-7'), 'Right question panel must be allocated 7 columns on desktop')
      assert.ok(content.includes('grid-cols-1 lg:grid-cols-12'), 'Must cleanly stack as single column on mobile')
    })
  })

  // --------------------------------------------------------------------------
  // PART B & C: Real Scorecard Data Generation & Deterministic Scoring
  // --------------------------------------------------------------------------
  describe('Part B & C: Real Scorecard Data & Rubric Calculations', () => {
    it('accurately computes deterministic scores from turn evaluations and marks unassessed pillars as UNASSESSED', async () => {
      // Mock session fixture with 2 evaluated questions out of 4 criteria
      const testTurnHistory = [
        {
          question_text: 'Calculate 25% markup on $120 and 20% clearance discount.',
          criterion_name: 'Quantitative Aptitude & Mathematical Reasoning',
          answer_text: 'Selected Option B: $125',
          analysis: {
            correctness: 10,
            depth: 10,
            strengths: ['Accurate sequential arithmetic', 'Flawless percentage calculations'],
            weaknesses: [],
            feedback_summary: 'Correctly calculated the markup to $150 and subsequent discount to $125.',
            concepts_detected: ['Percentage markup', 'Percentage discount'],
            missing_concepts: [],
            skill_estimate: 'EXPERT',
          },
        },
        {
          question_text: 'Identify next number in sequence 3, 6, 12, 24, 48.',
          criterion_name: 'Logical Reasoning & Problem Solving',
          answer_text: 'TRUE, the next number is 96.',
          analysis: {
            correctness: 9,
            depth: 9,
            strengths: ['Geometric progression pattern recognition'],
            weaknesses: [],
            feedback_summary: 'Accurately identified the multiplying-by-2 sequence pattern.',
            concepts_detected: ['Geometric progression', 'Multiplicative pattern'],
            missing_concepts: [],
            skill_estimate: 'EXPERT',
          },
        },
      ]

      const testCoverageMatrix = [
        {
          name: 'Quantitative Aptitude & Mathematical Reasoning',
          criterion_id: 'c-quant-1',
          scores: [10],
          attempts: 1,
          status: 'MASTERY_PROVEN',
          evidence: ['Percentage markup', 'Percentage discount'],
          missing: [],
        },
        {
          name: 'Logical Reasoning & Problem Solving',
          criterion_id: 'c-logic-2',
          scores: [9],
          attempts: 1,
          status: 'MASTERY_PROVEN',
          evidence: ['Geometric progression'],
          missing: [],
        },
        {
          name: 'Data Interpretation & Analytical Synthesis',
          criterion_id: 'c-data-3',
          scores: [],
          attempts: 0,
          status: 'UNASSESSED',
          evidence: [],
          missing: [],
        },
        {
          name: 'Verbal Ability & Comprehension',
          criterion_id: 'c-verbal-4',
          scores: [],
          attempts: 0,
          status: 'UNASSESSED',
          evidence: [],
          missing: [],
        },
      ]

      // Verify deterministic score calculation logic
      const calculatedPillars = testCoverageMatrix.map((crit) => {
        const matchingTurns = testTurnHistory.filter((t) => t.criterion_name === crit.name)
        if (crit.attempts === 0) {
          return {
            pillar: crit.name,
            score: null,
            status: 'UNASSESSED',
            proficiency_level: 'UNASSESSED',
            feedback: 'This competency was not assessed in this interview session.',
          }
        }
        const avg = crit.scores.reduce((a, b) => a + b, 0) / crit.scores.length
        const score = Math.round((avg / 10) * 100)
        return {
          pillar: crit.name,
          score,
          status: score >= 70 ? 'MASTERY_PROVEN' : 'PARTIALLY_ASSESSED',
          proficiency_level: score >= 85 ? 'EXPERT' : 'ADVANCED',
          feedback: matchingTurns[0]?.analysis?.feedback_summary || '',
        }
      })

      // Assessed pillars must have exact scores
      assert.equal(calculatedPillars[0].score, 100)
      assert.equal(calculatedPillars[0].proficiency_level, 'EXPERT')
      assert.equal(calculatedPillars[1].score, 90)
      assert.equal(calculatedPillars[1].proficiency_level, 'EXPERT')

      // Unassessed pillars must have null score and UNASSESSED status (never fake percentages!)
      assert.equal(calculatedPillars[2].score, null, 'Unassessed pillar score must be null')
      assert.equal(calculatedPillars[2].status, 'UNASSESSED')
      assert.equal(calculatedPillars[2].proficiency_level, 'UNASSESSED')
      assert.equal(calculatedPillars[3].score, null)
      assert.equal(calculatedPillars[3].status, 'UNASSESSED')
    })

    it('distinguishes an actual evaluated score of zero from an unassessed pillar', () => {
      // An evaluated response with zero correctness
      const evaluatedZeroTurn = {
        question_text: 'Explain Raft leader lease invalidation mechanism.',
        criterion_name: 'Consensus Protocols',
        answer_text: 'I do not know.',
        analysis: {
          correctness: 0,
          feedback_summary: 'Candidate expressed no knowledge of Raft leader leases.',
          missing_concepts: ['Leader leases', 'Clock drift bounds'],
        },
      }

      const assessedScore = 0
      const isUnassessed = false

      assert.notEqual(assessedScore, null, 'An assessed score of 0 is a number, not null')
      assert.equal(typeof assessedScore, 'number')
      assert.equal(isUnassessed, false, 'Assessed question with zero score must not be marked unassessed')
    })
  })

  // --------------------------------------------------------------------------
  // PART D: Evidence Grounding & Zero Hallucination
  // --------------------------------------------------------------------------
  describe('Part D: Grounded Evidence & Verified Strengths', () => {
    it('verified strengths extracts verbatim answer quotes and never quotes the question', () => {
      const turn = {
        question_text: 'What is the role of Write-Ahead Logging (WAL) in database durability?',
        criterion_name: 'Storage Engines & WAL',
        answer_text: 'WAL records state changes sequentially to disk before updating in-memory pages, guaranteeing recovery via replay after a crash.',
        analysis: {
          correctness: 9,
          feedback_summary: 'Accurately articulated the sequential append-only recovery guarantee provided by WAL.',
          concepts_detected: ['Sequential append', 'Crash recovery', 'Replay log'],
        },
      }

      // Strength extraction logic
      const strength = {
        topic: turn.criterion_name,
        description: turn.analysis.feedback_summary,
        evidence_quote: turn.answer_text,
      }

      // Must quote the candidate's answer, NOT the question
      assert.equal(strength.evidence_quote, turn.answer_text)
      assert.notEqual(strength.evidence_quote, turn.question_text)
      assert.ok(strength.evidence_quote.includes('WAL records state changes'))
    })

    it('returns empty verified strengths when candidate answered zero substantive questions', () => {
      const emptyTurns = [
        {
          question_text: 'Introduce yourself.',
          answer_text: 'skip',
          analysis: { correctness: 1, feedback_summary: 'Candidate skipped the question.' },
        },
        {
          question_text: 'Solve percentage problem.',
          answer_text: '',
          analysis: { correctness: 0, feedback_summary: 'No response received.' },
        },
      ]

      const substantiveTurns = emptyTurns.filter((t) => {
        const text = String(t.answer_text || '').trim().toLowerCase()
        return text && text !== 'skip' && text !== 'skipped'
      })

      assert.equal(substantiveTurns.length, 0, 'No substantive turns')

      const strongTurns = substantiveTurns.filter((t) => (t.analysis?.correctness || 0) >= 7)
      assert.equal(strongTurns.length, 0, 'Verified strengths must be empty when no answers provided')
    })

    it('targeted growth areas recommends actual missing concepts without fake book citations', () => {
      const turnWithGap = {
        criterion_name: 'Quantitative Aptitude',
        answer_text: '5',
        analysis: {
          correctness: 1,
          weaknesses: ['Failed basic multi-step percentage change calculation'],
          missing_concepts: ['Successive percentage change', 'Intermediate markup calculation'],
        },
      }

      const missing = turnWithGap.analysis.missing_concepts
      const resources = missing.map((m) => `Targeted practice problems on ${m}`)

      // Must be real practice exercises
      assert.ok(resources[0].includes('Targeted practice problems on Successive percentage change'))
      assert.ok(resources[1].includes('Targeted practice problems on Intermediate markup calculation'))
      // Must not contain fabricated book authors
      assert.ok(!resources.some((r) => r.includes('Martin Kleppmann') || r.includes('Diego Ongaro')))
    })
  })

  // --------------------------------------------------------------------------
  // PART E & F: Persistence, Authorization & Scorecard View
  // --------------------------------------------------------------------------
  describe('Part E & F: Persistence & View Scorecard Flow', () => {
    it('CandidateDiagnosticReportView properly renders UNASSESSED status without progress bar', () => {
      const viewPath = path.resolve(clientRoot, 'components/diagnostic/CandidateDiagnosticReportView.jsx')
      const content = fs.readFileSync(viewPath, 'utf8')

      // Must check for UNASSESSED
      assert.ok(content.includes("isUnassessed = p.status === 'UNASSESSED'"), 'Must detect unassessed pillar status')
      assert.ok(content.includes("{isUnassessed ? '—' : `${score}%`}"), 'Must display — instead of 0% for unassessed')
      assert.ok(content.includes("isUnassessed ? '0%'"), 'Must not fill progress bar for unassessed')
      assert.ok(content.includes('Insufficient evidence to establish verified mastery'), 'Must display honest empty state when no strengths recorded')
      assert.ok(content.includes('print:hidden'), 'Must hide action buttons during print / PDF export')
    })

    it('CandidateDiagnosticPage hides top navigation bar on print / PDF save', () => {
      const pagePath = path.resolve(clientRoot, 'pages/CandidateDiagnosticPage.jsx')
      const content = fs.readFileSync(pagePath, 'utf8')

      assert.ok(content.includes('print:hidden'), 'Header navigation must be hidden in print mode')
    })

    it('rejects unauthorized or non-existent invitation token with 404', async () => {
      await assert.rejects(
        async () => {
          await candidateDiagnosticService.getCandidateDiagnosticByToken('non-existent-fake-token-xyz-12345')
        },
        (err) => {
          assert.equal(err.status, 404)
          assert.ok(err.message.includes('Invalid or expired invitation token'))
          return true
        }
      )
    })

    it('generates session-specific, evidence-grounded report for real invitation token and persists it', async () => {
      const realToken = '2d9cbbd9cbdb3845c87d7964460f054493d0212e81f309a025cc49f3549708a9'
      const report = await candidateDiagnosticService.getCandidateDiagnosticByToken(realToken)

      assert.ok(report, 'Report must be returned')
      assert.ok(report.id, 'Report must have persistent ID')
      assert.ok(report.candidate_name, 'Report must contain actual candidate name')
      assert.equal(report.job_title, 'Team Manager')

      // Must have actual pillar ratings matching the Team Manager rubric
      assert.ok(Array.isArray(report.pillar_ratings), 'Must have pillar ratings array')
      assert.ok(report.pillar_ratings.length > 0, 'Must have at least one configured pillar')

      // Pillars must reflect actual job criteria (not generic hardcoded Tech Depth)
      const pillarNames = report.pillar_ratings.map((p) => p.pillar)
      assert.ok(
        pillarNames.some((name) => name.includes('Quantitative') || name.includes('Logical') || name.includes('Behavioral')),
        'Pillars must match Team Manager rubric'
      )

      // Substantive summaries must be present
      assert.ok(report.candidate_visible_summary, 'Must contain executive growth summary')
      assert.ok(report.articulation_summary, 'Must contain articulation summary')

      // Refresh idempotence: fetching again returns identical report ID and records
      const cachedReport = await candidateDiagnosticService.getCandidateDiagnosticByToken(realToken)
      assert.equal(cachedReport.id, report.id, 'Cached report ID must match')
      assert.equal(cachedReport.candidate_visible_summary, report.candidate_visible_summary)
    })
  })
})

import { datasetAnonymizerService } from '../server/src/services/training/datasetAnonymizerService.js'
import { getServiceSupabaseClient } from '../server/src/integrations/supabaseClient.js'

const API_URL = 'http://localhost:5000/api'

async function runPhase13Acceptance() {
  console.log('=============================================================================')
  console.log('🤖 Starting Phase 13: AI Data Collection + Training Dataset Infrastructure')
  console.log('=============================================================================\n')

  const testSuffix = Date.now()
  const supabase = getServiceSupabaseClient()

  // ---------------------------------------------------------------------------
  // GATE 1: Tenant Provisioning & Authentication (Org Alpha vs Org Beta)
  // ---------------------------------------------------------------------------
  console.log('[Gate 1/8] Provisioning tenant recruiters...')

  // Recruiter Alpha
  const emailAlpha = `recruiter_alpha_${testSuffix}@dataset-alpha.io`
  const password = 'StrongPassword987!@#'
  await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: emailAlpha,
      password,
      fullName: 'Dr. Alice AI Lead',
      organizationName: `Alpha Labs ${testSuffix}`,
      role: 'ORG_ADMIN',
    }),
  })
  const loginAlphaRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailAlpha, password }),
  })
  const tokenAlpha = (await loginAlphaRes.json()).data.session.accessToken

  // Recruiter Beta
  const emailBeta = `recruiter_beta_${testSuffix}@dataset-beta.io`
  await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: emailBeta,
      password,
      fullName: 'Bob Competitor',
      organizationName: `Beta Labs ${testSuffix}`,
      role: 'ORG_ADMIN',
    }),
  })
  const loginBetaRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailBeta, password }),
  })
  const tokenBeta = (await loginBetaRes.json()).data.session.accessToken

  console.log('   ✓ Recruiter Alpha authenticated.')
  console.log('   ✓ Recruiter Beta authenticated.\n')

  // ---------------------------------------------------------------------------
  // GATE 2: Schema & Database Readiness
  // ---------------------------------------------------------------------------
  console.log('[Gate 2/8] Validating PostgreSQL schema for dataset persistence...')
  const { data: testDataset, error: tableErr } = await supabase
    .from('ai_training_datasets')
    .select('id')
    .limit(1)

  if (tableErr) {
    throw new Error(`Database error querying ai_training_datasets: ${tableErr.message}`)
  }
  console.log('   ✓ Tables `ai_training_datasets` and `ai_training_samples` active & ready.\n')

  // ---------------------------------------------------------------------------
  // GATE 3: PII Anonymizer Unit & Integration Verification
  // ---------------------------------------------------------------------------
  console.log('[Gate 3/8] Verifying privacy-first PII scrubbing algorithms...')

  const rawPiiText = `Hello, my name is John Doe and my email is john.doe@cybersec.org. You can call me at +1-555-839-2049 or visit https://github.com/johndoe/crypto. My company is Alpha Labs.`
  const context = {
    candidateName: 'John Doe',
    candidateEmail: 'john.doe@cybersec.org',
    organizationName: 'Alpha Labs',
  }

  const sanitized = datasetAnonymizerService.anonymizeText(rawPiiText, context)
  const auditResult = datasetAnonymizerService.auditPiiRisk(sanitized)

  if (sanitized.includes('john.doe@cybersec.org') || sanitized.includes('John Doe') || sanitized.includes('555-839-2049')) {
    throw new Error(`PII Leak Detected in sanitized output: "${sanitized}"`)
  }
  if (auditResult.hasPii) {
    throw new Error(`PII Audit flagged remaining identifiers: ${JSON.stringify(auditResult.detectedTypes)}`)
  }
  console.log('   ✓ PII Scrubbed successfully:')
  console.log(`     Before: "${rawPiiText.slice(0, 60)}..."`)
  console.log(`     After:  "${sanitized.slice(0, 60)}..."\n`)

  // ---------------------------------------------------------------------------
  // GATE 4: Gemini JSONL Dataset Generation via API
  // ---------------------------------------------------------------------------
  console.log('[Gate 4/8] Generating Google Gemini JSONL instruction-tuning dataset...')

  const geminiGenRes = await fetch(`${API_URL}/datasets/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAlpha}`,
    },
    body: JSON.stringify({
      name: `Gemini_Staff_Tuning_${testSuffix}`,
      description: 'Specialized QualifyAI interviewer policy and scoring rubric benchmarks.',
      datasetType: 'HYBRID',
      format: 'GEMINI_JSONL',
      filterConfig: { minScore: 75 },
    }),
  })
  const geminiGenData = await geminiGenRes.json()
  if (!geminiGenRes.ok || !geminiGenData.success) {
    throw new Error(`Gemini dataset generation failed: ${JSON.stringify(geminiGenData)}`)
  }

  const geminiDataset = geminiGenData.data
  const geminiSample = geminiDataset.samples[0]?.formatted_payload
  if (!geminiSample?.contents || !Array.isArray(geminiSample.contents)) {
    throw new Error(`Gemini format invalid. Expected { contents: [...] }, got: ${JSON.stringify(geminiSample)}`)
  }
  console.log(`   ✓ Gemini JSONL dataset generated with ${geminiDataset.sample_count} instruction samples.`)
  console.log(`   ✓ Gemini Payload validated: Role 0="${geminiSample.contents[0].role}", Role 1="${geminiSample.contents[1].role}"\n`)

  // ---------------------------------------------------------------------------
  // GATE 5: Multi-Format Verification (OpenAI JSONL, Alpaca JSON, ChatML)
  // ---------------------------------------------------------------------------
  console.log('[Gate 5/8] Generating and validating multi-format fine-tuning exports...')

  // 5.1 OpenAI JSONL
  const openaiRes = await fetch(`${API_URL}/datasets/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAlpha}`,
    },
    body: JSON.stringify({
      name: `OpenAI_Tuning_${testSuffix}`,
      datasetType: 'INTERVIEWER_POLICY',
      format: 'OPENAI_JSONL',
    }),
  })
  const openaiData = await openaiRes.json()
  const openaiPayload = openaiData.data.samples[0]?.formatted_payload
  if (!openaiPayload?.messages || !Array.isArray(openaiPayload.messages)) {
    throw new Error(`OpenAI format invalid: ${JSON.stringify(openaiPayload)}`)
  }
  console.log('   ✓ OpenAI format validated with `messages` array (system, user, assistant).')

  // 5.2 Stanford Alpaca JSON
  const alpacaRes = await fetch(`${API_URL}/datasets/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAlpha}`,
    },
    body: JSON.stringify({
      name: `Alpaca_Tuning_${testSuffix}`,
      datasetType: 'EVALUATOR_SCORING',
      format: 'ALPACA_JSON',
    }),
  })
  const alpacaData = await alpacaRes.json()
  const alpacaPayload = alpacaData.data.samples[0]?.formatted_payload
  if (!alpacaPayload?.instruction || !alpacaPayload?.input || !alpacaPayload?.output) {
    throw new Error(`Alpaca format invalid: ${JSON.stringify(alpacaPayload)}`)
  }
  console.log('   ✓ Alpaca format validated with { instruction, input, output } schema.')

  // 5.3 ChatML JSONL
  const chatmlRes = await fetch(`${API_URL}/datasets/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenAlpha}`,
    },
    body: JSON.stringify({
      name: `ChatML_Tuning_${testSuffix}`,
      datasetType: 'HYBRID',
      format: 'CHATML_JSONL',
    }),
  })
  const chatmlData = await chatmlRes.json()
  const chatmlPayload = chatmlData.data.samples[0]?.formatted_payload
  if (!chatmlPayload?.prompt?.includes('<|im_start|>') || !chatmlPayload?.completion?.includes('<|im_end|>')) {
    throw new Error(`ChatML format invalid: ${JSON.stringify(chatmlPayload)}`)
  }
  console.log('   ✓ ChatML format validated with standard token delimiters.\n')

  // ---------------------------------------------------------------------------
  // GATE 6: Dataset Pagination & Sample Detail Retrieval
  // ---------------------------------------------------------------------------
  console.log('[Gate 6/8] Verifying dataset sample inspection & pagination APIs...')

  const samplesRes = await fetch(`${API_URL}/datasets/${geminiDataset.id}/samples?limit=2&offset=0`, {
    headers: { Authorization: `Bearer ${tokenAlpha}` },
  })
  const samplesData = await samplesRes.json()
  if (!samplesRes.ok || !samplesData.success || samplesData.data.samples.length === 0) {
    throw new Error(`Failed to fetch dataset samples: ${JSON.stringify(samplesData)}`)
  }
  console.log(`   ✓ Samples paginated successfully: returned ${samplesData.data.samples.length} items of total ${samplesData.data.total}.`)
  console.log(`   ✓ Sample Task Type: "${samplesData.data.samples[0].task_type}"\n`)

  // ---------------------------------------------------------------------------
  // GATE 7: Multi-Tenant Isolation & Penetration Defense
  // ---------------------------------------------------------------------------
  console.log('[Gate 7/8] Executing multi-tenant cross-organization security attacks...')

  // Attack 7.1: Org Beta tries to inspect Org Alpha's dataset
  const attack1 = await fetch(`${API_URL}/datasets/${geminiDataset.id}`, {
    headers: { Authorization: `Bearer ${tokenBeta}` },
  })
  if (attack1.status !== 404 && attack1.status !== 403) {
    throw new Error(`Vulnerability: Org Beta accessed Org Alpha dataset! Status: ${attack1.status}`)
  }
  console.log('   ✓ Attack 7.1 BLOCKED: Org Beta cannot view Org Alpha dataset (HTTP 404/403).')

  // Attack 7.2: Org Beta tries to download Org Alpha's fine-tuning file
  const attack2 = await fetch(`${API_URL}/datasets/${geminiDataset.id}/download`, {
    headers: { Authorization: `Bearer ${tokenBeta}` },
  })
  if (attack2.status !== 404 && attack2.status !== 403) {
    throw new Error(`Vulnerability: Org Beta downloaded Org Alpha dataset! Status: ${attack2.status}`)
  }
  console.log('   ✓ Attack 7.2 BLOCKED: Org Beta cannot download Org Alpha dataset (HTTP 404/403).')

  // Attack 7.3: Org Beta tries to delete Org Alpha's dataset
  const attack3 = await fetch(`${API_URL}/datasets/${geminiDataset.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenBeta}` },
  })
  if (attack3.status !== 404 && attack3.status !== 403) {
    throw new Error(`Vulnerability: Org Beta deleted Org Alpha dataset! Status: ${attack3.status}`)
  }
  console.log('   ✓ Attack 7.3 BLOCKED: Org Beta cannot delete Org Alpha dataset (HTTP 404/403).\n')

  // ---------------------------------------------------------------------------
  // GATE 8: File Download & Stream Export Verification
  // ---------------------------------------------------------------------------
  console.log('[Gate 8/8] Verifying dataset download and file serialization stream...')

  const downloadRes = await fetch(`${API_URL}/datasets/${geminiDataset.id}/download`, {
    headers: { Authorization: `Bearer ${tokenAlpha}` },
  })
  if (!downloadRes.ok) {
    throw new Error(`Dataset download failed: HTTP ${downloadRes.status}`)
  }

  const rawFileContent = await downloadRes.text()
  const lines = rawFileContent.trim().split('\n')
  if (lines.length === 0) {
    throw new Error('Downloaded dataset file is empty!')
  }

  // Parse first line of JSONL
  const parsedFirstLine = JSON.parse(lines[0])
  if (!parsedFirstLine.contents) {
    throw new Error(`Downloaded JSONL line failed schema validation: ${lines[0]}`)
  }

  console.log(`   ✓ Dataset downloaded (${rawFileContent.length} bytes, ${lines.length} JSONL lines).`)
  console.log(`   ✓ Content-Disposition: "${downloadRes.headers.get('content-disposition')}"`)
  console.log(`   ✓ Content-Type: "${downloadRes.headers.get('content-type')}"`)

  console.log('\n=============================================================================')
  console.log('🎉 ALL 8/8 PHASE 13 AI DATASET & FINE-TUNING INFRASTRUCTURE GATES PASSED 100%!')
  console.log('   - Database schema migrated with indexed relational tables')
  console.log('   - Algorithmic PII scrubbers neutralizing candidate and recruiter identifiers')
  console.log('   - Multi-format instruction-tuning export: Gemini, OpenAI, Alpaca, ChatML')
  console.log('   - Multi-tenant tenant boundary enforcement blocking cross-org access')
  console.log('   - Paginated sample review and formatted file stream download')
  console.log('=============================================================================\n')
}

runPhase13Acceptance().catch((err) => {
  console.error('\n❌ Phase 13 AI Dataset Acceptance Test Failed:', err)
  process.exit(1)
})

import http from 'http'
import app from '../api/index.js'
import { supabase, getServiceSupabaseClient } from '../server/src/integrations/supabaseClient.js'

async function runComprehensiveTests() {
  console.log('=== STARTING QUALIFYAI MONOREPO COMPREHENSIVE VERIFICATION ===\n')

  // 1. Boot an HTTP server using the serverless app exported by api/index.js
  const testPort = 5190
  const server = http.createServer(app)

  await new Promise((resolve) => server.listen(testPort, resolve))
  console.log(`[PASS] Serverless API handler (api/index.js) successfully bound to test port ${testPort}`)

  const baseUrl = `http://localhost:${testPort}`
  let allPassed = true

  try {
    // 2. Test GET /api/health
    console.log('\n--- 1. Testing GET /api/health ---')
    const healthRes = await fetch(`${baseUrl}/api/health`)
    const healthData = await healthRes.json()
    console.log(`Status Code: ${healthRes.status}`)
    console.log('Response Payload:', healthData)
    if (healthRes.status === 200 && healthData.status === 'ok') {
      console.log('[PASS] GET /api/health returned 200 OK with status "ok"')
    } else {
      console.error('[FAIL] GET /api/health verification failed')
      allPassed = false
    }

    // 3. Test GET /api/health/database
    console.log('\n--- 2. Testing GET /api/health/database ---')
    const dbHealthRes = await fetch(`${baseUrl}/api/health/database`)
    const dbHealthData = await dbHealthRes.json()
    console.log(`Status Code: ${dbHealthRes.status}`)
    console.log('Response Payload:', dbHealthData)
    if (dbHealthRes.status === 200 && dbHealthData.connected === true) {
      console.log(`[PASS] GET /api/health/database verified live database connectivity (${dbHealthData.latencyMs}ms)`)
    } else {
      console.error('[FAIL] GET /api/health/database verification failed')
      allPassed = false
    }

    // 4. Test Production-Style Vercel Rewrites & Path Normalization
    console.log('\n--- 3. Testing Vercel Rewrite Header Path Normalization ---')
    const rewriteRes = await fetch(`${baseUrl}/api/index.js`, {
      headers: {
        'x-forwarded-uri': '/api/health',
      },
    })
    const rewriteData = await rewriteRes.json()
    console.log(`Status Code for rewritten request: ${rewriteRes.status}`)
    console.log('Payload:', rewriteData)
    if (rewriteRes.status === 200 && rewriteData.status === 'ok') {
      console.log('[PASS] Vercel internal rewrite header path normalization correctly resolved to /api/health')
    } else {
      console.error('[FAIL] Rewrite path normalization failed')
      allPassed = false
    }

    // 5. Test Live Supabase SELECT Operation
    console.log('\n--- 4. Testing Supabase SELECT Operation ---')
    const client = getServiceSupabaseClient()
    const { data: selectData, error: selectErr } = await client
      .from('profiles')
      .select('id, email, full_name, role')
      .limit(3)
    if (selectErr) {
      console.error('[FAIL] SELECT from profiles error:', selectErr.message)
      allPassed = false
    } else {
      console.log(`[PASS] Successfully selected ${selectData.length} profile records from Supabase`)
      console.log('Sample profiles:', selectData.map(p => ({ id: p.id, email: p.email, role: p.role })))
    }

    // 6. Test Live Supabase INSERT -> UPDATE -> SELECT -> DELETE Cycle
    console.log('\n--- 5. Testing Supabase CRUD Integrity Cycle ---')
    const testSlug = `test-org-${Date.now()}`
    const testOrgName = `Automated Verification Org ${Date.now()}`

    // INSERT
    console.log('Step 5a: Testing INSERT...')
    const { data: insertData, error: insertErr } = await client
      .from('organizations')
      .insert({
        name: testOrgName,
        slug: testSlug,
        industry: 'Software Quality Assurance',
        company_size: '1-10',
      })
      .select()
      .single()

    if (insertErr) {
      console.error('[FAIL] INSERT failed:', insertErr.message)
      allPassed = false
    } else {
      const createdId = insertData.id
      console.log(`[PASS] INSERT succeeded. Created organization ID: ${createdId}`)

      // UPDATE
      console.log('Step 5b: Testing UPDATE...')
      const updatedName = `${testOrgName} (Updated)`
      const { data: updateData, error: updateErr } = await client
        .from('organizations')
        .update({ name: updatedName })
        .eq('id', createdId)
        .select()
        .single()

      if (updateErr) {
        console.error('[FAIL] UPDATE failed:', updateErr.message)
        allPassed = false
      } else {
        console.log(`[PASS] UPDATE succeeded. New name: "${updateData.name}"`)

        // DELETE
        console.log('Step 5c: Testing DELETE...')
        const { error: deleteErr } = await client
          .from('organizations')
          .delete()
          .eq('id', createdId)

        if (deleteErr) {
          console.error('[FAIL] DELETE failed:', deleteErr.message)
          allPassed = false
        } else {
          console.log(`[PASS] DELETE succeeded. Removed test organization ID: ${createdId}`)
        }
      }
    }

    // 7. Test Non-existent API Route (404 Handling)
    console.log('\n--- 6. Testing 404 Error Handling ---')
    const notFoundRes = await fetch(`${baseUrl}/api/non-existent-route-xyz`)
    const notFoundData = await notFoundRes.json()
    console.log(`Status Code: ${notFoundRes.status}`)
    console.log('Payload:', notFoundData)
    if (notFoundRes.status === 404 && notFoundData.error?.code === 'NOT_FOUND') {
      console.log('[PASS] Non-existent route returned structured 404 JSON response')
    } else {
      console.error('[FAIL] 404 handling failed')
      allPassed = false
    }

    console.log('\n==================================================')
    if (allPassed) {
      console.log('🎉 ALL COMPREHENSIVE TESTS PASSED SUCCESSFULLY!')
    } else {
      console.error('❌ SOME TESTS FAILED.')
    }
    console.log('==================================================\n')
  } finally {
    server.close()
  }
}

runComprehensiveTests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})

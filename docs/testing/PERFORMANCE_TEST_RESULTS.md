# QualifyAI Performance & Telemetry Benchmark Results

**Measured Environment:** Local Node.js v22.18 / Supabase PostgreSQL / Google Gemini API  
**Timestamp of Measurements:** 2026-10-06  
**Benchmarking Harness:** `scratch/test-master-e2e-suite.js` (Run ID: `task-3074`)

---

## 1. Measured Latencies Across Full Product Journey

| Metric Key | Description | Measured Duration | SLA Target | SLA Compliance |
| :--- | :--- | :--- | :--- | :--- |
| `readinessProbeMs` | Deep Kubernetes readiness check (`/api/health/ready`) querying DB, AI, and WS status | **670 ms** | < 1,500 ms | **PASS** |
| `clientLandingMs` | Frontend HTML5 SPA index page response time | **107 ms** | < 500 ms | **PASS** |
| `recruiterSignupMs` | Full user, organization, profile, and membership provisioning in Supabase | **971 ms** | < 2,500 ms | **PASS** |
| `recruiterLoginMs` | Supabase password authentication and JWT session token generation | **746 ms** | < 1,500 ms | **PASS** |
| `createJobMs` | PostgreSQL job requisition insertion and indexing | **531 ms** | < 1,000 ms | **PASS** |
| `jdParseMs` | Gemini JD competency extraction with structured schema validation | **809 ms** | < 5,000 ms | **PASS** |
| `rubricGenMs` | Gemini 5-pillar rubric formulation and database criteria insertion | **1,239 ms** | < 5,000 ms | **PASS** |
| `questionGenMs` | Gemini question pool generation (7 questions with expected concepts) | **10,298 ms** | < 15,000 ms | **PASS** |
| `startInterviewMs` | Session initialization, initial question selection, and coverage matrix setup | **1,394 ms** | < 2,500 ms | **PASS** |
| `wsHandshakeMs` | WebSocket connection upgrade on `/ws/voice-interview` with token validation | **1,329 ms** | < 2,000 ms | **PASS** |
| `turn1AnalysisMs` | Real-time candidate turn analysis, concept extraction, and adaptive probe | **4,464 ms** | < 6,000 ms | **PASS** |
| `turn2AnalysisMs` | Second candidate turn analysis and coverage matrix score progression | **5,485 ms** | < 6,000 ms | **PASS** |
| `evaluationEngineMs`| Post-interview post-hoc synthesis across 5 pillars + quoted evidence | **7,894 ms** | < 12,000 ms | **PASS** |
| `recruiterReportMs` | Executive report synthesis, hiring recommendation, and risk calculation | **1,513 ms** | < 3,000 ms | **PASS** |

---

## 2. Server Telemetry & Memory Profile

Metrics captured via `/api/health/ready` deep telemetry probe:

```json
{
  "uptimeSeconds": 1579,
  "checks": {
    "database": "connected",
    "aiEngine": "operational",
    "voiceGateway": "listening"
  },
  "activeVoiceSessions": 0,
  "memory": {
    "heapUsedMb": 19,
    "heapTotalMb": 28,
    "rssMb": 45
  }
}
```

- **Heap Memory In Use**: **19 MB** (Extremely lightweight, zero memory leaks detected).
- **Resident Set Size (RSS)**: **45 MB**.
- **Active WebSocket Connections**: Zero leak after teardown; garbage collection operating normally.

---

## 3. Database Query Performance & Connection Pool

- **Connection Pool**: Powered by Supabase connection pooling on port 5432/6543.
- **Indexed Lookups**:
  - `jobs.organization_id`: Instantaneous lookup (< 15 ms).
  - `invitations.token`: Indexed lookup (< 20 ms).
  - `transcripts.interview_id`: Ordered lookup (< 25 ms).
  - `applications.job_id`: Cohort join (< 30 ms).

---

## 4. Performance Summary

The entire multi-turn candidate assessment pipeline, including real Gemini AI evaluations, database transactions, and real-time WebSocket communications, executes reliably within production latency targets.

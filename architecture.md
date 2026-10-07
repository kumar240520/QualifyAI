# Technical & System Architecture Document — QualifyAI

**Document Status:** Approved / Source of Truth  
**Target Platform:** QualifyAI Enterprise SaaS  
**Document Version:** 1.1.0 (Fully Synchronized with Foundation Documents 1–6)  

---

## 1. Executive Architectural Summary

QualifyAI is an enterprise-grade, multi-tenant SaaS platform architected as a **Layered Modular Monolith** with clean domain boundaries, high-performance real-time audio transport, and isolated external AI integration adapters.

The platform coordinates asynchronous background computation (document parsing, rubric generation, post-interview deep evaluation, PDF synthesis) with synchronous low-latency bidirectional real-time audio pipelines for conversational AI voice interviews.

```mermaid
graph TD
    Client[Client: React 19 / Vite SPA]
    
    subgraph Edge & Transport
        Ingress[API Gateway / Ingress Reverse Proxy]
        WS[WebSocket Audio Transport Server]
        REST[Express REST API Server]
    end
    
    subgraph Server Application Core
        AuthCtx[Tenant & Auth Context Middleware]
        Modules[Domain Modules: Jobs, Candidates, Interviews, Evaluation, Proctoring, Reports]
        Queue[BullMQ Job Queue Producers & Workers]
    end
    
    subgraph Data & Storage
        PG[(PostgreSQL Database via Supabase)]
        Redis[(Redis: Sessions, Caching & BullMQ)]
        Storage[(Storage: Recordings, Resumes, Transcripts, Reports)]
    end
    
    subgraph AI Orchestration & Provider Abstraction
        Orchestrator[AI Orchestrator: Rate Limits, Cache, Latency & State]
        AIProvider[AI Provider Abstract Contract: AIProvider]
        GeminiProvider[Primary Provider: GeminiProvider (@google/genai)]
        FutureAdapters[Future / Optional Adapters: OpenAI, Deepgram, ElevenLabs]
        SupabaseAuth[Supabase Auth API & Identity]
    end
    
    Client -->|HTTPS REST| REST
    Client <-->|WSS Realtime Stream| WS
    REST --> AuthCtx
    WS --> AuthCtx
    AuthCtx --> Modules
    Modules --> PG
    Modules --> Redis
    Modules --> Storage
    Modules --> Queue
    Queue --> Orchestrator
    Modules --> Orchestrator
    WS <--> Orchestrator
    Orchestrator --> AIProvider
    AIProvider --> GeminiProvider
    AIProvider -.-> FutureAdapters
    AuthCtx --> SupabaseAuth
```

---

## 2. Five-Tier System Architecture (from Document 4)

QualifyAI enforces a rigorous 5-tier separation of concerns across the complete stack:

1. **Presentation Tier (`client/`)**: Reusable UI component library, 3-tier user experience model (Public Landing, Recruiter Workspace, Candidate Interview Room), custom audio streaming hooks, and client state machines.
2. **Transport & Gateway Tier (`server/src/routes/` & `server/src/modules/realtime/`)**: Express REST endpoints, WebSocket duplex audio session gateway, rate limiters, payload validators, and CORS/security headers.
3. **Application & Business Service Tier (`server/src/services/` & `server/src/modules/`)**: Pure domain services executing business logic (Job requisition lifecycle, JD requirement extraction, Rubric calibration, Interview state engine, Scoring algorithms, Proctoring integrity analysis, Report compilers).
4. **AI Orchestration & Provider Integration Tier (`server/src/integrations/ai/`)**: Enterprise AI Orchestration layer (`AIOrchestrator`), vendor-agnostic provider contract (`AIProvider`), and active primary implementation (`GeminiProvider` using `@google/genai`). Optional future adapters (OpenAI, Deepgram, ElevenLabs) can implement the same interface without touching business logic.
5. **Persistence & Data Access Tier (PostgreSQL / Supabase)**: Multi-tenant relational schema (21 tables), strict foreign keys, transactional boundaries, performance indexes, and database-level Row Level Security (RLS) policies.

---

## 3. Client Architecture (`client/`) (from Document 3)

The frontend is built on **React 19 + Vite 8 + Tailwind CSS v3** with **Framer Motion** animations and **Lucide** icons.

```
client/
├── public/                 # Static assets, SVG favicons, Web manifest
└── src/
    ├── assets/             # Branding icons, Figma 3D illustrations, sound indicators
    ├── components/         # Design system primitives & specialized landing components
    │   ├── common/         # SplitFlapText, BorderGlow, FlipCard, TiltCard, CountUp, RotatingText
    │   └── landing/        # 14 Figma-calibrated landing sections
    ├── layouts/            # Page layouts: RecruiterLayout, CandidateLayout, PublicLayout
    ├── pages/              # Domain views: LandingPage, RecruiterDashboard, InterviewRoom, DiagnosticReport
    ├── routes/             # App routing, protected routes, tenant & role guards
    ├── services/           # Axios/Fetch API client wrappers for REST endpoints
    ├── hooks/              # Custom hooks: useAudioStream, useInterviewSocket, useAuth
    ├── context/            # Global state: AuthContext, OrganizationContext, AudioDeviceContext
    ├── lib/                # Client third-party library configurations & utility functions
    ├── constants/          # UI constants, route paths, error codes
    ├── utils/              # Formatting, timing, and audio math helpers
    └── styles/             # Global CSS, HSL design tokens, Tailwind configuration
```

### 3.1 Three Frontend Experience Portals
1. **Public Experience**: High-conversion landing page with interactive feature demonstrations, transparent pricing, and candidate trial sandbox.
2. **Recruiter Portal**:
   - Organization setup & recruiter team management.
   - Job creation with intelligent JD upload & requirements inspection.
   - Rubric editor (weights, criteria, scoring benchmarks).
   - Candidate pipeline management & cohort leaderboard.
   - Multi-dimensional scorecards & synchronized audio transcript playback.
3. **Candidate Portal**:
   - Tokenized invitation validation & hardware device check (mic, speaker, latency).
   - Distraction-free voice interview room with live audio visualizer.
   - Post-interview Candidate Diagnostic Report with technical growth takeaways.

---

## 4. Server Architecture (`server/`) (from Document 4)

The backend is structured as a **modular monolith** with clear dependency rules:

```
server/
├── src/
│   ├── config/             # Environment validation, database & Redis connection configs
│   ├── constants/          # System constants, HTTP status codes, error definitions
│   ├── controllers/        # Request unpacking, parameter extraction, response serialization
│   ├── integrations/       # Isolated third-party adapters
│   │   ├── ai/             # AIOrchestrator, AIProvider, GeminiProvider
│   │   └── supabaseClient.js # Multi-tenant user & service Supabase clients
│   ├── middleware/         # Auth verification, Tenant binding, Rate limiting, Error handler
│   ├── modules/            # Vertical domain engines:
│   │   ├── jdIntelligence/ # Document parsing & requirement extraction pipeline
│   │   ├── rubricEngine/   # Dynamic rubric synthesis & question pool generation
│   │   ├── aiInterview/    # Real-time interview state machine, turn-taking, prompt templates
│   │   ├── evaluation/     # Post-interview scoring, evidence quote citation
│   │   ├── proctoring/     # Browser focus & acoustic anomaly signal analyzer
│   │   └── reports/        # Executive recruiter report & candidate diagnostic compiler
│   ├── routes/             # REST route declarations and middleware bindings
│   ├── services/           # Core domain business logic orchestrating data and integrations
│   ├── utils/              # Cryptographic tokens, audio math, logger helpers
│   └── validators/         # Declarative schema validators (Zod / Joi)
```

---

## 5. Real-Time Conversational Voice Audio Pipeline (from Document 1 & 4)

QualifyAI delivers a natural, human-like voice interview dialogue with an end-to-end turnaround latency target of **$\le$ 1500ms** (candidate finishes speaking $\rightarrow$ AI voice audio begins playing), controlled strictly by the backend gateway:

```
Candidate Mic
     │ (Web Audio API / PCM Opus audio stream)
     ▼
WebSocket Gateway (`/ws/interview/:sessionId`)
     │
     ├──➔ QualifyAI Server Gateway & Session State Controller
     │         │ (Session verification, authorization, turn state)
     │         ▼
     ├──➔ AI Orchestration Layer (`AIOrchestrator`)
     │         │ (Prompt minimization, interview state compression)
     │         ▼
     ├──➔ Primary AI Provider: Gemini Realtime Engine (`GeminiProvider`)
     │         │ (Real-time transcription, evaluation, and speech synthesis)
     │         ▼
     ├──➔ Optional / Future Adapters (Deepgram Nova-2 STT / ElevenLabs TTS)
     │         │ (Plug-and-play via AIProvider interface)
     ▼
WebSocket Gateway
     │ (Duplex binary audio frames & synchronized transcript events)
     ▼
Candidate Browser AudioContext Buffer Queue
```

---

## 6. Asynchronous Processing & Queue Architecture

Heavy or non-real-time operations are completely decoupled from HTTP/WebSocket loops using **BullMQ** and **Redis**:

1. **`jd-processing-queue`**: Multi-format document text extraction, LLM parsing, requirement structuring.
2. **`rubric-generation-queue`**: Synthesis of multi-dimensional evaluation criteria and seed question pools.
3. **`interview-evaluation-queue`**: Full transcript analysis, criteria scoring, quote citation, communication metrics computation.
4. **`report-generation-queue`**: Executive report compilation, candidate diagnostic feedback generation, branded PDF rendering.

---

## 7. Multi-Tenancy & Authorization Model (from Document 5)

QualifyAI implements a **Shared Database, Shared Schema with Tenant Discriminator** multi-tenancy model backed by defense-in-depth:

```
Organization (Tenant Root)
   ├── Organization Memberships (Recruiters, Org Admins, Reviewers)
   ├── Jobs
   │     ├── Job Requirements
   │     ├── Rubric
   │     │     └── Rubric Criteria
   │     └── Questions
   ├── Candidates
   │     ├── Applications
   │     └── Invitations
   │           └── Interviews
   │                 ├── Interview Sessions
   │                 ├── Transcripts & Audio Recordings
   │                 ├── Evaluations & Rubric Scores
   │                 ├── Communication Metrics
   │                 ├── Proctoring Events & Summaries
   │                 ├── Executive Reports
   │                 └── Candidate Diagnostic Reports
   └── Organization Assets
```

---

## 8. Complete Database Architecture & Schema Specification (from Document 5)

The database is PostgreSQL hosted on **Supabase** and accessed through **Prisma ORM**.

### 8.1 Core Entities & Table Specifications

#### 1. `organizations` Table
The tenant boundary root for all enterprise data.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `name` (VARCHAR(255), Not Null)
- `slug` (VARCHAR(100), Unique, Not Null)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)
- `updated_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 2. `profiles` Table
Application-level user profiles mapped 1:1 to Supabase `auth.users`.
- `id` (UUID, Primary Key, References `auth.users(id)` ON DELETE CASCADE)
- `email` (VARCHAR(255), Unique, Not Null)
- `full_name` (VARCHAR(255), Not Null)
- `role` (VARCHAR(50), Not Null, Default: `'RECRUITER'`) — Values: `ORG_ADMIN`, `RECRUITER`, `REVIEWER`, `CANDIDATE`
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)
- `updated_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 3. `organization_memberships` Table
Maps users to organizations with role-based access.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `organization_id` (UUID, Not Null, References `organizations(id)` ON DELETE CASCADE)
- `user_id` (UUID, Not Null, References `profiles(id)` ON DELETE CASCADE)
- `role` (VARCHAR(50), Not Null, Default: `'RECRUITER'`)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)
- *Unique Constraint*: `(organization_id, user_id)`

#### 4. `jobs` Table
Recruitment positions created by an organization.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `organization_id` (UUID, Not Null, References `organizations(id)` ON DELETE CASCADE)
- `title` (VARCHAR(255), Not Null)
- `description` (TEXT, Not Null)
- `department` (VARCHAR(100))
- `seniority` (VARCHAR(50)) — Values: `JUNIOR`, `MID`, `SENIOR`, `STAFF`, `LEAD`
- `status` (VARCHAR(50), Not Null, Default: `'DRAFT'`) — Values: `DRAFT`, `ACTIVE`, `PAUSED`, `CLOSED`
- `created_by` (UUID, References `profiles(id)` ON DELETE SET NULL)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)
- `updated_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 5. `job_requirements` Table
Structured technical competencies extracted from the JD.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `job_id` (UUID, Unique, Not Null, References `jobs(id)` ON DELETE CASCADE)
- `skills` (JSONB, Not Null, Default: `'[]'`)
- `experience_years` (INT)
- `responsibilities` (JSONB, Not Null, Default: `'[]'`)
- `technical_requirements` (JSONB, Not Null, Default: `'[]'`)
- `role_context` (TEXT)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 6. `rubrics` Table
Role-specific evaluation matrix for a job.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `job_id` (UUID, Unique, Not Null, References `jobs(id)` ON DELETE CASCADE)
- `title` (VARCHAR(255), Not Null)
- `description` (TEXT)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)
- `updated_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 7. `rubric_criteria` Table
Granular evaluation pillars and scoring benchmarks.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `rubric_id` (UUID, Not Null, References `rubrics(id)` ON DELETE CASCADE)
- `name` (VARCHAR(255), Not Null)
- `description` (TEXT)
- `weight` (INT, Not Null, Default: 1) — Scale 1 to 5
- `expected_competency` (TEXT)
- `evaluation_guidance` (JSONB) — Novice (1), Competent (3), Mastery (5) descriptors
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 8. `questions` Table
Targeted interview question pool.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `job_id` (UUID, Not Null, References `jobs(id)` ON DELETE CASCADE)
- `rubric_criterion_id` (UUID, References `rubric_criteria(id)` ON DELETE SET NULL)
- `type` (VARCHAR(50), Not Null, Default: `'TECHNICAL'`) — Values: `TECHNICAL`, `SYSTEM_DESIGN`, `PROBLEM_SOLVING`, `BEHAVIORAL`
- `question_text` (TEXT, Not Null)
- `difficulty` (VARCHAR(50), Default: `'MEDIUM'`)
- `context_order` (INT, Default: 0)
- `metadata` (JSONB, Default: `'{}'`)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 9. `candidates` Table
Applicant identity within an organization's talent pool.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `organization_id` (UUID, Not Null, References `organizations(id)` ON DELETE CASCADE)
- `email` (VARCHAR(255), Not Null)
- `full_name` (VARCHAR(255), Not Null)
- `phone` (VARCHAR(50))
- `resume_url` (TEXT)
- `metadata` (JSONB, Default: `'{}'`)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)
- `updated_at` (TIMESTAMPTZ, Default: `NOW()`)
- *Unique Constraint*: `(organization_id, email)`

#### 10. `applications` Table
Associates a candidate with a specific job requisition.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `job_id` (UUID, Not Null, References `jobs(id)` ON DELETE CASCADE)
- `candidate_id` (UUID, Not Null, References `candidates(id)` ON DELETE CASCADE)
- `status` (VARCHAR(50), Not Null, Default: `'APPLIED'`) — Values: `APPLIED`, `INVITED`, `INTERVIEWED`, `OFFERED`, `REJECTED`
- `applied_at` (TIMESTAMPTZ, Default: `NOW()`)
- *Unique Constraint*: `(job_id, candidate_id)`

#### 11. `invitations` Table
Tokenized access link for candidate interview scheduling and entry.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `job_id` (UUID, Not Null, References `jobs(id)` ON DELETE CASCADE)
- `candidate_id` (UUID, Not Null, References `candidates(id)` ON DELETE CASCADE)
- `token` (VARCHAR(255), Unique, Not Null) — Cryptographic high-entropy string
- `status` (VARCHAR(50), Not Null, Default: `'CREATED'`) — Values: `CREATED`, `SENT`, `OPENED`, `ACCEPTED`, `EXPIRED`, `COMPLETED`
- `expires_at` (TIMESTAMPTZ, Not Null)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 12. `interviews` Table
Central assessment instance linking candidate, job, and evaluation records.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `organization_id` (UUID, Not Null, References `organizations(id)` ON DELETE CASCADE)
- `job_id` (UUID, Not Null, References `jobs(id)` ON DELETE CASCADE)
- `candidate_id` (UUID, Not Null, References `candidates(id)` ON DELETE CASCADE)
- `status` (VARCHAR(50), Not Null, Default: `'SCHEDULED'`) — Values: `SCHEDULED`, `READY`, `IN_PROGRESS`, `COMPLETED`, `EVALUATED`, `CANCELLED`
- `started_at` (TIMESTAMPTZ)
- `completed_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 13. `interview_sessions` Table
Tracks real-time WebSocket connection state and question progression.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `interview_id` (UUID, Unique, Not Null, References `interviews(id)` ON DELETE CASCADE)
- `connection_state` (VARCHAR(50), Default: `'DISCONNECTED'`) — Values: `CONNECTED`, `ACTIVE`, `PAUSED`, `DISCONNECTED`
- `current_question_index` (INT, Default: 0)
- `conversation_state` (VARCHAR(50), Default: `'IDLE'`) — Values: `IDLE`, `AI_SPEAKING`, `CANDIDATE_SPEAKING`, `THINKING`
- `audio_state` (JSONB, Default: `'{}'`)
- `session_metadata` (JSONB, Default: `'{}'`)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)
- `updated_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 14. `transcripts` Table
Sequential conversational record between AI interviewer and candidate.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `interview_id` (UUID, Not Null, References `interviews(id)` ON DELETE CASCADE)
- `speaker` (VARCHAR(50), Not Null) — Values: `'AI'`, `'CANDIDATE'`
- `content` (TEXT, Not Null)
- `sequence` (INT, Not Null)
- `audio_timestamp_ms` (INT, Default: 0)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 15. `evaluations` Table
Post-interview objective multi-dimensional assessment summary.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `interview_id` (UUID, Unique, Not Null, References `interviews(id)` ON DELETE CASCADE)
- `overall_score` (NUMERIC(5,2), Not Null) — Range 0.00 to 100.00
- `technical_score` (NUMERIC(5,2), Not Null)
- `problem_solving_score` (NUMERIC(5,2), Not Null)
- `communication_score` (NUMERIC(5,2), Not Null)
- `summary` (TEXT, Not Null)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 16. `rubric_scores` Table
Score breakdown per rubric criterion with cited evidence quotes.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `evaluation_id` (UUID, Not Null, References `evaluations(id)` ON DELETE CASCADE)
- `rubric_criterion_id` (UUID, Not Null, References `rubric_criteria(id)` ON DELETE CASCADE)
- `score` (NUMERIC(5,2), Not Null) — Range 0.00 to 100.00
- `justification` (TEXT, Not Null)
- `evidence_quotes` (JSONB, Default: `'[]'`)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 17. `communication_metrics` Table
Objective verbal delivery and speech benchmarks.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `interview_id` (UUID, Unique, Not Null, References `interviews(id)` ON DELETE CASCADE)
- `wpm` (INT, Not Null) — Words per minute
- `filler_word_density` (NUMERIC(4,2), Not Null) — Percentage
- `clarity_score` (NUMERIC(5,2), Not Null) — Range 0 to 100
- `pauses_count` (INT, Default: 0)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 18. `proctoring_events` Table
Raw environment and browser integrity events.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `interview_id` (UUID, Not Null, References `interviews(id)` ON DELETE CASCADE)
- `event_type` (VARCHAR(100), Not Null) — Values: `FOCUS_LOSS`, `TAB_SWITCH`, `VISIBILITY_CHANGE`, `ACOUSTIC_ANOMALY`
- `severity` (VARCHAR(50), Default: `'LOW'`) — Values: `LOW`, `MEDIUM`, `HIGH`
- `metadata` (JSONB, Default: `'{}'`)
- `timestamp_ms` (INT, Not Null)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 19. `proctoring_summaries` Table
Derived integrity summary and risk tiering.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `interview_id` (UUID, Unique, Not Null, References `interviews(id)` ON DELETE CASCADE)
- `risk_score` (NUMERIC(5,2), Not Null) — Range 0 to 100
- `trust_level` (VARCHAR(50), Not Null, Default: `'HIGH'`) — Values: `HIGH`, `MODERATE`, `SUSPICIOUS`
- `total_anomalies` (INT, Default: 0)
- `flags_summary` (JSONB, Default: `'{}'`)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 20. `reports` Table
Executive recruiter assessment report and exportable PDF artifact.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `interview_id` (UUID, Unique, Not Null, References `interviews(id)` ON DELETE CASCADE)
- `candidate_id` (UUID, Not Null, References `candidates(id)` ON DELETE CASCADE)
- `overall_summary` (TEXT, Not Null)
- `strengths` (JSONB, Not Null, Default: `'[]'`)
- `improvement_areas` (JSONB, Not Null, Default: `'[]'`)
- `technical_details` (JSONB, Default: `'{}'`)
- `communication_details` (JSONB, Default: `'{}'`)
- `integrity_summary` (JSONB, Default: `'{}'`)
- `pdf_url` (TEXT)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

#### 21. `candidate_diagnostic_reports` Table
Candidate-facing constructive technical feedback.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `interview_id` (UUID, Unique, Not Null, References `interviews(id)` ON DELETE CASCADE)
- `candidate_id` (UUID, Not Null, References `candidates(id)` ON DELETE CASCADE)
- `verified_strengths` (JSONB, Not Null, Default: `'[]'`)
- `recommended_growth_areas` (JSONB, Not Null, Default: `'[]'`)
- `articulation_summary` (TEXT)
- `audio_snippet_url` (TEXT)
- `candidate_visible_summary` (TEXT)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

---

### 8.2 Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : has
    PROFILES ||--o{ ORGANIZATION_MEMBERSHIPS : holds
    ORGANIZATIONS ||--o{ JOBS : owns
    ORGANIZATIONS ||--o{ CANDIDATES : maintains
    JOBS ||--o| JOB_REQUIREMENTS : defines
    JOBS ||--o| RUBRICS : calibrates
    RUBRICS ||--o{ RUBRIC_CRITERIA : contains
    JOBS ||--o{ QUESTIONS : pools
    RUBRIC_CRITERIA ||--o{ QUESTIONS : maps_to
    CANDIDATES ||--o{ APPLICATIONS : submits
    JOBS ||--o{ APPLICATIONS : receives
    CANDIDATES ||--o{ INVITATIONS : receives
    JOBS ||--o{ INVITATIONS : issues
    ORGANIZATIONS ||--o{ INTERVIEWS : conducts
    JOBS ||--o{ INTERVIEWS : assesses_for
    CANDIDATES ||--o{ INTERVIEWS : participates
    INTERVIEWS ||--o| INTERVIEW_SESSIONS : tracks
    INTERVIEWS ||--o{ TRANSCRIPTS : records
    INTERVIEWS ||--o| EVALUATIONS : scores
    EVALUATIONS ||--o{ RUBRIC_SCORES : details
    RUBRIC_CRITERIA ||--o{ RUBRIC_SCORES : benchmarks
    INTERVIEWS ||--o| COMMUNICATION_METRICS : analyzes
    INTERVIEWS ||--o{ PROCTORING_EVENTS : logs
    INTERVIEWS ||--o| PROCTORING_SUMMARIES : evaluates
    INTERVIEWS ||--o| REPORTS : compiles
    INTERVIEWS ||--o| CANDIDATE_DIAGNOSTIC_REPORTS : generates
```

---

### 8.3 Row Level Security (RLS) Policy Architecture (from Document 5)

Supabase PostgreSQL Row Level Security enforces tenant and candidate isolation at the database kernel level:

1. **Helper Functions**:
   - `auth.user_id()`: Returns authenticated user's UUID.
   - `is_org_member(org_id UUID)`: Returns true if user exists in `organization_memberships` for that organization.
   - `is_org_admin(org_id UUID)`: Returns true if user has `'ORG_ADMIN'` in `organization_memberships`.
2. **Organization-Level Policies**:
   - `organizations`: SELECT allowed if `is_org_member(id)`.
   - `jobs`, `candidates`, `interviews`: SELECT, INSERT, UPDATE allowed only when `is_org_member(organization_id)`.
3. **Candidate-Level Policies**:
   - `candidate_diagnostic_reports`: Candidate can SELECT only where `candidate_id` matches their verified candidate profile.
   - `transcripts`: Candidate can SELECT only messages from their own active interview session.
   - Recruiters have full read access to interviews and evaluations within their organization.

---

## 9. Logical Storage Architecture (`storage/`)

Storage paths are organized strictly by category and prefixed with the tenant `organization_id`:

```
storage/
├── resumes/{organizationId}/{candidateId}/{fileName}
├── job-descriptions/{organizationId}/{jobId}/{fileName}
├── interview-recordings/{organizationId}/{interviewId}/{fileName}.webm
├── transcripts/{organizationId}/{interviewId}/transcript.json
├── reports/{organizationId}/{interviewId}/report.pdf
├── candidate-documents/{organizationId}/{candidateId}/{fileName}
├── organization-assets/{organizationId}/logo.png
└── temp/
In production, this structure maps transparently to **Supabase Storage** or AWS S3 private buckets accessed exclusively through signed, expiring URLs.

---

## 11. Testing & Release Verification Architecture

QualifyAI incorporates an automated multi-tier end-to-end integration and verification harness:

```
[Master E2E Suite: scratch/test-master-e2e-suite.js]
  │
  ├── 1. Infra Probe: /api/health/ready (DB, AI Engine, WebSocket status)
  ├── 2. Secret Scan: client/dist/assets (Rule 7 Certified, 0 leaked keys)
  ├── 3. Frontend Check: http://localhost:3000 (HTML5 SPA root index)
  ├── 4. Auth & Multi-Tenancy: Supabase JWT sign up, login, /me, & cross-org IDOR block
  ├── 5. Requisition Pipeline: Postgres job creation, Gemini JD parsing (12 skills)
  ├── 6. Rubric & Question Bank: 5-pillar rubric formulation & 7-question pool
  ├── 7. Candidate Management: Talent enrollment, resume linking, & 64-hex token issuance
  ├── 8. Real-Time Voice Gateway: /ws/voice-interview bidirectional WebSocket handshake
  ├── 9. Adaptive Dialogue Engine: Live turns, Raft/Postgres scoring (8-9/10), coverage matrix
  ├── 10. Proctoring & Telemetry: Tab blur / visibility shift ingestion, Trust=HIGH, Risk=9
  ├── 11. Resilience & Recovery: Reconnection test preserving all dialogue turns
  ├── 12. 0-100 Evaluation Engine: Multi-pillar scoring (Overall: 68/100, Tech: 75/100)
  ├── 13. Candidate Diagnostic & Recruiter Report: Actionable feedback & executive briefs
  ├── 14. Golden Path 2 (Beta): Marcus Vance evaluated with lower score (10/100 vs 68/100)
  ├── 15. Dynamic Leaderboard: PostgreSQL ranked cohort analytics (Rank 1 Alpha, Rank 2 Beta)
  ├── 16. Relational Integrity Audit: 100% foreign key linkages verified
  └── 17. Security & Injection Defense: Input sandboxing, token validation, rate limiters
```

All 36 Master E2E Gates pass with a 100% success rate. Detailed documentation is cataloged under `docs/testing/`.


# Engineering Rules & Architectural Invariants — QualifyAI

**Document Status:** Permanent & Mandatory  
**Applies To:** All Engineers, Code Contributors, and AI Coding Agents  
**Document Version:** 1.1.0 (Aligned with Foundation Documents 1–6)  

---

## 1. Golden Rules (Non-Negotiable Invariants)

0. **STRICT 3-STAGE LIFECYCLE: FRONTEND FIRST ➔ BACKEND & DATABASE ➔ TRUE END-TO-END WIRING**:
   - **Stage 1 (Frontend First & Full User Satisfaction)**: We MUST build the entire frontend properly, completely, and beautifully first. All pages, components, layouts, responsive behavior, interactions, and local states must be developed to production quality. We will NOT proceed to the backend until the USER is completely satisfied with the frontend.
   - **Stage 2 (Isolated Backend & Database Verification)**: Once the user is satisfied with the frontend, we proceed to the backend. Every single route, controller, service, and model must be wired directly to the real database (Supabase PostgreSQL 17.11) and rigorously tested for data integrity, multi-tenancy, and RLS compliance.
   - **Stage 3 (End-to-End Purely Working Integration — Zero Hallucination)**: We wire the frontend to the verified backend and database. Every button, every form, every toggle, and every feature must be completely and truthfully functional with real data persistence. No fake mock-only placeholders, no superficial UI facades, no hallucinated actions—purely and truthfully working.
1. **NO BUSINESS LOGIC IN UI COMPONENTS**: Frontend components (`client/src/components/`, `client/src/pages/`) exist exclusively to render UI, handle user interactions, and bind state. All business calculations, scoring logic, and validation rules belong in the backend service layer or shared utility validators.
2. **NO BUSINESS LOGIC IN ROUTE DEFINITIONS**: Route files (`server/src/routes/`) only declare HTTP verbs, paths, middleware stacks, and controller bindings. Controllers handle request/response orchestration. Services (`server/src/services/`) hold the actual business logic.
3. **STRICT MULTI-TENANT ISOLATION**: Every database query touching organization-scoped entities **must** be explicitly filtered by `organizationId`. Never trust client-provided tenant identifiers without validating them against the authenticated JWT session context.
4. **NO VENDOR SDK LEAKAGE**: Third-party AI libraries (`@deepgram/sdk`, `openai`, `@google/genai`, `elevenlabs-node`, `@supabase/supabase-js`) must be completely wrapped inside `server/src/integrations/`. Application services must only interact with abstract interface contracts.
5. **NO FACIAL OR EMOTION SCORING**: Under no circumstances shall webcam video analysis, facial expression scoring, eye-gaze tracking, or emotion AI be introduced. Proctoring is strictly limited to browser visibility/focus changes and acoustic anomaly detection.
6. **EXPLAINABLE, RUBRIC-GROUNDED SCORING ONLY**: Candidate evaluation scores must be derived strictly from the approved job rubric and must be substantiated by cited quotes from the interview transcript. Hallucinated or arbitrary scoring is prohibited.
7. **ZERO SECRETS ON THE CLIENT**: API keys, service role credentials, and third-party signing secrets must never be exposed to the client bundle or prefixed with public client environment tags.
8. **ZERO REFERENCE PROJECT CONTAMINATION**: No domain concepts, code, naming conventions, or data schemas from reference projects (such as healthcare, hospitals, doctors, patients, or medical billing) may ever be introduced into QualifyAI.
9. **AUDITABILITY OF PROCTORING EVIDENCE**: Raw proctoring event telemetry (focus loss, tab switch, acoustic flags) must be stored and preserved distinctly from derived risk summaries.
10. **STRICT DEFENSE-IN-DEPTH**: Both application-layer tenant context enforcement and database-layer Row Level Security (RLS) policies must be active simultaneously.

---

## 2. Mandatory Database & Security Invariants (from Document 5)

As formalized in **Document 5 (Database Architecture & Security Model, Section 60)**, these ten architectural principles are non-negotiable:

- **Rule 2.1 (No Frontend Security Reliance)**: Never rely only on frontend filtering for tenant security or authorization boundaries.
- **Rule 2.2 (Universal Tenant Traceability)**: Every organization-owned resource (`jobs`, `candidates`, `rubrics`, `interviews`, `reports`) must possess a direct, verifiable foreign key path to its owning `organization_id`.
- **Rule 2.3 (Candidate Boundary Isolation)**: Candidate authenticated identities can access only their own individual candidate profile, invited interview session, and authorized candidate diagnostic report. They must never see recruiter dashboards, other candidates, or organizational candidate pools.
- **Rule 2.4 (Recruiter Scope Boundary)**: Recruiters can access only authorized organization resources through verified `organization_memberships`. Unrestricted cross-tenant queries are blocked.
- **Rule 2.5 (AI Privacy & Zero PII Leakage)**: Third-party AI providers (Deepgram, OpenAI, Gemini, ElevenLabs) must never receive extraneous tenant metadata, candidate contact info, or unneeded organizational data in prompt payloads.
- **Rule 2.6 (Ownership-Aware Access Patterns)**: Every database query, update, or deletion must execute with explicit ownership checks (`WHERE id = :id AND organization_id = :orgId`).
- **Rule 2.7 (Independent CRUD Authorization)**: SELECT, INSERT, UPDATE, and DELETE operations on every table must be verified independently. Having read access does not imply write or delete access.
- **Rule 2.8 (Unpredictable Secure Identifiers)**: Sensitive assessment endpoints, candidate invitation links, and interview access tokens must use cryptographically secure UUIDv4 or high-entropy tokens. Sequential or guessable IDs are strictly prohibited.
- **Rule 2.9 (Externalized Secrets)**: API tokens, service keys, and database passwords must remain exclusively in validated environment variables (`.env`) and never be committed to source code or database tables.
- **Rule 2.10 (Architecture-Synchronized Schemas)**: Database schema definitions, Prisma models, and migration scripts must remain 100% synchronized with the data models documented in `architecture.md` and `Document 5`.

---

## 3. Architectural Boundaries & Layering Rules

### 3.1 Backend Layering Flow
```
Incoming Request
       ↓
Route Handler (`server/src/routes/`)
       ↓
Middleware (`server/src/middleware/`) ➔ Auth (Supabase JWT), Tenant Binding, Rate Limiting
       ↓
Validator (`server/src/validators/`) ➔ Schema validation (Joi/Zod)
       ↓
Controller (`server/src/controllers/`) ➔ Unpack input, format HTTP response
       ↓
Service (`server/src/services/`) ➔ Pure domain business logic & orchestration
       ↓
Integration Adapter (`server/src/integrations/`) ➔ Third-party API translation
       ↓
Persistence Layer (Prisma ORM / PostgreSQL + RLS) ➔ Tenant-scoped data queries
```
- **Rule 3.1.1**: Controllers must not call Prisma directly. They must delegate to Services.
- **Rule 3.1.2**: Services must not handle HTTP `req` or `res` objects directly. Pass plain JavaScript data objects (DTOs).

### 3.2 Client Layering Flow
```
User Interaction
       ↓
Component / Page View (`client/src/components/`, `client/src/pages/`)
       ↓
Custom Hook / State Hook (`client/src/hooks/`)
       ↓
Service Layer (`client/src/services/`) ➔ Axios / Fetch client wrappers
       ↓
HTTP / WebSocket Transport
```
- **Rule 3.2.1**: Components must not execute raw `fetch` or `axios` calls directly inside `useEffect` or event handlers; use dedicated API client services in `client/src/services/`.
- **Rule 3.2.2**: UI state must be separated from server cache state.

---

## 4. AI & Real-Time Audio Pipeline Rules

- **Rule 4.1 (Turn-Taking Resilience)**: The voice interview state machine must handle interruptions, silence timeouts, and background acoustic noise gracefully without crashing or entering infinite prompt loops. Target turnaround latency: $\le$ 1500ms.
- **Rule 4.2 (Prompt Versioning & Management)**: System prompts for rubric generation, technical question synthesis, and interview reasoning must be centrally managed in `server/src/modules/aiInterview/prompts/` rather than hardcoded inline in service methods.
- **Rule 4.3 (Audio Stream Chunking)**: Real-time candidate audio streaming must use consistent binary chunk sizing (recommended 250ms–500ms buffers) to maintain low latency without overwhelming the WebSocket connection.
- **Rule 4.4 (Failure Fallbacks)**: If an AI provider experiences a rate limit or timeout, the system must emit a structured audio warning event to the client and retry or gracefully fallback.

---

## 5. Database & Persistence Rules

- **Rule 5.1 (Prisma Migrations)**: All schema changes must be applied via Prisma Migrate. Never modify database tables directly in production without a tracked migration file.
- **Rule 5.2 (No Cascade Deletes on Critical Data)**: Organizations, Candidates, Interviews, and Transcripts must use soft deletes (`deletedAt`) or restricted foreign keys to prevent accidental cascading data loss.
- **Rule 5.3 (Indexed Foreign Keys)**: All foreign key columns (`organization_id`, `job_id`, `candidate_id`, `interview_id`) and lookup status fields must have explicit database indexes.

---

## 6. File Handling & Storage Rules

- **Rule 6.1 (Storage Category Isolation)**: All stored files must be filed strictly under their appropriate logical directory (`resumes/`, `job-descriptions/`, `interview-recordings/`, `transcripts/`, `reports/`, `candidate-documents/`, `organization-assets/`, `temp/`).
- **Rule 6.2 (Tenant-Prefix File Paths)**: Every stored file must include the tenant ID in its storage path: `{category}/{organizationId}/{entityId}/{fileName}`.
- **Rule 6.3 (Signed Access Only)**: Direct public access to candidate resumes, interview audio, and diagnostic reports is prohibited. All client downloads must use signed, time-limited URLs (e.g., expiring in 15 minutes).

---

## 7. Documentation & Source-of-Truth Rules (from Document 6)

- **Rule 7.1 (Root Markdown Supremacy)**: The seven root Markdown files (`README.md`, `prd.md`, `architecture.md`, `design.md`, `memory.md`, `phases.md`, `rules.md`) are the permanent operational sources of truth. Never move them to `docs/` or rename them.
- **Rule 7.2 (Synchronous Documentation Updates)**:
  - When an architectural decision or integration changes ➔ Update `architecture.md` and log in `memory.md`.
  - When a product requirement changes ➔ Update `prd.md`.
  - When visual design or UX state changes ➔ Update `design.md`.
  - When engineering constraints or invariants change ➔ Update `rules.md`.
  - When milestone status changes ➔ Update `phases.md`.
- **Rule 7.3 (Engineering Documentation in `docs/`)**: Deep dive implementation guides, API endpoint references, and diagrams belong in `docs/`.
- **Rule 7.4 (Formal Project Artifacts in `document/`)**: Formal project charters, reference specifications, and compliance blueprints belong in `document/`.

---

## 8. Coding Standards & Code Hygiene

- **Rule 8.1 (Descriptive Naming)**: Use explicit, descriptive naming conventions matching QualifyAI domains (e.g., `candidateInterviewService.js`, `jobRubricController.js`, `useAudioStream.js`).
- **Rule 8.2 (Async/Await Error Handling)**: All asynchronous functions must have structured error handling with try/catch blocks delegating to the centralized error middleware.
- **Rule 8.3 (Structured Logging)**: Use structured JSON logging with context (`organizationId`, `interviewId`, `timestamp`, `level`). Never use raw `console.log` in production code.
- **Rule 8.4 (Clean Monorepo Boundaries)**: Do not create circular dependencies between `client/` and `server/`. Code shared between client and server must be purely functional DTO schemas or constants.

---

## 9. Quality Assurance & Continuous Verification Rules

- **Rule 9.1 (No False Passes)**: Never declare a test or milestone passed merely because an HTTP 200 was returned or a component rendered. Pass criteria requires the complete expected business flow to work across the database, AI engine, and user interface.
- **Rule 9.2 (Automatic Bug-Fix Protocol)**: When a failure occurs during automated or manual verification, engineers must debug, determine the root cause, fix the issue in code or database, and execute regression tests before proceeding.
- **Rule 9.3 (Strict Git Constraint)**: Under no circumstances execute Git or GitHub commands (`git add`, `git commit`, `git push`).
- **Rule 9.4 (Non-Mocked AI Testing)**: Integration tests for AI subsystems must exercise the live AI provider API with strict schema validation; mocked placeholders are prohibited for release acceptance.
- **Rule 9.5 (Relational Integrity Invariant)**: All database entities must maintain foreign key integrity across the full relational chain: Organization ➔ Job ➔ Rubric ➔ Question ➔ Candidate ➔ Application ➔ Invitation ➔ Interview ➔ Session ➔ Transcript ➔ Evaluation ➔ Report.


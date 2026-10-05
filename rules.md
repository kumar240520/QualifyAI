# Engineering Rules & Architectural Invariants — QualifyAI

**Document Status:** Permanent & Mandatory  
**Applies To:** All Engineers, Code Contributors, and AI Coding Agents  
**Document Version:** 1.0.0  

---

## 1. Golden Rules (Non-Negotiable Invariants)

1. **NO BUSINESS LOGIC IN UI COMPONENTS**: Frontend components (`client/src/components/`, `client/src/pages/`) exist exclusively to render UI, handle user interactions, and bind state. All business calculations, scoring logic, and validation rules belong in the backend service layer or shared utility validators.
2. **NO BUSINESS LOGIC IN ROUTE DEFINITIONS**: Route files (`server/src/routes/`) only declare HTTP verbs, paths, middleware stacks, and controller bindings. Controllers handle request/response orchestration. Services (`server/src/services/`) hold the actual business logic.
3. **STRICT MULTI-TENANT ISOLATION**: Every database query touching organization-scoped entities **must** be explicitly filtered by `organizationId`. Never trust client-provided tenant identifiers without validating them against the authenticated JWT session context.
4. **NO VENDOR SDK LEAKAGE**: Third-party AI libraries (`@deepgram/sdk`, `openai`, `@google/genai`, `elevenlabs-node`, `@supabase/supabase-js`) must be completely wrapped inside `server/src/integrations/`. Application services must only interact with abstract interface contracts.
5. **NO FACIAL OR EMOTION SCORING**: Under no circumstances shall webcam video analysis, facial expression scoring, eye-gaze tracking, or emotion AI be introduced. Proctoring is strictly limited to browser visibility/focus changes and acoustic anomaly detection.
6. **EXPLAINABLE, RUBRIC-GROUNDED SCORING ONLY**: Candidate evaluation scores must be derived strictly from the approved job rubric and must be substantiated by cited quotes from the interview transcript. Hallucinated or arbitrary scoring is prohibited.
7. **ZERO SECRETS ON THE CLIENT**: API keys, service role credentials, and third-party signing secrets must never be exposed to the client bundle or prefixed with public client environment tags.
8. **ZERO REFERENCE PROJECT CONTAMINATION**: No domain concepts, code, naming conventions, or data schemas from reference projects (such as healthcare, hospitals, doctors, patients, or medical billing) may ever be introduced into QualifyAI.

---

## 2. Architectural Boundaries & Layering Rules

### 2.1 Backend Layering Flow
```
Incoming Request
       ↓
Route Handler (`server/src/routes/`)
       ↓
Middleware (`server/src/middleware/`) ➔ Auth, Tenant Binding, Rate Limiting
       ↓
Validator (`server/src/validators/`) ➔ Schema validation (Joi/Zod)
       ↓
Controller (`server/src/controllers/`) ➔ Unpack input, format HTTP response
       ↓
Service (`server/src/services/`) ➔ Pure domain business logic & orchestration
       ↓
Integration Adapter (`server/src/integrations/`) ➔ Third-party API translation
       ↓
Persistence Layer (Prisma ORM / PostgreSQL) ➔ Tenant-scoped data queries
```
- **Rule 2.1.1**: Controllers must not call Prisma directly. They must delegate to Services.
- **Rule 2.1.2**: Services must not handle HTTP `req` or `res` objects directly. Pass plain JavaScript data objects (DTOs).

### 2.2 Client Layering Flow
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
- **Rule 2.2.1**: Components must not execute raw `fetch` or `axios` calls directly inside `useEffect` or event handlers; use dedicated API client services in `client/src/services/`.
- **Rule 2.2.2**: UI state must be separated from server cache state.

---

## 3. Security, Authentication & Multi-Tenancy Rules

- **Rule 3.1 (Authentication Verification)**: Every protected route must pass through `authMiddleware` which verifies the Supabase JWT.
- **Rule 3.2 (Tenant Scoping)**: `tenantMiddleware` must verify that the authenticated user belongs to the target `organizationId`. If an endpoint receives an entity ID (e.g., `jobId`), the query must verify both `id: jobId` AND `organizationId: req.organizationId`.
- **Rule 3.3 (Candidate Token Isolation)**: Candidates access interviews using single-use, cryptographically signed, short-lived tokens. Candidate tokens must never permit access to recruiter endpoints, candidate lists, or other interviews.
- **Rule 3.4 (Input Sanitization)**: All incoming payloads must be strictly validated against declarative schemas in `server/src/validators/` before reaching controllers.
- **Rule 3.5 (Rate Limiting)**: Audio WebSocket handshakes, candidate invitation endpoints, and auth routes must have explicit rate limiters.

---

## 4. AI & Real-Time Audio Pipeline Rules

- **Rule 4.1 (Turn-Taking Resilience)**: The voice interview state machine must handle interruptions, silence timeouts, and background acoustic noise gracefully without crashing or entering infinite prompt loops.
- **Rule 4.2 (Prompt Versioning & Management)**: System prompts for rubric generation, technical question synthesis, and interview reasoning must be centrally managed in `server/src/modules/aiInterview/prompts/` rather than hardcoded inline in service methods.
- **Rule 4.3 (Audio Stream Chunking)**: Real-time candidate audio streaming must use consistent binary chunk sizing (recommended 250ms–500ms buffers) to maintain low latency without overwhelming the WebSocket connection.
- **Rule 4.4 (Failure Fallbacks)**: If an AI provider (e.g., ElevenLabs or OpenAI) experiences a rate limit or timeout, the system must emit a structured audio warning event to the client and retry or gracefully fallback.

---

## 5. Database & Persistence Rules

- **Rule 5.1 (Prisma Migrations)**: All schema changes must be applied via Prisma Migrate. Never modify database tables directly in production without a tracked migration file.
- **Rule 5.2 (No Cascade Deletes on Critical Data)**: Organizations, Candidates, and Interviews must use soft deletes (`deletedAt`) or restricted foreign keys to prevent accidental cascading data loss.
- **Rule 5.3 (Indexed Foreign Keys)**: All foreign key columns (`organizationId`, `jobId`, `candidateId`, `interviewId`) and lookup status fields must have explicit database indexes.

---

## 6. File Handling & Storage Rules

- **Rule 6.1 (Storage Category Isolation)**: All stored files must be filed strictly under their appropriate logical directory (`resumes/`, `job-descriptions/`, `interview-recordings/`, `transcripts/`, `reports/`, `candidate-documents/`, `organization-assets/`, `temp/`).
- **Rule 6.2 (Tenant-Prefix File Paths)**: Every stored file must include the tenant ID in its storage path: `{category}/{organizationId}/{entityId}/{fileName}`.
- **Rule 6.3 (Signed Access Only)**: Direct public access to candidate resumes, interview audio, and diagnostic reports is prohibited. All client downloads must use signed, time-limited URLs (e.g., expiring in 15 minutes).

---

## 7. Documentation & Source-of-Truth Rules

- **Rule 7.1 (Root Markdown Supremacy)**: The seven root Markdown files (`README.md`, `prd.md`, `architecture.md`, `design.md`, `memory.md`, `phases.md`, `rules.md`) are the permanent sources of truth. Never move them to `docs/` or rename them.
- **Rule 7.2 (Synchronous Documentation Updates)**:
  - When an architectural decision or integration changes ➔ Update `architecture.md` and log in `memory.md`.
  - When a product requirement changes ➔ Update `prd.md`.
  - When visual design or UX state changes ➔ Update `design.md`.
  - When engineering constraints or invariants change ➔ Update `rules.md`.
  - When milestone status changes ➔ Update `phases.md`.
- **Rule 7.3 (Engineering Documentation in `docs/`)**: Deep dive implementation guides, API endpoint references, and diagrams belong in `docs/`.
- **Rule 7.4 (Formal Project Artifacts in `document/`)**: Formal project charters, reference specifications, and compliance documents belong in `document/`.

---

## 8. Coding Standards & Code Hygiene

- **Rule 8.1 (Descriptive Naming)**: Use explicit, descriptive naming conventions matching QualifyAI domains (e.g., `candidateInterviewService.js`, `jobRubricController.js`, `useAudioStream.js`).
- **Rule 8.2 (Async/Await Error Handling)**: All asynchronous functions must have structured error handling with try/catch blocks delegating to the centralized error middleware.
- **Rule 8.3 (Structured Logging)**: Use structured JSON logging with context (`organizationId`, `interviewId`, `timestamp`, `level`). Never use raw `console.log` in production code.
- **Rule 8.4 (Clean Monorepo Boundaries)**: Do not create circular dependencies between `client/` and `server/`. Code shared between client and server must be purely functional DTO schemas or constants.

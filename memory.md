# Living Project Memory & State Log — QualifyAI

**Document Status:** Active / Persistent Project Memory  
**Last Updated:** Phase 0 Completion (Architecture & Repository Initialization)  
**Current Milestone:** Phase 0 Complete ➔ Transitioning to Phase 1  

---

## 1. Project Identity & Purpose

- **Project Name:** QualifyAI
- **Type:** Enterprise AI-powered technical recruitment and interview assessment SaaS platform.
- **Dual Audience:** Recruiters / Organizations and Technical Candidates.
- **Core Loop:** Job Description Upload ➔ JD Parsing ➔ Rubric & Question Generation ➔ Candidate Invitation ➔ AI Voice Interview (STT + LLM + TTS) ➔ Evaluation & Scoring ➔ Integrity Analysis ➔ Recruiter Dashboard & Candidate Diagnostic Report.

---

## 2. Current Development State

- **Current Phase:** Phase 1 (Foundation & Frontend Setup) in progress; Phase 0 completed.
- **Repository Setup:**
  - Root source-of-truth documentation system established (`README.md`, `prd.md`, `architecture.md`, `design.md`, `memory.md`, `phases.md`, `rules.md`).
  - Core directory trees created: `client/`, `server/`, `storage/`, `document/`, and `docs/`.
  - Frontend initialized: React 19 + Vite 8 + Tailwind CSS v3 setup completed in `client/`.
  - Interactive demonstration application running at `http://localhost:3000/`.
- **Next Phase:** Server foundation, PostgreSQL Prisma models & Supabase authentication.

---

## 3. Key Architectural Decisions (ADR Log)

### ADR-001: Monorepo Architecture with Strict Domain Separation
- **Date:** Initialization
- **Decision:** Keep `client/`, `server/`, `storage/`, `document/`, and `docs/` in a single cohesive repository without merging frontend and backend.
- **Rationale:** Minimizes orchestration overhead and deployment complexity while preserving domain boundaries and enabling atomic versioning.

### ADR-002: Modular Monolith Backend Pattern
- **Date:** Initialization
- **Decision:** Build `server/` as a modular monolith organized into layered concerns (routes, controllers, services, integrations, modules) rather than premature microservices.
- **Rationale:** Avoids distributed systems failure modes, simplifies tenant transactions, and maintains high development velocity during early stages.

### ADR-003: Isolated External Integration Adapters
- **Date:** Initialization
- **Decision:** Encapsulate Deepgram (STT), OpenAI / Gemini (LLM), ElevenLabs (TTS), and Supabase Auth inside `server/src/integrations/`.
- **Rationale:** Prevents vendor SDK lock-in and allows seamless swapping or fallbacks without modifying core domain business logic.

### ADR-004: Multi-Tenant Data Isolation Strategy
- **Date:** Initialization
- **Decision:** Implement multi-tenancy at the application and database layer using an `organizationId` tenant context discriminator across all queries.
- **Rationale:** Ensures enterprise data compliance, prevents cross-organization leaks, and integrates seamlessly with Supabase / PostgreSQL.

### ADR-005: Strict Exclusion of Facial Micro-Expression & Emotion AI
- **Date:** Initialization
- **Decision:** Focus evaluation solely on technical correctness, depth, communication clarity, and browser/acoustic integrity signals. Facial recognition and emotion detection are prohibited.
- **Rationale:** Adheres to ethical hiring standards, avoids pseudoscientific bias, ensures ADA compliance, and respects candidate psychological comfort.

### ADR-006: Asynchronous Heavy Processing via BullMQ and Redis
- **Date:** Initialization
- **Decision:** Decouple JD document parsing, post-interview rubric scoring, and PDF report generation from HTTP/WebSocket loops into BullMQ worker queues.
- **Rationale:** Prevents HTTP timeouts, protects low-latency voice WebSocket connections, and guarantees resilient job retries.

### ADR-007: React + Vite + Tailwind CSS v3 Frontend Foundation
- **Date:** Phase 1 Initialization
- **Decision:** Selected Vite + React 19 + Tailwind CSS v3 (stable PostCSS configuration) for the client application.
- **Rationale:** Delivers sub-second hot-module replacement (HMR), lightweight build footprints, and deep integration with the tailored HSL design token system established in `design.md`.

---

## 4. Completed Work

- [x] Defined complete product vision, user workflows, and functional requirements in `prd.md`.
- [x] Specified system architecture, data flow diagrams, database entities, and real-time audio pipeline in `architecture.md`.
- [x] Established design system, HSL color tokens, typography, audio visualizer states, and UX guidelines in `design.md`.
- [x] Created permanent engineering rules, constraints, and prohibited patterns in `rules.md`.
- [x] Outlined 6-phase development roadmap with milestones and exit criteria in `phases.md`.
- [x] Created root `README.md` introducing the platform and repository layout.
- [x] Created the complete clean directory hierarchy across `client/`, `server/`, `storage/`, `document/`, and `docs/`.
- [x] Scaffolded React 19 + Vite setup in `client/` with Tailwind CSS v3, PostCSS, Google Fonts (`Inter`, `Outfit`, `JetBrains Mono`), and Lucide icons.
- [x] Connected to Figma design via Personal Access Token (`zFW4h1zMbYlQ8uymSSx6pw`), extracted all 16 sections, typography, colors, and high-resolution 3D illustration assets.
- [x] Implemented pixel-perfect Figma Landing Page in `client/src/pages/LandingPage.jsx` across 14 modular components (`Navbar`, `HeroSection`, `TrustStrip`, `ProblemSection`, `WorkflowSection`, `DualSidedSection`, `JdIntelligenceSection`, `VoiceEngineSection`, `ScorecardSection`, `IntegritySection`, `LeaderboardSection`, `DiagnosticReportSection`, `TechSecuritySection`, `MetricsSection`, `CTASection`, `Footer`).
- [x] Created seamless view toggle between the Figma Landing Page and the interactive Voice Simulator Sandbox in `client/src/App.jsx`.
- [x] Validated production build (`npm run build`) with zero errors.
- [x] Dev server running live on `http://localhost:3000/`.

---

## 5. Active & Upcoming Work

- **Immediate Goal:**
  - Set up `server/` Node.js / Express environment and configuration.
  - Set up Prisma ORM with PostgreSQL and define core schema models.
  - Configure Supabase Auth integration and tenant context middleware.

---

## 6. Known Context & Constraints for Future Developers and AI Agents

1. **Source of Truth Precedence**:
   Always consult `rules.md`, `architecture.md`, and `prd.md` before implementing any feature or modifying directory structures.
2. **Business Logic Boundaries**:
   - Never put business logic in route handlers or controllers.
   - Never put business logic in React components.
   - All external vendor APIs must go through `server/src/integrations/`.
3. **Multi-Tenancy Guardrail**:
   Every database query affecting organization data must be tenant-scoped with `organizationId`.
4. **No Reference Project Bleed**:
   Ensure zero reference-project domain artifacts (healthcare, hospital, patient, doctor, billing) ever enter this codebase. QualifyAI is strictly an enterprise technical recruitment platform.
5. **Memory Synchronization**:
   Update this file (`memory.md`) after completing major milestones, resolving architectural decisions, or discovering system bottlenecks.

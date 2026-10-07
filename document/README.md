# Formal Foundation Documents & Reference Artifacts (`document/`) — QualifyAI

This directory serves as the **Formal Foundation Specifications Archive** for QualifyAI. It houses the authoritative, complete engineering and product blueprints across all six functional and architectural domains of the platform.

---

## 1. Directory Responsibility & Governance

As specified in **Document 6** (Project Documentation & Reference Structure), `document/` is strictly governed by the following architectural boundaries:

1. **Separation from Living Documentation (`docs/`)**: `document/` stores immutable, versioned baseline specifications and institutional blueprints. Living technical guides, API specs, and runbooks reside in `docs/`.
2. **Separation from Runtime Data (`storage/`)**: No runtime assets, candidate resumes, audio recordings, or database backups are stored here (runtime assets belong in `storage/` or cloud object storage).
3. **Separation from Implementation Code**: Implementation code (`.js`, `.jsx`, `.ts`, `.sql`, `.py`) is never placed directly in `document/`.
4. **Relationship to Root Markdown**: The seven root Markdown files (`README.md`, `prd.md`, `architecture.md`, `design.md`, `memory.md`, `phases.md`, `rules.md`) are the active, synchronized operational representations of these foundational documents.

---

## 2. Formal Specification Documents Index

| Document | Filename | Pages | Purpose & Domain Coverage |
| :--- | :--- | :--- | :--- |
| **Document 1** | [`DOCUMENT 1.pdf`](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%201.pdf) | 37 | **Product & Functional Blueprint**: Complete product vision, problem space, user personas, end-to-end recruiter/candidate workflows, functional requirements, adaptive assessment models, and non-functional requirements. |
| **Document 2** | [`DOCUMENT 2.pdf`](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%202.pdf) | 45 | **Full Technical Implementation Plan**: Multi-layer technology stack (React 19, Node.js/Express, Prisma, PostgreSQL/Supabase), bidirectional WebSocket audio pipeline, AI provider integration boundaries, asynchronous queue architecture (BullMQ), and 5-phase engineering roadmap. |
| **Document 3** | [`DOCUMENT 3.pdf`](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%203.pdf) | 34 | **Complete Web App Frontend Blueprint**: 3-tier experience model (Public Website, Recruiter Platform, Candidate Portal), route hierarchies, component states, audio visualizer UI, responsive guidelines, and accessibility standards. |
| **Document 4** | [`DOCUMENT 4.pdf`](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%204.pdf) | 43 | **Software Architecture & Development Structure**: Layered modular monolith, controller/service/integration boundaries, AI pipeline orchestration (Deepgram Nova-2 STT, LLM reasoning, ElevenLabs TTS), and WebSocket session management. |
| **Document 5** | [`DOCUMENT 5.pdf`](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%205.pdf) | 37 | **Database Architecture & Security Model**: Entity-relationship models, tenant isolation, Supabase Auth identity mapping, foreign key cascade strategies, Row Level Security (RLS) policies, indexes, and database security rules. |
| **Document 6** | [`DOCUMENT 6.pdf`](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%206.pdf) | 28 | **Project Documentation & Reference Structure**: Seven permanent root documents, documentation lifecycle, source-of-truth hierarchy, feature-to-code traceability, and change-management protocols. |

---

## 3. Detailed Document Summaries

### [Document 1: Product & Functional Blueprint](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%201.pdf)
- **Vision**: Autonomous, standardized, conversational voice-AI technical interviews replacing manual, biased, unstandardized preliminary phone screens.
- **Workflows**:
  - *Recruiter*: Job creation ➔ JD upload ➔ Automated requirement extraction ➔ Calibrated rubric & questions ➔ Candidate invitation ➔ Candidate ranking leaderboard.
  - *Candidate*: Secure invitation validation ➔ Mic/environment check ➔ Distraction-free voice interview with follow-up probing ➔ Instant diagnostic report.
- **Latency Target**: Real-time voice loop target $\le$ 1.5s (Deepgram Nova-2 $\rightarrow$ LLM streaming $\rightarrow$ ElevenLabs).
- **Proctoring**: Tab switch, focus loss, visibility change, acoustic anomaly detection with full tamper-proof audit trails (NO discriminatory facial/emotion scoring).

### [Document 2: Full Technical Implementation Plan](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%202.pdf)
- **Tech Stack**: React 19 + Vite + Tailwind CSS + Lucide + Framer Motion (client); Node.js + Express + Prisma ORM (server); PostgreSQL via Supabase (database); Deepgram Nova-2 (STT); OpenAI GPT-4o / Gemini 1.5 Pro (LLM); ElevenLabs (TTS); WebSockets (audio streaming).
- **Execution Strategy**: 5-phase delivery model with explicit acceptance criteria per milestone.
- **Integration Boundary**: Strict isolation of third-party SDKs inside `server/src/integrations/`.

### [Document 3: Complete Web App Frontend Blueprint](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%203.pdf)
- **Three Experience Portals**:
  1. *Public Experience*: High-conversion landing page, live product demo sandbox, transparent pricing.
  2. *Recruiter Portal*: Dashboard, JD Intelligence, Job creation, Candidate leaderboard, Multi-dimensional scorecard, Analytics.
  3. *Candidate Portal*: Invitation entry, Device check, Audio room, Active conversation visualizer, Diagnostic report.

### [Document 4: Software Architecture & Development Structure](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%204.pdf)
- **Layered Architecture**: Presentation $\rightarrow$ Transport/Gateway $\rightarrow$ Business Services $\rightarrow$ Integration Adapters $\rightarrow$ Data Access.
- **Audio Pipeline**: Duplex binary WebSocket streaming with Voice Activity Detection (VAD) and turn-taking orchestration.
- **Resilience**: Asynchronous offloading for heavy operations (PDF generation, JD parsing, post-interview scoring) via BullMQ and Redis.

### [Document 5: Database Architecture & Security Model](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%205.pdf)
- **Central Principle**: Every sensitive assessment record has an explicit ownership path and authorization boundary.
- **Entities**: Organizations, Profiles (Auth Users), Memberships, Jobs, Job Requirements, Rubrics, Rubric Criteria, Questions, Candidates, Applications, Invitations, Interviews, Sessions, Transcripts, Evaluations, Scores, Communication Metrics, Proctoring Events, Proctoring Summaries, Reports, Candidate Diagnostic Reports, Recruiter Analytics.
- **Security**: Defense-in-depth combining server-level tenant context binding with database-level Supabase PostgreSQL Row Level Security (RLS) policies.

### [Document 6: Project Documentation & Reference Structure](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%206.pdf)
- **Governance**: Establishes the 7 permanent root Markdown files and defines how changes to specifications must cascade into code and documentation.

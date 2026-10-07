# QualifyAI

> **Enterprise AI-Powered Technical Recruitment & Conversational Voice Assessment Platform**

QualifyAI is an enterprise-grade, dual-sided technical hiring platform that connects Job Description (JD) intelligence with conversational AI voice interviewing, automated multi-dimensional technical evaluation, and candidate integrity analytics.

---

## 1. Product Overview

QualifyAI bridges the gap between hiring organizations and technical candidates by replacing manual, biased, unstandardized preliminary phone screens with autonomous, calibrated AI voice interviews.

```
Job Description Upload (PDF / DOCX / Text)
         ↓
Intelligent JD Parsing & Skill Extraction
         ↓
Role-Specific Rubric Synthesis (0–100 Multi-Dimensional)
         ↓
Targeted Question Pool Generation
         ↓
Candidate Invitation & Hardware Check (Mic / Speaker / Network)
         ↓
AI Real-Time Voice Interview (Turnaround Latency ≤ 1500ms)
    ├── Continuous Binary Audio Streaming (WebSockets)
    ├── AI Orchestration Layer (`AIOrchestrator` Rate Limiting & State Management)
    ├── Primary AI Engine: Google Gemini (`@google/genai` with model fallback chain)
    └── Optional Plug-and-Play Adapters (Deepgram, OpenAI, ElevenLabs)
         ↓
Multi-Dimensional Evaluation & Scoring
    ├── Technical Correctness & Systems Depth (Cited Transcript Quotes)
    ├── Problem-Solving & Architecture Decomposition
    └── Communication Clarity (WPM & Filler Word Density)
         ↓
Interview Integrity & Proctoring Analytics (Focus Loss & Acoustic Anomaly Logs)
         ↓
Reports & Actionable Intelligence
    ├── Candidate Diagnostic Growth Report (Verified Strengths & Audio Feedback)
    └── Recruiter Cohort Leaderboard & Executive PDF Scorecard
```

---

## 2. Core Platform Capabilities

- **Multi-Tenant SaaS Architecture**: Strict tenant isolation across organizations, departments, and roles enforced at both application and PostgreSQL Row Level Security (RLS) layers.
- **Intelligent JD Parser**: Automatic extraction of core competencies, programming languages, system design requirements, and seniority tiers into structured JSON schemas.
- **Dynamic Rubric Generation**: Role-tailored scoring benchmarks (Novice 1, Competent 3, Mastery 5) generated directly from verified job requirements.
- **Adaptive AI Voice Interviewing**: Natural, low-latency, conversational voice interviews that adapt in real time to candidate answers with clarifying follow-ups.
- **Explainable Multi-Dimensional Evaluation**: Quantitative and qualitative scoring (0–100 scale) grounded strictly in the generated rubric and verified by transcript citations.
- **Ethical Integrity Monitoring**: Acoustic anomaly detection, tab-switch monitoring, and focus-loss tracking without invasive or pseudoscientific facial/emotion scoring.
- **Dual-Sided Reporting**: In-depth diagnostic growth summaries for candidates and comparative cohort ranking dashboards for recruiters.

---

## 3. Technology Stack

| Layer | Technology | Purpose & Description |
| :--- | :--- | :--- |
| **Frontend Client** | React 19, Vite 8, Tailwind CSS v3, Framer Motion | 3-tier experience (Public, Recruiter, Candidate), Web Audio API, responsive UI |
| **Backend Server** | Node.js, Express | Layered clean architecture, modular monolith, REST APIs |
| **Real-Time Audio** | WebSockets (`ws`) | Binary audio streaming, low-latency duplex session orchestration |
| **Database** | PostgreSQL 17 (Supabase) | 21-table normalized schema, migrations, RLS policies |
| **Authentication** | Supabase Auth, JWT | Role-based access control (`ORG_ADMIN`, `RECRUITER`, `REVIEWER`, `CANDIDATE`) |
| **Background Processing** | Redis, BullMQ | Asynchronous JD parsing, post-interview evaluations, report compilation |
| **Primary AI Provider** | Google Gemini (`@google/genai`) | JD parsing, rubric synthesis, adaptive interview reasoning, answer analysis, scoring |
| **AI Orchestration** | `AIOrchestrator` & `AIProvider` | Rate limiting, token optimization, high-availability model fallback chain, caching |
| **Optional Adapters** | Deepgram Nova-2 / ElevenLabs / OpenAI | Optional modular plugins adhering to `AIProvider` contract |
| **Storage** | Logical Storage / Supabase Storage | Encrypted storage for resumes, recordings, reports, and transcripts |

---

## 4. Repository Structure

```
QUALIFYAI/
│
├── README.md                  # Project overview and development entry point
├── prd.md                     # Product Requirements Document (Permanent Source of Truth)
├── architecture.md            # Technical & System Architecture (Permanent Source of Truth)
├── design.md                  # Design System & UX Standards (Permanent Source of Truth)
├── memory.md                  # Living Project State & Architectural Decision Log
├── phases.md                  # Authoritative Development Roadmap & Milestones
├── rules.md                   # Permanent Engineering Rules & Security Invariants
│
├── client/                    # Frontend client application (React 19 + Vite + Tailwind)
│   ├── public/                # Static public assets
│   └── src/                   # Client source code
│       ├── assets/            # Static media, icons, and illustrations
│       ├── components/        # Reusable UI component library (design system & landing)
│       ├── layouts/           # Page shell layouts (Recruiter, Candidate, Public)
│       ├── pages/             # Route-level page views (LandingPage, Dashboard, etc.)
│       ├── routes/            # Route configuration and navigation guards
│       ├── services/          # HTTP API client services
│       ├── hooks/             # Custom React hooks (audio, websockets, auth)
│       ├── context/           # React context providers (Auth, Organization state)
│       ├── lib/               # Utility functions and library configurations
│       ├── constants/         # UI constants and route definitions
│       ├── utils/             # Formatting, timing, and audio math helpers
│       └── styles/            # Global styles and design tokens
│
├── server/                    # Backend server application (Node.js + Express)
│   └── src/                   # Server source code
│       ├── config/            # Environment and service configurations
│       ├── constants/         # Application constants and error codes
│       ├── controllers/       # HTTP request handlers
│       ├── integrations/      # Isolated third-party adapters (Deepgram, LLM, ElevenLabs, Supabase)
│       ├── middleware/        # Auth, tenant context, rate limiting, error handling
│       ├── modules/           # Domain modules (jdIntelligence, rubricEngine, aiInterview, etc.)
│       ├── routes/            # Express route declarations
│       ├── services/          # Core domain business logic
│       ├── utils/             # Cryptographic tokens, audio math, logger helpers
│       └── validators/        # Declarative schema validators (Zod / Joi)
│
├── storage/                   # Logical application storage layer
│   ├── candidate-documents/   # Candidate uploaded supplementary materials
│   ├── interview-recordings/  # Raw binary audio session recordings (.webm)
│   ├── job-descriptions/      # Uploaded job description source documents
│   ├── organization-assets/   # Employer brand assets and logos
│   ├── reports/               # Generated executive evaluation reports (PDF)
│   ├── resumes/               # Ingested candidate resumes (PDF, DOCX)
│   ├── temp/                  # Ephemeral upload processing sandbox
│   └── transcripts/           # Immutable interview conversation records (JSON)
│
├── document/                  # Formal Foundation Specifications Archive
│   ├── DOCUMENT 1.pdf         # Product & Functional Blueprint (37 pages)
│   ├── DOCUMENT 2.pdf         # Full Technical Implementation Plan (45 pages)
│   ├── DOCUMENT 3.pdf         # Complete Web App Frontend Blueprint (34 pages)
│   ├── DOCUMENT 4.pdf         # Software Architecture & Development Structure (43 pages)
│   ├── DOCUMENT 5.pdf         # Database Architecture & Security Model (37 pages)
│   └── DOCUMENT 6.pdf         # Project Documentation & Reference Structure (28 pages)
│
└── docs/                      # Living Engineering & Supporting Technical Documentation
    ├── README.md              # Living documentation index and contribution guide
    ├── api/                   # REST API specifications and OpenAPI contracts
    ├── database/              # Schema references, ER diagrams, and migration guides
    ├── ai/                    # Prompt engineering templates, VAD benchmarks, latency logs
    ├── interview/             # Real-time state machine and audio streaming protocols
    ├── security/              # Multi-tenant RLS guides and encryption specifications
    └── deployment/            # Docker, CI/CD, and infrastructure configurations
```

---

## 5. Documentation Source-of-Truth Hierarchy

As defined in **Document 6**, QualifyAI enforces a 3-layer documentation governance model:

1. **Root Source of Truth (Permanent)**:
   - [`prd.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/prd.md): Functional and product requirements.
   - [`architecture.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/architecture.md): System, audio, and database architecture.
   - [`design.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/design.md): UX standards, route structure, and design system.
   - [`rules.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/rules.md): Engineering invariants and security rules.
   - [`phases.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/phases.md): Development roadmap and phase deliverables.
   - [`memory.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/memory.md): Living state log and architectural decisions.
   - [`MEETING_ROOM_IMPLEMENTATION_SPEC.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/MEETING_ROOM_IMPLEMENTATION_SPEC.md): Authoritative real-time AI meeting room specification, question engine, voice streaming, and proctoring.
2. **Formal Foundation Specifications Archive (`document/`)**:
   - Immutable baseline blueprints ([`DOCUMENT 1.pdf`](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%201.pdf) through [`DOCUMENT 6.pdf`](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%206.pdf), 224 total pages). See [`document/README.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/document/README.md).
3. **Living Engineering Documentation (`docs/`)**:
   - Technical specifications, API references, and runbooks under active maintenance. See [`docs/README.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/docs/README.md).

---

## 6. Getting Started

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **PostgreSQL / Supabase**: Active Supabase project instance

### Quickstart
```bash
# 1. Install dependencies
npm install

# 2. Run both Server (API + WebSockets) & Client together at once
npm run dev
# Starts simultaneously:
# - Express API Gateway + Gemini AI + WebSocket Server on http://localhost:5000 (ws://localhost:5000/ws/voice-interview)
# - React Vite Client SPA on http://localhost:3000
```

---

## 7. Quality Assurance & System Verification

QualifyAI has been subjected to a complete, non-mocked End-to-End integration test and quality audit across all tiers (Frontend, Backend, Database, Auth, AI, WebSockets, Proctoring, Evaluations, and Leaderboards).

- **Master E2E Test Suite**: `scratch/test-master-e2e-suite.js` (36 of 36 gates passed — 100% success rate).
- **Comprehensive Audit Reports**:
  1. [`docs/testing/COMPLETE_TEST_PLAN.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/docs/testing/COMPLETE_TEST_PLAN.md) — Master test plan and 36-gate test matrix.
  2. [`docs/testing/E2E_TEST_RESULTS.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/docs/testing/E2E_TEST_RESULTS.md) — End-to-end execution results across Golden Paths 1 & 2.
  3. [`docs/testing/INTEGRATION_TEST_RESULTS.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/docs/testing/INTEGRATION_TEST_RESULTS.md) — Cross-tier integration and protocol verification.
  4. [`docs/testing/SECURITY_TEST_RESULTS.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/docs/testing/SECURITY_TEST_RESULTS.md) — Multi-tenant isolation, Rule 7 compliance, and penetration tests.
  5. [`docs/testing/AI_TEST_RESULTS.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/docs/testing/AI_TEST_RESULTS.md) — Gemini model validation, schema enforcement, and benchmark metrics.
  6. [`docs/testing/PERFORMANCE_TEST_RESULTS.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/docs/testing/PERFORMANCE_TEST_RESULTS.md) — End-to-end latency benchmarks and memory profiles.
  7. [`docs/testing/BUG_FIX_REPORT.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/docs/testing/BUG_FIX_REPORT.md) — 8 defects diagnosed, corrected, and regression verified.
  8. [`docs/testing/FINAL_SYSTEM_ACCEPTANCE.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/docs/testing/FINAL_SYSTEM_ACCEPTANCE.md) — Formal release certification (v1.2.0).


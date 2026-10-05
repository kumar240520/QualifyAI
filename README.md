# QualifyAI

> **Enterprise AI-Powered Technical Recruitment and Interview Assessment SaaS Platform**

QualifyAI is an enterprise-grade, dual-sided technical hiring platform that connects Job Description (JD) intelligence with conversational AI voice interviewing, automated multi-dimensional technical evaluation, and candidate integrity analytics.

---

## 1. Product Overview

QualifyAI bridges the gap between hiring organizations and technical candidates by automating the initial technical screening and deep competency interviews with voice-based AI interviewers.

```
Job Description Upload
         ↓
Intelligent JD Parsing
         ↓
Requirement & Skill Extraction
         ↓
Role-Specific Rubric Generation
         ↓
Adaptive Question Generation
         ↓
Candidate Invitation & Scheduling
         ↓
AI Real-Time Voice Interview
    ├── Low-Latency Audio Streaming
    ├── Speech-to-Text (STT via Deepgram)
    ├── LLM Reasoning & Adaptive Probing (OpenAI / Gemini)
    └── Text-to-Speech Synthesis (TTS via ElevenLabs)
         ↓
Multi-Dimensional Evaluation & Scoring
    ├── Technical Correctness & Depth
    ├── Problem Solving & Architecture
    └── Communication Clarity
         ↓
Interview Integrity & Proctoring Analytics
         ↓
Comprehensive Candidate Diagnostic Report & PDF
         ↓
Recruiter Dashboard & Comparative Candidate Ranking
```

---

## 2. Core Capabilities

- **Multi-Tenant SaaS Architecture**: Strict tenant isolation across organizations, departments, and roles.
- **Intelligent JD Parser**: Automatic extraction of core competencies, programming languages, system design requirements, and seniority expectations.
- **Dynamic Rubric Generation**: Role-tailored scoring benchmarks generated directly from verified job requirements.
- **Adaptive AI Voice Interviewing**: Natural, low-latency, conversational voice interviews that adapt in real time to candidate answers with technical follow-ups.
- **Explainable Multi-Dimensional Evaluation**: Quantitative and qualitative scoring grounded strictly in the generated rubric.
- **Interview Integrity Monitoring**: Acoustic anomaly detection, tab-switch monitoring, and focus-loss tracking without invasive or pseudoscientific facial scoring.
- **Executive & Candidate Reports**: In-depth diagnostic summaries, candidate growth feedback, and recruiter ranking dashboards.

---

## 3. Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React / Next.js, Tailwind CSS | Modular component architecture, Web Audio API, responsive UI |
| **Backend** | Node.js, Express | Layered clean architecture, REST APIs |
| **Real-Time Audio** | WebSockets / Socket.io | Binary audio streaming, low-latency duplex session orchestration |
| **Database** | PostgreSQL, Prisma ORM | Relational schema, migrations, tenant-scoped querying |
| **Authentication** | Supabase Auth, JWT | Role-based access control (Admin, Recruiter, Candidate) |
| **Background Processing** | Redis, BullMQ | Asynchronous JD parsing, post-interview evaluations, report compilation |
| **Speech-to-Text (STT)** | Deepgram | Real-time WebSocket streaming transcription |
| **LLM Reasoning** | OpenAI / Google Gemini | Rubric generation, question synthesis, adaptive interview dialogue |
| **Text-to-Speech (TTS)** | ElevenLabs | Low-latency natural conversational voice synthesis |
| **Storage** | Logical Storage Layer / Supabase Storage | Encrypted storage for resumes, recordings, reports, and transcripts |

---

## 4. Repository Structure

QualifyAI maintains a clean, modular repository organization:

```
QUALIFYAI/
│
├── README.md                  # Project overview and development entry point
├── prd.md                     # Product Requirements Document (Source of Truth)
├── architecture.md            # Technical & System Architecture (Source of Truth)
├── design.md                  # Design System & UX Standards (Source of Truth)
├── memory.md                  # Living Project State & Decision Log
├── phases.md                  # Authoritative Development Roadmap & Milestones
├── rules.md                   # Permanent Engineering Rules & Invariants
│
├── client/                    # Frontend client application
│   ├── public/                # Static public assets
│   └── src/                   # Client source code (domain-oriented)
│       ├── assets/            # Static media, icons, and illustrations
│       ├── components/        # Reusable UI component library
│       ├── layouts/           # Page shell layouts (Recruiter, Candidate, Public)
│       ├── pages/             # Route-level page views
│       ├── routes/            # Route configuration and navigation guards
│       ├── services/          # HTTP API client services
│       ├── hooks/             # Custom React hooks (audio, websockets, auth)
│       ├── context/           # React context providers (Auth, Interview state)
│       ├── lib/               # Third-party wrappers and client utilities
│       ├── constants/         # Client configuration constants
│       ├── utils/             # Pure utility functions
│       └── styles/            # Global styles and Tailwind configuration
│
├── server/                    # Backend API and real-time engine
│   └── src/                   # Server source code (layered architecture)
│       ├── config/            # Environment and infrastructure configurations
│       ├── constants/         # System constants and error codes
│       ├── middleware/        # Auth, tenant scoping, error, and rate-limiting middleware
│       ├── routes/            # HTTP and WebSocket route definitions
│       ├── controllers/       # HTTP request/response boundary handlers
│       ├── services/          # Core domain business logic
│       ├── validators/        # Request payload schema validators
│       ├── integrations/      # Third-party SDK boundaries (Deepgram, OpenAI, ElevenLabs)
│       ├── modules/           # Self-contained domain modules
│       └── utils/             # Helper utilities and loggers
│
├── storage/                   # Logical storage management layer
│   ├── resumes/               # Candidate uploaded resumes
│   ├── job-descriptions/      # Parsed and original JD files
│   ├── interview-recordings/  # Audio session recordings
│   ├── transcripts/           # Raw and annotated interview transcripts
│   ├── reports/               # Generated candidate evaluation PDFs
│   ├── candidate-documents/   # Additional candidate submitted verification files
│   ├── organization-assets/   # Recruiter company logos and branding assets
│   └── temp/                  # Ephemeral processing storage
│
├── document/                  # Formal project specifications and reference artifacts
│
└── docs/                      # Supporting engineering documentation and diagrams
```

---

## 5. Architectural Principles

1. **Source of Truth Hierarchy**: The seven root Markdown files (`README.md`, `prd.md`, `architecture.md`, `design.md`, `memory.md`, `phases.md`, `rules.md`) are the authoritative governance documents.
2. **Provider Isolation**: Third-party AI providers (Deepgram, OpenAI/Gemini, ElevenLabs) are strictly encapsulated behind integration adapter interfaces in `server/src/integrations/`. No provider SDK leaks into domain services.
3. **Multi-Tenant Isolation**: Every database query, storage path, and business transaction is isolated by `organizationId`. Cross-tenant data leakage is prohibited.
4. **Ethical Evaluation Focus**: Proctoring measures focus exclusively on technical reasoning, communication clarity, tab-focus integrity, and acoustic anomalies. **Facial micro-expression or emotion scoring is strictly prohibited.**
5. **No Premature Microservices**: QualifyAI is built as a clean, modular monolith with distinct domains, ensuring high developer velocity while maintaining clear boundaries for future scaling.

---

## 6. Development Workflow & Status

- **Current Phase**: **Phase 0: Architecture & Repository Initialization** (Completed)
- **Next Phase**: **Phase 1: Foundation, Multi-Tenancy & Authentication**
- See [`phases.md`](./phases.md) for detailed milestone breakdowns and exit criteria.
- Consult [`rules.md`](./rules.md) for mandatory engineering rules before writing any code.
- Check [`memory.md`](./memory.md) for the active implementation state and architectural decisions.

---

## 7. License & Confidentiality

QualifyAI is an enterprise SaaS platform. All proprietary rights, system designs, and intellectual property remain reserved.

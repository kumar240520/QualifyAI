# Product Requirements Document (PRD) — QualifyAI

**Document Status:** Approved / Source of Truth  
**Target Platform:** QualifyAI Enterprise SaaS  
**Document Version:** 1.0.0  

---

## 1. Product Vision & Objectives

### 1.1 Vision
QualifyAI transforms technical hiring from an exhausting, inconsistent, and bottlenecked manual screening process into an automated, objective, and deeply insightful AI-guided experience. By aligning role-specific job descriptions directly with conversational AI voice interviews and transparent multi-dimensional evaluation rubrics, QualifyAI empowers organizations to evaluate candidate depth faster while giving candidates a fair, stress-reducing interview opportunity.

### 1.2 Core Objectives
- **Reduce Time-to-Screen**: Cut engineering and recruiter screening time by over 75% through automated initial technical interviews.
- **Ensure Fair & Objective Assessment**: Standardize technical evaluation against dynamic rubrics generated directly from the employer's Job Description.
- **Natural Conversational Experience**: Deliver a human-like, low-latency voice dialogue where the AI adapts dynamically with probing technical follow-ups.
- **Auditability & Explainability**: Provide transparent scoring breakdowns backed by complete audio transcripts, code assessments, and verifiable rubric criteria.
- **Maintain High Ethical Standards**: Reject pseudo-scientific biometric emotion/facial scoring in favor of objective technical performance and acoustic/environmental integrity signals.

---

## 2. Target Users & Personas

### 2.1 Enterprise Recruiter / Talent Acquisition Specialist (Alice)
- **Profile**: Manages high-volume applicant pipelines across multiple engineering roles.
- **Pain Points**: Lacks deep technical expertise to vet senior systems engineering candidates; spends days scheduling manual 30-minute screening calls; struggles with resume keyword fluff.
- **Goals**: Create a job, upload the JD, invite candidates in batch, receive structured scorecards with actionable ranking, and forward qualified candidates to hiring managers.

### 2.2 Hiring Manager / Engineering Director (Bob)
- **Profile**: Leads backend/full-stack teams; frustrated by interviewing underqualified candidates sent from general screening.
- **Pain Points**: Engineering team loses 10+ hours per week conducting repetitive early-round interviews.
- **Goals**: Customize interview rubrics to reflect real engineering challenges; inspect candidate transcripts and audio highlights; rely on objective scoring dimensions.

### 2.3 Technical Candidate (Charlie)
- **Profile**: Software engineer applying for technical positions.
- **Pain Points**: Nervousness in live high-pressure interviews; opaque rejection emails without feedback; scheduling conflicts across time zones.
- **Goals**: Interview at their convenience in a calm, clear environment; experience a natural dialogue that truly tests their technical problem-solving; receive constructive diagnostic feedback.

### 2.4 Organization Administrator (David)
- **Profile**: Head of People or CTO managing the enterprise subscription.
- **Goals**: Manage team access, seat licensing, single sign-on (SSO), data retention, audit logs, and compliance.

---

## 3. High-Level Product Workflow

```
Recruiter creates Job & uploads JD
               ↓
QualifyAI extracts skills, seniority, and requirements
               ↓
AI generates customizable assessment Rubric & Question Pool
               ↓
Recruiter reviews/adjusts rubric and sends interview invitations
               ↓
Candidate completes system/mic check and enters interview room
               ↓
AI Voice Interviewer conducts interactive technical interview
    - Dynamic questions
    - Real-time speech-to-text
    - Adaptive follow-up probes
    - Text-to-speech conversational response
               ↓
Continuous interview integrity monitoring (Focus & Acoustic signals)
               ↓
Post-interview asynchronous evaluation & multi-dimensional scoring
               ↓
Comprehensive Diagnostic Report & PDF generated
               ↓
Recruiter Dashboard updates with candidate ranking and comparative analytics
```

---

## 4. Functional Requirements

### 4.1 Organization & User Management (Multi-Tenancy)
- **FR-1.1**: The platform must support multi-tenant organization workspaces. All user data, jobs, candidates, and reports must be strictly isolated by `organizationId`.
- **FR-1.2**: Role-Based Access Control (RBAC) must support:
  - `Org Admin`: Manage organization settings, billing, users, and audit logs.
  - `Recruiter`: Create jobs, manage candidates, invite candidates, view reports and rankings.
  - `Hiring Manager (Reviewer)`: Read-only access to job rubrics, candidate transcripts, and evaluation scorecards.
  - `Candidate`: Access to invited interview sessions, system check, and candidate diagnostic feedback.

### 4.2 Job Management & Intelligent JD Parser
- **FR-2.1**: Recruiters can upload Job Descriptions in PDF, DOCX, or plain text format.
- **FR-2.2**: The parser must automatically extract:
  - Core programming languages and technical frameworks.
  - Required architectural competencies (e.g., distributed systems, caching, DB design).
  - Experience level / seniority tier (Junior, Mid, Senior, Staff, Lead).
  - Soft skill requirements (collaboration, agile methodologies, leadership).
- **FR-2.3**: Recruiter can review, edit, or append extracted requirements before finalizing the job requisition.

### 4.3 Dynamic Rubric & Question Generation
- **FR-3.1**: The system must synthesize a multi-tier evaluation rubric directly from approved job requirements.
- **FR-3.2**: Each rubric criteria must define:
  - Criterion Name (e.g., "PostgreSQL Concurrency Control", "RESTful API Security").
  - Weighting (1–5 scale or percentage).
  - Explicit scoring benchmarks for 1 (Novice), 3 (Competent), and 5 (Mastery).
- **FR-3.3**: The system must generate a seed pool of technical interview questions targeting the specific rubric criteria.

### 4.4 Candidate Invitation & Onboarding
- **FR-4.1**: Recruiters can invite candidates individually via email or in bulk via CSV.
- **FR-4.2**: Candidates receive a secure, tamper-proof, single-use interview link with an expiration window.
- **FR-4.3**: Candidates go through an automated pre-interview hardware check:
  - Microphone input detection and audio level testing.
  - Speaker/headphone output check.
  - Network latency and WebSockets connection health check.
  - Clear presentation of interview guidelines, rules, and privacy expectations.

### 4.5 Real-Time AI Voice Interview Engine
- **FR-5.1**: Candidate speech is captured via Web Audio API and streamed in real time over WebSockets to the server.
- **FR-5.2**: The backend streams candidate audio to Deepgram for continuous low-latency Speech-to-Text (STT).
- **FR-5.3**: Turn-taking logic identifies when the candidate has completed their response (voice activity detection + silence timeout).
- **FR-5.4**: The LLM reasoning engine processes the candidate's transcript within the context of the current question, the rubric, and past session history.
- **FR-5.5**: The LLM generates either:
  - An adaptive follow-up probing question to explore candidate reasoning or clarify ambiguous statements.
  - The next substantive technical question from the rubric roadmap.
- **FR-5.6**: The generated response is synthesized via ElevenLabs Text-to-Speech (TTS) and streamed back to the client for immediate playback.
- **FR-5.7**: Total audio turnaround latency (candidate stop speaking to AI response playback start) must target **under 1200ms**.

### 4.6 Multi-Dimensional Evaluation & Scoring
- **FR-6.1**: Post-interview processing evaluates candidate performance across standardized dimensions:
  - **Technical Correctness**: Factual accuracy and conceptual precision.
  - **Technical Depth & Systems Thinking**: Grasp of trade-offs, edge cases, scalability, and internal mechanics.
  - **Problem-Solving Methodology**: Structured approach to ambiguity and decomposition.
  - **Communication Clarity**: Concise, structured technical articulation.
- **FR-6.2**: All scores must be grounded in the generated rubric and backed by cited quotes from the interview transcript.
- **FR-6.3**: An aggregate composite score (0–100) is calculated based on configured rubric weightings.

### 4.7 Interview Integrity & Proctoring
- **FR-7.1**: Browser visibility changes (tab switches, minimizing window, backgrounding) are timestamped and recorded as integrity events.
- **FR-7.2**: Acoustic anomaly analysis detects potential secondary background voices or suspicious continuous audio interruptions.
- **FR-7.3**: The system outputs a Proctoring & Integrity Summary highlighting flagged events with timestamps linked to transcript moments.
- **FR-7.4 (CRITICAL CONSTRAINT)**: The system **must NOT** use facial micro-expression, emotional state, or pseudo-scientific visual emotion scoring. Integrity analysis is strictly limited to environmental/browser signals and acoustic presence.

### 4.8 Recruiter Dashboard & Analytics
- **FR-8.1**: Job dashboard with interactive candidate ranking table (sortable by composite score, technical depth, communication, and integrity flag status).
- **FR-8.2**: Detailed candidate view containing:
  - Executive summary and key hiring recommendation.
  - Dimension breakdown with radar/bar charts.
  - Synchronized full audio recording and transcript with speaker diarization.
  - Integrity event timeline.
  - Exportable branded PDF Candidate Report.
- **FR-8.3**: Comparative candidate analysis enabling side-by-side evaluation of finalists.

### 4.9 Candidate Diagnostic Feedback
- **FR-9.1**: Candidates can be granted access to a constructive feedback report (configured at the organization level).
- **FR-9.2**: Feedback highlights technical strengths, areas for technical growth, and recommended topics for study, maintaining a positive candidate experience.

---

## 5. Non-Functional Requirements

### 5.1 Performance & Latency
- Voice response latency (Candidate turn end → AI voice audio playback start): **Target < 1200ms**, 95th percentile < 1800ms.
- Dashboard load time: Under 1.5 seconds for candidate lists with up to 500 applicants.
- PDF Report generation time: Under 10 seconds via asynchronous background queue.

### 5.2 Security, Privacy & Compliance
- **Data Isolation**: Multi-tenant data segregation enforced at the application, API, and database layers.
- **Data Protection**: Encryption in transit (TLS 1.3) and at rest (AES-256) for all transcripts, recordings, and candidate resumes.
- **Access Control**: Signed short-lived URLs for accessing audio recordings, resumes, and PDF reports.
- **Regulatory Alignment**: GDPR and CCPA compliant data retention controls, candidate data deletion requests, and transparent AI disclosure.

### 5.3 Reliability & Availability
- 99.9% uptime SLA for candidate interview sessions.
- Graceful reconnection handling: If candidate network drops, the interview session state is preserved for up to 5 minutes to allow reconnecting without losing progress.

---

## 6. Product Constraints & Architectural Invariants

1. **Rubric-Grounded Scoring**: AI evaluators must never invent criteria outside the generated and recruiter-approved rubric.
2. **Explainability**: Every score point must reference verifiable candidate utterances.
3. **No Emotional / Facial AI**: QualifyAI strictly excludes visual micro-expression or emotion detection.
4. **Decoupled AI Providers**: The system must not hardcode provider-specific logic into domain entities; Deepgram, OpenAI, Gemini, and ElevenLabs must be interchangeable through adapter interfaces.

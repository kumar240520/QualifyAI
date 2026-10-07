# Product Requirements Document (PRD) — QualifyAI

**Document Status:** Approved / Source of Truth  
**Target Platform:** QualifyAI Enterprise SaaS  
**Document Version:** 1.1.0 (Fully Synchronized with Foundation Documents 1–6)  

---

## 1. Product Vision & Objectives

### 1.1 Vision
QualifyAI transforms technical hiring from an exhausting, inconsistent, and bottlenecked manual screening process into an automated, objective, and deeply insightful AI-guided conversational experience. By aligning role-specific job descriptions directly with conversational AI voice interviews and transparent multi-dimensional evaluation rubrics, QualifyAI empowers organizations to evaluate candidate depth faster while giving candidates a fair, stress-reducing interview opportunity with actionable growth feedback.

### 1.2 Core Objectives (from Document 1)
- **Automate Technical Screening**: Eliminate repetitive 30–45 minute preliminary recruiter phone screens, cutting time-to-evaluate by over 75%.
- **Standardize Evaluation**: Calibrate scoring against transparent, role-specific rubrics synthesized directly from the employer's Job Description.
- **Conversational Real-Time Dialogue**: Deliver natural voice interaction ($\le$ 1500ms latency) where the AI actively listens, probes ambiguous answers, and asks relevant follow-up questions.
- **Explainable & Grounded Scoring**: Provide 0–100 multi-dimensional scores where every point is justified by cited quotes from the interview transcript.
- **Candidate-Centric Feedback**: Replace opaque rejection emails with personalized Diagnostic Reports detailing verified technical strengths and recommended growth areas.
- **Ethical Integrity Standards**: Strictly reject pseudo-scientific facial/emotion AI in favor of objective technical responses and environmental/browser integrity signals.

---

## 2. Target Users & Personas

### 2.1 Enterprise Recruiter / Talent Acquisition Specialist (Alice)
- **Profile**: Manages high-volume applicant pipelines across multiple engineering requisitions.
- **Pain Points**: Lacks deep systems engineering background; overwhelmed by resume fluff; spends 20+ hours weekly on unstandardized preliminary phone screens.
- **Goals**: Create jobs, upload JDs, auto-generate calibrated rubrics, invite candidates in batch, and inspect stack-ranked leaderboards with objective scorecards.

### 2.2 Engineering Hiring Manager / Director (Bob)
- **Profile**: Leads backend/infrastructure engineering teams.
- **Pain Points**: Engineering team loses hundreds of engineering hours interviewing unqualified candidates; screening feedback is subjective and inconsistent.
- **Goals**: Customize rubric criteria to reflect production failure modes; review synchronized audio transcripts and radar charts; forward top 10% finalists to on-sites.

### 2.3 Technical Candidate (Charlie)
- **Profile**: Software engineer applying for roles.
- **Pain Points**: High interview anxiety; scheduling conflicts; ghosting without feedback after preliminary screens.
- **Goals**: Complete the interview asynchronously in a comfortable setting; engage in a real technical discussion that probes actual architecture depth; receive transparent diagnostic feedback.

### 2.4 Organization Administrator (David)
- **Profile**: Head of People or VP of Engineering managing enterprise compliance.
- **Goals**: Enforce multi-tenant data isolation, manage recruiter seats, configure Supabase Auth SSO, and ensure GDPR/CCPA data retention compliance.

---

## 3. High-Level Product Workflows

### 3.1 Recruiter Workflow (5 Stages)
```
[1. Job Setup]         Upload JD (PDF/DOCX/Text) ➔ AI extracts skills, seniority, architecture
            ↓
[2. Rubric Creation]   AI synthesizes 0–100 rubric & question pool ➔ Recruiter adjusts weights
            ↓
[3. Candidate Invite]  Recruiter invites candidate (email/CSV) ➔ Secure tokenized link generated
            ↓
[4. Interview Review]  Candidate completes session ➔ Automated evaluation, scores & proctoring log
            ↓
[5. Cohort Analytics]  Recruiter views candidate leaderboard, radar comparison & exportable PDF
```

### 3.2 Candidate Workflow (4 Stages)
```
[1. Onboarding]        Candidate opens invitation link ➔ Validates token & terms
            ↓
[2. Hardware Check]    Interactive mic/speaker level check & network latency validation
            ↓
[3. AI Voice Interview] Conversational technical dialogue (VAD, adaptive follow-ups, questions)
            ↓
[4. Diagnostic Report] Instant diagnostic feedback with verified strengths & growth pointers
```

---

## 4. Functional Requirements

### 4.1 Organization & User Management (Multi-Tenancy)
- **FR-1.1**: Multi-tenant data segregation. Every organization, user profile, job, candidate, and report must be strictly partitioned by `organization_id`.
- **FR-1.2**: Role-Based Access Control (RBAC):
  - `ORG_ADMIN`: Organization settings, member invitations, billing, audit logs.
  - `RECRUITER`: Job creation, rubric adjustment, candidate management, report access.
  - `REVIEWER`: Read-only access to job rubrics, candidate transcripts, and scorecards.
  - `CANDIDATE`: Restricted access exclusively to their own interview room and diagnostic report.

### 4.2 Job Management & Intelligent JD Parser
- **FR-2.1**: Multi-format JD ingestion (PDF, DOCX, Markdown, plain text).
- **FR-2.2**: Automated extraction of core languages, frameworks, system design concepts, seniority tier, and role responsibilities into structured JSON schema (`job_requirements`).
- **FR-2.3**: Recruiter can edit, augment, or approve extracted requirements before rubric synthesis.

### 4.3 Dynamic Rubric & Question Generation
- **FR-3.1**: Synthesis of role-specific evaluation criteria mapped to the approved JD.
- **FR-3.2**: Each criterion contains: Name, Description, Weight (1–5), Expected Competency, and 3-level benchmark descriptors (Novice 1, Competent 3, Mastery 5).
- **FR-3.3**: Generation of a targeted question pool with categorized question types (Technical, System Design, Problem Solving, Behavioral).

### 4.4 Candidate Invitation & Onboarding
- **FR-4.1**: Generation of single-use, tamper-proof, time-expiring invitation tokens.
- **FR-4.2**: Pre-interview automated hardware diagnostic:
  - Microphone input energy detection.
  - Speaker/headphone playback confirmation.
  - Network jitter and WebSocket handshake check.
  - Clear presentation of interview guidelines and privacy disclosures.

### 4.5 Real-Time AI Voice Interview Engine
- **FR-5.1**: Candidate speech captured via Web Audio API and streamed in real time over secure WebSockets.
- **FR-5.2**: Continuous audio and transcription processing powered by Google Gemini Realtime integration through the server-side AI Orchestration layer.
- **FR-5.3**: Deterministic turn-taking and policy engine detects turn completion and orchestrates conversational flow.
- **FR-5.4**: Primary AI Reasoning Engine (Google Gemini via `GeminiProvider`) evaluates answer completeness against the rubric and dynamically generates either:
  - An adaptive follow-up probing question to explore candidate reasoning or clarify ambiguous statements.
  - The next substantive technical question from the question roadmap.
- **FR-5.5**: High-fidelity speech synthesis streamed directly back to the client for immediate playback.
- **FR-5.6**: Turnaround latency budget: **$\le$ 1500ms** total turnaround from candidate silence to AI speech playback start.

### 4.6 Multi-Dimensional Evaluation & Scoring
- **FR-6.1**: Post-interview scoring across four standardized pillars:
  1. **Technical Correctness** (0–100): Accuracy of technical claims and principles.
  2. **Technical Depth & Systems Thinking** (0–100): Trade-off analysis, edge-case anticipation, scalability.
  3. **Problem-Solving Methodology** (0–100): Structured decomposition of complex challenges.
  4. **Communication Clarity** (0–100): Concise articulation, logical signposting, and low filler density.
- **FR-6.2**: Rubric-grounded evidence: All criterion scores must cite verbatim quotes from the candidate transcript.
- **FR-6.3**: Overall composite score calculated based on configured rubric criterion weightings.

### 4.7 Interview Integrity & Proctoring
- **FR-7.1**: Real-time logging of environmental integrity signals:
  - Window blur / tab focus loss.
  - Page visibility changes.
  - Acoustic anomaly detection (secondary voices, unnatural speech patterns).
- **FR-7.2**: Dual-layer proctoring model:
  - *Raw Events*: Timestamped audit log of every discrete occurrence (`proctoring_events`).
  - *Integrity Summary*: Overall risk tiering (`HIGH`, `MODERATE`, `SUSPICIOUS`) and trust score (`proctoring_summaries`).
- **FR-7.3 (ETHICAL CONSTRAINT)**: Visual facial recognition, micro-expression tracking, and emotion AI are **strictly prohibited**.

### 4.8 Recruiter Dashboard & Analytics
- **FR-8.1**: Candidate cohort leaderboard with multi-parameter sorting (Composite Score, Technical Depth, Communication, Integrity Flags).
- **FR-8.2**: Detailed candidate view with interactive radar chart, synchronized audio transcript playback, and proctoring audit timeline.
- **FR-8.3**: One-click branded Executive PDF Report generation.

### 4.9 Candidate Diagnostic Reports
- **FR-9.1**: Post-interview personalized feedback view for candidates:
  - Verified Strengths in System Architecture.
  - Recommended Growth Areas and failover trade-offs.
  - Articulation & speech cadence metrics (WPM, clarity).
  - Audio snippet feedback player.

---

## 5. Non-Functional Requirements

### 5.1 Performance & Latency
- Voice turnaround latency: Target $\le$ 1200ms, 95th percentile $\le$ 1500ms.
- Dashboard API response time: $\le$ 250ms for candidate pipelines up to 1,000 applicants.
- PDF generation time: $\le$ 8 seconds via background BullMQ worker queue.

### 5.2 Security, Privacy & Compliance
- **Data Segregation**: Multi-tenant separation enforced at application, API, and PostgreSQL RLS layers.
- **Encryption**: TLS 1.3 in transit, AES-256 at rest for resumes, audio recordings, transcripts, and reports.
- **Access Control**: Signed, expiring URLs (15-minute validity) for all private media and PDF downloads.
- **Compliance**: GDPR / CCPA compliant data deletion workflows, explicit AI interview consent, and full auditability.

### 5.3 Reliability & Availability
- 99.9% uptime SLA for interview session WebSockets.
- Graceful session recovery: Reconnection state preserved for 5 minutes if candidate network drops.

---

## 6. Product Invariants & Non-Negotiable Boundaries

1. **Rubric-Grounded Scoring**: AI evaluators must never invent evaluation criteria outside the approved rubric.
2. **Explainability**: Every score point must reference verifiable candidate utterances.
3. **No Emotional / Facial AI**: Strict prohibition of webcam biometric analysis.
4. **AI Provider Abstraction**: Google Gemini serves as the primary AI provider, decoupled via the `AIProvider` interface. Optional adapters (OpenAI, Deepgram, ElevenLabs) can be plugged in without changing domain business logic.

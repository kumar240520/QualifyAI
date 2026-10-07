# Living Engineering Documentation (`docs/`) — QualifyAI

This directory is the **supporting engineering documentation workspace** for QualifyAI. It houses deep-dive technical guides, API contracts, sequence diagrams, and operational runbooks.

---

## 1. Documentation Layering & Governance (from Document 6)

| Layer | Location | Purpose & Governance |
| :--- | :--- | :--- |
| **Root Source of Truth** | `/` (Project Root) | **Seven Permanent Source-of-Truth Documents**: [`README.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/README.md), [`prd.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/prd.md), [`architecture.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/architecture.md), [`design.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/design.md), [`memory.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/memory.md), [`phases.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/phases.md), [`rules.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/rules.md). Never move into `docs/`. |
| **Living Engineering Docs** | `docs/` | **Detailed Implementation Notes & Guides**: Specialized deep dives, API specs, database schemas, and audio benchmarks under active development. |
| **Formal Foundation Specs** | `document/` | **Formal Foundation Specifications Archive**: High-level, approved institutional blueprints ([`DOCUMENT 1.pdf`](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%201.pdf) through [`DOCUMENT 6.pdf`](file:///d:/JAVA%20WEBDEV/QualifyAI/document/DOCUMENT%206.pdf), 224 total pages). |

---

## 2. Planned Subsections for `docs/` (as specified in Document 6)

As the platform evolves through its development phases, supporting engineering guides will be organized into these eight domains:

1. **`docs/api/`**: REST API endpoints, request/response schemas, OpenAPI/Swagger contracts, and WebSocket payload protocols.
2. **`docs/ai/`**: Prompt engineering templates, LLM reasoning pipelines, VAD benchmarks, and turnaround latency profiles.
3. **`docs/database/`**: Schema drill-downs, ER diagrams, foreign-key cascade maps, index benchmarks, and PostgreSQL RLS policy guides.
4. **`docs/interview/`**: Real-time state machine diagrams, Web Audio API audio chunking, and turn-taking orchestration. See [`MEETING_ROOM_SPEC.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/docs/interview/MEETING_ROOM_SPEC.md) and [`MEETING_ROOM_IMPLEMENTATION_SPEC.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/MEETING_ROOM_IMPLEMENTATION_SPEC.md).
5. **`docs/security/`**: Multi-tenant defense-in-depth, JWT verification flows, signed storage URL enforcement, and threat mitigation.
6. **`docs/deployment/`**: Docker containerization, CI/CD pipeline automation, environment configurations, and production runbooks.
7. **`docs/integrations/`**: Third-party adapter specifications for Deepgram Nova-2, OpenAI GPT-4o, Google Gemini, ElevenLabs, and Supabase.
8. **`docs/development/`**: Local developer onboarding, coding conventions, test execution suites, and Git workflows.

---

## 3. Governance Rules

1. **Alignment with Root Documents**: Content in `docs/` must remain in strict alignment with [`architecture.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/architecture.md), [`prd.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/prd.md), and [`rules.md`](file:///d:/JAVA%20WEBDEV/QualifyAI/rules.md).
2. **No Duplication of Source Code**: Technical guides should explain architecture, data flows, and constraints without copying complete source files.
3. **Root Markdown Invariance**: The seven permanent root documents must never be moved into or replaced by files in `docs/`.

# Technical Documentation Workspace (`docs/`) — QualifyAI

This directory is the **supporting engineering documentation workspace** for QualifyAI.

---

## 1. Distinction from Root Markdown Files

| Location | Purpose | Governance |
| :--- | :--- | :--- |
| **Project Root (`/`)** | **Permanent Sources of Truth** (`README.md`, `prd.md`, `architecture.md`, `design.md`, `memory.md`, `phases.md`, `rules.md`) | Authoritative platform specifications and engineering invariants. Never move into `docs/`. |
| **`docs/`** | **Supporting Technical Documentation** (Implementation guides, API endpoint references, sequence diagrams, benchmark results, setup guides). | Living technical notes, design drill-downs, and developer references. |
| **`document/`** | **Formal Project Artifacts** (Product briefs, compliance documents, external RFP responses, whitepapers). | Formal institutional documents separate from technical engineering notes. |

---

## 2. Planned Subsections for `docs/`

As the implementation progresses, supporting documentation will be added here:

- `docs/api/`: REST API schemas, OpenAPI/Swagger specifications, and WebSocket protocol definitions.
- `docs/audio-pipeline/`: Deep-dive guides on audio chunking, Web Audio API Worklets, latency optimization, and VAD configuration.
- `docs/evaluations/`: Rubric generation prompts, scoring formulas, and evaluation audit trails.
- `docs/deployment/`: Production deployment runbooks, Docker configurations, and infrastructure guides.

---

## 3. Governance Rule
Do NOT move the seven root Markdown files into this directory. Keep all supporting guides aligned with the root architecture documents.

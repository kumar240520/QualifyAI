# Formal Project Documents & Reference Artifacts (`document/`) — QualifyAI

This directory contains **formal project artifacts, institutional reference materials, legal/compliance specifications, and external documentation** for QualifyAI.

---

## 1. Directory Responsibility

`document/` is strictly separated from:
- `docs/` (which hosts supporting technical/engineering documentation and API references).
- `storage/` (which hosts application runtime file assets like resumes and recordings).
- Root Markdown files (which host the authoritative source of truth for architecture and product design).

---

## 2. Intended Contents

- **Formal Project Proposals & Scope Statements**
- **Security & Compliance Artifacts** (e.g., SOC2 readiness checklists, GDPR candidate consent policies, AI ethics declarations)
- **Vendor Evaluation Sheets & Benchmarks** (e.g., Deepgram vs Whisper latency benchmarks, ElevenLabs voice latency profiles)
- **External Integration Specifications**

---

## 3. Storage & Code Rules

1. Do NOT store runtime candidate files, resumes, or interview recordings in this directory (use `storage/` instead).
2. Do NOT place implementation code (`.js`, `.ts`, `.py`, `.sql`) in this directory.

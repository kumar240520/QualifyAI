# Logical Storage Layer (`storage/`) — QualifyAI

This directory represents the **logical storage layer** for QualifyAI. It manages file assets produced and consumed during recruitment and interview workflows.

---

## 1. Directory Structure & Asset Responsibilities

```
storage/
├── resumes/                 # Uploaded candidate resumes (PDF, DOCX)
├── job-descriptions/        # Uploaded and parsed job description documents
├── interview-recordings/    # Audio recordings of completed AI voice interviews (.webm, .wav, .mp3)
├── transcripts/             # Structured JSON & text transcripts with speaker diarization
├── reports/                 # Compiled candidate diagnostic evaluation PDF dossiers
├── candidate-documents/     # Supplementary verification files, portfolios, or certificates
├── organization-assets/     # Enterprise tenant logos, branding banners, and email header assets
└── temp/                    # Ephemeral files for audio transcoding, PDF compilation, and temp chunks
```

---

## 2. Storage Principles & Security Rules

1. **Separation from Source Code**: This directory is completely decoupled from application code (`client/` and `server/`).
2. **Tenant Path Isolation**: Every asset must be stored under a tenant-scoped path hierarchy:
   ```
   storage/{category}/{organizationId}/{entityId}/{fileName}
   ```
   Example: `storage/reports/org_98765/int_12345/candidate_report.pdf`
3. **Signed Access Only**: Application clients never access the raw filesystem path directly. The server issues time-limited signed URLs (or streams authenticated buffers via the API).
4. **Production Target**: In production environments, this logical layout maps transparently to object storage (Supabase Storage or AWS S3 buckets) using tenant-prefixed storage buckets.

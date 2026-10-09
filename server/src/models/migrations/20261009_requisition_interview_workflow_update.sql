-- Migration: 20261009_requisition_interview_workflow_update.sql
-- Description: Adds background, allowed/custom question types, project config, customizable opening question,
-- target difficulty, and safe deletion timestamps to jobs and candidates.

-- 1. Add background, question types, project config, opening question, difficulty, and soft-delete columns to jobs
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS background_type VARCHAR(50) NOT NULL DEFAULT 'TECHNICAL',
  ADD COLUMN IF NOT EXISTS custom_background VARCHAR(100),
  ADD COLUMN IF NOT EXISTS allowed_question_types JSONB NOT NULL DEFAULT '["SHORT_ANSWER", "DESCRIPTIVE", "MULTIPLE_CHOICE", "SCENARIO"]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_question_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ask_about_projects BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS opening_question TEXT,
  ADD COLUMN IF NOT EXISTS target_difficulty VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Safe check constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_jobs_background_type'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT chk_jobs_background_type
      CHECK (background_type IN ('TECHNICAL', 'NON_TECHNICAL', 'BUSINESS_DEVELOPMENT', 'MARKETING', 'CUSTOM'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_jobs_target_difficulty'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT chk_jobs_target_difficulty
      CHECK (target_difficulty IN ('EASY', 'MEDIUM', 'HARD'));
  END IF;
END $$;

-- 2. Add soft-delete column to candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Optimization indexes
CREATE INDEX IF NOT EXISTS idx_jobs_org_deleted ON public.jobs(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_candidates_org_deleted ON public.candidates(organization_id, deleted_at);

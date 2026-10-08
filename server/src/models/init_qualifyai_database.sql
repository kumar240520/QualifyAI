-- ==============================================================================
-- QualifyAI Database Architecture & Security Model Migration
-- Aligned with Document 5 (PostgreSQL 17 on Supabase)
-- 21 Normalized Entities, Foreign Keys, Indexes, Functions, and RLS Policies
-- ==============================================================================

-- 1. Helper trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. organizations (Tenant Boundary Root)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  industry VARCHAR(100),
  company_size VARCHAR(100),
  website VARCHAR(255),
  target_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  assessment_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 2. profiles (Application User Identity mapped to Supabase auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'RECRUITER' CHECK (role IN ('ORG_ADMIN', 'RECRUITER', 'REVIEWER', 'CANDIDATE')),
  phone VARCHAR(50),
  location VARCHAR(255),
  recruiter_role VARCHAR(100),
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 3. organization_memberships (User-Organization Association)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'RECRUITER' CHECK (role IN ('ORG_ADMIN', 'RECRUITER', 'REVIEWER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_org_user UNIQUE (organization_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 4. jobs (Recruitment Position Requisitions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  department VARCHAR(100),
  seniority VARCHAR(50) DEFAULT 'MID' CHECK (seniority IN ('JUNIOR', 'MID', 'SENIOR', 'STAFF', 'LEAD')),
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 5. job_requirements (Structured Requirements parsed from JD)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID UNIQUE NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience_years INT,
  responsibilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  technical_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  role_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. rubrics (Role-Specific Evaluation Matrix)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID UNIQUE NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_rubrics_updated_at
  BEFORE UPDATE ON public.rubrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 7. rubric_criteria (Pillars & 1–5 Scoring Benchmarks)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES public.rubrics(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  weight INT NOT NULL DEFAULT 1 CHECK (weight >= 1 AND weight <= 5),
  expected_competency TEXT,
  evaluation_guidance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. questions (Targeted Technical Interview Question Pool)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  rubric_criterion_id UUID REFERENCES public.rubric_criteria(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'TECHNICAL' CHECK (type IN ('TECHNICAL', 'SYSTEM_DESIGN', 'PROBLEM_SOLVING', 'BEHAVIORAL', 'MULTIPLE_CHOICE', 'MULTI_SELECT', 'CODE_OUTPUT', 'CODE_WRITING', 'SQL', 'FILL_IN_THE_BLANK', 'TRUE_FALSE', 'SCENARIO', 'DESCRIPTIVE')),
  question_text TEXT NOT NULL,
  difficulty VARCHAR(50) DEFAULT 'MEDIUM' CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
  context_order INT DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. candidates (Tenant-Scoped Talent Pool Identity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  resume_url TEXT,
  experience_years VARCHAR(50),
  specialization VARCHAR(255),
  recent_company VARCHAR(255),
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_org_candidate_email UNIQUE (organization_id, email)
);

CREATE TRIGGER trg_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 10. applications (Candidate Association with Specific Job)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED', 'INVITED', 'INTERVIEWED', 'OFFERED', 'REJECTED')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_job_candidate UNIQUE (job_id, candidate_id)
);

-- ------------------------------------------------------------------------------
-- 11. invitations (Secure Tokenized Access Links)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'SENT', 'OPENED', 'ACCEPTED', 'EXPIRED', 'COMPLETED')),
  expires_at TIMESTAMPTZ NOT NULL,
  interview_duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (interview_duration_minutes BETWEEN 5 AND 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS interview_duration_minutes INTEGER NOT NULL DEFAULT 30
  CHECK (interview_duration_minutes BETWEEN 5 AND 180);

-- ------------------------------------------------------------------------------
-- 12. interviews (Central Assessment Instance)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'EVALUATED', 'CANCELLED')),
  warning_count INTEGER NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_interviews_job_candidate ON public.interviews(job_id, candidate_id);

-- ------------------------------------------------------------------------------
-- 13. interview_sessions (Real-Time WebSocket Session State)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID UNIQUE NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  connection_state VARCHAR(50) NOT NULL DEFAULT 'DISCONNECTED' CHECK (connection_state IN ('CONNECTED', 'ACTIVE', 'PAUSED', 'DISCONNECTED')),
  current_question_index INT NOT NULL DEFAULT 0,
  conversation_state VARCHAR(50) NOT NULL DEFAULT 'IDLE' CHECK (conversation_state IN ('IDLE', 'AI_SPEAKING', 'CANDIDATE_SPEAKING', 'THINKING')),
  audio_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_interview_sessions_updated_at
  BEFORE UPDATE ON public.interview_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 14. transcripts (Conversational Dialogue Turns)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  speaker VARCHAR(50) NOT NULL CHECK (speaker IN ('AI', 'CANDIDATE')),
  content TEXT NOT NULL,
  sequence INT NOT NULL,
  audio_timestamp_ms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 15. evaluations (0–100 Multi-Dimensional Objective Assessment)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID UNIQUE NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  overall_score NUMERIC(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  technical_score NUMERIC(5,2) NOT NULL CHECK (technical_score >= 0 AND technical_score <= 100),
  problem_solving_score NUMERIC(5,2) NOT NULL CHECK (problem_solving_score >= 0 AND problem_solving_score <= 100),
  communication_score NUMERIC(5,2) NOT NULL CHECK (communication_score >= 0 AND communication_score <= 100),
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 16. rubric_scores (Score per Rubric Criterion with Cited Quotes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rubric_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
  rubric_criterion_id UUID NOT NULL REFERENCES public.rubric_criteria(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  justification TEXT NOT NULL,
  evidence_quotes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 17. communication_metrics (Verbal Benchmarks: WPM & Clarity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID UNIQUE NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  wpm INT NOT NULL,
  filler_word_density NUMERIC(4,2) NOT NULL,
  clarity_score NUMERIC(5,2) NOT NULL CHECK (clarity_score >= 0 AND clarity_score <= 100),
  pauses_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 18. proctoring_events (Raw Telemetry Event Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proctoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL CHECK (event_type IN ('FOCUS_LOSS', 'TAB_SWITCH', 'VISIBILITY_CHANGE', 'ACOUSTIC_ANOMALY', 'FULLSCREEN_EXIT', 'CLIPBOARD_ATTEMPT', 'RIGHT_CLICK', 'SCREENSHOT_ATTEMPT', 'DEVTOOLS_ATTEMPT', 'FACE_ABSENT', 'MULTIPLE_FACES', 'CAMERA_LOST', 'FACE_ORIENTATION')),
  event_id UUID NOT NULL DEFAULT gen_random_uuid(),
  severity VARCHAR(50) NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp_ms BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0 CHECK (warning_count >= 0);
ALTER TABLE public.proctoring_events ADD COLUMN IF NOT EXISTS event_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.proctoring_events DROP CONSTRAINT IF EXISTS proctoring_events_event_type_check;
ALTER TABLE public.proctoring_events ADD CONSTRAINT proctoring_events_event_type_check
  CHECK (event_type IN ('FOCUS_LOSS', 'TAB_SWITCH', 'VISIBILITY_CHANGE', 'ACOUSTIC_ANOMALY', 'FULLSCREEN_EXIT', 'CLIPBOARD_ATTEMPT', 'RIGHT_CLICK', 'SCREENSHOT_ATTEMPT', 'DEVTOOLS_ATTEMPT', 'FACE_ABSENT', 'MULTIPLE_FACES', 'CAMERA_LOST', 'FACE_ORIENTATION'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_proctoring_event_id ON public.proctoring_events(event_id);

CREATE OR REPLACE FUNCTION public.record_proctoring_event(
  p_interview_id UUID,
  p_invitation_token TEXT,
  p_event_id UUID,
  p_event_type TEXT,
  p_severity TEXT,
  p_metadata JSONB,
  p_timestamp_ms BIGINT,
  p_is_warning BOOLEAN DEFAULT TRUE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_interview public.interviews%ROWTYPE;
  v_event_id UUID;
  v_warning_count INTEGER;
  v_status TEXT;
BEGIN
  SELECT iv.* INTO v_interview
  FROM public.interviews iv
  JOIN public.invitations inv ON inv.job_id = iv.job_id AND inv.candidate_id = iv.candidate_id
  WHERE iv.id = p_interview_id
    AND inv.token = p_invitation_token
    AND inv.status NOT IN ('COMPLETED', 'EXPIRED')
  FOR UPDATE OF iv;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is not authorized for this interview' USING ERRCODE = '42501';
  END IF;

  IF v_interview.status IN ('COMPLETED', 'EVALUATED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Interview is no longer active' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.proctoring_events (interview_id, event_type, event_id, severity, metadata, timestamp_ms)
  VALUES (p_interview_id, p_event_type, p_event_id, p_severity, COALESCE(p_metadata, '{}'::jsonb), p_timestamp_ms)
  ON CONFLICT (event_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('duplicate', TRUE, 'warningCount', v_interview.warning_count, 'terminated', v_interview.status = 'COMPLETED');
  END IF;

  v_warning_count := v_interview.warning_count;
  v_status := v_interview.status;
  IF p_is_warning THEN
    v_warning_count := v_warning_count + 1;
    IF v_warning_count >= 3 THEN
      v_status := 'COMPLETED';
    END IF;
    UPDATE public.interviews
      SET warning_count = v_warning_count,
          status = v_status,
          completed_at = CASE WHEN v_status = 'COMPLETED' THEN COALESCE(completed_at, NOW()) ELSE completed_at END
      WHERE id = p_interview_id;

    IF v_status = 'COMPLETED' THEN
      UPDATE public.invitations SET status = 'COMPLETED' WHERE job_id = v_interview.job_id AND candidate_id = v_interview.candidate_id;
      UPDATE public.interview_sessions
        SET connection_state = 'DISCONNECTED', conversation_state = 'IDLE'
        WHERE interview_id = p_interview_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'duplicate', FALSE,
    'warningCount', v_warning_count,
    'terminated', v_status = 'COMPLETED' AND p_is_warning,
    'eventId', v_event_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_proctoring_event(UUID, TEXT, UUID, TEXT, TEXT, JSONB, BIGINT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_proctoring_event(UUID, TEXT, UUID, TEXT, TEXT, JSONB, BIGINT, BOOLEAN) TO service_role;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0)
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_bucket_key TEXT,
  p_window_seconds INTEGER,
  p_max_requests INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started TIMESTAMPTZ;
  v_count INTEGER;
  v_allowed BOOLEAN;
  v_retry INTEGER;
BEGIN
  IF p_window_seconds < 1 OR p_max_requests < 1 OR length(p_bucket_key) > 128 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;

  INSERT INTO public.api_rate_limits AS current_window (bucket_key, window_started_at, request_count)
  VALUES (p_bucket_key, NOW(), 1)
  ON CONFLICT (bucket_key) DO UPDATE SET
    request_count = CASE
      WHEN current_window.window_started_at <= NOW() - make_interval(secs => p_window_seconds) THEN 1
      ELSE current_window.request_count + 1
    END,
    window_started_at = CASE
      WHEN current_window.window_started_at <= NOW() - make_interval(secs => p_window_seconds) THEN NOW()
      ELSE current_window.window_started_at
    END
  RETURNING window_started_at, request_count INTO v_started, v_count;

  v_allowed := v_count <= p_max_requests;
  v_retry := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_started + make_interval(secs => p_window_seconds) - NOW())))::INTEGER);
  IF random() < 0.01 THEN
    DELETE FROM public.api_rate_limits WHERE window_started_at < NOW() - INTERVAL '1 day';
  END IF;
  RETURN jsonb_build_object('allowed', v_allowed, 'count', v_count, 'remaining', GREATEST(0, p_max_requests - v_count), 'retryAfterSeconds', v_retry);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- ------------------------------------------------------------------------------
-- 19. proctoring_summaries (Derived Integrity Assessment & Trust Tier)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proctoring_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID UNIQUE NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  risk_score NUMERIC(5,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  trust_level VARCHAR(50) NOT NULL DEFAULT 'HIGH' CHECK (trust_level IN ('HIGH', 'MODERATE', 'SUSPICIOUS')),
  total_anomalies INT NOT NULL DEFAULT 0,
  flags_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 20. reports (Recruiter Executive Summary & PDF URL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID UNIQUE NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  overall_summary TEXT NOT NULL,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvement_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  technical_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  communication_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  integrity_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 21. candidate_diagnostic_reports (Candidate-Facing Growth Feedback)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_diagnostic_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID UNIQUE NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  verified_strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_growth_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  articulation_summary TEXT,
  audio_snippet_url TEXT,
  candidate_visible_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES (Performance Optimization for Multi-Tenant Lookups)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_memberships_org ON public.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_status ON public.jobs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_candidates_org ON public.candidates(organization_id);
CREATE INDEX IF NOT EXISTS idx_applications_job ON public.applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON public.applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_interviews_org ON public.interviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job ON public.interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON public.interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON public.interviews(status);
CREATE INDEX IF NOT EXISTS idx_transcripts_interview_seq ON public.transcripts(interview_id, sequence);
CREATE INDEX IF NOT EXISTS idx_proctoring_interview_time ON public.proctoring_events(interview_id, timestamp_ms);
CREATE INDEX IF NOT EXISTS idx_questions_job ON public.questions(job_id);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric ON public.rubric_criteria(rubric_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) & HELPER FUNCTIONS
-- ==============================================================================

-- Helper: Check if authenticated user belongs to the specified organization
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE organization_id = target_org_id
      AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Check if authenticated user is ORG_ADMIN for the specified organization
CREATE OR REPLACE FUNCTION public.is_org_admin(target_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE organization_id = target_org_id
      AND user_id = auth.uid()
      AND role = 'ORG_ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security on all 21 tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
-- Internal Assessment & Diagnostic Engine Tables
-- (Controlled via API gateway and tenant authorization middleware)
ALTER TABLE public.evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_summaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_diagnostic_reports DISABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT USING (id = auth.uid() OR role = 'ORG_ADMIN');

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- 2. Organizations Policies
CREATE POLICY orgs_select_member ON public.organizations
  FOR SELECT USING (public.is_org_member(id));

CREATE POLICY orgs_update_admin ON public.organizations
  FOR UPDATE USING (public.is_org_admin(id));

-- 3. Organization Memberships Policies
CREATE POLICY memberships_select_org ON public.organization_memberships
  FOR SELECT USING (public.is_org_member(organization_id));

-- 4. Jobs Policies
CREATE POLICY jobs_select_org ON public.jobs
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY jobs_insert_org ON public.jobs
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY jobs_update_org ON public.jobs
  FOR UPDATE USING (public.is_org_member(organization_id));

-- 5. Candidates Policies
CREATE POLICY candidates_select_org ON public.candidates
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY candidates_insert_org ON public.candidates
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY candidates_update_org ON public.candidates
  FOR UPDATE USING (public.is_org_member(organization_id));

-- 6. Interviews Policies
CREATE POLICY interviews_select_org ON public.interviews
  FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY interviews_insert_org ON public.interviews
  FOR INSERT WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY interviews_update_org ON public.interviews
  FOR UPDATE USING (public.is_org_member(organization_id));

-- 7. Candidate Diagnostic Reports Policy (Candidate access)
CREATE POLICY candidate_diag_select_candidate ON public.candidate_diagnostic_reports
  FOR SELECT USING (
    candidate_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.interviews
      WHERE interviews.id = candidate_diagnostic_reports.interview_id
        AND public.is_org_member(interviews.organization_id)
    )
  );

-- 8. Automatic Profile & Organization Provisioning Trigger on auth.users Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role VARCHAR(50);
  v_full_name VARCHAR(255);
  v_org_name VARCHAR(255);
  v_org_slug VARCHAR(100);
  v_org_id UUID;
BEGIN
  -- Auto-confirm user email so account is immediately ready for login
  IF NEW.email_confirmed_at IS NULL THEN
    UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = NEW.id;
  END IF;

  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'ORG_ADMIN');
  v_full_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1));
  v_org_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'organization_name', ''), v_full_name || '''s Organization');

  -- 1. Insert or update profile
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, v_full_name, v_role)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  -- 2. If recruiter or org admin, provision default organization & membership
  IF v_role IN ('ORG_ADMIN', 'RECRUITER') THEN
    IF NOT EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = NEW.id) THEN
      v_org_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      
      INSERT INTO public.organizations (name, slug)
      VALUES (v_org_name, v_org_slug)
      RETURNING id INTO v_org_id;

      INSERT INTO public.organization_memberships (organization_id, user_id, role)
      VALUES (v_org_id, NEW.id, 'ORG_ADMIN')
      ON CONFLICT (organization_id, user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

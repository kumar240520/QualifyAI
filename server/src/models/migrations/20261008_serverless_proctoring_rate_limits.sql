-- Apply once to existing Supabase projects before deploying the Vercel function.
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0 CHECK (warning_count >= 0);
CREATE UNIQUE INDEX IF NOT EXISTS uq_interviews_job_candidate ON public.interviews(job_id, candidate_id);

ALTER TABLE public.proctoring_events ADD COLUMN IF NOT EXISTS event_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.proctoring_events DROP CONSTRAINT IF EXISTS proctoring_events_event_type_check;
ALTER TABLE public.proctoring_events ADD CONSTRAINT proctoring_events_event_type_check CHECK (event_type IN (
  'FOCUS_LOSS', 'TAB_SWITCH', 'VISIBILITY_CHANGE', 'ACOUSTIC_ANOMALY',
  'FULLSCREEN_EXIT', 'CLIPBOARD_ATTEMPT', 'RIGHT_CLICK', 'SCREENSHOT_ATTEMPT', 'DEVTOOLS_ATTEMPT',
  'FACE_ABSENT', 'MULTIPLE_FACES', 'CAMERA_LOST', 'FACE_ORIENTATION'
));
CREATE UNIQUE INDEX IF NOT EXISTS uq_proctoring_event_id ON public.proctoring_events(event_id);

CREATE OR REPLACE FUNCTION public.record_proctoring_event(
  p_interview_id UUID, p_invitation_token TEXT, p_event_id UUID,
  p_event_type TEXT, p_severity TEXT, p_metadata JSONB,
  p_timestamp_ms BIGINT, p_is_warning BOOLEAN DEFAULT TRUE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
  WHERE iv.id = p_interview_id AND inv.token = p_invitation_token
    AND inv.status NOT IN ('COMPLETED', 'EXPIRED')
  FOR UPDATE OF iv;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation is not authorized for this interview' USING ERRCODE = '42501'; END IF;
  IF v_interview.status IN ('COMPLETED', 'EVALUATED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Interview is no longer active' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.proctoring_events(interview_id,event_type,event_id,severity,metadata,timestamp_ms)
  VALUES (p_interview_id,p_event_type,p_event_id,p_severity,COALESCE(p_metadata,'{}'::jsonb),p_timestamp_ms)
  ON CONFLICT (event_id) DO NOTHING RETURNING id INTO v_event_id;
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('duplicate',true,'warningCount',v_interview.warning_count,'terminated',v_interview.status='COMPLETED');
  END IF;

  v_warning_count := v_interview.warning_count;
  v_status := v_interview.status;
  IF p_is_warning THEN
    v_warning_count := v_warning_count + 1;
    IF v_warning_count >= 3 THEN v_status := 'COMPLETED'; END IF;
    UPDATE public.interviews SET warning_count=v_warning_count,status=v_status,
      completed_at=CASE WHEN v_status='COMPLETED' THEN COALESCE(completed_at,NOW()) ELSE completed_at END
      WHERE id=p_interview_id;
    IF v_status='COMPLETED' THEN
      UPDATE public.invitations SET status='COMPLETED' WHERE job_id=v_interview.job_id AND candidate_id=v_interview.candidate_id;
      UPDATE public.interview_sessions SET connection_state='DISCONNECTED',conversation_state='IDLE' WHERE interview_id=p_interview_id;
    END IF;
  END IF;
  RETURN jsonb_build_object('duplicate',false,'warningCount',v_warning_count,
    'terminated',v_status='COMPLETED' AND p_is_warning,'eventId',v_event_id);
END;
$$;
REVOKE ALL ON FUNCTION public.record_proctoring_event(UUID,TEXT,UUID,TEXT,TEXT,JSONB,BIGINT,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_proctoring_event(UUID,TEXT,UUID,TEXT,TEXT,JSONB,BIGINT,BOOLEAN) TO service_role;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0)
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(p_bucket_key TEXT,p_window_seconds INTEGER,p_max_requests INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_started TIMESTAMPTZ; v_count INTEGER; v_allowed BOOLEAN; v_retry INTEGER;
BEGIN
  IF p_window_seconds<1 OR p_max_requests<1 OR length(p_bucket_key)>128 THEN RAISE EXCEPTION 'Invalid rate limit parameters'; END IF;
  INSERT INTO public.api_rate_limits AS current_window(bucket_key,window_started_at,request_count)
  VALUES(p_bucket_key,NOW(),1)
  ON CONFLICT(bucket_key) DO UPDATE SET
    request_count=CASE WHEN current_window.window_started_at<=NOW()-make_interval(secs=>p_window_seconds) THEN 1 ELSE current_window.request_count+1 END,
    window_started_at=CASE WHEN current_window.window_started_at<=NOW()-make_interval(secs=>p_window_seconds) THEN NOW() ELSE current_window.window_started_at END
  RETURNING window_started_at,request_count INTO v_started,v_count;
  v_allowed:=v_count<=p_max_requests;
  v_retry:=GREATEST(1,CEIL(EXTRACT(EPOCH FROM (v_started+make_interval(secs=>p_window_seconds)-NOW())))::INTEGER);
  IF random()<0.01 THEN DELETE FROM public.api_rate_limits WHERE window_started_at<NOW()-INTERVAL '1 day'; END IF;
  RETURN jsonb_build_object('allowed',v_allowed,'count',v_count,'remaining',GREATEST(0,p_max_requests-v_count),'retryAfterSeconds',v_retry);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_api_rate_limit(TEXT,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(TEXT,INTEGER,INTEGER) TO service_role;

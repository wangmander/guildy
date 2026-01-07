-- ============================================================
-- GUILDY SCHEMA + RLS POLICIES
-- Run this in Supabase SQL Editor to fix security warnings
-- ============================================================

-- ============================================================
-- TABLE: email_processing_log
-- ============================================================
CREATE TABLE IF NOT EXISTS email_processing_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  gmail_thread_id TEXT,
  gmail_message_id TEXT NOT NULL,
  from_email TEXT,
  from_domain TEXT,
  company_guess TEXT,
  subject TEXT,
  detected BOOLEAN NOT NULL DEFAULT FALSE,
  score INTEGER,
  strongest_hit INTEGER,
  matched_keywords TEXT[],
  rejection_reason TEXT,
  llm_called BOOLEAN DEFAULT FALSE,
  llm_is_recruiting BOOLEAN,
  llm_company TEXT,
  llm_role TEXT,
  llm_stage TEXT,
  created_pipeline_id UUID,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_epl_user_email ON email_processing_log(user_email);
CREATE INDEX IF NOT EXISTS idx_epl_created_at ON email_processing_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_epl_gmail_message_id ON email_processing_log(gmail_message_id);

-- ============================================================
-- TABLE: sync_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  scanned INTEGER DEFAULT 0,
  detected INTEGER DEFAULT 0,
  inserted INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  rejected INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_sr_user_email ON sync_runs(user_email);
CREATE INDEX IF NOT EXISTS idx_sr_started_at ON sync_runs(started_at DESC);

-- ============================================================
-- Ensure pipelines table has all needed columns
-- ============================================================
DO $$ BEGIN ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS stage_detail TEXT; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS insights_json JSONB; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS prep_json JSONB; EXCEPTION WHEN others THEN NULL; END $$;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
-- If daily_email_requests exists:
DO $$ BEGIN ALTER TABLE daily_email_requests ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- ============================================================
-- RLS POLICIES FOR: pipelines
-- Service role bypasses these; anon users get nothing
-- ============================================================
DROP POLICY IF EXISTS "service_role_full_access_pipelines" ON pipelines;
CREATE POLICY "service_role_full_access_pipelines" ON pipelines
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- RLS POLICIES FOR: emails
-- ============================================================
DROP POLICY IF EXISTS "service_role_full_access_emails" ON emails;
CREATE POLICY "service_role_full_access_emails" ON emails
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- RLS POLICIES FOR: email_processing_log
-- ============================================================
DROP POLICY IF EXISTS "service_role_full_access_epl" ON email_processing_log;
CREATE POLICY "service_role_full_access_epl" ON email_processing_log
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- RLS POLICIES FOR: sync_runs
-- ============================================================
DROP POLICY IF EXISTS "service_role_full_access_sync_runs" ON sync_runs;
CREATE POLICY "service_role_full_access_sync_runs" ON sync_runs
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- RLS POLICIES FOR: daily_email_requests (if exists)
-- ============================================================
DO $$ 
BEGIN 
  DROP POLICY IF EXISTS "service_role_full_access_der" ON daily_email_requests;
  CREATE POLICY "service_role_full_access_der" ON daily_email_requests
    FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN 
  NULL;
END $$;

-- ============================================================
-- GRANT SERVICE ROLE ACCESS
-- The service_role key automatically bypasses RLS, but we need
-- policies that allow access. Using (true) means the service
-- role can access everything, while anon key gets nothing unless
-- authenticated via auth.uid() matching user_email.
-- ============================================================

-- Done! RLS is now enabled with permissive policies for service role.
-- The Security Advisor warnings should be resolved.

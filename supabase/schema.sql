-- ============================================================
-- GUILDY SCHEMA - Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- TABLE: email_processing_log
-- Purpose: Track every email processed during sync, including
--          why it was accepted or rejected
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
  action_taken TEXT, -- 'created_pipeline', 'updated_pipeline', 'rejected', 'skipped', 'error'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_epl_user_email ON email_processing_log(user_email);
CREATE INDEX IF NOT EXISTS idx_epl_created_at ON email_processing_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_epl_gmail_message_id ON email_processing_log(gmail_message_id);

-- ============================================================
-- TABLE: sync_runs
-- Purpose: Track each Gmail sync run with summary stats
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
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
-- (These are ALTER statements - they will be ignored if 
--  columns already exist)
-- ============================================================

-- Add stage_detail if missing
DO $$ 
BEGIN
  ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS stage_detail TEXT;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add insights_json if missing
DO $$ 
BEGIN
  ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS insights_json JSONB;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add prep_json if missing
DO $$ 
BEGIN
  ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS prep_json JSONB;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- NOTE: We use the Supabase SERVICE ROLE KEY in API routes,
-- which bypasses RLS. This is secure because:
-- 1. The service role key is only stored server-side
-- 2. API routes validate the user session before querying
-- 3. Queries filter by user_email from the authenticated session
-- 
-- No RLS policies are needed for server-side operations.
-- ============================================================

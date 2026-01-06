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
-- (These are ALTER statements - they'll fail gracefully if 
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
-- RLS Policies (if RLS is enabled)
-- These allow users to only see their own data
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE email_processing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

-- Policies for email_processing_log
DROP POLICY IF EXISTS "Users can view own processing logs" ON email_processing_log;
CREATE POLICY "Users can view own processing logs" ON email_processing_log
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

DROP POLICY IF EXISTS "Users can insert own processing logs" ON email_processing_log;
CREATE POLICY "Users can insert own processing logs" ON email_processing_log
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = user_email);

-- Policies for sync_runs
DROP POLICY IF EXISTS "Users can view own sync runs" ON sync_runs;
CREATE POLICY "Users can view own sync runs" ON sync_runs
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

DROP POLICY IF EXISTS "Users can insert own sync runs" ON sync_runs;
CREATE POLICY "Users can insert own sync runs" ON sync_runs
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = user_email);

DROP POLICY IF EXISTS "Users can update own sync runs" ON sync_runs;
CREATE POLICY "Users can update own sync runs" ON sync_runs
  FOR UPDATE USING (auth.jwt() ->> 'email' = user_email);

-- ============================================================
-- IMPORTANT: If using anon key from server routes, you may need
-- to temporarily disable RLS or use service role key.
-- To disable RLS (less secure, but simpler):
--
-- ALTER TABLE email_processing_log DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sync_runs DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE pipelines DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE emails DISABLE ROW LEVEL SECURITY;
-- ============================================================

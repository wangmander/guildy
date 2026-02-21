-- ============================================================
-- Guildy Gmail Detection V2 Migration
-- Run this in Supabase SQL Editor (safe to re-run)
-- ============================================================

-- ============================================================
-- 1. PIPELINES — add thread ID and timestamps
-- ============================================================
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS last_email_from_email TEXT;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS last_email_from_name TEXT;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS company_intel_json JSONB;
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS predicted_stages TEXT[];

-- Unique index: (user_email, gmail_thread_id) for thread inheritance lookups
-- Partial index: only for rows where gmail_thread_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipelines_user_thread
  ON pipelines(user_email, gmail_thread_id)
  WHERE gmail_thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pipelines_updated_at
  ON pipelines(updated_at DESC);

-- ============================================================
-- 2. EMAILS — add missing columns for rich message tracking
-- ============================================================
ALTER TABLE emails ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS from_name TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS body_text TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS analysis_json JSONB;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_recruiting BOOLEAN;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS message_type TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS llm_confidence FLOAT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS llm_summary TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS gmail_id TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS from_email TEXT;

-- Unique constraint required for upsert { onConflict: "gmail_message_id" }
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'emails_gmail_message_id_key'
  ) THEN
    ALTER TABLE emails ADD CONSTRAINT emails_gmail_message_id_key UNIQUE (gmail_message_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);

-- ============================================================
-- 3. GHOST LOGS — internal debug (never shown to users)
-- ============================================================
CREATE TABLE IF NOT EXISTS ghost_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT,
  reason TEXT NOT NULL, -- hard_junk_reject | router_no_match | llm_non_recruiting
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghost_logs_user ON ghost_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_ghost_logs_created ON ghost_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ghost_logs_message ON ghost_logs(gmail_message_id);

ALTER TABLE ghost_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_ghost_logs" ON ghost_logs;
CREATE POLICY "service_role_ghost_logs" ON ghost_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. STAGE HISTORY — immutable stage change audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS stage_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT,
  gmail_message_id TEXT,
  llm_confidence FLOAT
);

CREATE INDEX IF NOT EXISTS idx_stage_history_pipeline ON stage_history(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_user ON stage_history(user_email);
CREATE INDEX IF NOT EXISTS idx_stage_history_changed ON stage_history(changed_at DESC);

ALTER TABLE stage_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_stage_history" ON stage_history;
CREATE POLICY "service_role_stage_history" ON stage_history FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. EMAIL_PROCESSING_LOG — extend with V2 observability fields
-- ============================================================
ALTER TABLE email_processing_log ADD COLUMN IF NOT EXISTS gate TEXT;
    -- THREAD_INHERITANCE | LLM_CLASSIFIED
ALTER TABLE email_processing_log ADD COLUMN IF NOT EXISTS outcome TEXT;
    -- accepted_known_thread | accepted_new_or_attached | rejected_non_recruiting
ALTER TABLE email_processing_log ADD COLUMN IF NOT EXISTS router_reason TEXT;
    -- ats_domain | jobish_subject | warm_lead_score | no_signal
ALTER TABLE email_processing_log ADD COLUMN IF NOT EXISTS router_score INTEGER;
ALTER TABLE email_processing_log ADD COLUMN IF NOT EXISTS llm_confidence FLOAT;
ALTER TABLE email_processing_log ADD COLUMN IF NOT EXISTS llm_model TEXT;
ALTER TABLE email_processing_log ADD COLUMN IF NOT EXISTS llm_response JSONB;

CREATE INDEX IF NOT EXISTS idx_epl_gate ON email_processing_log(gate);
CREATE INDEX IF NOT EXISTS idx_epl_outcome ON email_processing_log(outcome);

-- ============================================================
-- 6. DISMISSED THREADS — user-deleted pipeline suppression
-- When a pipeline is deleted, its Gmail thread IDs are recorded
-- here so the sync never recreates them from old emails.
-- NEW threads from the same company are unaffected (different threadId).
-- ============================================================
CREATE TABLE IF NOT EXISTS dismissed_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, gmail_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_threads_user ON dismissed_threads(user_email);
CREATE INDEX IF NOT EXISTS idx_dismissed_threads_lookup ON dismissed_threads(user_email, gmail_thread_id);

ALTER TABLE dismissed_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_dismissed_threads" ON dismissed_threads;
CREATE POLICY "service_role_dismissed_threads" ON dismissed_threads FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Done. V2 schema is active.
-- ============================================================

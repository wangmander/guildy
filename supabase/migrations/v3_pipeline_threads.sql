-- Guildy V3 Migration
-- Run in Supabase SQL Editor before deploying V3 code

-- 1. pipeline_threads table — supports many Gmail threads per pipeline
CREATE TABLE IF NOT EXISTS pipeline_threads (
  user_email      TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_email, gmail_thread_id)
);

CREATE INDEX IF NOT EXISTS idx_pt_pipeline ON pipeline_threads(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pt_user ON pipeline_threads(user_email);

-- 2. Backfill from emails table
--    (pipelines.gmail_thread_id is legacy — emails table is the source of truth)
INSERT INTO pipeline_threads (user_email, gmail_thread_id, pipeline_id)
SELECT DISTINCT e.user_email, e.gmail_thread_id, e.pipeline_id
FROM emails e
WHERE e.gmail_thread_id IS NOT NULL
  AND e.pipeline_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Sync run audit columns
ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS mini_calls_made INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prep_calls_made INTEGER DEFAULT 0;

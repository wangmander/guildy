-- Wipes all pipelines and emails to force a complete re-sync and re-analysis
-- Run this in the Supabase SQL Editor

TRUNCATE TABLE emails CASCADE;
TRUNCATE TABLE pipelines CASCADE;

-- Verify it's empty
SELECT count(*) FROM pipelines;

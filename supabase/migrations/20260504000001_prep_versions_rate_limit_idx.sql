-- Phase 4c-4 patch 7: index supporting the rate-limit count query in
-- lib/ai/rate-limit.ts. The query shape is:
--
--   select count(*) from prep_versions
--   where user_id = $1 and tier = $2 and created_at >= $3
--
-- Existing indexes are (job_id) and (job_id, tier, context_hash). Neither has
-- user_id as the leading column, so the planner falls back to a sequential
-- scan. This index keeps daily and monthly count queries sub-50ms as the
-- prep_versions table grows.

create index if not exists prep_versions_user_tier_created_idx
  on public.prep_versions (user_id, tier, created_at desc);

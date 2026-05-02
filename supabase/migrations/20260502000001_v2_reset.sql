-- Guildy V2 Phase 1 — full V1 reset.
-- Drops all V1 tables. Auth users are preserved (auth.users is in auth schema).
-- Earlier migration files in this directory are archived; V2 starts fresh from
-- this file plus 20260502000002_v2_schema.sql.

drop table if exists public.pipeline_threads cascade;
drop table if exists public.dismissed_threads cascade;
drop table if exists public.ghost_logs cascade;
drop table if exists public.stage_history cascade;
drop table if exists public.email_processing_log cascade;
drop table if exists public.sync_runs cascade;
drop table if exists public.emails cascade;
drop table if exists public.pipelines cascade;
drop table if exists public.interviewers cascade;
drop table if exists public.test_pipelines cascade;
drop table if exists public.early_access_requests cascade;

-- Drop V1 helper functions if they exist; cascade catches dependent triggers.
drop function if exists public.update_updated_at_column() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;

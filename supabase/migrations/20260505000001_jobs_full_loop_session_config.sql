-- Phase 4f: per-job dynamic Full Loop session config. jsonb column on jobs
-- so each job can override which sessions exist and what they're labeled
-- (e.g. "Engineering Bar Raiser" parsed from a recruiter email).
--
-- Nullable: null is the legitimate pre-Phase-4f state and means "fall back
-- to DEFAULT_FULL_LOOP_SESSION_CONFIG at the application layer." No CHECK
-- constraint — shape validation lives in lib/ai/prep-types.ts via Zod.
-- No index needed: this column is read alongside the parent row, never
-- queried in isolation.
--
-- Forward-only. Rolling back means losing any user-configured session
-- overrides; defaults can be inferred but not customizations.

alter table public.jobs
  add column full_loop_session_config jsonb default null;

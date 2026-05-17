-- Prompt 21: operational handoff table for the unauthenticated Quick Prep
-- funnel. The marketing site generates Quick Prep for a visitor, persists
-- { jd, resume, prep } here keyed by a uuid, and redirects to signup with
-- that uuid. On onboarding completion the product consumes the row: it
-- creates a job plus a cached prep_versions row, then deletes the handoff.
--
-- This is an operational, ephemeral table, not product schema. Rows live
-- about an hour (read-time expiry check in completeOnboardingAction) and
-- are deleted on consume. HANDOFF.md's "do not expand schema beyond V2"
-- rule is explicitly waived for this table on those grounds.
--
-- RLS is enabled with no policies: only the service-role key can read or
-- write, so the uuid functions as an unguessable capability token. Both
-- the create endpoint and the consume path use the service-role client.

create table public.unauth_handoffs (
  id uuid primary key default gen_random_uuid(),
  jd_text text not null,
  resume_text text not null,
  prep_output jsonb not null,
  created_at timestamptz not null default now()
);

-- Supports TTL cleanup (manual or future cron) and read-time expiry scans.
create index unauth_handoffs_created_at_idx
  on public.unauth_handoffs (created_at);

alter table public.unauth_handoffs enable row level security;

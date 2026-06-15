-- Feature 4: Negotiation Prep. One row per generation (persist, do not
-- overwrite), mirroring prep_versions conventions.
-- APPLY MANUALLY: paste into the Supabase SQL editor only. DO NOT run
-- `supabase db push` against prod (a destructive reset sits in the pending
-- migration set). Idempotent so re-running is safe.

create table if not exists public.negotiation_preps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  model_used text not null,
  context_hash text not null,
  inputs jsonb not null,
  output jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists negotiation_preps_job_created_idx
  on public.negotiation_preps (job_id, created_at desc);

alter table public.negotiation_preps enable row level security;

-- Mirror prep_versions: a single owner-scoped policy covering all operations.
drop policy if exists "negotiation_preps_owner_all" on public.negotiation_preps;
create policy "negotiation_preps_owner_all"
  on public.negotiation_preps for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

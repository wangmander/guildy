-- Feature 3: TC comparison matrix.
-- One row per job, all compensation fields nullable. Free feature (no gating).
-- Apply manually after merge: `supabase db push` or paste into the Supabase
-- SQL editor. Idempotent so re-running is safe.

create table if not exists public.job_compensation (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  base numeric,
  signing_bonus numeric default 0,
  annual_bonus_pct numeric default 0,
  equity_grant_total numeric default 0,
  vesting_years numeric default 4,
  location text,
  benefits_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_compensation_job_id_idx on public.job_compensation (job_id);
create index if not exists job_compensation_user_id_idx on public.job_compensation (user_id);

alter table public.job_compensation enable row level security;

-- Per-user RLS, same shape as the other owner-keyed tables.
drop policy if exists "job_compensation_owner_all" on public.job_compensation;
create policy "job_compensation_owner_all"
  on public.job_compensation for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Reuse the shared updated_at trigger function from the v2 schema migration.
drop trigger if exists job_compensation_set_updated_at on public.job_compensation;
create trigger job_compensation_set_updated_at
  before update on public.job_compensation
  for each row execute function public.set_updated_at();

-- Guildy V2 Phase 1 — schema.
-- Tables: user_profiles, jobs, stage_events, job_context, prep_versions, stage_labels.
-- No subscriptions table; tier is a single column on user_profiles.
-- Per-user RLS keyed on auth.uid() = user_id (or id for user_profiles).

-- Helpers ------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- user_profiles ------------------------------------------------------------

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  resume_url text,
  resume_text text,
  background_text text,
  tier text not null default 'free' check (tier in ('free', 'deep')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile row on auth signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- jobs ---------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  role_title text not null,
  tc text,
  source_url text,
  jd_text text,
  state text not null default 'passive' check (state in ('passive', 'active')),
  stage text not null default 'applied' check (
    stage in ('applied', 'screen', 'hiring_manager', 'interview_loop', 'final', 'offer', 'closed')
  ),
  prep_status text not null default 'none' check (
    prep_status in ('none', 'quick_generated', 'deep_generated')
  ),
  latest_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz
);

create index jobs_user_id_idx on public.jobs (user_id);
create index jobs_user_state_idx on public.jobs (user_id, state);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- stage_events -------------------------------------------------------------

create table public.stage_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  note text,
  created_at timestamptz not null default now()
);

create index stage_events_job_id_idx on public.stage_events (job_id);

-- job_context --------------------------------------------------------------

create table public.job_context (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('jd', 'latest_message', 'interviewer', 'note', 'other')),
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index job_context_job_id_idx on public.job_context (job_id);

-- prep_versions ------------------------------------------------------------

create table public.prep_versions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('quick', 'deep')),
  model_used text not null,
  context_hash text,
  output jsonb not null,
  created_at timestamptz not null default now()
);

create index prep_versions_job_id_idx on public.prep_versions (job_id);
create index prep_versions_context_hash_idx on public.prep_versions (job_id, tier, context_hash);

-- stage_labels -------------------------------------------------------------

create table public.stage_labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stage_key text not null check (
    stage_key in ('applied', 'screen', 'hiring_manager', 'interview_loop', 'final', 'offer', 'closed')
  ),
  custom_label text not null,
  unique (user_id, stage_key)
);

-- RLS ----------------------------------------------------------------------

alter table public.user_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.stage_events enable row level security;
alter table public.job_context enable row level security;
alter table public.prep_versions enable row level security;
alter table public.stage_labels enable row level security;

-- user_profiles: row keyed on id, owner is the user themselves.
create policy "user_profiles_select_own"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "user_profiles_update_own"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Insert handled by handle_new_user() trigger; no client insert path.

-- jobs / stage_events / job_context / prep_versions / stage_labels:
-- row keyed on user_id, owner is the user themselves.
create policy "jobs_owner_all"
  on public.jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "stage_events_owner_all"
  on public.stage_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "job_context_owner_all"
  on public.job_context for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "prep_versions_owner_all"
  on public.prep_versions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "stage_labels_owner_all"
  on public.stage_labels for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage: private resume bucket -------------------------------------------
-- Users upload resumes here; access is via signed URLs only.

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "resumes_owner_select"
  on storage.objects for select
  using (bucket_id = 'resumes' and owner = auth.uid());

create policy "resumes_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'resumes' and owner = auth.uid());

create policy "resumes_owner_update"
  on storage.objects for update
  using (bucket_id = 'resumes' and owner = auth.uid())
  with check (bucket_id = 'resumes' and owner = auth.uid());

create policy "resumes_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'resumes' and owner = auth.uid());

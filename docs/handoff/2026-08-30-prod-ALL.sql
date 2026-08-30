-- =====================================================================
-- PROD SQL EDITOR: both pending schema blocks, one submission.
-- Paste this whole thing into the Supabase SQL editor and run once.
--
-- This supersedes:
--   docs/handoff/2026-08-19-prod-streak-migrations.sql
--   docs/handoff/2026-08-19-prod-resume-migrations.sql
-- Neither of those has been run. Both are reproduced below, unchanged in
-- effect, streak first.
--
-- Covers, in order:
--   PART 1, streak
--     20260811000001_streak
--     20260811000002_streak_email_tracking
--     20260815000001_streak_email_unsubscribe
--     20260815000002_streak_email_calendar_anchor
--   PART 2, resumes
--     20260819000001_resumes
--     20260819000002_resumes_storage
--
-- The two parts are independent. Part 2 reads nothing part 1 writes, and
-- they share no object: part 1 touches public.user_profiles and
-- public.unauth_handoffs, part 2 creates public.resumes and touches
-- storage.buckets and storage.objects. Nothing is dropped and recreated
-- across the boundary, so order between them is a preference, not a
-- dependency. They run in the stated order because part 1 is the live
-- outage.
--
-- Deliberately TWO transactions, not one. Part 1 clears a bug that is
-- blocking every user right now. Part 2 rewrites policies on
-- storage.objects, which is the statement here most likely to hit a
-- privilege wall. Committing part 1 on its own means a failure in part 2
-- cannot take the outage fix down with it. If your editor wraps the whole
-- submission in its own transaction and rolls both back, nothing is lost:
-- every statement below is idempotent, so re-running is free.
--
-- Verified against prod on 2026-08-30, before writing this:
--   * All 7 streak columns on user_profiles are ABSENT, and
--     unauth_handoffs.streak_started_at is ABSENT. Part 1 is unapplied.
--     This is the live bug: app/app/page.tsx selects streak_started_at,
--     PostgREST fails the whole select with 42703, the page reads a null
--     profile, and every generate button renders disabled saying "Add
--     your resume in onboarding before running prep."
--   * unauth_handoffs holds 6 rows. ZERO of them would violate the
--     payload check added in part 1: all 6 have jd_text, resume_text and
--     prep_output non-null. No row needs naming.
--   * public.resumes does NOT exist. Part 2 creates it. New table, so no
--     existing row can violate its check constraints, and there is no
--     backfill: the 23 existing user_profiles keep their resume_text
--     exactly as it is and acquire a resumes row the next time they save.
--   * The private 'resumes' storage bucket DOES exist (public = false,
--     created 2026-05-02 by the Phase 1 schema) and is EMPTY: zero
--     objects. So the path-prefix policies in part 2 cannot orphan
--     anything. Had there been objects outside a <user_id>/ prefix,
--     their owners would have lost access, and that is exactly the row
--     this note would have named.
--   * 11 of 23 user_profiles hold resume_text shorter than the 200
--     character floor: 9 are empty strings and 2 hold 1 and 2 characters.
--     None of them violate anything here. They are already blocked from
--     prep and stay blocked; branch 2's only change for them is that the
--     Generate button now tells them why instead of failing silently.
-- =====================================================================


-- =====================================================================
-- PART 1 of 2: streak
-- =====================================================================

begin;

-- --- 20260811000001_streak -------------------------------------------

alter table public.unauth_handoffs
  alter column jd_text drop not null,
  alter column resume_text drop not null,
  alter column prep_output drop not null;

alter table public.unauth_handoffs
  add column if not exists streak_started_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'unauth_handoffs_payload_check'
      and conrelid = 'public.unauth_handoffs'::regclass
  ) then
    alter table public.unauth_handoffs
      add constraint unauth_handoffs_payload_check
      check (
        (jd_text is not null and resume_text is not null and prep_output is not null)
        or streak_started_at is not null
      );
  end if;
end $$;

alter table public.user_profiles
  add column if not exists streak_started_at timestamptz null,
  add column if not exists streak_current_day smallint null,
  add column if not exists streak_last_active_date date null,
  add column if not exists streak_broken_at timestamptz null;

-- --- 20260811000002_streak_email_tracking ----------------------------

alter table public.user_profiles
  add column if not exists streak_last_emailed_day smallint null;

-- --- 20260815000001_streak_email_unsubscribe -------------------------

alter table public.user_profiles
  add column if not exists streak_emails_unsubscribed_at timestamptz null;

comment on column public.user_profiles.streak_emails_unsubscribed_at is
  'Set when the user clicks unsubscribe in a streak email. Non-null means the '
  'daily cron must never email them again. Never cleared by the app; a resubscribe '
  'would be a deliberate, separate action.';

create index if not exists user_profiles_streak_emailable_idx
  on public.user_profiles (streak_current_day)
  where streak_emails_unsubscribed_at is null and streak_broken_at is null;

-- --- 20260815000002_streak_email_calendar_anchor ---------------------

alter table public.user_profiles
  add column if not exists streak_email_consecutive_lapsed smallint not null default 0;

comment on column public.user_profiles.streak_email_consecutive_lapsed is
  'Consecutive streak emails sent in lapsed wording. Reset to 0 by any send in '
  'welcome or returned wording. At 2 the sequence stops sending until the user '
  'returns; it is evaluated fresh each run rather than stored as a terminal '
  'state, which is what makes lapse-then-return resume correctly.';

create index if not exists user_profiles_streak_email_calendar_idx
  on public.user_profiles (created_at)
  where streak_emails_unsubscribed_at is null;

commit;


-- =====================================================================
-- PART 2 of 2: resumes
--
-- Branch 2 code writes public.resumes on every resume save, through
-- every one of the four doors. If that code goes live and this has not
-- run, ingest fails at the first upsert and returns write_failed, which
-- means nobody can save a resume, which means nobody can generate prep.
-- Same shape of failure as part 1: code selecting schema that is not
-- there.
-- =====================================================================

begin;

-- --- 20260819000001_resumes ------------------------------------------
--
-- One resume per user, whatever door it came through. user_id is the
-- primary key on purpose: this is a current resume, not a version
-- history. user_profiles.resume_text stays the read path that every gate
-- and every prep call uses; every ingest writes both in the same call so
-- the two cannot drift.

create table if not exists public.resumes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source text not null check (
    source in ('upload_drop', 'upload_browse', 'paste', 'handoff')
  ),
  file_name text,
  file_ext text check (file_ext in ('pdf', 'docx', 'txt')),
  byte_size integer,
  parsed_text text not null,
  char_count integer not null check (char_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.resumes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'resumes'
      and policyname = 'resumes_owner_all'
  ) then
    create policy "resumes_owner_all"
      on public.resumes for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- --- 20260819000002_resumes_storage ----------------------------------
--
-- The file itself, and a path only its owner can reach.

alter table public.resumes
  add column if not exists storage_path text,
  add column if not exists mime_type text;

comment on column public.resumes.storage_path is
  'Object key in the private resumes bucket, always <user_id>/<uuid>.<ext>. '
  'Null for the paste and handoff paths, which have no file behind them.';

comment on column public.resumes.mime_type is
  'Content type as reported by the browser. Recorded, never trusted: parse '
  'dispatch is on extension, which is what the picker and the 10MB cap agree on.';

-- The bucket already exists from Phase 1; this is here so the block is
-- self-contained if it is ever run against a fresh project.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Path isolation, replacing Phase 1's ownership-only checks. `owner =
-- auth.uid()` is satisfied by any authed user writing anywhere in the
-- bucket, because the uploader is the owner by definition. That was
-- harmless while nothing uploaded. Uploads start with branch 2.
--
-- The drop and the create are inside one transaction, so there is no
-- window where the bucket sits unpoliced. The bucket is also empty
-- today, which is what makes this safe to run at all: do not run this
-- block for the first time after real uploads have landed.
drop policy if exists "resumes_owner_select" on storage.objects;
drop policy if exists "resumes_owner_insert" on storage.objects;
drop policy if exists "resumes_owner_update" on storage.objects;
drop policy if exists "resumes_owner_delete" on storage.objects;

create policy "resumes_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "resumes_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "resumes_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "resumes_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;


-- =====================================================================
-- VERIFICATION: one row. Every column below must read true.
-- The last column is a count, not a check: it is the pre-existing
-- resume_text population, printed so you can see the table landed
-- empty against 23 untouched profiles.
-- =====================================================================
select
  -- part 1
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'user_profiles'
       and column_name in (
         'streak_started_at', 'streak_current_day', 'streak_last_active_date',
         'streak_broken_at', 'streak_last_emailed_day',
         'streak_emails_unsubscribed_at', 'streak_email_consecutive_lapsed'
       )) = 7
    as streak_7_profile_columns,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'unauth_handoffs'
       and column_name = 'streak_started_at') = 1
    as handoff_streak_column,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'unauth_handoffs'
       and column_name in ('jd_text', 'resume_text', 'prep_output')
       and is_nullable = 'YES') = 3
    as handoff_payload_now_nullable,
  (select count(*) from pg_constraint
     where conname = 'unauth_handoffs_payload_check'
       and conrelid = 'public.unauth_handoffs'::regclass) = 1
    as handoff_payload_check,
  (select count(*) from pg_indexes
     where schemaname = 'public' and tablename = 'user_profiles'
       and indexname in (
         'user_profiles_streak_emailable_idx',
         'user_profiles_streak_email_calendar_idx'
       )) = 2
    as streak_2_indexes,
  -- part 2
  (select to_regclass('public.resumes') is not null)
    as resumes_table_exists,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'resumes') = 11
    as resumes_has_11_columns,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'resumes'
       and column_name in ('storage_path', 'mime_type')) = 2
    as resumes_storage_columns,
  (select relrowsecurity from pg_class
     where oid = 'public.resumes'::regclass)
    as resumes_rls_enabled,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'resumes') = 1
    as resumes_row_policy,
  (select count(*) from storage.buckets b
     where b.id = 'resumes' and b.public = false) = 1
    as bucket_exists_and_private,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'resumes_owner_%'
       and coalesce(qual, '') || coalesce(with_check, '') like '%foldername%') = 4
    as object_policies_check_path,
  -- context, not a check
  (select count(*) from public.resumes) as existing_resume_rows;

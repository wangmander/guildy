-- =====================================================================
-- PROD SQL EDITOR: apply branch 2's schema before branch 2's code ships.
-- Paste this whole block into the Supabase SQL editor and run once.
--
-- Order matters. Branch 2 code writes public.resumes on every resume
-- save, through every one of the four doors. If the code goes live and
-- this has not run, ingest fails at the first upsert and returns
-- write_failed, which means nobody can save a resume, which means
-- nobody can generate prep. That is the same shape of failure as the
-- streak columns: code selecting schema that is not there.
--
-- Covers, in order:
--   20260819000001_resumes
--   20260819000002_resumes_storage
--
-- Idempotent: safe to run twice.
--
-- Verified against prod on 2026-08-26, before writing this:
--   * public.resumes does NOT exist. This creates it. It is a new table,
--     so no existing row can violate its check constraints. There is no
--     backfill: the 23 existing user_profiles keep their resume_text
--     exactly as it is and acquire a resumes row the next time they save.
--   * The private 'resumes' storage bucket DOES exist (public = false,
--     created by the Phase 1 schema) and is EMPTY: zero objects. So the
--     path-prefix policies below cannot orphan anything. Had there been
--     objects outside a <user_id>/ prefix, their owners would have lost
--     access, and that is exactly the row this note would have named.
--   * 11 of 23 user_profiles hold resume_text shorter than the 200
--     character floor: 9 are empty strings and 2 hold 1 and 2 characters.
--     None of them violate anything here. They are already blocked from
--     prep and stay blocked; branch 2's only change for them is that the
--     Generate button now tells them why instead of failing silently.
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

-- --- verification: one row, and everything should read true ----------
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'resumes') = 11
    as resumes_has_11_columns,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'resumes') = 1
    as resumes_row_policy,
  (select relrowsecurity from pg_class
     where oid = 'public.resumes'::regclass)
    as resumes_rls_enabled,
  (select not public from storage.buckets where id = 'resumes')
    as bucket_is_private,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'resumes_owner_%'
       and coalesce(qual, '') || coalesce(with_check, '') like '%foldername%') = 4
    as object_policies_check_path,
  (select count(*) from public.resumes) as existing_resume_rows;

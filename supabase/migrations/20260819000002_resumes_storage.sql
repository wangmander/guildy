-- The file itself, and the ability to take it back.
--
-- Two things were missing from 20260819000001.
--
-- One: the resumes row recorded a file's name and size but not the file. The
-- parse ran in memory and the document was discarded, so a user who uploaded
-- a PDF had its text and nothing else. There was no way to hand the original
-- back, and no way to re-parse it if the parser improved. The private
-- 'resumes' bucket has existed since Phase 1 with nothing ever written to it.
--
-- Two: the bucket's object policies checked ownership but not path. `owner =
-- auth.uid()` is satisfied by any authed user writing anywhere in the bucket,
-- because the uploader is the owner by definition. Nothing stopped a user
-- from writing over another user's prefix. Uploads start now, so the check
-- has to be real now.

alter table public.resumes
  add column if not exists storage_path text,
  add column if not exists mime_type text;

comment on column public.resumes.storage_path is
  'Object key in the private resumes bucket, always <user_id>/<uuid>.<ext>. Null for the paste and handoff paths, which have no file.';

comment on column public.resumes.mime_type is
  'Content type as reported by the browser. Recorded, never trusted: parse dispatch is on extension, which is what the picker and the 10MB cap agree on.';

-- Path isolation, replacing the ownership-only checks from Phase 1.
--
-- storage.foldername(name) splits the object key on /, so [1] is the first
-- segment. Every write goes to <user_id>/..., and a user can only reach their
-- own prefix. Ownership stays in the check as well: both must hold.
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

-- One resume per user, whatever door it came through.
--
-- Before this, "the resume" was a single free-text column on user_profiles
-- that four different code paths wrote in four different shapes: the
-- onboarding paste, the prep overlay's Intro/Cover Letter box, the unauth
-- handoff injection, and nothing at all for files (there was no upload).
-- Nobody recorded what the text was parsed from, how long it was, or
-- whether it was ever long enough to be worth sending to a model. Three
-- production profiles hold resumes of 1 and 2 characters, saved by a path
-- that never checked.
--
-- This table is the write side of that. user_profiles.resume_text stays the
-- read path (every gate and every prep call still reads it), and every
-- ingest writes through to it in the same call, so the two cannot drift.
--
-- user_id is unique on purpose: one row, replaced in place. This is not a
-- version history. A user has a current resume or they have none.
--
-- No backfill. Existing resume_text values keep working as they are; they
-- acquire a resumes row the next time the user saves or replaces one.

create table public.resumes (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Which of the four input paths produced this text. Recorded for
  -- diagnostics only. Nothing downstream branches on it: a resume is a
  -- resume once it is parsed, whichever door it came through.
  source text not null check (
    source in ('upload_drop', 'upload_browse', 'paste', 'handoff')
  ),

  -- File provenance, null for the paste and handoff paths.
  file_name text,
  file_ext text check (file_ext in ('pdf', 'docx', 'txt')),
  byte_size integer,

  -- The parsed text, exactly as it was written to
  -- user_profiles.resume_text in the same ingest.
  parsed_text text not null,

  -- Denormalized length of parsed_text. Cheap to read when explaining to a
  -- user why their resume is too short, and it makes the minimum auditable
  -- without pulling whole documents back out of the database.
  char_count integer not null check (char_count >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.resumes enable row level security;

create policy "resumes_owner_all"
  on public.resumes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

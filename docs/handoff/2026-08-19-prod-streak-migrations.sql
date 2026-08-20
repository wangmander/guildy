-- =====================================================================
-- PROD SQL EDITOR: apply the four unapplied streak migrations.
-- Paste this whole block into the Supabase SQL editor and run once.
--
-- Why this is urgent, not housekeeping: app/app/page.tsx selects
-- streak_started_at as part of its user_profiles read. That column does
-- not exist on prod, so PostgREST fails the ENTIRE select with 42703,
-- the page sees a null profile, and every generate-prep button renders
-- disabled with "Add your resume in onboarding before running prep."
-- That is the live signup-blocking bug. Running this clears it.
--
-- Covers, in order:
--   20260811000001_streak
--   20260811000002_streak_email_tracking
--   20260815000001_streak_email_unsubscribe
--   20260815000002_streak_email_calendar_anchor
--
-- Idempotent: safe to run twice. Verified against prod on 2026-08-19 that
-- all four are unapplied, and that all 6 existing unauth_handoffs rows
-- already satisfy the payload check added below (0 violations).
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

-- --- verification: all 8 columns should come back in one row ---------
select
  streak_started_at,
  streak_current_day,
  streak_last_active_date,
  streak_broken_at,
  streak_last_emailed_day,
  streak_emails_unsubscribed_at,
  streak_email_consecutive_lapsed,
  resume_text is not null as has_resume
from public.user_profiles
order by created_at desc
limit 1;

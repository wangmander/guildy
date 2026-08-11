-- 5-day streak: same bridge the unauth Quick Prep handoff already uses,
-- carrying a second, independent payload. A visitor who has landed but
-- never touched the demo has no jd/resume/prep to hand off, so those three
-- columns move from required to optional; the check constraint below keeps
-- every row honest (a row must carry at least one complete payload, never
-- an empty shell).
--
-- streak_started_at travels the identical uuid/cookie/localStorage carry
-- path unauth_handoffs already has (see completeOnboardingAction /
-- consumeHandoff): one mechanism, two payloads, not a parallel table.

alter table public.unauth_handoffs
  alter column jd_text drop not null,
  alter column resume_text drop not null,
  alter column prep_output drop not null,
  add column streak_started_at timestamptz null;

alter table public.unauth_handoffs
  add constraint unauth_handoffs_payload_check
  check (
    (jd_text is not null and resume_text is not null and prep_output is not null)
    or streak_started_at is not null
  );

-- Account-side streak state. Day count and last-active date are the two
-- facts a "did today count" check needs; broken_at is null while live and
-- set once a day passes with no qualifying action (see lib/streak.ts).
alter table public.user_profiles
  add column streak_started_at timestamptz null,
  add column streak_current_day smallint null,
  add column streak_last_active_date date null,
  add column streak_broken_at timestamptz null;

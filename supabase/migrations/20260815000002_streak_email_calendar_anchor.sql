-- Separate the two clocks.
--
-- The 5-day sequence keyed off streak_current_day, which only advances inside
-- deriveAndUpdateStreak, which only runs on an authenticated /app load. So the
-- emails whose job is to bring a lapsed user back required that user to have
-- already come back. Signup-and-vanish received exactly one email, and that is
-- the entire population the sequence exists to reach.
--
-- Cadence moves to the calendar, anchored on user_profiles.created_at, which
-- the auth trigger already populates on every signup. Streak state stays
-- behavioural and is untouched by this migration: a streak should keep
-- reflecting what the user actually did.
--
-- One new column. The counter is what makes the sequence stop nagging a user
-- who never comes back (two consecutive lapsed sends, per Michael's ruling of
-- 2026-08-15) while staying resumable if they do: any returned-wording send
-- resets it to zero.

alter table public.user_profiles
  add column streak_email_consecutive_lapsed smallint not null default 0;

comment on column public.user_profiles.streak_email_consecutive_lapsed is
  'Consecutive streak emails sent in lapsed wording. Reset to 0 by any send in '
  'welcome or returned wording. At 2 the sequence stops sending until the user '
  'returns; it is evaluated fresh each run rather than stored as a terminal '
  'state, which is what makes lapse-then-return resume correctly.';

-- The daily cron now selects on created_at rather than on streak_current_day,
-- so the old partial index no longer covers its query.
create index if not exists user_profiles_streak_email_calendar_idx
  on public.user_profiles (created_at)
  where streak_emails_unsubscribed_at is null;

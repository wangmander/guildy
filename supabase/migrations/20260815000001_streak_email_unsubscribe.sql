-- Unsubscribe for the 5-day streak drip.
--
-- The drip was wired end to end and ready to fire the moment RESEND_API_KEY
-- landed, with no way for a recipient to stop it. Five unsolicited emails with
-- no opt-out is a CAN-SPAM problem before it is a UX one, and it is the kind of
-- thing that is discovered by a complaint rather than by a test.
--
-- Nullable timestamp rather than a boolean, so the record says WHEN they opted
-- out. A boolean loses the one fact that matters if a complaint ever arrives.

alter table public.user_profiles
  add column streak_emails_unsubscribed_at timestamptz null;

comment on column public.user_profiles.streak_emails_unsubscribed_at is
  'Set when the user clicks unsubscribe in a streak email. Non-null means the '
  'daily cron must never email them again. Never cleared by the app; a resubscribe '
  'would be a deliberate, separate action.';

-- The daily cron filters on this column on every run, so it is worth an index
-- even at current volume: the query is a full scan of user_profiles otherwise.
create index if not exists user_profiles_streak_emailable_idx
  on public.user_profiles (streak_current_day)
  where streak_emails_unsubscribed_at is null and streak_broken_at is null;

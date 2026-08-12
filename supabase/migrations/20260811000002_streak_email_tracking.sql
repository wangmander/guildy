-- Tracks the last streak day a user was actually emailed for, so the daily
-- cron never double-sends if it runs more than once for the same day
-- (retry, manual trigger, clock skew). Separate from streak_current_day:
-- that field can change for reasons unrelated to email (a qualifying
-- action incrementing it before the cron runs that day).

alter table public.user_profiles
  add column streak_last_emailed_day smallint null;

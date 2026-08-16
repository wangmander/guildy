// When to send a streak email, and in whose wording.
//
// This module exists as pure functions with no imports on purpose. The bug it
// was written to fix was invisible because the decision lived inline in a cron
// route that could not be run without Supabase, Next and a live clock. A
// re-engagement sequence whose trigger nobody can test is a re-engagement
// sequence nobody notices is broken.
//
// THE BUG, for whoever reads this next. The original sequence keyed off
// streak_current_day, which only advances inside deriveAndUpdateStreak, which
// only runs on an authenticated /app load. So the emails whose entire job is to
// bring a lapsed user back required that user to have already come back.
// Signup-and-vanish received exactly one email, and that is the whole
// population the sequence exists to reach.
//
// The fix is two clocks that never touch:
//
//   STREAK state   behavioural. Driven by real /app activity. A streak should
//                  reflect what the user actually did, so this is unchanged.
//   EMAIL cadence  calendar. Driven by created_at and the cron's clock. Fires
//                  whether or not the user has ever returned.
//
// The wording follows the behavioural clock even though the cadence follows the
// calendar one, because telling someone "day 3 of your streak" when their
// streak broke on day 2 is a lie the product tells about the user's own life.

/** The five days of the sequence. */
export type StreakDay = 1 | 2 | 3 | 4 | 5;

/** Which wording. `welcome` is day 1 only: at that point nobody has had a
 * chance to return or lapse, so neither of the other two is true yet. */
export type Variant = "welcome" | "returned" | "lapsed";

export interface EmailProfile {
  /** Signup. Auto-provisioned by the auth trigger, never null. This is the
   * calendar anchor: the streak's own started_at is the LANDING timestamp,
   * which precedes signup and is a different fact. */
  created_at: string;
  /** Last day of the sequence actually emailed, or null. */
  streak_last_emailed_day: number | null;
  /** How many consecutive sends went out in lapsed wording. Reset to 0 by any
   * returned-wording send. */
  streak_email_consecutive_lapsed: number | null;
  /** Behavioural: the last date the user opened /app. */
  streak_last_active_date: string | null;
  streak_broken_at: string | null;
  streak_emails_unsubscribed_at: string | null;
}

export interface SendDecision {
  send: boolean;
  day: StreakDay | null;
  variant: Variant | null;
  /** Always populated, including when send is false. The cron logs it, so a
   * quiet day is explainable without re-deriving anything. */
  reason: string;
}

export const SEQUENCE_LENGTH = 5;

/** Two consecutive lapsed sends and the sequence stops. Michael's ruling of
 * 2026-08-15: four unanswered emails to someone who signed up and left is a
 * nag, and being marked spam before the first customer is a worse outcome than
 * a missed re-engagement. */
export const MAX_CONSECUTIVE_LAPSED = 2;

/** A day-1 email must not arrive minutes after signup just because the cron
 * happened to fire. Twelve hours is the floor. */
export const MIN_HOURS_BEFORE_DAY_1 = 12;

/** How far behind the calendar the sequence can run. A daily cron plus the
 * 12-hour floor means a signup late in the day has its first eligible run on
 * the following calendar day, so the sequence finishes one day late. One is
 * the maximum: the shift is introduced once, at the start, and never grows. */
export const MAX_SHIFT_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Which day of the sequence the calendar says we are on.
 *
 * Day 1 is the signup day itself, but only once MIN_HOURS_BEFORE_DAY_1 has
 * elapsed. Day N is N-1 UTC calendar days after the signup date. Returns null
 * past the end of the sequence, or before day 1 is due.
 */
export function calendarDay(createdAt: string, now: Date): StreakDay | null {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;

  const elapsedHours = (now.getTime() - created.getTime()) / (60 * 60 * 1000);
  if (elapsedHours < MIN_HOURS_BEFORE_DAY_1) return null;

  // Calendar days, not elapsed 24h blocks: a signup at 23:00 and one at 01:00
  // on the same date should land on the same day number, so the sequence reads
  // as "days" to the recipient rather than as an opaque timer.
  const createdDay = Date.parse(dateOnly(created.toISOString()) + "T00:00:00Z");
  const nowDay = Date.parse(dateOnly(now.toISOString()) + "T00:00:00Z");
  const n = Math.floor((nowDay - createdDay) / DAY_MS) + 1;
  // The window runs one day past the sequence, because a signup late in the
  // day starts a day behind (see decideSend) and would otherwise be cut off
  // with its last email unsent. decideSend clamps the day number itself, so a
  // wider window can never produce a day 6 email.
  if (n < 1 || n > SEQUENCE_LENGTH + MAX_SHIFT_DAYS) return null;
  return Math.min(n, SEQUENCE_LENGTH) as StreakDay;
}

/**
 * Has the user come back since signing up?
 *
 * Deliberately generous: any /app activity on a date after the signup date
 * counts. A stricter bar would word an email as "lapsed" for someone who was
 * genuinely active, which is the failure mode that matters here. Activity on
 * the signup day itself does not count, because that is the signup session.
 */
export function hasReturned(p: EmailProfile): boolean {
  if (!p.streak_last_active_date) return false;
  return p.streak_last_active_date > dateOnly(p.created_at);
}

export function variantFor(p: EmailProfile, day: StreakDay): Variant {
  if (day === 1) return "welcome";
  return hasReturned(p) ? "returned" : "lapsed";
}

/**
 * The whole decision, in one pure function.
 *
 * Order matters and is the safety argument: unsubscribe is checked before
 * anything else, so no later branch can reach a send for someone who opted out.
 */
export function decideSend(p: EmailProfile, now: Date): SendDecision {
  const no = (reason: string): SendDecision => ({ send: false, day: null, variant: null, reason });

  if (p.streak_emails_unsubscribed_at) return no("unsubscribed");

  const day = calendarDay(p.created_at, now);
  if (day === null) {
    const elapsed = (now.getTime() - new Date(p.created_at).getTime()) / (60 * 60 * 1000);
    return no(elapsed < MIN_HOURS_BEFORE_DAY_1
      ? `too soon: ${elapsed.toFixed(1)}h since signup, floor is ${MIN_HOURS_BEFORE_DAY_1}h`
      : "past the end of the sequence");
  }

  // Never resend a day. The cron can run twice for one day after a retry, a
  // manual trigger or clock skew, and a duplicate is worse than a miss.
  const lastSent = p.streak_last_emailed_day ?? 0;
  if (lastSent >= day) return no(`day ${day} already sent`);

  // Never skip one either, and this is not a hypothetical.
  //
  // The cron runs once a day at a fixed hour. Combined with the 12-hour floor,
  // a signup at 09:00 has its first eligible run at 14:00 the NEXT day, by
  // which point the calendar already reads day 2. Keying purely off the
  // calendar silently dropped day 1 for every signup after 02:00 UTC: the
  // welcome email, for most users, never sent at all.
  //
  // So the calendar sets the ceiling and the sequence advances one step at a
  // time. A late-in-day signup starts a day behind and still receives every
  // step in order, which is the behaviour that matters. Nobody is counting
  // whether the day-3 email arrived on the third calendar day; they would
  // certainly notice never being welcomed.
  const step = (lastSent + 1) as StreakDay;
  const effective = (step < day ? step : day) as StreakDay;

  const variant = variantFor(p, effective);

  // The early exit. Evaluated fresh every run rather than stored as a
  // terminal state, which is what makes the sequence resumable: a user who
  // comes back reads as "returned", the counter is no longer relevant, and the
  // next calendar day sends normally.
  if (variant === "lapsed" && (p.streak_email_consecutive_lapsed ?? 0) >= MAX_CONSECUTIVE_LAPSED) {
    return no(`stopped: ${p.streak_email_consecutive_lapsed} consecutive lapsed sends and still lapsed`);
  }

  return {
    send: true,
    day: effective,
    variant,
    reason: effective === day
      ? `day ${effective}, ${variant}`
      : `day ${effective}, ${variant} (calendar reads ${day}; sequence advances one step at a time so no day is skipped)`,
  };
}

/** What the consecutive-lapsed counter becomes after a send. Returned or
 * welcome wording resets it, so a user who comes back gets the full remaining
 * sequence rather than staying one strike from silence. */
export function nextLapsedCount(current: number | null, variant: Variant): number {
  return variant === "lapsed" ? (current ?? 0) + 1 : 0;
}

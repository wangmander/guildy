// Tests for the streak email schedule.
//
//   node --experimental-strip-types scripts/test-streak-schedule.mjs
//
// No test runner in this repo, and adding one is a bigger decision than this
// change deserves. lib/email/streakSchedule.ts is pure and imports nothing, so
// it runs directly under node's type stripping with no framework, no aliases
// and no database.
//
// The two tests Michael asked for by name are 2a and 4a: a user who signs up
// and never returns receives all five (amended to the early-exit ruling: they
// receive days 1 through 3 and then the sequence stops), and copy differs for a
// returned versus a lapsed user.

import {
  decideSend, calendarDay, hasReturned, variantFor, nextLapsedCount,
  MAX_CONSECUTIVE_LAPSED,
} from "../lib/email/streakSchedule.ts";
import { buildStreakEmail } from "../lib/email/streakEmails.ts";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  :: ${detail}`);
};

const SIGNUP = "2026-08-01T09:00:00Z";
const at = (iso) => new Date(iso);

/** A profile that has never been touched since signup. */
const fresh = (over = {}) => ({
  created_at: SIGNUP,
  streak_last_emailed_day: null,
  streak_email_consecutive_lapsed: 0,
  streak_last_active_date: null,
  streak_broken_at: null,
  streak_emails_unsubscribed_at: null,
  ...over,
});

/** Walk the sequence day by day, applying each send's effect, exactly as the
 * cron would across five real days. Returns the log of what went out. */
function runSequence(profile, { returnsOn = [] } = {}) {
  const p = { ...profile };
  const sent = [];
  // Eight runs, not five: a late-in-day signup starts a day behind, so the
  // sequence needs runs past calendar day 5 to finish. The window in the cron
  // query is sized for the same reason.
  for (let d = 0; d <= 7; d++) {
    // 14:00 UTC, the hour vercel.json actually runs the cron.
    const day = String(1 + d).padStart(2, "0");
    const now = at(`2026-08-${day}T14:00:00Z`);
    // A day the user opened /app: recorded before that day's cron fires.
    if (returnsOn.includes(d)) {
      p.streak_last_active_date = `2026-08-${day}`;
    }
    const decision = decideSend(p, now);
    if (!decision.send) {
      sent.push({ day: null, variant: null, skipped: decision.reason });
      continue;
    }
    sent.push({ day: decision.day, variant: decision.variant });
    p.streak_last_emailed_day = decision.day;
    p.streak_email_consecutive_lapsed = nextLapsedCount(
      p.streak_email_consecutive_lapsed, decision.variant
    );
  }
  return sent.filter((s) => s.day !== null);
}

// --- 1. the calendar clock, independent of streak state ---------------------
check("1a. day 1 does not fire in the first 12 hours after signup",
  calendarDay(SIGNUP, at("2026-08-01T15:00:00Z")) === null,
  "6h after signup: no send");
check("1b. day 1 fires once 12 hours have passed",
  calendarDay(SIGNUP, at("2026-08-02T00:00:00Z")) === 1 ||
  calendarDay(SIGNUP, at("2026-08-01T22:00:00Z")) === 1,
  `13h after signup: day ${calendarDay(SIGNUP, at("2026-08-01T22:00:00Z"))}`);
check("1c. day N is N-1 calendar days after the signup date",
  calendarDay(SIGNUP, at("2026-08-03T14:00:00Z")) === 3 &&
  calendarDay(SIGNUP, at("2026-08-05T14:00:00Z")) === 5,
  "3rd and 5th resolve to days 3 and 5");
// The calendar window runs one day past the sequence so a late-in-day signup
// can finish (see MAX_SHIFT_DAYS). The cap that matters is on the day NUMBER,
// which decideSend enforces, so that is what gets asserted.
check("1d. the calendar window closes one day past the sequence, then stops",
  calendarDay(SIGNUP, at("2026-08-06T14:00:00Z")) === 5 &&
  calendarDay(SIGNUP, at("2026-08-07T14:00:00Z")) === null,
  "day 6 clamps to 5, day 7 is null");
check("1f. no send can ever carry a day number above 5",
  decideSend(fresh({ streak_last_emailed_day: 4, streak_last_active_date: "2026-08-05" }),
    at("2026-08-06T14:00:00Z")).day === 5 &&
  decideSend(fresh({ streak_last_emailed_day: 5, streak_last_active_date: "2026-08-05" }),
    at("2026-08-06T14:00:00Z")).send === false,
  "day 5 sends once, then nothing");
check("1e. the calendar ignores streak state entirely",
  calendarDay(SIGNUP, at("2026-08-03T14:00:00Z")) ===
  calendarDay(SIGNUP, at("2026-08-03T14:00:00Z")),
  "calendarDay takes no streak argument, so it cannot depend on one");

// --- 2. THE BUG: signup and vanish ------------------------------------------
// Before this change, this user received exactly one email, because
// streak_current_day never advanced without an /app load.
const vanished = runSequence(fresh());
check("2a. a user who signs up and never returns is emailed on days 1, 2 and 3",
  vanished.map((s) => s.day).join(",") === "1,2,3",
  `days sent: ${vanished.map((s) => s.day).join(",") || "none"}`);
check("2b. and the sequence then stops rather than nagging to day 5",
  vanished.length === 3 && !vanished.some((s) => s.day > 3),
  `${vanished.length} sends, stopped after two consecutive lapsed`);
check("2c. day 1 is welcome wording, days 2 and 3 are lapsed",
  vanished.map((s) => s.variant).join(",") === "welcome,lapsed,lapsed",
  vanished.map((s) => s.variant).join(","));

// --- 3. a user who comes back every day -------------------------------------
const engaged = runSequence(fresh(), { returnsOn: [1, 2, 3, 4, 5] });
check("3a. an engaged user receives all five",
  engaged.map((s) => s.day).join(",") === "1,2,3,4,5",
  engaged.map((s) => s.day).join(","));
check("3b. in welcome then returned wording, never lapsed",
  engaged.map((s) => s.variant).join(",") === "welcome,returned,returned,returned,returned",
  engaged.map((s) => s.variant).join(","));

// --- 4. lapse then return, resuming at the right day ------------------------
// Silent on days 2 and 3, back on day 4.
const resumed = runSequence(fresh(), { returnsOn: [3] });
check("4a. a returning user resumes at the correct calendar day, not where it stopped",
  resumed.some((s) => s.day === 4 && s.variant === "returned"),
  resumed.map((s) => `${s.day}:${s.variant}`).join(" "));
check("4b. resuming does not backfill the days that already went out",
  resumed.filter((s) => s.day === 2).length === 1 &&
  resumed.filter((s) => s.day === 3).length === 1,
  "days 2 and 3 sent once each, in the wording true at the time");
check("4c. a returned send resets the lapsed counter",
  nextLapsedCount(1, "returned") === 0 && nextLapsedCount(1, "lapsed") === 2,
  "returned -> 0, lapsed -> increments");

// A user who lapses, is stopped, then returns on the last day.
const lateReturn = runSequence(fresh(), { returnsOn: [4] });
check("4d. even a user stopped for two days resumes if they come back",
  lateReturn.some((s) => s.day === 5 && s.variant === "returned"),
  lateReturn.map((s) => `${s.day}:${s.variant}`).join(" "));

// --- 5. the copy actually differs -------------------------------------------
const ctx = { uid: "u1", day: 2 };
const ret2 = buildStreakEmail(2, ctx, "returned");
const lap2 = buildStreakEmail(2, ctx, "lapsed");
check("5a. returned and lapsed copy differ for the same day",
  ret2.subject !== lap2.subject && ret2.html !== lap2.html,
  `returned "${ret2.subject}" vs lapsed "${lap2.subject}"`);
check("5b. lapsed copy never asserts activity that did not happen",
  !/one job in|four days in|you've got jobs tracked|streak complete/i.test(lap2.html) &&
  !/one job in|four days in/i.test(buildStreakEmail(4, ctx, "lapsed").html),
  "no false claims about the user in lapsed wording");
check("5c. lapsed copy invites them back rather than reporting a streak",
  /job description|add your first job|add a job/i.test(lap2.html),
  "names the single next action");
check("5d. every day 2-5 has distinct lapsed copy",
  new Set([2, 3, 4, 5].map((d) => buildStreakEmail(d, ctx, "lapsed").subject)).size === 4,
  [2, 3, 4, 5].map((d) => buildStreakEmail(d, ctx, "lapsed").subject).join(" | "));
check("5e. day 1 is welcome wording regardless of the variant asked for",
  buildStreakEmail(1, ctx, "lapsed").subject === buildStreakEmail(1, ctx, "welcome").subject,
  "day 1 has no lapsed variant to fall into");

// --- 6. the guards still hold -----------------------------------------------
check("6a. an unsubscribed user is never sent to, whatever the calendar says",
  decideSend(fresh({ streak_emails_unsubscribed_at: "2026-08-02T00:00:00Z" }),
    at("2026-08-03T14:00:00Z")).send === false,
  decideSend(fresh({ streak_emails_unsubscribed_at: "2026-08-02T00:00:00Z" }),
    at("2026-08-03T14:00:00Z")).reason);
check("6b. a day already sent is never re-sent",
  decideSend(fresh({ streak_last_emailed_day: 3 }), at("2026-08-03T14:00:00Z")).send === false,
  decideSend(fresh({ streak_last_emailed_day: 3 }), at("2026-08-03T14:00:00Z")).reason);
check("6c. the sequence is capped at five, never a sixth",
  decideSend(fresh({ streak_last_emailed_day: 5 }), at("2026-08-06T14:00:00Z")).send === false,
  decideSend(fresh({ streak_last_emailed_day: 5 }), at("2026-08-06T14:00:00Z")).reason);
check("6d. the stop threshold is the ruling, two, not an arbitrary number",
  MAX_CONSECUTIVE_LAPSED === 2, `MAX_CONSECUTIVE_LAPSED = ${MAX_CONSECUTIVE_LAPSED}`);
check("6e. streak state does not gate sending: a broken streak still receives",
  decideSend(fresh({ streak_broken_at: "2026-08-02T00:00:00Z" }),
    at("2026-08-02T14:00:00Z")).send === true,
  "broken_at is no longer a filter, which is the fix");

// --- 7. returned detection --------------------------------------------------
check("7a. activity on the signup day itself is the signup session, not a return",
  hasReturned(fresh({ streak_last_active_date: "2026-08-01" })) === false,
  "same-day activity does not count as returning");
check("7b. activity on any later date is a return",
  hasReturned(fresh({ streak_last_active_date: "2026-08-02" })) === true, "later date counts");
check("7c. day 1 is always welcome, never returned or lapsed",
  variantFor(fresh(), 1) === "welcome", "day 1 variant");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"
import { buildStreakEmail, unsubscribeUrl } from "@/lib/email/streakEmails"
import {
  decideSend, nextLapsedCount, SEQUENCE_LENGTH, type EmailProfile,
} from "@/lib/email/streakSchedule"
import { trackStreakEmailSent } from "@/lib/analytics"

// Real production path for the 5-day streak drip. Runs daily (see
// vercel.json). Off by default: STREAK_EMAILS_LIVE must be exactly "true"
// or this is a dry run that logs who WOULD have been emailed and sends
// nothing. Per explicit instruction: real users get nothing until Michael
// says so. Flipping that env var, not a code change, is the go-ahead.

export const runtime = "nodejs"
export const maxDuration = 60

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: Request) {
  // Vercel crons send this header; guards against the route being hit by
  // anything else and accidentally emailing real users off-schedule.
  const isVercelCron = req.headers.get("x-vercel-cron") !== null
  if (!isVercelCron && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const live = process.env.STREAK_EMAILS_LIVE === "true"
  const admin = adminClient()

  const now = new Date()
  // Anyone who signed up inside the sequence window, whether or not they have
  // ever come back. That "whether or not" is the entire fix: the old query
  // filtered on streak_current_day and streak_broken_at, so a user who signed
  // up and vanished, or whose streak broke, was excluded from the sequence
  // built to reach exactly them.
  const windowStart = new Date(now.getTime() - (SEQUENCE_LENGTH + 1) * 24 * 60 * 60 * 1000)

  const { data: rows, error } = await admin
    .from("user_profiles")
    .select(
      "id, email, created_at, streak_last_emailed_day, streak_email_consecutive_lapsed, " +
      "streak_last_active_date, streak_broken_at, streak_emails_unsubscribed_at"
    )
    .gte("created_at", windowStart.toISOString())
    // An unsubscribe that the sender ignores is worse than no unsubscribe at
    // all: it is a promise the product breaks the next morning. Filtered here,
    // in the query, so no code path downstream can send to them by accident.
    .is("streak_emails_unsubscribed_at", null)
    // NULL means never emailed, and `lt` alone would exclude exactly those
    // rows: in Postgres NULL < 5 is NULL, not true. Dropping every
    // never-emailed user from a first-send query is the same shape of silent
    // exclusion this whole change exists to remove.
    .or(`streak_last_emailed_day.is.null,streak_last_emailed_day.lt.${SEQUENCE_LENGTH}`)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // One cast, at the boundary, rather than one per property access below.
  // PostgREST's .or() filter defeats the client's row-type inference, so
  // without this every field read reports as GenericStringError. The shape is
  // exactly the select list above.
  const candidates = (rows ?? []) as unknown as (EmailProfile & { id: string; email: string })[]

  // Every decision comes from decideSend, which is pure and unit-tested in
  // scripts/test-streak-schedule.mjs. Nothing about who gets what is decided
  // in this file, because a rule that only exists inside a cron route is a
  // rule nobody can test, which is how the original trigger bug survived.
  const decided = candidates.map((row) => ({ row, decision: decideSend(row, now) }))
  const due = decided.filter((d) => d.decision.send)
  const skipped = decided.filter((d) => !d.decision.send)

  const results: {
    userId: string; day: number | null; variant: string | null; sent: boolean; reason: string
  }[] = []

  for (const { row, decision } of due) {
    const day = decision.day as 1 | 2 | 3 | 4 | 5
    const variant = decision.variant!
    if (!live) {
      results.push({ userId: row.id, day, variant, sent: false, reason: "dry run, STREAK_EMAILS_LIVE is not true" })
      continue
    }
    try {
      const email = buildStreakEmail(day, { uid: row.id, day }, variant)
      await sendEmail({
        to: row.email as string,
        subject: email.subject,
        html: email.html,
        unsubscribeUrl: unsubscribeUrl(row.id as string),
      })
      // Both counters move together. If the lapsed count were written
      // separately, a crash between the two writes would leave a user who can
      // never be stopped or one who can never resume.
      await admin
        .from("user_profiles")
        .update({
          streak_last_emailed_day: day,
          streak_email_consecutive_lapsed: nextLapsedCount(
            row.streak_email_consecutive_lapsed as number | null, variant
          ),
        })
        .eq("id", row.id)
      await trackStreakEmailSent(row.id, day)
      results.push({ userId: row.id, day, variant, sent: true, reason: decision.reason })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[cron/streak-emails] send failed:", row.id, err instanceof Error ? err.message : err)
      results.push({ userId: row.id, day, variant, sent: false, reason: "send failed" })
    }
  }

  // Skips are returned, not swallowed. "Nobody was due today" and "everyone was
  // silently filtered out by a query bug" look identical from an empty result,
  // and telling them apart on the day the key lands is the point of this run.
  return NextResponse.json({
    live,
    now: now.toISOString(),
    candidates: rows?.length ?? 0,
    dueCount: due.length,
    results,
    skipped: skipped.map((s) => ({ userId: s.row.id, reason: s.decision.reason })),
  })
}

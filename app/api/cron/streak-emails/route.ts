import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"
import { buildStreakEmail } from "@/lib/email/streakEmails"
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

  const { data: rows, error } = await admin
    .from("user_profiles")
    .select("id, email, streak_current_day, streak_last_emailed_day")
    .not("streak_current_day", "is", null)
    .is("streak_broken_at", null)
    .gte("streak_current_day", 1)
    .lte("streak_current_day", 5)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const due = (rows ?? []).filter(
    (r) => r.streak_last_emailed_day == null || r.streak_last_emailed_day < r.streak_current_day
  )

  const results: { userId: string; day: number; sent: boolean }[] = []

  for (const row of due) {
    const day = row.streak_current_day as 1 | 2 | 3 | 4 | 5
    if (!live) {
      results.push({ userId: row.id, day, sent: false })
      continue
    }
    try {
      const email = buildStreakEmail(day, { uid: row.id, day })
      await sendEmail({ to: row.email as string, subject: email.subject, html: email.html })
      await admin.from("user_profiles").update({ streak_last_emailed_day: day }).eq("id", row.id)
      await trackStreakEmailSent(row.id, day)
      results.push({ userId: row.id, day, sent: true })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[cron/streak-emails] send failed:", row.id, err instanceof Error ? err.message : err)
      results.push({ userId: row.id, day, sent: false })
    }
  }

  return NextResponse.json({ live, dueCount: due.length, results })
}

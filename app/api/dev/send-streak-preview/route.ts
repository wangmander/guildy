import { NextResponse } from "next/server"
import { sendEmail } from "@/lib/email/resend"
import { buildStreakEmail } from "@/lib/email/streakEmails"

// One-off: sends the real 5 streak emails to Michael's own inbox on a
// compressed schedule, so he reads them as mail instead of as drafts, per
// his explicit instruction. The recipient is a literal, not configurable
// by request body or query param, on purpose: this endpoint cannot be
// made to email anyone else no matter how it's called. Not the production
// path (see app/api/cron/streak-emails/route.ts) and not linked from
// anywhere a real user would reach.

export const runtime = "nodejs"
export const maxDuration = 120

const RECIPIENT = "boxgetdesign@gmail.com"
const GAP_MS = 20_000 // 20s apart: five distinct emails, readable as a sequence, not a scroll-fest

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST() {
  const results: { day: number; ok: boolean; id?: string; error?: string }[] = []

  for (const day of [1, 2, 3, 4, 5] as const) {
    const email = buildStreakEmail(day, { uid: "preview", day })
    try {
      const { id } = await sendEmail({
        to: RECIPIENT,
        subject: `[Preview Day ${day}/5] ${email.subject}`,
        html: email.html,
      })
      results.push({ day, ok: true, id })
    } catch (err) {
      results.push({ day, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
    if (day < 5) await sleep(GAP_MS)
  }

  return NextResponse.json({ recipient: RECIPIENT, results })
}

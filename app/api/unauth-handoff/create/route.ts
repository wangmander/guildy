import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Prompt 21: unauthenticated handoff persistence for the Quick Prep
// funnel. The marketing-side proxy posts { jd, resumeText, prepOutput }
// here after a successful unauth generation; we store the payload and
// return a uuid the signup flow consumes on onboarding completion.
//
// 2026-08-11: second payload, same mechanism. A visitor's 5-day streak
// starts on landing, before any demo interaction, so this now also
// accepts { streakStartedAt } alone, plus an optional { id } so a visitor
// who already has a streak handoff and later runs the demo (or vice
// versa) gets ONE row carrying both payloads, not two rows racing for
// which uuid makes it into the signup link. Requires at least one
// complete payload (all three prep fields, or streakStartedAt); the
// same rule as the unauth_handoffs_payload_check constraint.
//
// No auth: uses the service-role client against an RLS-protected table
// with no policies, so the returned uuid is the only capability token.
// Mirrors the adminClient pattern in the Stripe webhook route.

export const maxDuration = 30

// Mirror the authenticated-flow input caps so a single oversized payload
// cannot bloat the row.
const JD_MAX = 20000
const RESUME_MAX = 50000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  let body: {
    id?: unknown
    jd?: unknown
    resumeText?: unknown
    prepOutput?: unknown
    streakStartedAt?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const id = typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : null
  const jd = typeof body.jd === "string" ? body.jd.trim() : ""
  const resumeText =
    typeof body.resumeText === "string" ? body.resumeText.trim() : ""
  const prepOutput = body.prepOutput
  const streakStartedAt =
    typeof body.streakStartedAt === "string" ? body.streakStartedAt.trim() : ""

  const hasPrepPayload = jd.length > 0 && resumeText.length > 0 && prepOutput != null
  const hasStreakPayload = streakStartedAt.length > 0

  if (!hasPrepPayload && !hasStreakPayload) {
    return NextResponse.json(
      { error: "Provide either { jd, resumeText, prepOutput } or { streakStartedAt }" },
      { status: 400 }
    )
  }
  if (jd.length > JD_MAX || resumeText.length > RESUME_MAX) {
    return NextResponse.json({ error: "Input too long" }, { status: 400 })
  }
  if (hasPrepPayload && (typeof prepOutput !== "object" || prepOutput === null)) {
    return NextResponse.json({ error: "Missing prepOutput" }, { status: 400 })
  }
  if (hasStreakPayload && Number.isNaN(Date.parse(streakStartedAt))) {
    return NextResponse.json({ error: "streakStartedAt is not a valid timestamp" }, { status: 400 })
  }

  const fields: Record<string, unknown> = {}
  if (hasPrepPayload) {
    fields.jd_text = jd
    fields.resume_text = resumeText
    fields.prep_output = prepOutput
  }
  if (hasStreakPayload) fields.streak_started_at = streakStartedAt

  try {
    const supabase = adminClient()

    // Merge onto an existing row (the other payload arriving second) rather
    // than minting a competing uuid. Falls through to insert if the id is
    // missing, unknown, or already consumed, same as a fresh visitor.
    if (id) {
      const { data: updated, error: updateError } = await supabase
        .from("unauth_handoffs")
        .update(fields)
        .eq("id", id)
        .select("id")
        .maybeSingle()
      if (updated && !updateError) {
        return NextResponse.json({ id: updated.id })
      }
    }

    const { data, error } = await supabase
      .from("unauth_handoffs")
      .insert(fields)
      .select("id")
      .single()
    if (error || !data) {
      // Log the PostgREST code + details (no PII) so a prod failure is
      // self-diagnosing: PGRST205 = missing table, 42501 = RLS/key issue.
      // eslint-disable-next-line no-console
      console.error(
        "[unauth-handoff/create] insert failed:",
        error?.code,
        error?.message,
        error?.details
      )
      return NextResponse.json(
        { error: "Could not save handoff" },
        { status: 503 }
      )
    }
    return NextResponse.json({ id: data.id })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[unauth-handoff/create] error:",
      err instanceof Error ? err.message : err
    )
    return NextResponse.json(
      { error: "Could not save handoff" },
      { status: 503 }
    )
  }
}

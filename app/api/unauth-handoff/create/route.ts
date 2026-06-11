import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Prompt 21: unauthenticated handoff persistence for the Quick Prep
// funnel. The marketing-side proxy posts { jd, resumeText, prepOutput }
// here after a successful unauth generation; we store the payload and
// return a uuid the signup flow consumes on onboarding completion.
//
// No auth: uses the service-role client against an RLS-protected table
// with no policies, so the returned uuid is the only capability token.
// Mirrors the adminClient pattern in the Stripe webhook route.

export const maxDuration = 30

// Mirror the authenticated-flow input caps so a single oversized payload
// cannot bloat the row.
const JD_MAX = 20000
const RESUME_MAX = 50000

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  let body: { jd?: unknown; resumeText?: unknown; prepOutput?: unknown }
  try {
    body = (await req.json()) as {
      jd?: unknown
      resumeText?: unknown
      prepOutput?: unknown
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const jd = typeof body.jd === "string" ? body.jd.trim() : ""
  const resumeText =
    typeof body.resumeText === "string" ? body.resumeText.trim() : ""
  const prepOutput = body.prepOutput

  if (jd.length === 0 || resumeText.length === 0) {
    return NextResponse.json(
      { error: "Missing jd or resumeText" },
      { status: 400 }
    )
  }
  if (jd.length > JD_MAX || resumeText.length > RESUME_MAX) {
    return NextResponse.json({ error: "Input too long" }, { status: 400 })
  }
  if (typeof prepOutput !== "object" || prepOutput === null) {
    return NextResponse.json({ error: "Missing prepOutput" }, { status: 400 })
  }

  try {
    const supabase = adminClient()
    const { data, error } = await supabase
      .from("unauth_handoffs")
      .insert({ jd_text: jd, resume_text: resumeText, prep_output: prepOutput })
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

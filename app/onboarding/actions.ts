"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

import { trackKanbanJobCreated, trackSignupCompleted } from "@/lib/analytics"
import { buildContextHash } from "@/lib/ai/context-hash"
import { QUICK_PREP_MODEL } from "@/lib/ai/models"
import { stageKeyToPrepStage } from "@/lib/ai/prep-types"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type ActionResult = {
  ok: boolean
  message?: string
  reason?: "auth" | "input" | "db"
}

export async function saveResumeTextAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, reason: "auth", message: "Not signed in." }
  }

  const text = String(formData.get("resume_text") ?? "").trim()
  if (text.length === 0) {
    return { ok: false, reason: "input", message: "Add some text before saving." }
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ resume_text: text })
    .eq("id", user.id)

  if (error) {
    return { ok: false, reason: "db", message: `Save failed: ${error.message}` }
  }

  return { ok: true }
}

// Prompt 21: unauth Quick Prep handoff consumption ------------------------
//
// On onboarding completion, if the user arrived from the marketing-site
// Quick Prep funnel a handoff uuid is passed through (captured at
// /signup, stashed in localStorage, read back by the onboarding form).
// consumeHandoff turns that row into a real job with the already-generated
// Quick Prep cached, so the user lands on /app with prep ready and no
// regeneration. The whole path is best-effort: any failure logs and the
// user proceeds to an empty /app. It never blocks signup.

const HANDOFF_TTL_MS = 60 * 60 * 1000

function handoffAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// First non-empty line of the JD, capped at 80 chars. The unauth flow has
// no structured company/role, so this is a best-effort role title the
// user can rename inline on the board.
function deriveJobTitle(jd: string): string {
  const firstLine = jd
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  const candidate = (firstLine ?? jd).trim()
  if (candidate.length === 0) return "Untitled job"
  return candidate.slice(0, 80)
}

async function consumeHandoff(
  handoffId: string,
  userId: string,
  resumeText: string
): Promise<string | null> {
  const admin = handoffAdminClient()

  const { data: row, error: fetchError } = await admin
    .from("unauth_handoffs")
    .select("id, jd_text, prep_output, created_at")
    .eq("id", handoffId)
    .maybeSingle()
  if (fetchError || !row) return null

  // Read-time expiry: a handoff older than the TTL is dropped, not used.
  const ageMs = Date.now() - new Date(row.created_at as string).getTime()
  if (ageMs > HANDOFF_TTL_MS) {
    await admin.from("unauth_handoffs").delete().eq("id", handoffId)
    return null
  }

  const jdText = row.jd_text as string

  // Active-board Applied: state "active" + stage "applied" so the job
  // shows on the board immediately (per spec, this is the slot reserved
  // for jobs created directly into the active board).
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .insert({
      user_id: userId,
      company_name: "Unknown company",
      role_title: deriveJobTitle(jdText),
      jd_text: jdText,
      state: "active",
      stage: "applied",
      prep_status: "quick_generated",
      activated_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (jobError || !job) return null

  // Hash with the same inputs an authed Quick regen would use:
  // user_profiles.resume_text (post-onboarding) + the job's jd_text +
  // stageKeyToPrepStage("applied"). A future regen then produces the
  // identical hash and the cached row resolves with no false stale.
  const contextHash = buildContextHash({
    tier: "quick",
    stage: stageKeyToPrepStage("applied"),
    resume_text: resumeText,
    jd_text: jdText,
    latest_message: null,
    interviewer_name: null,
    interviewer_title: null,
    interviewer_link: null,
    note_text: null,
  })

  // session_role null marks this as a single (non-Full-Loop) prep, which
  // is how getPrepStatesAction classifies the "single" key.
  const output = {
    ...(row.prep_output as Record<string, unknown>),
    session_role: null,
  }

  const { error: prepError } = await admin.from("prep_versions").insert({
    job_id: job.id,
    user_id: userId,
    tier: "quick",
    model_used: QUICK_PREP_MODEL,
    context_hash: contextHash,
    output,
  })
  if (prepError) {
    // Job exists but the prep cache write failed. Degraded, not broken:
    // the user lands on the job and can generate. Log and continue.
    // eslint-disable-next-line no-console
    console.error(
      "[completeOnboarding] handoff prep insert failed:",
      prepError.message
    )
  }

  // Consume: delete the handoff row regardless of the prep-insert outcome.
  await admin.from("unauth_handoffs").delete().eq("id", handoffId)

  // Fire-and-forget analytics. Failure is swallowed inside the helper.
  await trackKanbanJobCreated(userId, "handoff")

  return job.id as string
}

export async function completeOnboardingAction(handoffId?: string) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // The client passes the localStorage handoff (same-context fallback). When
  // the email was opened in a different browser/device, localStorage is empty
  // and the handoff arrives in the guildy_handoff cookie set at /auth/callback.
  const cookieStore = await cookies()
  const cookieHandoff = cookieStore.get("guildy_handoff")?.value
  const effectiveHandoff =
    handoffId && handoffId.length > 0 ? handoffId : cookieHandoff

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("resume_text")
    .eq("id", user.id)
    .maybeSingle()

  const resumeText =
    typeof profile?.resume_text === "string" ? profile.resume_text : ""
  const hasResume = resumeText.trim().length > 0

  if (!hasResume) {
    return { ok: false as const, message: "Add your resume or background before continuing." }
  }

  // Phase 6.5: signup_completed fires once the user has the minimum data
  // for the product to be useful (resume on file). Awaited so the capture
  // request gets to fly before redirect terminates the action.
  await trackSignupCompleted(user.id)

  // Prompt 21: consume the unauth Quick Prep handoff if one is present.
  // Fully isolated and best-effort: any failure logs and the user still
  // lands on /app. A missing, invalid, or expired uuid is a no-op.
  let openJobId: string | null = null
  if (effectiveHandoff && effectiveHandoff.length > 0) {
    try {
      openJobId = await consumeHandoff(effectiveHandoff, user.id, resumeText)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        "[completeOnboarding] handoff consume failed:",
        err instanceof Error ? err.message : err
      )
    }
  }

  // Clear the cookie carrier once consumed so a later re-onboard does not
  // replay it. Best-effort; the row is also deleted in consumeHandoff.
  if (cookieHandoff) {
    try {
      cookieStore.set("guildy_handoff", "", { path: "/", maxAge: 0 })
    } catch {
      // Cookie mutation not available in this context; the TTL expiry and the
      // consumeHandoff row delete both still apply.
    }
  }

  redirect(openJobId ? `/app?job=${openJobId}` : "/app")
}

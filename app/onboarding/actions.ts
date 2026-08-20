"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

import {
  trackKanbanJobCreated,
  trackPrepReferralConverted,
  trackSignupCompleted,
  trackStreakCarriedToAccount,
} from "@/lib/analytics"
import { buildContextHash } from "@/lib/ai/context-hash"
import { extractJobFields } from "@/lib/ai/extract-jd"
import { QUICK_PREP_MODEL } from "@/lib/ai/models"
import { isShareId } from "@/lib/share/shareId"
import { recordReferral } from "@/lib/share/store"
import { stageKeyToPrepStage } from "@/lib/ai/prep-types"
import { prepBlockMessage, readResumeGate } from "@/lib/resume/gate"
import type { ResumeErrorCode } from "@/lib/resume/errors"
import { ingestResumeFile, ingestResumeText } from "@/lib/resume/ingest"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type ActionResult = {
  ok: boolean
  message?: string
  reason?: "auth" | "input" | "db"
  // Which of the named resume failures this was, when it was one. The form
  // uses it only to decide whether to keep the file picker open; the message
  // is what the user reads.
  code?: ResumeErrorCode
  charCount?: number
}

// Which of the four doors a paste came through. The onboarding form marks
// text it pre-filled from the unauth handoff so that path stays labelled
// through to the resumes row. Nothing downstream branches on it.
function pasteSource(formData: FormData): "paste" | "handoff" {
  return formData.get("source") === "handoff" ? "handoff" : "paste"
}

export async function saveResumeTextAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, reason: "auth", message: "Not signed in." }
  }

  const text = String(formData.get("resume_text") ?? "")
  if (text.trim().length === 0) {
    return { ok: false, reason: "input", message: "Add some text before saving." }
  }

  // Everything below the surface lives in ingestResumeText: normalization,
  // the 200 character minimum, the resumes row, the write-through to
  // user_profiles.resume_text, and the confirmation that the update touched
  // a row rather than silently matching none. The dropped file, the browsed
  // file and this paste all go through it, so they cannot drift.
  const result = await ingestResumeText(supabase, user.id, {
    text,
    source: pasteSource(formData),
  })

  if (!result.ok) {
    return {
      ok: false,
      reason: result.code === "too_short" ? "input" : "db",
      message: result.message,
      code: result.code,
      charCount: result.charCount,
    }
  }

  return { ok: true }
}

// Door 1 and 2: a file, dropped or browsed. Same destination as the paste,
// with a parse in front of it. A parse failure returns before anything is
// written, so a bad upload never costs the user the resume already on file.
export async function uploadResumeFileAction(
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, reason: "auth", message: "Not signed in." }
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { ok: false, reason: "input", message: "No file received. Try again." }
  }

  const source =
    formData.get("source") === "upload_drop" ? "upload_drop" : "upload_browse"

  const result = await ingestResumeFile(supabase, user.id, file, source)

  if (!result.ok) {
    return {
      ok: false,
      reason: result.code === "write_failed" ? "db" : "input",
      message: result.message,
      code: result.code,
      charCount: result.charCount,
    }
  }

  return { ok: true, message: `Read ${result.charCount} characters from ${file.name}.` }
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
const HANDOFF_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function handoffAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Phase 8.5: pre-fill onboarding with the resume the visitor already pasted on
// the marketing site, so a handoff user clicks through with no manual paste.
// Read-only by uuid (the capability token), TTL-respected. Does NOT consume or
// delete the row; consumeHandoff still runs at completion. Returns null on any
// miss so the onboarding box just stays empty.
export async function getHandoffResumeAction(
  handoffId: string
): Promise<string | null> {
  if (!handoffId || !HANDOFF_UUID_RE.test(handoffId)) return null
  const admin = handoffAdminClient()
  const { data, error } = await admin
    .from("unauth_handoffs")
    .select("resume_text, created_at")
    .eq("id", handoffId)
    .maybeSingle()
  if (error || !data) return null
  const ageMs = Date.now() - new Date(data.created_at as string).getTime()
  if (ageMs > HANDOFF_TTL_MS) return null
  const resume = data.resume_text
  return typeof resume === "string" && resume.trim().length > 0 ? resume : null
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

// 2026-08-11: carries the streak's start timestamp onto the new account,
// same handoff row the prep payload rides in on. Best-effort like the rest
// of this path: a failure here never blocks signup, it just means the
// streak doesn't carry (same honest degradation the prep handoff already
// has for a missing/expired row).
async function carryStreak(
  admin: ReturnType<typeof handoffAdminClient>,
  userId: string,
  streakStartedAt: string
): Promise<boolean> {
  const startedAt = new Date(streakStartedAt)
  if (Number.isNaN(startedAt.getTime())) return false

  const daysElapsed = Math.floor(
    (Date.now() - startedAt.getTime()) / (24 * 60 * 60 * 1000)
  )
  // Landing was day 1; a signup happening the same day or the next still
  // reads as day 1 or 2. Clamp to the 5-day window: a handoff older than
  // that reads as already-closed, not as a phantom day 6+.
  const currentDay = Math.max(1, Math.min(5, daysElapsed + 1))

  const { error } = await admin
    .from("user_profiles")
    .update({
      streak_started_at: startedAt.toISOString(),
      streak_current_day: currentDay,
      streak_last_active_date: new Date().toISOString().slice(0, 10),
      streak_broken_at: null,
    })
    .eq("id", userId)

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[completeOnboarding] streak carry failed:", error.message)
    return false
  }
  await trackStreakCarriedToAccount(userId, currentDay)
  return true
}

async function consumeHandoff(
  handoffId: string,
  userId: string,
  resumeText: string
): Promise<string | null> {
  const admin = handoffAdminClient()

  const { data: row, error: fetchError } = await admin
    .from("unauth_handoffs")
    .select("id, jd_text, prep_output, streak_started_at, created_at")
    .eq("id", handoffId)
    .maybeSingle()
  if (fetchError || !row) return null

  // Read-time expiry: a handoff older than the TTL is dropped, not used.
  const ageMs = Date.now() - new Date(row.created_at as string).getTime()
  if (ageMs > HANDOFF_TTL_MS) {
    await admin.from("unauth_handoffs").delete().eq("id", handoffId)
    return null
  }

  const streakStartedAt = row.streak_started_at as string | null
  if (streakStartedAt) await carryStreak(admin, userId, streakStartedAt)

  // Streak-only row (visitor landed, never touched the demo): nothing to
  // turn into a job. Consume it here and stop; the prep-specific insert
  // logic below requires jd_text.
  if (!row.jd_text) {
    await admin.from("unauth_handoffs").delete().eq("id", handoffId)
    return null
  }

  const jdText = row.jd_text as string

  // The unauth funnel never parsed a company (unauth_handoffs stores only
  // jd_text), so the card and prep header showed "Unknown company". Reuse
  // the in-app JD parser on the stored jd_text at consume time to recover
  // company, role, and TC. Best-effort: any failure (bad key, model error,
  // null fields) falls back to the prior heuristics so signup is never
  // blocked. Awaited before insert so the first board render is correct.
  let parsedCompany: string | null = null
  let parsedRole: string | null = null
  let parsedTc: string | null = null
  try {
    const fields = await extractJobFields(jdText)
    parsedCompany = fields.company_name
    parsedRole = fields.role_title
    parsedTc = fields.tc
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[completeOnboarding] handoff JD parse failed:",
      err instanceof Error ? err.message : err
    )
  }

  // Active-board Applied: state "active" + stage "applied" so the job
  // shows on the board immediately (per spec, this is the slot reserved
  // for jobs created directly into the active board).
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .insert({
      user_id: userId,
      company_name: parsedCompany ?? "Unknown company",
      role_title: parsedRole ?? deriveJobTitle(jdText),
      tc: parsedTc,
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

export async function completeOnboardingAction(
  handoffId?: string,
  refId?: string
) {
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

  const gate = await readResumeGate(supabase, user.id)

  if (gate.status === "unknown") {
    return {
      ok: false as const,
      message: "Could not read your profile just now. Refresh and try again.",
    }
  }

  if (gate.status === "absent") {
    return { ok: false as const, message: "Add your resume or background before continuing." }
  }

  // A legacy profile under the minimum reaches onboarding with text already
  // in the box. Say what is wrong with it and let them add to it; do not wipe
  // it on their behalf.
  if (gate.status === "too_short") {
    return {
      ok: false as const,
      message:
        prepBlockMessage(gate) ?? "Add more of your background before continuing.",
    }
  }

  const resumeText = gate.resumeText

  // Phase 6.5: signup_completed fires once the user has the minimum data
  // for the product to be useful (resume on file). Awaited so the capture
  // request gets to fly before redirect terminates the action.
  await trackSignupCompleted(user.id)

  // Viral loop: if this signup came from a shared prep link, record the
  // "signup" referral and fire prep_referral_converted (distinct_id is the
  // real user id; share_id rides in properties). Best-effort: any failure
  // logs and never blocks the user landing on /app.
  if (isShareId(refId)) {
    try {
      await recordReferral(refId, "signup", user.id)
      await trackPrepReferralConverted(user.id, refId)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        "[completeOnboarding] referral record failed:",
        err instanceof Error ? err.message : err
      )
    }
  }

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

  // Land on the board with the overlay closed. ?new flags the just-created
  // card for its one-time entrance animation; it does NOT open the overlay
  // (that is ?job, used by deep links). Board strips ?new after first paint.
  redirect(openJobId ? `/app?new=${openJobId}` : "/app")
}

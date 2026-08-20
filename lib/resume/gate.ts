import type { SupabaseClient } from "@supabase/supabase-js"

// From limits, not ingest: this file runs inside middleware on the Edge
// runtime, and ingest reaches the PDF and DOCX parsers.
import { RESUME_MIN_CHARS, tooShortMessage } from "./limits"

// Single source of truth for "does this user have a resume on file".
//
// 2026-08-19 incident: /app read resume_text as part of a wide user_profiles
// select that also asked for streak_* columns. Those columns existed in the
// repo's migrations but had never been applied to prod, so PostgREST failed
// the whole select with 42703 (undefined_column). The caller destructured
// only `data`, so the error vanished and `profile` was null, which read as
// "no resume" and disabled every generate button. The user had a 9.5k
// character resume saved the whole time.
//
// Two rules come out of that, and every caller here depends on both:
//
//   1. The gate selects resume_text and nothing else. An unrelated column
//      cannot take the gate down with it, whatever else a caller needs.
//   2. A failed read is not an absent resume. `status: "unknown"` is its own
//      state so no caller can silently turn an infrastructure fault back
//      into "go upload a resume", which is the exact lie that caused this.
//
// "too_short" is the third state, added when the 200 character minimum
// landed. It is not the same as absent: these users did save something, and
// telling them to add a resume they can see in the box is the same lie in a
// different costume. They are told the count, shown what is stored, and
// pointed at replace. Nothing is wiped on their behalf.
export type ResumeGate =
  | { status: "present"; resumeText: string }
  | { status: "absent"; resumeText: null }
  | { status: "too_short"; resumeText: string; charCount: number }
  | { status: "unknown"; resumeText: null; error: string }

export async function readResumeGate(
  supabase: SupabaseClient,
  userId: string
): Promise<ResumeGate> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("resume_text")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[resume-gate] profile read failed:", error.message)
    return { status: "unknown", resumeText: null, error: error.message }
  }

  const text = typeof data?.resume_text === "string" ? data.resume_text : ""
  const trimmed = text.trim()
  if (trimmed.length === 0) return { status: "absent", resumeText: null }
  if (trimmed.length < RESUME_MIN_CHARS) {
    return { status: "too_short", resumeText: text, charCount: trimmed.length }
  }
  return { status: "present", resumeText: text }
}

// Can prep run on this? Absent and too_short both mean no; the model has
// nothing to ground an answer in either way. "unknown" deliberately does NOT
// block: a broken read means the app is degraded, and refusing to generate
// for someone whose resume is fine is the failure this file exists to stop.
export function blocksPrep(gate: ResumeGate): boolean {
  return gate.status === "absent" || gate.status === "too_short"
}

// Should this user be bounced to /onboarding? Only a confirmed-absent resume.
// A too_short user keeps their board: their fix is a replace, which they
// reach from the Intro/Cover Letter row or from the prep error itself, and
// stranding them on an onboarding page they already completed does not help.
// A failed read never redirects, or a broken profile read loops the user onto
// a page that cannot save either.
export function requiresOnboarding(gate: ResumeGate): boolean {
  return gate.status === "absent"
}

// The sentence to show when the gate refuses prep. Null when it does not.
export function prepBlockMessage(gate: ResumeGate): string | null {
  if (gate.status === "absent") {
    return "Add your resume before running prep."
  }
  if (gate.status === "too_short") {
    return `The resume on file is too short to work with. ${tooShortMessage(
      gate.charCount
    )}`
  }
  return null
}

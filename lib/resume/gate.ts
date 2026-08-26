import type { SupabaseClient } from "@supabase/supabase-js"

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
export type ResumeGate =
  | { status: "present"; resumeText: string }
  | { status: "absent"; resumeText: null }
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
  if (text.trim().length === 0) return { status: "absent", resumeText: null }
  return { status: "present", resumeText: text }
}

// What the UI should do with the gate. "unknown" deliberately does NOT block:
// a broken read means the app is degraded, and telling the user to add a
// resume they already added is worse than letting them try. The server-side
// check in generatePrepAction is the authority, so nothing unsafe gets
// through on the strength of this being permissive.
export function blocksPrep(gate: ResumeGate): boolean {
  return gate.status === "absent"
}

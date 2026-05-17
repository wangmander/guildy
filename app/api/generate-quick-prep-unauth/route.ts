import { NextResponse } from "next/server"

import { generatePrep } from "@/lib/ai/generate-prep"
import type { PrepInput } from "@/lib/ai/prep-types"

// Prompt 20: unauthenticated Quick Prep generation for the guildy.ai hero
// funnel. Lets a visitor paste a JD + resume/intro and get a Quick Prep
// sketch before signing up. Stateless: no user lookup, no DB write. The
// authenticated generatePrepAction flow is untouched.
//
// TODO: Rate limit when user volume warrants. Anthropic credit is finite
// ($7 + auto-reload disabled), so abuse is self-bounded for now.

// Quick Prep runs a single Haiku pass (no research step). 60s is a
// comfortable ceiling for a call that typically settles in ~20s.
export const maxDuration = 60

// Mirror the authenticated-flow input caps (createJobSchema jd_text max
// 20000, updateUserResumeSchema resume_text max 50000) so a single
// oversized paste can't balloon token cost on this public boundary.
const JD_MAX = 20000
const RESUME_MAX = 50000

export async function POST(req: Request) {
  let body: { jd?: unknown; resumeText?: unknown }
  try {
    body = (await req.json()) as { jd?: unknown; resumeText?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const jd = typeof body.jd === "string" ? body.jd.trim() : ""
  const resumeText =
    typeof body.resumeText === "string" ? body.resumeText.trim() : ""

  if (jd.length === 0 || resumeText.length === 0) {
    return NextResponse.json(
      { error: "Paste both a job description and your resume or intro." },
      { status: 400 }
    )
  }
  if (jd.length > JD_MAX || resumeText.length > RESUME_MAX) {
    return NextResponse.json(
      { error: "That input is too long. Trim it down and try again." },
      { status: 400 }
    )
  }

  // company/role are unknown for an unauth one-shot; the model leans on the
  // JD text directly. "(not provided)" matches the interviewer-block
  // convention in the prompt assembly. Stage defaults to the earliest real
  // round, which is the most broadly applicable for a generic preview.
  const input: PrepInput = {
    resume_text: resumeText,
    jd_text: jd,
    latest_message: null,
    company_name: "(not provided)",
    role_title: "(not provided)",
    stage: "screen",
    interviewer_name: null,
    interviewer_title: null,
    interviewer_link: null,
    note_text: null,
    tier: "quick",
  }

  try {
    const prep = await generatePrep(input)
    return NextResponse.json({ prep })
  } catch (err) {
    // Anthropic failure or exhausted credit: opaque fallback, no detail.
    // eslint-disable-next-line no-console
    console.error(
      "[generate-quick-prep-unauth] generation failed:",
      err instanceof Error ? err.message : err
    )
    return NextResponse.json({ error: "Try again later" }, { status: 503 })
  }
}

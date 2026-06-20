import { NextResponse } from "next/server"

import { extractJobFields } from "@/lib/ai/extract-jd"
import { generatePrep } from "@/lib/ai/generate-prep"
import type { PrepInput } from "@/lib/ai/prep-types"
import { newShareId } from "@/lib/share/shareId"
import { shareAdminClient } from "@/lib/share/store"
import { buildTeaser } from "@/lib/share/teaser"

// Viral loop: mint a public share link for an unauth prep. Called on an
// explicit Share click (no junk rows), server-to-server from the marketing
// proxy (mirrors /api/unauth-handoff/create, so no CORS here).
//
// PRIVACY: the live unauth prep is generated WITH the visitor's resume, so its
// output is resume-tainted and must never be stored or teased. This route
// regenerates a JD-ONLY teaser (resume "(not provided)") so the stored teaser
// is grounded purely in the public JD. We persist only teaser-safe fields.

// JD-only Quick Prep is a single Haiku pass; 60s is a comfortable ceiling.
export const maxDuration = 60

const JD_MAX = 20000

export async function POST(req: Request) {
  let body: { jd?: unknown }
  try {
    body = (await req.json()) as { jd?: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const jd = typeof body.jd === "string" ? body.jd.trim() : ""
  if (jd.length === 0) {
    return NextResponse.json({ error: "Missing jd" }, { status: 400 })
  }
  if (jd.length > JD_MAX) {
    return NextResponse.json({ error: "Input too long" }, { status: 400 })
  }

  // Role/company for the share header + OG title. JD-only parse, best-effort:
  // a failure just leaves them null and the page falls back to "this role".
  let roleTitle: string | null = null
  let companyName: string | null = null
  try {
    const fields = await extractJobFields(jd)
    roleTitle = fields.role_title
    companyName = fields.company_name
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[share/create] JD field parse failed:",
      err instanceof Error ? err.message : err
    )
  }

  // JD-only teaser generation. resume_text "(not provided)" guarantees the
  // output carries no resume-derived content. Same placeholder convention the
  // unauth one-shot uses for company/role.
  const input: PrepInput = {
    resume_text: "(not provided)",
    jd_text: jd,
    latest_message: null,
    company_name: companyName ?? "(not provided)",
    role_title: roleTitle ?? "(not provided)",
    stage: "screen",
    interviewer_name: null,
    interviewer_title: null,
    interviewer_link: null,
    note_text: null,
    tier: "quick",
  }

  let teaser
  try {
    const prep = await generatePrep(input)
    teaser = buildTeaser(prep)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[share/create] teaser generation failed:",
      err instanceof Error ? err.message : err
    )
    return NextResponse.json({ error: "Try again later" }, { status: 503 })
  }

  const id = newShareId()
  const admin = shareAdminClient()
  const { error } = await admin.from("shared_preps").insert({
    id,
    role_title: roleTitle,
    company_name: companyName,
    jd_text: jd,
    teaser,
  })
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[share/create] insert failed:", error.code, error.message)
    return NextResponse.json(
      { error: "Could not create share link" },
      { status: 503 }
    )
  }

  // App origin from the request so the link points at this deployment
  // (app.guildy.ai in prod, the preview host otherwise).
  const origin = new URL(req.url).origin
  return NextResponse.json({ id, url: `${origin}/p/${id}` })
}

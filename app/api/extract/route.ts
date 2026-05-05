import { NextResponse } from "next/server"
import { z } from "zod"

import { JdExtractionError, extractJobFields } from "@/lib/ai/extract-jd"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

// URL intake is removed from the Add Job modal in patch 6 — extraction is
// unreliable across LinkedIn (auth wall), Greenhouse / Lever (JS-rendered).
// The discriminator still accepts `kind: "url"` so direct callers
// (devtools, future re-enable) get a clean 410 instead of a 400. The
// `htmlToText` helper and `lib/ai/extract-jd.ts` URL fetch path are kept
// for the V2.1 revisit.
const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.string().url() }),
  z.object({ kind: z.literal("jd"), jd_text: z.string().min(20) }),
])

function serializeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    let parsed
    try {
      const json = await req.json()
      parsed = bodySchema.parse(json)
    } catch (err) {
      console.error("[extract] invalid body:", err)
      return NextResponse.json({ error: "invalid_body" }, { status: 400 })
    }

    if (parsed.kind === "url") {
      return NextResponse.json(
        {
          ok: false,
          reason: "extract_failed",
          error:
            "URL extraction temporarily disabled. Paste JD text directly.",
        },
        { status: 410 }
      )
    }

    try {
      const fields = await extractJobFields(parsed.jd_text)
      return NextResponse.json({ ok: true, fields, jd_text: parsed.jd_text })
    } catch (err) {
      console.error("[extract] extract failed (jd):", err)
      if (err instanceof JdExtractionError) {
        return NextResponse.json({
          ok: false,
          reason: "login_wall",
          error: err.message,
        })
      }
      return NextResponse.json({
        ok: false,
        reason: "extract_failed",
        error: serializeError(err),
        jd_text: parsed.jd_text,
      })
    }
  } catch (err) {
    console.error("[extract] unhandled error:", err)
    return NextResponse.json(
      { ok: false, reason: "extract_failed", error: serializeError(err) },
      { status: 200 }
    )
  }
}

import { NextResponse } from "next/server"
import { z } from "zod"

import { extractJobFields, htmlToText } from "@/lib/ai/extract-jd"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.string().url() }),
  z.object({ kind: z.literal("jd"), jd_text: z.string().min(20) }),
])

const FETCH_TIMEOUT_MS = 5000

async function fetchUrlText(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    const html = await res.text()
    const text = htmlToText(html)
    if (text.length < 80) throw new Error("body too short")
    return text
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(req: Request) {
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
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  if (parsed.kind === "url") {
    let text: string
    try {
      text = await fetchUrlText(parsed.url)
    } catch {
      return NextResponse.json({
        ok: false,
        reason: "fetch_failed",
      })
    }
    try {
      const fields = await extractJobFields(text)
      return NextResponse.json({
        ok: true,
        fields,
        jd_text: text.slice(0, 20000),
      })
    } catch {
      return NextResponse.json({
        ok: false,
        reason: "extract_failed",
        jd_text: text.slice(0, 20000),
      })
    }
  }

  try {
    const fields = await extractJobFields(parsed.jd_text)
    return NextResponse.json({ ok: true, fields, jd_text: parsed.jd_text })
  } catch {
    return NextResponse.json({
      ok: false,
      reason: "extract_failed",
      jd_text: parsed.jd_text,
    })
  }
}

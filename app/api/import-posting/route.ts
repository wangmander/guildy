import { NextResponse } from "next/server"
import { z } from "zod"

import { PostingParseError, parsePosting } from "@/lib/ai/parse-posting"
import {
  MAX_POSTING_CHARS,
  fetchPostingText,
  hostOf,
  isAllowedHost,
  looksLikeUrl,
  normalizeUrl,
} from "@/lib/jobLink"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

// The first-job takeover's import endpoint. Text is the primary path. URLs are
// accepted only for the hosts the link-parse spike cleared for a plain server
// fetch; everything else gets the blocked message and a nudge back to paste.
//
// Failure shape is deliberately narrow. The client only needs to know which of
// three things happened:
//   blocked_host - a URL on a host we do not import from
//   no_posting   - fetched an allowed host but no single posting body was there
//   parse_failed - we have text but the parse did not yield company + role
const bodySchema = z.object({
  input: z.string().min(1).max(200_000),
})

type ImportFields = {
  company: string
  role_title: string
  location: string | null
  employment_type: string | null
  requirements: string[]
}

type ImportResponse =
  | {
      ok: true
      fields: ImportFields
      jd_text: string
      input_kind: "url" | "text"
      host: string | null
    }
  | {
      ok: false
      reason: "blocked_host" | "no_posting" | "parse_failed"
      input_kind: "url" | "text"
      host: string | null
    }

export async function POST(req: Request): Promise<NextResponse<ImportResponse>> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, reason: "parse_failed", input_kind: "text", host: null },
      { status: 401 }
    )
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json(
      { ok: false, reason: "parse_failed", input_kind: "text", host: null },
      { status: 400 }
    )
  }

  const raw = parsed.input.trim()
  const isUrl = looksLikeUrl(raw)
  const inputKind: "url" | "text" = isUrl ? "url" : "text"
  const host = isUrl ? hostOf(normalizeUrl(raw)) : null

  let postingText: string

  if (isUrl) {
    if (!isAllowedHost(normalizeUrl(raw))) {
      return NextResponse.json({
        ok: false,
        reason: "blocked_host",
        input_kind: "url",
        host,
      })
    }
    const outcome = await fetchPostingText(raw)
    if (!outcome.ok) {
      return NextResponse.json({
        ok: false,
        reason: outcome.reason,
        input_kind: "url",
        host: outcome.host,
      })
    }
    postingText = outcome.text
  } else {
    // Pasted text skips the marker gate. That gate exists to catch a fetch
    // that silently landed on the wrong page, and someone who pasted a
    // posting is not making that mistake. This path gets the same real check
    // every path gets: the parse has to come back with a company and a role.
    postingText = raw.slice(0, MAX_POSTING_CHARS)
  }

  try {
    const fields = await parsePosting(postingText)
    // A 200 is not success. The import counts only when the parse produced
    // both a role title and a company, which is what rejects the spike's
    // empty-200 shapes that a status check and a title check both pass.
    if (!fields.company || !fields.role_title) {
      return NextResponse.json({
        ok: false,
        reason: isUrl ? "no_posting" : "parse_failed",
        input_kind: inputKind,
        host,
      })
    }
    return NextResponse.json({
      ok: true,
      fields: {
        company: fields.company,
        role_title: fields.role_title,
        location: fields.location,
        employment_type: fields.employment_type,
        requirements: fields.requirements,
      },
      jd_text: postingText,
      input_kind: inputKind,
      host,
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[import-posting] parse failed:",
      err instanceof PostingParseError ? err.message : err
    )
    return NextResponse.json({
      ok: false,
      reason: "parse_failed",
      input_kind: inputKind,
      host,
    })
  }
}

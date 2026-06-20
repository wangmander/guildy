import { NextResponse } from "next/server"

import { shareCorsHeaders } from "@/lib/share/cors"
import { getSharedPrepById } from "@/lib/share/store"

// Public teaser-safe read for the viral loop. The marketing hero fetches this
// by id (from the ?ref slug) to pre-fill the viewer's prep with the same JD,
// so it is browser-called cross-origin and needs CORS. Returns ONLY
// teaser-safe fields; the table stores nothing else.

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: shareCorsHeaders() })
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const data = await getSharedPrepById(params.id)
  if (!data) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: shareCorsHeaders() }
    )
  }
  return NextResponse.json(
    {
      id: data.id,
      role_title: data.role_title,
      company_name: data.company_name,
      jd_text: data.jd_text,
      teaser: data.teaser,
    },
    { headers: shareCorsHeaders() }
  )
}

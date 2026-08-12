import { NextResponse } from "next/server"
import { trackStreakEmailOpened } from "@/lib/analytics"

// 1x1 tracking pixel embedded in each streak email. "preview" as uid (the
// one-off send-to-Michael path) never fires this into a real user's
// analytics identity, it is a distinct, literal, non-user id.

export const runtime = "nodejs"

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64"
)

export async function GET(req: Request) {
  const url = new URL(req.url)
  const uid = url.searchParams.get("uid")
  const day = Number(url.searchParams.get("day"))
  if (uid && uid !== "preview" && Number.isFinite(day)) {
    await trackStreakEmailOpened(uid, day)
  }
  return new NextResponse(PIXEL, {
    headers: { "content-type": "image/gif", "cache-control": "no-store" },
  })
}

import { NextResponse } from "next/server"
import { trackStreakEmailClicked } from "@/lib/analytics"

// Click-through redirect for streak email CTAs. Fires the analytics event
// server-side, where it is reliable, then redirects; the link itself is
// the only thing the recipient sees, same UX as a plain link.

export const runtime = "nodejs"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.guildy.ai"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const uid = url.searchParams.get("uid")
  const day = Number(url.searchParams.get("day"))
  const to = url.searchParams.get("to")

  if (uid && uid !== "preview" && Number.isFinite(day)) {
    await trackStreakEmailClicked(uid, day)
  }

  // Only ever redirect within the app, never to an arbitrary external URL
  // an email header could be crafted to carry (open-redirect guard).
  const dest = to && to.startsWith(APP_URL) ? to : `${APP_URL}/app`
  return NextResponse.redirect(dest)
}

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Unsubscribe from the 5-day streak drip.
//
// One click, no login, no confirmation step. A recipient who wants out is not
// in a mood to sign in first, and an unsubscribe that requires authentication
// is the kind that generates spam complaints instead of unsubscribes.
//
// GET handles the link in the email body. POST handles the one-click header
// (RFC 8058), which is what Gmail and Outlook actually call when the user hits
// their native unsubscribe button. Both do the same thing.

export const runtime = "nodejs"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.guildy.ai"

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function unsubscribe(uid: string | null): Promise<boolean> {
  // The uid is a Supabase user id from the recipient's own email. It is not a
  // secret, so the worst an attacker can do with a guessed one is stop someone
  // else's marketing email. That is a far smaller harm than making a real
  // recipient jump through a verification step to stop unwanted mail, which is
  // the trade every mail provider expects you to make.
  if (!uid || uid === "preview") return false
  const { error } = await adminClient()
    .from("user_profiles")
    .update({ streak_emails_unsubscribed_at: new Date().toISOString() })
    .eq("id", uid)
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[email/unsubscribe] failed:", uid, error.message)
    return false
  }
  return true
}

export async function GET(req: Request) {
  const uid = new URL(req.url).searchParams.get("uid")
  const ok = await unsubscribe(uid)
  const message = ok
    ? "You're unsubscribed. No more streak emails."
    : "We couldn't process that unsubscribe link. Reply to the email and we'll remove you by hand."
  return new NextResponse(
    `<!doctype html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f4fb;">
      <table role="presentation" width="100%" style="padding:64px 0"><tr><td align="center">
        <table role="presentation" width="440" style="background:#fff;border-radius:12px;padding:32px">
          <tr><td style="font-weight:800;font-size:18px;color:#1a1033">Guildy</td></tr>
          <tr><td style="padding-top:16px;font-size:15px;line-height:1.55;color:#4a4460">${message}</td></tr>
          <tr><td style="padding-top:24px"><a href="${APP_URL}/app" style="font-size:14px;color:#6d4aff">Back to Guildy</a></td></tr>
        </table>
      </td></tr></table>
    </body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  )
}

// RFC 8058 one-click. Mail clients POST here with no body and expect a 2xx.
export async function POST(req: Request) {
  const ok = await unsubscribe(new URL(req.url).searchParams.get("uid"))
  return NextResponse.json({ ok })
}

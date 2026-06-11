import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/app"
  // Carried in the email link from /login. Parked in an httpOnly cookie so the
  // browser that opens the email (which may differ from the signup browser)
  // hands it to completeOnboardingAction. completeOnboardingAction clears it.
  const handoff = searchParams.get("handoff")

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  if (handoff && UUID_RE.test(handoff)) {
    const cookieStore = await cookies()
    cookieStore.set("guildy_handoff", handoff, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    })
  }

  return NextResponse.redirect(`${origin}${next}`)
}

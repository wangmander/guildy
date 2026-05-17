import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

type CookieSet = { name: string; value: string; options?: CookieOptions }

// Prompt 21: /signup is the unauth Quick Prep funnel's capture route and
// must be reachable without a session, or the auth gate 307s to /login
// and drops the ?handoff= param. The two unauth API routes likewise need
// to bypass the gate: a redirected POST never reaches the handler. The
// generate route shipped in Prompt 20 without this entry, so an
// unauthenticated call was being redirected away from the handler.
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/about",
  "/privacy",
  "/terms",
  "/security",
])
const PUBLIC_PREFIXES = [
  "/auth/",
  "/api/health",
  "/api/generate-quick-prep-unauth",
  "/api/unauth-handoff/",
  "/_next/",
  "/static/",
]

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function updateSession(request: NextRequest) {
  // Patch 6b-fix1: Stripe webhook is unauthenticated (no user cookies, raw
  // body required for signature verification). Bypass session refresh and
  // the auth gate entirely — both would 307-redirect the POST to /login,
  // which Stripe interprets as a delivery failure and retries indefinitely
  // without ever reaching the handler. Other /api/stripe/* routes
  // (checkout, portal) carry user cookies and stay authed via middleware
  // as normal.
  if (request.nextUrl.pathname.startsWith("/api/stripe/webhook")) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (user && (pathname === "/login" || pathname === "/")) {
    const url = request.nextUrl.clone()
    url.pathname = "/app"
    return NextResponse.redirect(url)
  }

  // Onboarding gate: authed users without resume_text must complete onboarding
  // before reaching /app or any future authed surface. /onboarding itself is
  // exempt so the user can land there.
  if (
    user &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/auth/") &&
    !isPublicPath(pathname)
  ) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("resume_text")
      .eq("id", user.id)
      .maybeSingle()

    const hasResume =
      typeof profile?.resume_text === "string" && profile.resume_text.trim().length > 0

    if (!hasResume) {
      const url = request.nextUrl.clone()
      url.pathname = "/onboarding"
      return NextResponse.redirect(url)
    }
  }

  return response
}

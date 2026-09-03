import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { readResumeGate, requiresOnboarding } from "@/lib/resume/gate"

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
// 2026-09-02: the streak drip's two unauthenticated surfaces. /api/cron/ is
// hit by Vercel's scheduler, which carries no session cookie, so the gate was
// 307ing the daily run to /login and the handler never executed. /api/email/
// is hit from mail clients (open pixel, click redirect, one-click
// unsubscribe), which likewise have no session: an unsubscribe link that
// lands on a login page is a promise the product breaks in front of the
// person least inclined to forgive it.
//
// Bypassing the session gate is not the same as being unprotected. The cron
// route authenticates itself on the CRON_SECRET bearer token (see
// app/api/cron/streak-emails/route.ts). The email routes are deliberately
// open: they are addressed by uuid and must work on first click from any
// client, and gating them would defeat their only purpose.
const PUBLIC_PREFIXES = [
  "/auth/",
  "/api/health",
  "/api/generate-quick-prep-unauth",
  "/api/unauth-handoff/",
  "/api/cron/",
  "/api/email/",
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
    // Same shared gate the board and the generate action use, so the three
    // can never disagree about whether a user has a resume. Critically, a
    // failed read is "unknown" and does NOT redirect: bouncing someone to
    // /onboarding on a broken profile read strands them in a loop where the
    // page they are sent to cannot save anything either.
    //
    // requiresOnboarding, not blocksPrep: a resume that is too short to
    // generate on is still a resume the user typed. They keep their board and
    // get told the actual character count at the point they try to generate.
    const gate = await readResumeGate(supabase, user.id)

    if (requiresOnboarding(gate)) {
      const url = request.nextUrl.clone()
      url.pathname = "/onboarding"
      return NextResponse.redirect(url)
    }
  }

  return response
}

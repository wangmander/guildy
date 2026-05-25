"use client"

import { useEffect } from "react"
import posthog from "posthog-js"
import { createBrowserClient } from "@supabase/ssr"

// Phase 6.5 + funnel patch: client-side PostHog initialization plus the
// identify() bridge that links the anonymous distinct_id minted on the
// marketing site (guildy.ai) to the Supabase user once they reach
// app.guildy.ai. cross_subdomain_cookie scopes the distinct_id cookie to
// .guildy.ai so the same id persists across both subdomains.
//
// Server actions (lib/analytics.ts) fire named conversion events directly
// against the capture endpoint keyed on Supabase user.id. That same id is
// the one passed to posthog.identify() below, so server-captured events
// attribute to the identified person automatically.

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"
    if (!key) return
    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      person_profiles: "identified_only",
      cross_subdomain_cookie: true,
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) return

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

    let identified = false
    const identifyFromUser = (user: { id: string; email?: string | null }) => {
      if (identified) return
      identified = true
      const handoff = window.localStorage.getItem("guildy_handoff")
      posthog.identify(
        user.id,
        {
          email: user.email ?? undefined,
          has_handoff: !!handoff,
          handoff_id: handoff,
        },
        {
          // $set_once: only the first identify writes signup_date so
          // subsequent logins don't overwrite the original timestamp.
          signup_date: new Date().toISOString(),
        }
      )
    }

    // Initial mount: an existing session (page refresh, returning user)
    // doesn't fire SIGNED_IN, so prime identify() from getUser().
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) identifyFromUser(data.user)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        identifyFromUser(session.user)
      } else if (event === "SIGNED_OUT") {
        identified = false
        posthog.reset()
      }
    })

    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  return <>{children}</>
}

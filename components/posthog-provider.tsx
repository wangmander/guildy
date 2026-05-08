"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

// Phase 6.5: client-side PostHog initialization. Captures pageviews and
// gives the JS SDK a chance to identify users via supabase auth state on
// mount. No-ops gracefully when NEXT_PUBLIC_POSTHOG_KEY is unset (local
// dev, preview deploys without analytics).
//
// Server actions fire the named conversion events (signup_completed,
// first_prep_generated, subscription_paid) directly via the capture
// endpoint in lib/analytics.ts so we don't depend on the client SDK
// being loaded for the V2.0 KPIs.

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
    })
  }, [])

  return <>{children}</>
}

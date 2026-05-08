import "server-only"

import Stripe from "stripe"

// Phase 6b: lazy Stripe client. The Stripe constructor throws when the API
// key is empty — that breaks `next build`'s page-data collection step
// because route modules get imported even when env vars aren't set during
// build (e.g. on first deploy or when running build without a real key).
// Factory pattern defers construction until a route actually handles a
// request, by which point STRIPE_SECRET_KEY is required.

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is missing from environment")
  }
  cached = new Stripe(key, {
    // Brief pinned to "2024-12-18.acacia". SDK 22's apiVersion type narrows
    // to its own latest literal, so the older value won't fit. Cast through
    // any since the runtime accepts any valid Stripe API string —
    // downgrading to an explicit older API version is intentional for
    // stable webhook event shapes across SDK upgrades.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2024-12-18.acacia" as any,
  })
  return cached
}

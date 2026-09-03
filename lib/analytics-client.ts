"use client"

import posthog from "posthog-js"

// Client-side capture wrapper. Before this file, client events called
// posthog.capture() directly with bare properties and there was no way to tell
// a real user's event from a dev-machine or team-account one in PostHog
// Activity. Both flags below are NEW, not pre-existing:
//
//   environment - "development" | "preview" | "production", so local and
//                 preview traffic can be filtered out of funnels.
//   internal    - true when the signed-in email is listed in INTERNAL_EMAILS,
//                 so test accounts can be excluded from real user counts.
//
// Both ride on every event captured through here AND are set as person
// properties at identify() time (see components/posthog-provider.tsx), so
// they are filterable either per-event or per-person.

export type AnalyticsFlags = {
  environment: string
  internal: boolean
}

// NEXT_PUBLIC_VERCEL_ENV is "production" | "preview" | "development" on Vercel
// and absent locally, where NODE_ENV covers it.
export function resolveEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development"
  )
}

// INTERNAL_EMAILS is a comma-separated allowlist. It has to be a
// NEXT_PUBLIC_ var to be readable here, which is fine: it is a list of our own
// addresses, not a secret, and it never leaves the analytics payload.
export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.NEXT_PUBLIC_INTERNAL_EMAILS
  if (!raw) return false
  const needle = email.trim().toLowerCase()
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
    .includes(needle)
}

// The identified person's email, stashed by the provider at identify() time so
// capture() calls made from anywhere in the tree can resolve `internal`
// without threading the email through every component.
let identifiedEmail: string | null = null

export function setIdentifiedEmail(email: string | null): void {
  identifiedEmail = email
}

export function analyticsFlags(): AnalyticsFlags {
  return {
    environment: resolveEnvironment(),
    internal: isInternalEmail(identifiedEmail),
  }
}

// Capture with the flags merged in. Explicit properties win over the flags so
// a caller can always override, though nothing does today.
export function capture(
  event: string,
  properties: Record<string, unknown> = {}
): void {
  try {
    posthog.capture(event, { ...analyticsFlags(), ...properties })
  } catch {
    // Analytics must never break a user flow.
  }
}

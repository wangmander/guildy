import "server-only"

// Phase 6.5: PostHog event capture from server actions. Uses the public
// capture endpoint via fetch — no posthog-node dependency, no batching,
// works reliably in serverless. Fire-and-forget within the action; analytics
// failures never block the user flow.

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"

async function captureServer(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  if (!POSTHOG_KEY) return
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties,
      }),
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[analytics] capture failed:",
      err instanceof Error ? err.message : err
    )
  }
}

export async function trackSignupCompleted(userId: string): Promise<void> {
  await captureServer("signup_completed", userId)
}

export async function trackFirstPrepGenerated(
  userId: string,
  jobId: string,
  tier: "quick" | "deep",
  modelUsed: string
): Promise<void> {
  await captureServer("first_prep_generated", userId, {
    job_id: jobId,
    tier,
    model_used: modelUsed,
  })
}

// Phase 6b will call this from the Stripe webhook handler. Stub for now —
// no caller in V2.0 sprint.
export async function trackSubscriptionPaid(
  userId: string,
  tier: string
): Promise<void> {
  await captureServer("subscription_paid", userId, { tier })
}

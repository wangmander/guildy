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

// Viral loop: a viewer who arrived via a shared prep link (?ref=shareId)
// converted by signing up. distinct_id is the real new-user id; share_id rides
// in properties so per-share performance is a property filter (never use
// share_id as distinct_id, that would merge distinct viewers into one person).
export async function trackPrepReferralConverted(
  userId: string,
  shareId: string
): Promise<void> {
  await captureServer("prep_referral_converted", userId, { share_id: shareId })
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

// kanban_job_created: fired from consumeHandoff (source="handoff") since
// that path has no client moment. Manual creates fire client-side from
// add-job-modal. distinct_id is the Supabase user.id — the same id the
// client-side posthog.identify() call uses, so server-captured events
// attach to the same person record.
export async function trackKanbanJobCreated(
  userId: string,
  source: "manual" | "handoff"
): Promise<void> {
  await captureServer("kanban_job_created", userId, { source })
}

// G0 growth build (FTUE): activation_reached fires once when a user first
// crosses the activation bar — 3+ non-archived jobs AND at least one
// prep_versions row. Fired from both the job-create and prep-create server
// paths, gated on a count transition (job count === 3 / first prep) so it
// lands once per user in normal flows. No properties; the userId is the
// signal.
export async function trackActivationReached(userId: string): Promise<void> {
  await captureServer("activation_reached", userId)
}

// Feature 4: Negotiation Prep. CTA-clicked fires server-side from
// getCachedNegotiationAction (the panel-open path); generated fires after a
// successful negotiation_preps insert.
export async function trackNegotiationCtaClicked(
  userId: string,
  jobId: string
): Promise<void> {
  await captureServer("negotiation_cta_clicked", userId, { job_id: jobId })
}

export async function trackNegotiationGenerated(
  userId: string,
  jobId: string
): Promise<void> {
  await captureServer("negotiation_generated", userId, { job_id: jobId })
}

// 5-day streak (S-20260811-01). Read access to PostHog is blocked on this
// project (no keychain item) as of this ship. These fire regardless, per
// explicit instruction, so the read side has real data the moment it's
// unblocked instead of a gap starting from whenever someone remembers to
// add the calls.
export async function trackStreakCarriedToAccount(
  userId: string,
  day: number
): Promise<void> {
  await captureServer("streak_carried_to_account", userId, { day })
}

export async function trackStreakDayIncremented(
  userId: string,
  day: number
): Promise<void> {
  await captureServer("streak_day_incremented", userId, { day })
}

export async function trackStreakBroken(
  userId: string,
  dayReached: number
): Promise<void> {
  await captureServer("streak_broken", userId, { day_reached: dayReached })
}

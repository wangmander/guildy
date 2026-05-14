import { NextResponse } from "next/server"

import { getStripe } from "@/lib/stripe"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// Phase 6b: starts a Stripe Checkout session for the $19.99/mo Deep tier.
// Returns the Stripe-hosted page URL; client redirects via window.location.
// Customer is reused if user_profiles.stripe_customer_id is already set;
// otherwise a Stripe customer is created and the id persisted before the
// session is created.

export async function POST(req: Request) {
  if (!process.env.STRIPE_PRICE_ID) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    )
  }

  // Post-checkout resume context. When the paywall fires from inside a
  // job's PrepCanvas we thread the job id + round role through Checkout's
  // success_url so /app can auto-open that job and re-fire Deep without
  // the user re-navigating. Body is optional — older callers POST {} and
  // the success_url falls back to the bare subscribed flag.
  let resumeJob: string | null = null
  let resumeRole: string | null = null
  try {
    const body = (await req.json().catch(() => ({}))) as {
      resume_job?: unknown
      resume_role?: unknown
    }
    if (typeof body.resume_job === "string" && body.resume_job.length > 0) {
      resumeJob = body.resume_job
    }
    if (typeof body.resume_role === "string" && body.resume_role.length > 0) {
      resumeRole = body.resume_role
    }
  } catch {
    // ignore malformed bodies; fall back to bare success_url
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  let customerId = profile?.stripe_customer_id ?? null
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id)
    if (updateError) {
      // Don't block checkout on this — webhook will resolve via customer
      // metadata anyway. Log and continue.
      // eslint-disable-next-line no-console
      console.warn(
        "[stripe-checkout] failed to persist customer id:",
        updateError.message
      )
    }
  }

  const origin = new URL(req.url).origin
  // Prompt 12: success_url carries Stripe's {CHECKOUT_SESSION_ID} literal
  // placeholder, which Stripe substitutes after Checkout completes. /app
  // verifies the session server-side via verifyCheckoutAndSyncAction —
  // no longer depends on the webhook landing first. URLSearchParams would
  // percent-encode the braces and break Stripe's substitution, so the
  // query string is assembled manually.
  const successParams: string[] = [`session_id={CHECKOUT_SESSION_ID}`]
  if (resumeJob && resumeRole) {
    successParams.push(`resume_job=${encodeURIComponent(resumeJob)}`)
    successParams.push(`resume_role=${encodeURIComponent(resumeRole)}`)
  }
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    // Session-level metadata makes ownership verification cheap on the
    // /app side: a single retrieve call returns this without needing to
    // expand the customer object. Customer metadata is also set above on
    // first creation; the two paths are redundant by design.
    metadata: { supabase_user_id: user.id },
    success_url: `${origin}/app?${successParams.join("&")}`,
    cancel_url: `${origin}/app?canceled=1`,
    allow_promotion_codes: true,
  })

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL" },
      { status: 500 }
    )
  }
  return NextResponse.json({ url: session.url })
}

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
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/app?subscribed=1`,
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

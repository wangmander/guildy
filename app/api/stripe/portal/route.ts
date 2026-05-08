import { NextResponse } from "next/server"

import { getStripe } from "@/lib/stripe"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// Phase 6b: Stripe-hosted billing portal session. Returns the portal URL;
// client redirects via window.location. 400 when the user has no Stripe
// customer record (never subscribed).

export async function POST(req: Request) {
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
  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No subscription to manage" },
      { status: 400 }
    )
  }

  const origin = new URL(req.url).origin
  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/app`,
  })

  return NextResponse.json({ url: session.url })
}

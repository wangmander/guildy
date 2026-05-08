import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type Stripe from "stripe"

import { trackSubscriptionPaid } from "@/lib/analytics"
import { getStripe } from "@/lib/stripe"

// Phase 6b: Stripe webhook handler. Unauthenticated entrypoint — relies on
// the Stripe-Signature header verified against STRIPE_WEBHOOK_SECRET. Uses
// the service-role Supabase client (no user cookies present). Resolves the
// user via user_profiles.stripe_customer_id; orphaned events return 200 so
// Stripe doesn't retry-loop on stale customer ids.
//
// Raw body access: Next.js App Router route handlers don't auto-parse the
// body. Stripe.webhooks.constructEvent requires the raw string, so we use
// req.text() and pass the result directly.

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function findUserByCustomerId(
  supabase: ReturnType<typeof adminClient>,
  customerId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()
  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[stripe-webhook] customer lookup failed:",
      error.message
    )
    return null
  }
  return data
}

function mapSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): "active" | "past_due" | "canceled" {
  if (stripeStatus === "active" || stripeStatus === "trialing") return "active"
  if (stripeStatus === "past_due") return "past_due"
  if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired")
    return "canceled"
  // unpaid / incomplete / paused — treat conservatively as past_due so the
  // 3-day grace window applies and the user still has time to recover.
  return "past_due"
}

function customerIdOf(
  customer:
    | string
    | Stripe.Customer
    | Stripe.DeletedCustomer
    | null
    | undefined
): string | null {
  if (!customer) return null
  if (typeof customer === "string") return customer
  return customer.id
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    // eslint-disable-next-line no-console
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET missing")
    return NextResponse.json({ error: "Server config" }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const supabase = adminClient()

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const customerId = customerIdOf(sub.customer)
        if (!customerId) return NextResponse.json({ received: true })
        const userRow = await findUserByCustomerId(supabase, customerId)
        if (!userRow) {
          // eslint-disable-next-line no-console
          console.warn(
            "[stripe-webhook] no user found for customer:",
            customerId
          )
          return NextResponse.json({ received: true })
        }
        const status = mapSubscriptionStatus(sub.status)
        // Stripe SDK 22 narrowed Subscription.current_period_end out of the
        // root type (it lives on subscription_item now). With apiVersion
        // pinned to 2024-12-18.acacia the runtime response still puts it at
        // the subscription level, so cast to read it directly.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const periodEndUnix = (sub as any).current_period_end as
          | number
          | undefined
        const periodEnd = periodEndUnix
          ? new Date(periodEndUnix * 1000).toISOString()
          : null
        const { error } = await supabase
          .from("user_profiles")
          .update({
            subscription_status: status,
            current_period_end: periodEnd,
          })
          .eq("id", userRow.id)
        if (error) {
          // eslint-disable-next-line no-console
          console.error("[stripe-webhook] db update failed:", error.message)
          return NextResponse.json(
            { error: "DB update failed" },
            { status: 500 }
          )
        }
        if (
          event.type === "customer.subscription.created" &&
          status === "active"
        ) {
          await trackSubscriptionPaid(userRow.id, "deep")
        }
        revalidatePath("/app")
        break
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const customerId = customerIdOf(sub.customer)
        if (!customerId) return NextResponse.json({ received: true })
        const userRow = await findUserByCustomerId(supabase, customerId)
        if (!userRow) {
          // eslint-disable-next-line no-console
          console.warn(
            "[stripe-webhook] no user found for customer:",
            customerId
          )
          return NextResponse.json({ received: true })
        }
        const { error } = await supabase
          .from("user_profiles")
          .update({ subscription_status: "canceled" })
          .eq("id", userRow.id)
        if (error) {
          // eslint-disable-next-line no-console
          console.error("[stripe-webhook] db update failed:", error.message)
          return NextResponse.json(
            { error: "DB update failed" },
            { status: 500 }
          )
        }
        revalidatePath("/app")
        break
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = customerIdOf(invoice.customer)
        if (!customerId) return NextResponse.json({ received: true })
        const userRow = await findUserByCustomerId(supabase, customerId)
        if (!userRow) {
          // eslint-disable-next-line no-console
          console.warn(
            "[stripe-webhook] no user found for customer:",
            customerId
          )
          return NextResponse.json({ received: true })
        }
        await supabase
          .from("user_profiles")
          .update({ subscription_status: "past_due" })
          .eq("id", userRow.id)
        revalidatePath("/app")
        break
      }
      default:
        // checkout.session.completed and other lifecycle events fire too;
        // we don't action them. customer.subscription.created arrives right
        // after with the actual subscription state.
        break
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[stripe-webhook] handler error:",
      err instanceof Error ? err.message : err
    )
    return NextResponse.json({ error: "Handler error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

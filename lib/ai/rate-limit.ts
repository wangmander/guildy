import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"

import type { PrepTier } from "./prep-types"

// Per-user fair-use limits. Hidden from UI per spec section 8 ("unlimited" is
// user-facing copy). Quick is capped tighter than Deep on purpose: free tier
// abuse risk is higher, sketch quality doesn't justify hundreds of regens, and
// heavy users should convert to Deep instead of hammering Quick.
const QUICK_DAILY = 10
const QUICK_MONTHLY = 75
// Margin-protective at launch: Deep cost target is ~$0.10/gen but
// dashboard-confirmed cost may land closer to $0.30; 8/day, 50/month
// keeps the worst case ≥ $4 margin per user at cap on the $19.99 tier.
// Raise after Anthropic dashboard confirms steady-state cost.
const DEEP_DAILY = 8
const DEEP_MONTHLY = 50

export type RateLimitReason = "daily_cap" | "monthly_cap"

export type RateLimitResult = {
  allowed: boolean
  reason?: RateLimitReason
  resetAt?: Date
  currentCount?: number
  limit?: number
}

// Counts succeeded prep generations for the user via the existing prep_versions
// table — one row per generation, never overwritten. Cache hits don't reach
// this function (callers route through getCachedPrepAction first).
//
// Daily window is rolling (now - 24h). Monthly window is calendar UTC
// (date_trunc('month', now() at UTC)) so it resets at the month boundary.
//
// Failure mode: on count-query error, fail open with a console.error rather
// than blocking legit users on an infra hiccup. The model's max_tokens cap
// already bounds worst-case cost per generation.
export async function checkRateLimit({
  userId,
  tier,
}: {
  userId: string
  tier: PrepTier
}): Promise<RateLimitResult> {
  const supabase = await createSupabaseServerClient()

  const dailyLimit = tier === "deep" ? DEEP_DAILY : QUICK_DAILY
  const monthlyLimit = tier === "deep" ? DEEP_MONTHLY : QUICK_MONTHLY

  const now = new Date()
  const dailyCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  )

  const { count: dailyCount, error: dailyErr } = await supabase
    .from("prep_versions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tier", tier)
    .gte("created_at", dailyCutoff.toISOString())
  if (dailyErr) {
    // eslint-disable-next-line no-console
    console.error(
      "[rate-limit] daily count failed; failing open:",
      dailyErr.message
    )
    return { allowed: true }
  }
  if ((dailyCount ?? 0) >= dailyLimit) {
    const resetAt = new Date(dailyCutoff.getTime() + 24 * 60 * 60 * 1000)
    // eslint-disable-next-line no-console
    console.log("[rate-limit] hit", {
      userId,
      tier,
      reason: "daily_cap",
      currentCount: dailyCount,
      limit: dailyLimit,
    })
    return {
      allowed: false,
      reason: "daily_cap",
      resetAt,
      currentCount: dailyCount ?? undefined,
      limit: dailyLimit,
    }
  }

  const { count: monthlyCount, error: monthlyErr } = await supabase
    .from("prep_versions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tier", tier)
    .gte("created_at", monthStart.toISOString())
  if (monthlyErr) {
    // eslint-disable-next-line no-console
    console.error(
      "[rate-limit] monthly count failed; failing open:",
      monthlyErr.message
    )
    return { allowed: true }
  }
  if ((monthlyCount ?? 0) >= monthlyLimit) {
    const nextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    )
    // eslint-disable-next-line no-console
    console.log("[rate-limit] hit", {
      userId,
      tier,
      reason: "monthly_cap",
      currentCount: monthlyCount,
      limit: monthlyLimit,
    })
    return {
      allowed: false,
      reason: "monthly_cap",
      resetAt: nextMonth,
      currentCount: monthlyCount ?? undefined,
      limit: monthlyLimit,
    }
  }

  return { allowed: true }
}

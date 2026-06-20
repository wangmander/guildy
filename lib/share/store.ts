import "server-only"

import { createClient } from "@supabase/supabase-js"

import { isShareId } from "./shareId"
import type { SharedPrep } from "./teaser"

// Service-role client for the share tables. shared_preps and prep_referrals
// have RLS enabled with NO policies, so only this key can read or write them;
// the share id is the capability token. Mirrors the adminClient pattern used
// by the unauth-handoff route and the onboarding consume path. Deliberately
// NOT the shared lib/supabaseAdmin client, which falls back to the anon key
// and would silently fail against the policy-less tables.
export function shareAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Teaser-safe read. Selects ONLY the teaser-safe columns (the table stores
// nothing else, but the explicit projection documents the contract). Used by
// both the public GET route and the /p/[id] server page.
export async function getSharedPrepById(
  id: string
): Promise<SharedPrep | null> {
  if (!isShareId(id)) return null
  const admin = shareAdminClient()
  const { data, error } = await admin
    .from("shared_preps")
    .select("id, role_title, company_name, jd_text, teaser, created_at")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null
  return data as SharedPrep
}

type ReferralEvent = "generated" | "signup"

// Lightweight attribution write. Best-effort: callers swallow failures so a
// referral-table hiccup never blocks generation or signup.
export async function recordReferral(
  shareId: string,
  event: ReferralEvent,
  userId: string | null
): Promise<void> {
  if (!isShareId(shareId)) return
  const admin = shareAdminClient()
  await admin
    .from("prep_referrals")
    .insert({ share_id: shareId, event, user_id: userId })
}

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { trackStreakBroken, trackStreakDayIncremented } from "@/lib/analytics"

// 5-day streak (S-20260811-01). Day 1 starts on first landing on
// guildy.ai, before any account exists (see guildy-site's lib/streak.js),
// and carries into the account via the unauth_handoffs bridge at signup
// (see app/onboarding/actions.ts, carryStreak). This module owns what
// happens to it AFTER signup: incrementing on a qualifying day, and
// detecting a broken streak.
//
// Qualifying action, decided in the brief rather than left implicit:
// opening the app on a given day counts. A stricter bar (an add/apply/prep
// action specifically) risks breaking someone's streak on a day they were
// genuinely engaged but between actions. The loose bar is the honest one
// given what's actually measurable server-side on every page load.

export interface StreakProfileFields {
  streak_started_at: string | null
  streak_current_day: number | null
  streak_last_active_date: string | null
  streak_broken_at: string | null
}

export interface StreakState {
  active: boolean
  day: number | null
  broken: boolean
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Reads today's date against the profile's last-active date and either
 * leaves the streak alone (already counted today), increments it (a new
 * consecutive day), or breaks it (a day was skipped). Writes only when
 * something actually changes. Called once per authenticated /app load.
 */
export async function deriveAndUpdateStreak(
  supabase: SupabaseClient,
  userId: string,
  profile: StreakProfileFields
): Promise<StreakState> {
  if (!profile.streak_started_at || profile.streak_broken_at) {
    return {
      active: false,
      day: profile.streak_current_day,
      broken: Boolean(profile.streak_broken_at),
    }
  }

  const today = todayIso()
  if (profile.streak_last_active_date === today) {
    // Already counted today. Nothing to do.
    return { active: true, day: profile.streak_current_day, broken: false }
  }

  const currentDay = profile.streak_current_day ?? 1
  const lastActive = profile.streak_last_active_date
  const daysSinceActive = lastActive
    ? Math.floor(
        (Date.parse(today) - Date.parse(lastActive)) / (24 * 60 * 60 * 1000)
      )
    : 1

  // More than one day passed with no qualifying action: broken.
  if (daysSinceActive > 1) {
    await supabase
      .from("user_profiles")
      .update({ streak_broken_at: new Date().toISOString() })
      .eq("id", userId)
    await trackStreakBroken(userId, currentDay)
    return { active: false, day: currentDay, broken: true }
  }

  // Consecutive day. Day 5 is the last one the streak counts; a qualifying
  // action on what would be day 6 does not extend it past the window.
  if (currentDay >= 5) {
    await supabase
      .from("user_profiles")
      .update({ streak_last_active_date: today })
      .eq("id", userId)
    return { active: true, day: currentDay, broken: false }
  }

  const nextDay = currentDay + 1
  await supabase
    .from("user_profiles")
    .update({ streak_current_day: nextDay, streak_last_active_date: today })
    .eq("id", userId)
  await trackStreakDayIncremented(userId, nextDay)
  return { active: true, day: nextDay, broken: false }
}

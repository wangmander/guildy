// Pure scoring for the rated comparison matrix. Server-safe (no I/O, no
// React). Comp dims auto-rate relative to the offers on the table; soft dims
// are the user's absolute 1-10; the overall is a user-weighted average on the
// shared 1-10 scale. The overall is a heuristic decision aid, not exact
// science.

import { normalizeComp } from "./normalize"
import { COMP_DIMS } from "./dimensions"
import type { JobCompensation } from "@/types"

export type CompLike = JobCompensation | null

// Dollar value for a comp dim or the anchor. Reuses normalize.ts so the
// figures stay consistent with year-1 (bonus is base * pct / 100, equity is
// grant / vesting).
export function dimValue(key: string, comp: CompLike): number {
  if (!comp) return 0
  const n = normalizeComp({
    base: comp.base,
    signing_bonus: comp.signing_bonus,
    annual_bonus_pct: comp.annual_bonus_pct,
    equity_grant_total: comp.equity_grant_total,
    vesting_years: comp.vesting_years,
    location: comp.location,
  })
  switch (key) {
    case "base":
      return n.base
    case "bonus":
      return n.bonus_amount
    case "equity":
      return n.annualized_equity
    case "year1_total":
      return n.year1_total
    default:
      return 0
  }
}

// Max comp value per comp dim across the offers on the table.
export function compMaxes(comps: CompLike[]): Record<string, number> {
  const maxes: Record<string, number> = {}
  for (const d of COMP_DIMS) {
    let max = 0
    for (const c of comps) max = Math.max(max, dimValue(d.key, c))
    maxes[d.key] = max
  }
  return maxes
}

// 1-10 relative to the top offer on the table. Dash (null) when the max is 0.
export function autoRating(
  key: string,
  comp: CompLike,
  maxVal: number
): number | null {
  if (maxVal <= 0) return null
  const v = dimValue(key, comp)
  return Math.max(0, Math.min(10, Math.round((v / maxVal) * 10)))
}

// The user's stored 1-10 for a soft dim, or null if unrated.
export function softRating(key: string, comp: CompLike): number | null {
  const r = comp?.ratings?.[key]
  return typeof r === "number" ? r : null
}

// User-weighted average over shown dims that have a non-null rating, excluding
// the anchor. Comp dims count when their auto rating is non-null; soft dims
// count only the enabled ones that are rated. weight defaults to 1.
export function overallScore(
  comp: CompLike,
  args: {
    compMax: Record<string, number>
    enabledSoft: string[]
    weights: Record<string, number>
  }
): number | null {
  let num = 0
  let den = 0
  for (const d of COMP_DIMS) {
    const r = autoRating(d.key, comp, args.compMax[d.key] ?? 0)
    if (r === null) continue
    const w = args.weights[d.key] ?? 1
    num += w * r
    den += w
  }
  for (const key of args.enabledSoft) {
    const r = softRating(key, comp)
    if (r === null) continue
    const w = args.weights[key] ?? 1
    num += w * r
    den += w
  }
  if (den === 0) return null
  return Math.round((num / den) * 10) / 10
}

// Index of the highest overall, or -1 if none. Multi-offer only.
export function winnerIndex(overalls: Array<number | null>): number {
  let best = -1
  let bestVal = -Infinity
  overalls.forEach((o, i) => {
    if (o !== null && o > bestVal) {
      bestVal = o
      best = i
    }
  })
  return best
}

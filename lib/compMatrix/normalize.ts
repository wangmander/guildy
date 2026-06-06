// Pure compensation normalization for the TC comparison matrix. No I/O, no
// React. Unit-testable. Null/empty inputs treated as 0 (vesting_years as 4)
// so partial entry never throws.

import { colMultiplier } from "./colSeed"

export type CompInput = {
  base: number | null
  signing_bonus: number | null
  annual_bonus_pct: number | null
  equity_grant_total: number | null
  vesting_years: number | null
  location: string | null
}

export type NormalizedComp = {
  base: number
  signing_bonus: number
  bonus_amount: number
  annualized_equity: number
  year1_total: number
  steady_state_total: number
  col_multiplier: number
  col_adjusted_steady: number
}

function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

export function normalizeComp(input: CompInput): NormalizedComp {
  const base = num(input.base)
  const signing_bonus = num(input.signing_bonus)
  const annual_bonus_pct = num(input.annual_bonus_pct)
  const equity_grant_total = num(input.equity_grant_total)
  // Fall back to 4 when null/empty/<=0 to avoid divide-by-zero.
  const vesting_years =
    input.vesting_years && input.vesting_years > 0 ? input.vesting_years : 4

  const bonus_amount = base * (annual_bonus_pct / 100)
  const annualized_equity = equity_grant_total / vesting_years
  const year1_total = base + signing_bonus + bonus_amount + annualized_equity
  const steady_state_total = base + bonus_amount + annualized_equity
  const col_multiplier = colMultiplier(input.location)
  const col_adjusted_steady = steady_state_total / col_multiplier

  return {
    base,
    signing_bonus,
    bonus_amount,
    annualized_equity,
    year1_total,
    steady_state_total,
    col_multiplier,
    col_adjusted_steady,
  }
}

// Strict single-number parse for the tc pre-fill convenience. Accepts a lone
// money value with optional $, commas, and k/K suffix ("$180k", "180,000",
// "180000" -> 180000). Ranges, multiple numbers, or words return null so the
// base field stays empty rather than guessing.
export function parseMoneyString(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  if (!s) return null
  // Reject if there is more than one numeric group (ranges, "base + bonus").
  const groups = s.match(/\d[\d,]*\.?\d*/g)
  if (!groups || groups.length !== 1) return null
  const cleaned = s.replace(/[$,\s]/g, "")
  const m = cleaned.match(/^(\d+\.?\d*)(k)?$/)
  if (!m) return null
  let n = parseFloat(m[1])
  if (m[2] === "k") n *= 1000
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

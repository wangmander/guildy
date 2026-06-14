// Pure projection copy for the apply-goal hero. Every number here is
// arithmetic on the researched ranges in applyBenchmarks.ts, presented as
// ranges with an explicit estimate lead-in. No single fabricated numbers, no
// causal lift claims. Unit-testable.

import {
  FIELD_RESPONSE_CONTEXT,
  GENERAL_PER_OFFER,
  SENIORITY_PER_OFFER,
  inferSegment,
  type Field,
} from "./applyBenchmarks"

// Stat-forward rows for the Insights card (gem-guide / dashboard spec): a bold
// number plus a sentence. Same researched ranges as `lines`, restructured.
export type ApplyProjectionRow = {
  stat: string
  text: string
}

export type ApplyProjection = {
  leadIn: string
  lines: string[]
  rows: ApplyProjectionRow[]
}

const FIELD_LABEL: Record<Exclude<Field, "general">, string> = {
  tech: "Tech",
  finance: "Finance",
  marketing: "Marketing",
  healthcare: "Healthcare",
}

const SENIORITY_LABEL: Record<"entry" | "senior", string> = {
  entry: "entry-level",
  senior: "senior",
}

// Whole-week range from an applications range at the weekly target.
function weeksRange(
  low: number,
  high: number,
  weeklyTarget: number
): [number, number] {
  return [Math.round(low / weeklyTarget), Math.round(high / weeklyTarget)]
}

// Specific projection only when BOTH seniority is explicit (entry/senior) AND
// field is known, mirroring benchmarkLine's fallback. Otherwise a single
// generic line from the general per-offer range.
export function applyProjection(
  roleTitle: string,
  weeklyTarget = 15
): ApplyProjection {
  const { field, seniority } = inferSegment(roleTitle)
  const seniorityExplicit = seniority === "entry" || seniority === "senior"

  if (seniorityExplicit && field !== "general") {
    const fieldLabel = FIELD_LABEL[field]
    const rate = FIELD_RESPONSE_CONTEXT[field].interviewRate
    const [low, high] = SENIORITY_PER_OFFER[seniority]
    const [a, b] = weeksRange(low, high, weeklyTarget)
    return {
      leadIn: `Estimated from typical ${fieldLabel.toLowerCase()} rates:`,
      lines: [
        `${fieldLabel} roles convert roughly ${rate} of applications to interviews.`,
        `Typical ${SENIORITY_LABEL[seniority]} offers take ${low} to ${high} applications, about ${a} to ${b} weeks at ${weeklyTarget} a week.`,
      ],
      rows: [
        {
          stat: rate,
          text: `of applications convert to interviews in ${fieldLabel.toLowerCase()}.`,
        },
        {
          stat: `${low} to ${high}`,
          text: `applications for a typical ${SENIORITY_LABEL[seniority]} offer, about ${a} to ${b} weeks at your pace.`,
        },
      ],
    }
  }

  const [low, high] = GENERAL_PER_OFFER
  const [a, b] = weeksRange(low, high, weeklyTarget)
  const rate = FIELD_RESPONSE_CONTEXT.general.interviewRate
  return {
    leadIn: "Estimated from typical hiring rates:",
    lines: [
      `Most roles take ${low} to ${high} applications per offer, about ${a} to ${b} weeks at ${weeklyTarget} a week.`,
    ],
    rows: [
      { stat: rate, text: "of applications convert to interviews." },
      {
        stat: `${low} to ${high}`,
        text: `applications for a typical offer, about ${a} to ${b} weeks at your pace.`,
      },
    ],
  }
}

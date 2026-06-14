// Phase 2A quest system: pure derivation over existing kanban + prep state.
// No new data model. Guidance only; never used inside prep output.

import type { StageKey } from "@/lib/stages"

export type Readiness = "not_ready" | "getting_there" | "ready"
export type MilestoneKey = "first_screen" | "first_loop" | "first_offer"

export type JobQuest = {
  line: string
  // Offer carries a second guidance line (negotiate); other stages null.
  secondaryLine: string | null
  // null = no card button (Offer points to the comp bar; no off-limits wiring).
  ctaLabel: string | null
  readiness: Readiness
}

export type Milestone = {
  key: MilestoneKey
  text: string
}

const READINESS_LABEL: Record<Readiness, string> = {
  not_ready: "Not ready",
  getting_there: "Getting there",
  ready: "Ready",
}

export function readinessLabel(r: Readiness): string {
  return READINESS_LABEL[r]
}

// Phase 2A coarse readiness from jobs.prep_status + context presence. Stage
// accuracy and full-loop per-round coverage are a later refinement.
export function deriveReadiness(
  prepStatus: string,
  hasJd: boolean,
  hasInterviewer: boolean
): Readiness {
  if (prepStatus === "deep_generated") return "ready"
  if (prepStatus === "quick_generated") return "getting_there"
  if (hasJd || hasInterviewer) return "getting_there"
  return "not_ready"
}

export function deriveQuest(
  stage: StageKey,
  company: string,
  readiness: Readiness,
  roundCount: number
): JobQuest {
  switch (stage) {
    case "screen":
      return {
        line: `Prep your ${company} screen`,
        secondaryLine: null,
        ctaLabel: "Deep Prep",
        readiness,
      }
    case "hiring_manager":
      return {
        line: `Read the room before the ${company} HM call`,
        secondaryLine: null,
        ctaLabel: "Deep Prep",
        readiness,
      }
    case "interview_loop":
    case "final":
      return {
        line: `Prep all ${roundCount} rounds at ${company}`,
        secondaryLine: null,
        ctaLabel: "Deep Prep",
        readiness,
      }
    case "offer":
      return {
        line: `See how ${company} stacks up`,
        secondaryLine: `Walk in ready to negotiate ${company}`,
        ctaLabel: null,
        readiness,
      }
    case "applied":
    case "closed":
    default:
      return {
        line: `Get a first read on ${company}`,
        secondaryLine: null,
        ctaLabel: "Quick Prep",
        readiness,
      }
  }
}

// Single highest-reached milestone (offer > loop > screen). The caller hides it
// when dismissed and does NOT fall back to a lower one.
export function highestMilestone(stages: StageKey[]): Milestone | null {
  const set = new Set(stages)
  if (set.has("offer")) {
    return {
      key: "first_offer",
      text: "First offer in hand. Time to compare and negotiate.",
    }
  }
  if (set.has("interview_loop") || set.has("final")) {
    return { key: "first_loop", text: "First full loop. You're in the final stretch." }
  }
  if (set.has("screen") || set.has("hiring_manager")) {
    return {
      key: "first_screen",
      text: "First screen reached. The pipeline is moving.",
    }
  }
  return null
}

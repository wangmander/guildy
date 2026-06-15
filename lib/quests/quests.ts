// Phase 2A quest system: pure derivation over existing kanban + prep state.
// No new data model. Guidance only; never used inside prep output.

import type { StageKey } from "@/lib/stages"

export type Readiness = "not_ready" | "getting_there" | "ready"
export type MilestoneKey = "first_screen" | "first_loop" | "first_offer"

// Job-card status cue (gem-guide section 3). Real state only, never a date.
export type CueTone = "scheduled" | "offer"
export type JobQuestCue = { label: string; tone: CueTone }

// Card CTA action: "prep" opens the prep overlay, "compare" opens the comp bar.
export type CtaAction = "prep" | "compare"
export type CtaVariant = "primary" | "secondary"

export type JobQuest = {
  // Gem-voice next-move line (gem-guide section 7).
  line: string
  ctaLabel: string
  ctaVariant: CtaVariant
  ctaAction: CtaAction
  // Right-aligned status cue, or null (Applied has none).
  cue: JobQuestCue | null
  // Kept for quest prioritization; not rendered on the card (chip removed).
  readiness: Readiness
}

// Milestone card copy (gem-guide section 5): Bricolage title + body line.
// Encouragement only, no loss state.
export type Milestone = {
  key: MilestoneKey
  title: string
  body: string
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
        line: `Prep your ${company} screen. Screens reward clear thinking out loud.`,
        ctaLabel: "Deep Prep",
        ctaVariant: "primary",
        ctaAction: "prep",
        cue: { label: "Screen", tone: "scheduled" },
        readiness,
      }
    case "hiring_manager":
      return {
        line: `Read the room before the ${company} HM call.`,
        ctaLabel: "Deep Prep",
        ctaVariant: "primary",
        ctaAction: "prep",
        cue: { label: "Hiring Manager", tone: "scheduled" },
        readiness,
      }
    case "interview_loop":
    case "final":
      return {
        line: `Prep all ${roundCount} rounds at ${company}.`,
        ctaLabel: "Deep Prep",
        ctaVariant: "primary",
        ctaAction: "prep",
        cue: { label: "Full Loop", tone: "scheduled" },
        readiness,
      }
    case "offer":
      return {
        line: `See how ${company} stacks up, then walk in ready to negotiate.`,
        ctaLabel: "Compare & negotiate",
        ctaVariant: "primary",
        ctaAction: "compare",
        cue: { label: "Offer in", tone: "offer" },
        readiness,
      }
    case "applied":
    case "closed":
    default:
      return {
        line: `Get a first read on ${company}.`,
        ctaLabel: "Quick Prep",
        ctaVariant: "secondary",
        ctaAction: "prep",
        cue: null,
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
      title: "First offer.",
      body: "Time to compare and negotiate. I'll line it up.",
    }
  }
  if (set.has("interview_loop") || set.has("final")) {
    return {
      key: "first_loop",
      title: "Full loop.",
      body: "You're in the final stretch.",
    }
  }
  if (set.has("screen") || set.has("hiring_manager")) {
    return {
      key: "first_screen",
      title: "First screen.",
      body: "The pipeline is moving.",
    }
  }
  return null
}

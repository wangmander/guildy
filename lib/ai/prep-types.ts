import { z } from "zod"

import type { StageKey } from "@/lib/stages"

export const prepTierSchema = z.enum(["quick", "deep"])
export type PrepTier = z.infer<typeof prepTierSchema>

// Stages we generate prep for. Applied/closed don't get prep — they're not
// active rounds. Final collapses into interview_loop for content generation.
export const prepStageSchema = z.enum([
  "screen",
  "hiring_manager",
  "interview_loop",
  "offer",
])
export type PrepStage = z.infer<typeof prepStageSchema>

// Phase 4d: a single Full Loop stage hosts multiple sessions, each with its
// own focus. The role identifies which lens the model should adopt when
// generating prep. Threading through happens in prompt 3 / 4.
export const PREP_SESSION_ROLES = [
  "hiring_manager",
  "cross_functional",
  "skills_portfolio",
  "bar_raiser",
] as const
export type PrepSessionRole = (typeof PREP_SESSION_ROLES)[number]

export type PrepInput = {
  resume_text: string | null
  jd_text: string | null
  latest_message: string | null
  company_name: string
  role_title: string
  stage: PrepStage
  interviewer_name: string | null
  interviewer_title: string | null
  interviewer_link: string | null
  note_text: string | null
  session_role?: PrepSessionRole
  tier: PrepTier
}

export const prepCriterionSchema = z.object({
  name: z.string(),
  weight: z.number(),
  description: z.string(),
})
export type PrepCriterion = z.infer<typeof prepCriterionSchema>

export const prepFrameSchema = z.object({
  title: z.string(),
  description: z.string(),
})
export type PrepFrame = z.infer<typeof prepFrameSchema>

export const prepRiskItemSchema = z.object({
  risk: z.string(),
  counter: z.string().nullable(), // Deep-only
})
export type PrepRiskItem = z.infer<typeof prepRiskItemSchema>

export const prepChecklistItemSchema = z.object({
  item: z.string(),
  done: z.boolean(),
})
export type PrepChecklistItem = z.infer<typeof prepChecklistItemSchema>

export const prepQuestionThemSchema = z.object({
  // Nullable: Deep emits 8 spec-defined categories; Quick is uncategorized
  // (returns null per the system prompt). UI groups by category in Deep and
  // renders flat in Quick.
  category: z.string().nullable(),
  question: z.string(),
  answer_plan: z.string().nullable(), // Deep-only
})
export type PrepQuestionThey = z.infer<typeof prepQuestionThemSchema>

export const prepQuestionYouSchema = z.object({
  // Nullable for the same reason as questions_they_ask.
  category: z.string().nullable(),
  question: z.string(),
})
export type PrepQuestionYou = z.infer<typeof prepQuestionYouSchema>

export const prepOutputSchema = z.object({
  // Stage the prep was generated against — stored here because the
  // prep_versions table has no stage column. Used to show staleness if
  // the job has since moved.
  stage: prepStageSchema,

  // Phase 4d: human-readable label for the session this prep was generated
  // for, e.g. "Engineering Bar Raiser". Optional and nullable so single-
  // session prep (Screen, Hiring Manager, etc.) leaves it unset.
  session_title: z.string().nullable().optional(),

  purpose: z.object({
    headline: z.string(),
    summary: z.string(),
    criteria: z.array(prepCriterionSchema),
  }),
  positioning: z.object({
    headline: z.string(),
    summary: z.string(),
    frames: z.array(prepFrameSchema),
  }),
  risks: z.object({
    headline: z.string(),
    summary: z.string(),
    items: z.array(prepRiskItemSchema),
  }),
  prep_checklist: z.array(prepChecklistItemSchema),
  questions_they_ask: z.array(prepQuestionThemSchema),
  questions_you_ask: z.array(prepQuestionYouSchema),
  // Deep-only. `.optional()` accepts model omission when no interviewer is
  // provided; `.nullable()` accepts an explicit null. UI handles both as
  // "no insights yet" via the locked placeholder.
  interviewer_insights: z.string().nullable().optional(),
})
export type PrepOutput = z.infer<typeof prepOutputSchema>

// Map a DB StageKey to the PrepStage we generate against. Active-board
// Applied (per spec section 2 — manually-created jobs that skipped passive)
// and Closed both fall back to Screen-level prep so prep generation never
// blocks. Heading reads "Screening round" in those cases — cosmetic
// mismatch, acceptable until a dedicated PrepStage variant is added.
export function stageKeyToPrepStage(stage: StageKey): PrepStage {
  switch (stage) {
    case "screen":
      return "screen"
    case "hiring_manager":
      return "hiring_manager"
    case "interview_loop":
    case "final":
      return "interview_loop"
    case "offer":
      return "offer"
    case "applied":
    case "closed":
      return "screen"
  }
}

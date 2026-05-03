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

export type PrepInput = {
  resume_text: string | null
  jd_text: string | null
  latest_message: string | null
  company_name: string
  role_title: string
  stage: PrepStage
  interviewer_name: string | null
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
  category: z.string(),
  question: z.string(),
  answer_plan: z.string().nullable(), // Deep-only
})
export type PrepQuestionThey = z.infer<typeof prepQuestionThemSchema>

export const prepQuestionYouSchema = z.object({
  category: z.string(),
  question: z.string(),
})
export type PrepQuestionYou = z.infer<typeof prepQuestionYouSchema>

export const prepOutputSchema = z.object({
  // Stage the prep was generated against — stored here because the
  // prep_versions table has no stage column. Used to show staleness if
  // the job has since moved.
  stage: prepStageSchema,

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
  interviewer_insights: z.string().nullable(), // Deep-only
})
export type PrepOutput = z.infer<typeof prepOutputSchema>

// Map a DB StageKey to the PrepStage we generate against. Returns null for
// stages that don't get prep (applied / closed).
export function stageKeyToPrepStage(stage: StageKey): PrepStage | null {
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
      return null
  }
}

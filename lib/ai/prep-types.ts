import type { StageKey } from "@/lib/stages"

export type PrepTier = "quick" | "deep"

// Stages we generate prep for. Applied/closed don't get prep — they're not
// active rounds. Final collapses into interview_loop for content generation.
export type PrepStage = "screen" | "hiring_manager" | "interview_loop" | "offer"

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

export type PrepCriterion = {
  name: string
  weight: number // 0-100
  description: string
}

export type PrepFrame = {
  title: string
  description: string
}

export type PrepRiskItem = {
  risk: string
  counter: string | null // Deep-only
}

export type PrepChecklistItem = {
  item: string
  done: boolean
}

export type PrepQuestionThey = {
  category: string
  question: string
  answer_plan: string | null // Deep-only
}

export type PrepQuestionYou = {
  category: string
  question: string
}

export type PrepOutput = {
  // Stage the prep was generated against — stored here because the
  // prep_versions table has no stage column. Used to show staleness if
  // the job has since moved.
  stage: PrepStage

  purpose: {
    headline: string
    summary: string
    criteria: PrepCriterion[]
  }
  positioning: {
    headline: string
    summary: string
    frames: PrepFrame[]
  }
  risks: {
    headline: string
    summary: string
    items: PrepRiskItem[]
  }
  prep_checklist: PrepChecklistItem[]
  questions_they_ask: PrepQuestionThey[]
  questions_you_ask: PrepQuestionYou[]
  interviewer_insights: string | null // Deep-only
}

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

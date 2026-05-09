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
  // Phase 5: user-edited Full Loop round label (full_loop_session_config[role].label).
  // When non-null, drives prep emphasis ahead of the role-keyed SESSION_ROLE_EMPHASIS
  // block. Null when the job has no full_loop_session_config or the role entry is missing.
  session_label?: string | null
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

  // Phase 4d: server-authoritative role tag, written by generatePrepAction
  // after the LLM returns. Identifies which Full Loop session a row belongs
  // to so getPrepStatesAction can classify rows for stale fallback lookup.
  // Null for non-Full-Loop ("single") generations. Old rows lacking the
  // field validate via .optional() and are treated as "single" by the
  // state-inquiry path.
  session_role: z.enum(PREP_SESSION_ROLES).nullable().optional(),

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

// Phase 4f: per-job Full Loop session config. Persisted in
// jobs.full_loop_session_config (jsonb, nullable). When null, callers use
// DEFAULT_FULL_LOOP_SESSION_CONFIG via resolveFullLoopSessionConfig. The
// shape lets a job override which sessions render in SessionTabs (enabled),
// what label they show (label), and where the override came from (source).

export const fullLoopSessionEntrySchema = z.object({
  enabled: z.boolean(),
  label: z.string().min(1),
  // default = built-in fallback; parsed = filled by the LLM parser from
  // recruiter context; user = manually edited in the UI.
  source: z.enum(["default", "parsed", "user"]),
})
export type FullLoopSessionEntry = z.infer<typeof fullLoopSessionEntrySchema>

// Strict: extra keys rejected. Each of the four roles must be present in a
// fully-validated config. Partial DB JSON is reconciled to this shape via
// resolveFullLoopSessionConfig before any Zod parse.
export const fullLoopSessionConfigSchema = z
  .object({
    hiring_manager: fullLoopSessionEntrySchema,
    cross_functional: fullLoopSessionEntrySchema,
    skills_portfolio: fullLoopSessionEntrySchema,
    bar_raiser: fullLoopSessionEntrySchema,
  })
  .strict()
export type FullLoopSessionConfig = z.infer<typeof fullLoopSessionConfigSchema>

// Built-in fallback. Mirrors the labels in components/app/widgets/session-
// tabs.tsx ROLE_LABELS; if those drift the UI keeps showing the local copy
// while persisted configs continue to serialize the resolved label. Acceptable
// duplication: hoisting ROLE_LABELS into prep-types would create a cycle
// risk and is out of scope for this prompt.
export const DEFAULT_FULL_LOOP_SESSION_CONFIG: FullLoopSessionConfig = {
  hiring_manager: {
    enabled: true,
    label: "Hiring Manager",
    source: "default",
  },
  cross_functional: {
    enabled: true,
    label: "Cross-functional",
    source: "default",
  },
  skills_portfolio: {
    enabled: true,
    label: "Skills/Portfolio",
    source: "default",
  },
  bar_raiser: {
    enabled: true,
    label: "Bar Raiser",
    source: "default",
  },
}

// Reconcile a possibly-null, possibly-partial config against the default.
// Always returns a complete FullLoopSessionConfig with all four roles
// populated — every consumer can treat the result as authoritative.
//
// Runtime defense: even though the input type asserts a complete config,
// older or hand-edited DB rows may be missing keys. The ?? merge keeps
// downstream code simple at the cost of one nullish-coalesce per role.
export function resolveFullLoopSessionConfig(
  config: FullLoopSessionConfig | null | undefined
): FullLoopSessionConfig {
  if (!config) return DEFAULT_FULL_LOOP_SESSION_CONFIG
  return {
    hiring_manager:
      config.hiring_manager ??
      DEFAULT_FULL_LOOP_SESSION_CONFIG.hiring_manager,
    cross_functional:
      config.cross_functional ??
      DEFAULT_FULL_LOOP_SESSION_CONFIG.cross_functional,
    skills_portfolio:
      config.skills_portfolio ??
      DEFAULT_FULL_LOOP_SESSION_CONFIG.skills_portfolio,
    bar_raiser:
      config.bar_raiser ?? DEFAULT_FULL_LOOP_SESSION_CONFIG.bar_raiser,
  }
}

import { z } from "zod"

// Feature 4: Negotiation Prep types. Separate from prep-types.ts. The model
// output is QUALITATIVE ONLY (no numeric fields); the three hard figures the
// UI shows come from lib/compMatrix/normalize.ts via the action, snapshotted
// into the row, never from the model.

// Normalized offer figures snapshotted at generation time. Year-1 total is the
// single anchor (COL-adjusted and steady-state are killed product-wide); the
// components are year-1 parts only, never COL or steady-state. All from
// lib/compMatrix/normalize.ts, never the model.
export type NegotiationOfferNormalized = {
  year1_total: number
  base: number
  signing_bonus: number
  bonus_amount: number
  annualized_equity: number
}

// Input handed to generateNegotiation(). priorities/leverage are the user's
// elicitation chip selections; target is their free-text goal (may be empty).
// companyContext stays for type compatibility but is always null now (the live
// web search was removed; grounding is the elicitation answers + static stats).
export type NegotiationInput = {
  company: string
  role: string
  priorities: string[]
  target: string
  leverage: string[]
  offer_normalized: NegotiationOfferNormalized
  companyContext: string | null
  // Best-effort sourced market-comp range (Haiku + web_search), or null when
  // none was confidently found (plan stays tactics-only). Distinct from the
  // removed company-patterns search.
  marketComp: string | null
}

export const negotiationScriptSchema = z.object({
  scenario: z.string().min(1),
  script: z.string().min(1),
})

export const negotiationOutputSchema = z.object({
  company_patterns: z.string().min(1),
  leverage_analysis: z.string().min(1),
  scripts: z.array(negotiationScriptSchema).min(2),
  walk_away_guidance: z.string().min(1),
})

export type NegotiationOutput = z.infer<typeof negotiationOutputSchema>

// JSON schema for the submit_negotiation tool. Qualitative only, no numeric
// fields. additionalProperties false everywhere.
export const NEGOTIATION_OUTPUT_TOOL_SCHEMA = {
  type: "object",
  properties: {
    company_patterns: {
      type: "string",
      description:
        "How this company (or companies generally, if ungrounded) tends to structure and flex offers.",
    },
    leverage_analysis: {
      type: "string",
      description:
        "What gives the candidate leverage here, grounded in their stated leverage and the offer figures provided.",
    },
    scripts: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        properties: {
          scenario: { type: "string", description: "Short label for the moment." },
          script: {
            type: "string",
            description: "Word-for-word language the candidate can say.",
          },
        },
        required: ["scenario", "script"],
        additionalProperties: false,
      },
    },
    walk_away_guidance: {
      type: "string",
      description:
        "Qualitative guidance on holding firm vs walking, anchored to the provided figures and stated target. No invented dollar amounts.",
    },
  },
  required: ["company_patterns", "leverage_analysis", "scripts", "walk_away_guidance"],
  additionalProperties: false,
}

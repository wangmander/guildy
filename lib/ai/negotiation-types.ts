import { z } from "zod"

// Feature 4: Negotiation Prep types. Separate from prep-types.ts. The model
// output is QUALITATIVE ONLY (no numeric fields); the three hard figures the
// UI shows come from lib/compMatrix/normalize.ts via the action, snapshotted
// into the row, never from the model.

// Normalized offer figures snapshotted at generation time. Mirrors the subset
// of NormalizedComp the UI renders in the walk-away module.
export type NegotiationOfferNormalized = {
  year1_total: number
  steady_state_total: number
  col_adjusted_steady: number
}

// Input handed to generateNegotiation(). companyContext is the Haiku grounding
// summary or null (ungrounded).
export type NegotiationInput = {
  company: string
  role: string
  target: string
  leverage: string | null
  offer_normalized: NegotiationOfferNormalized
  companyContext: string | null
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

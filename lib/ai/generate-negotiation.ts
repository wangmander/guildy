import { createHash } from "node:crypto"

import Anthropic from "@anthropic-ai/sdk"

import { NEGOTIATION_PREP_MODEL, QUICK_PREP_MODEL } from "./models"
import {
  NEGOTIATION_OUTPUT_TOOL_SCHEMA,
  negotiationOutputSchema,
  type NegotiationInput,
  type NegotiationOutput,
} from "./negotiation-types"

// Feature 4: Negotiation Prep generation. Modeled on generate-prep.ts but a
// SEPARATE module so generate-prep.ts stays byte-identical. Opus single-pass,
// no agentic loop. Grounding is a dedicated Haiku web_search fetch that the
// action runs upstream and passes in as input.companyContext.

// Bump when the prompt or output contract changes so cached rows re-generate.
export const NEGOTIATION_PROMPT_VERSION = "neg-v2"

const NEGOTIATION_MAX_TOKENS = 8192
// Opus AbortController budget. Haiku grounding (60s) plus this stays under the
// route maxDuration of 300 with margin (worst case ~270s).
const NEGOTIATION_TIMEOUT_MS = 210_000

const GROUNDING_TIMEOUT_MS = 60_000
const GROUNDING_MAX_TOKENS = 600

// Negotiation-tuned grounding prompt. Comp-structure norms and leverage
// signals, not generic company news.
const NEGOTIATION_CONTEXT_SYSTEM = `You are a compensation research assistant. Given a company name and role, perform exactly one web_search and produce a 150 to 220 word terse summary focused on negotiation-relevant signals: how this company structures offers (base vs equity vs signing weighting), where it tends to have flexibility, recent funding or headcount or hiring-posture signals that affect candidate leverage, and any public comp-band signals. No fluff, no preamble. Plain text only, no markdown. Never use em dashes.`

const SYSTEM_PROMPT = `You are a senior compensation negotiation advisor. You produce a tight, actionable negotiation playbook for one job offer. Use the submit_negotiation tool for your entire response.

HARD RULES:
1. Numbers. Use ONLY the normalized figure provided in [OFFER FIGURES] when referencing the offer's value, and refer to it in words ("your year-1 total figure shown") rather than restating dollar amounts. Never invent any dollar amount. Never reference steady-state or cost-of-living-adjusted figures; year-1 total is the only anchor. The candidate's [TARGET] is free text: reference their stated goal in their own words, but do NOT derive any precise number from it, no floor, no gap, no recommended counter amount. Walk-away and ask guidance stay qualitative, anchored to the provided figure and the stated target.
2. Company specificity. When [COMPANY CONTEXT] is present, ground company_patterns in it. When it is absent, give honest general negotiation guidance and never fabricate company-specific claims (do not invent flex percentages or company policies).
3. Output. company_patterns, leverage_analysis, and walk_away_guidance are non-empty prose. scripts has at least 2 entries, each a named scenario plus word-for-word language the candidate can say.

VOICE: terse, direct, no preamble, no AI tells, no em dashes.`

const RETRY_HINT = `\n\nYour previous response failed schema validation. Return the submit_negotiation tool call with all required fields non-empty and at least 2 scripts.`

class NegotiationValidationError extends Error {
  issues: string
  constructor(issues: string) {
    super(`Negotiation output failed schema validation: ${issues}`)
    this.name = "NegotiationValidationError"
    this.issues = issues
  }
}

// Thrown when Zod failed AND the model ran out of output tokens. Retrying with
// a longer prompt only leaves less room, so the caller skips the retry.
class NegotiationTruncatedError extends NegotiationValidationError {
  constructor(issues: string) {
    super(issues)
    this.name = "NegotiationTruncatedError"
    this.message =
      "Generation exceeded length limits. Try again, or shorten your target and leverage notes."
  }
}

class NegotiationTimeoutError extends Error {
  constructor() {
    super("Negotiation generation timed out, please try again.")
    this.name = "NegotiationTimeoutError"
  }
}

function buildUserPrompt(input: NegotiationInput, retryHint: string): string {
  const { offer_normalized: o } = input
  const lines: string[] = []
  lines.push(`[COMPANY]\n${input.company}\nRole: ${input.role}`)
  // Figure provided for reasoning only. The UI renders the snapshot
  // separately; the model must not restate exact dollar amounts (rule 1).
  // Year-1 total is the only anchor; steady-state and COL are killed.
  lines.push(
    `[OFFER FIGURES] (normalized, for your reasoning only, do not restate exact dollars)\n` +
      `Year-1 total: ${Math.round(o.year1_total)}`
  )
  lines.push(`[TARGET]\n${input.target}`)
  if (input.leverage && input.leverage.trim().length > 0) {
    lines.push(`[LEVERAGE]\n${input.leverage}`)
  }
  if (input.companyContext) {
    lines.push(`[COMPANY CONTEXT]\n${input.companyContext}`)
  }
  return lines.join("\n\n") + retryHint
}

// Surface a clean error if the Opus model id is not accessible. No silent
// fallback to Sonnet or Haiku.
function rethrowModelAccessError(err: unknown): never {
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError ||
    err instanceof Anthropic.NotFoundError
  ) {
    throw new Error(
      `Negotiation Prep model (${NEGOTIATION_PREP_MODEL}) is not accessible with this API key. Check model access; no fallback model is used.`
    )
  }
  throw err
}

async function generateOnce(
  client: Anthropic,
  input: NegotiationInput,
  retryHint: string
): Promise<NegotiationOutput> {
  const userPrompt = buildUserPrompt(input, retryHint)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), NEGOTIATION_TIMEOUT_MS)

  let response: Anthropic.Messages.Message
  try {
    response = await client.messages.create(
      {
        model: NEGOTIATION_PREP_MODEL,
        max_tokens: NEGOTIATION_MAX_TOKENS,
        temperature: 0.4,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userPrompt }],
        tools: [
          {
            name: "submit_negotiation",
            description:
              "Submit the structured negotiation playbook. Always use this tool for the response.",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            input_schema: NEGOTIATION_OUTPUT_TOOL_SCHEMA as any,
          },
        ],
        tool_choice: { type: "tool", name: "submit_negotiation" },
      },
      { signal: controller.signal }
    )
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) {
      throw new NegotiationTimeoutError()
    }
    rethrowModelAccessError(err)
  } finally {
    clearTimeout(timeoutId)
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === "tool_use" && block.name === "submit_negotiation"
  )
  if (!toolUse) {
    throw new Error("Anthropic did not return a submit_negotiation tool call")
  }

  const result = negotiationOutputSchema.safeParse(toolUse.input)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
    if (response.stop_reason === "max_tokens") {
      throw new NegotiationTruncatedError(issues)
    }
    throw new NegotiationValidationError(issues)
  }

  return result.data
}

function normHash(v: string | null | undefined): string {
  if (!v) return ""
  return v.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()
}

// context_hash folds the comp fields + target + leverage + model id + prompt
// version. grounded is an outcome, not a hash input. Same sha256 +
// sorted-key + whitespace-normalized technique as lib/ai/context-hash.ts.
export function buildNegotiationContextHash(args: {
  comp: {
    base: number | null
    signing_bonus: number | null
    annual_bonus_pct: number | null
    equity_grant_total: number | null
    vesting_years: number | null
    location: string | null
  }
  target: string
  leverage: string | null
}): string {
  const obj: Record<string, unknown> = {
    base: args.comp.base ?? 0,
    signing_bonus: args.comp.signing_bonus ?? 0,
    annual_bonus_pct: args.comp.annual_bonus_pct ?? 0,
    equity_grant_total: args.comp.equity_grant_total ?? 0,
    vesting_years: args.comp.vesting_years ?? 4,
    location: normHash(args.comp.location),
    target: normHash(args.target),
    leverage: normHash(args.leverage),
    model: NEGOTIATION_PREP_MODEL,
    prompt_version: NEGOTIATION_PROMPT_VERSION,
  }
  const keys = Object.keys(obj).sort()
  const sorted: Record<string, unknown> = {}
  for (const k of keys) sorted[k] = obj[k]
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex")
}

export async function generateNegotiation(
  input: NegotiationInput
): Promise<NegotiationOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing from environment")
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    return await generateOnce(client, input, "")
  } catch (err) {
    if (err instanceof NegotiationTruncatedError) {
      throw err
    }
    if (err instanceof NegotiationValidationError) {
      return await generateOnce(client, input, RETRY_HINT)
    }
    throw err
  }
}

// Dedicated Haiku grounding for the company-patterns module. Intentionally
// duplicates generate-prep's fetchCompanyContext shape so generate-prep.ts
// stays byte-identical. Returns a 150-220 word summary or null on timeout,
// auth error, empty response, or any error (Negotiation degrades to general
// guidance, never fabricates company claims).
export async function fetchNegotiationContext(
  client: Anthropic,
  { company, role }: { company: string; role: string }
): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), GROUNDING_TIMEOUT_MS)
  try {
    const response = await client.messages.create(
      {
        model: QUICK_PREP_MODEL,
        max_tokens: GROUNDING_MAX_TOKENS,
        temperature: 0.2,
        system: [
          {
            type: "text",
            text: NEGOTIATION_CONTEXT_SYSTEM,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Company: ${company}\nRole context: ${role}\n\nSearch and summarize negotiation-relevant signals.`,
          },
        ],
        tools: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 1,
          } as any,
        ],
        tool_choice: { type: "auto" },
      },
      { signal: controller.signal }
    )

    let summary = ""
    for (const block of response.content) {
      if (block.type === "text") summary += block.text
    }
    summary = summary.trim()
    return summary.length > 0 ? summary : null
  } catch {
    // Timeout, auth, network, or parse error: caller proceeds ungrounded.
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

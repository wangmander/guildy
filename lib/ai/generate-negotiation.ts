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
// neg-v3: removed live web search; added elicitation (priorities/leverage)
// grounding + the static research-backed stat set.
// neg-v4: added best-effort market-comp lookup ([MARKET COMP] anchor).
export const NEGOTIATION_PROMPT_VERSION = "neg-v4"

// Market-comp lookup budget. One Haiku web_search, ~45s cap, so worst-case Deep
// negotiation wall-clock (45 + Opus 210) stays under the 300s route maxDuration.
const MARKET_COMP_TIMEOUT_MS = 45_000
const MARKET_COMP_MAX_TOKENS = 600

// Comp-RANGE researcher. Distinct from the removed company-patterns search: this
// fetches a real number (range) for the role, the one per-job input the user
// can't reliably supply. Honest or null, never fabricated.
const MARKET_COMP_SYSTEM = `You are a compensation data researcher. Perform exactly one web_search and return a best-effort MARKET COMP range for the given role.

LOCATION: use the provided structured location if present; else infer the location from the job description snippet if it names one; else treat as US national. State which location the range is for.

LEVEL: infer seniority from the role title (Senior, Staff, Lead, Manager, Director, etc.). If unclear, assume a mid-to-senior individual contributor.

DATA PRIORITY:
- Prefer a real COMPANY-SPECIFIC band ONLY if the company is large enough to have public comp data (big tech, well-populated levels.fyi entries) AND you confidently find it. Mark it company-specific.
- Otherwise return the role + level + location MARKET range (levels.fyi aggregate, Glassdoor-style, BLS). Mark it market-rate.

HONESTY:
- NEVER fabricate a number. If you cannot find a confident range, output exactly NONE and nothing else.
- Present a RANGE (low to high) for total compensation (or base only, labeled as such), with the source named.

OUTPUT (terse plain text, no markdown, no em dashes, at most ~80 words):
Range: <low> to <high>, <what it covers, e.g. total comp>
Location: <location the range is for>
Level: <inferred level>
Type: company-specific OR market-rate
Source: <named source>
Read: <one line on what this implies for the candidate>`

// Static, research-backed negotiation benchmarks. General and stable (the same
// way the command rail's apply-pace numbers are static constants), NEVER live
// or company-specific. Baked into the system prompt; the model weaves only the
// fitting ones in as motivation, never as facts about this offer or company.
const NEGOTIATION_STATS = `RESEARCH-BACKED STATS (static general benchmarks, NOT company-specific, NOT live data). Weave ONLY the ones that fit the candidate's situation into the plan as motivation and to calibrate expectations. Do NOT dump them all as a list. Always frame as general research ("research shows...", "studies find..."), never as facts about this specific company or offer.
- About 85% of people who counter an offer get at least some of what they asked for (Fidelity); about 87% for ages 25 to 35.
- Only about 30% of workers ask for higher pay when hired (Pew); about 42% of candidates counter (Fidelity). Most never ask.
- Tech candidates who countered won an average raise of about 12% (around $27,000 per year) in a roughly 3,858 person study (UCLA Anderson).
- The downside is smaller than feared: employers who already chose a candidate rarely rescind over a respectful, professional counter.
- When base is fixed, other levers (signing bonus, equity, PTO, title, earlier review) are often easier yeses. A signing bonus is a one time cost that does not move salary bands or set precedent, and package levers can add roughly $15,000 to $40,000 in value.`

const NEGOTIATION_MAX_TOKENS = 8192
// Opus AbortController budget. Haiku grounding (60s) plus this stays under the
// route maxDuration of 300 with margin (worst case ~270s).
const NEGOTIATION_TIMEOUT_MS = 210_000

const GROUNDING_TIMEOUT_MS = 60_000
const GROUNDING_MAX_TOKENS = 600

// Negotiation-tuned grounding prompt. Comp-structure norms and leverage
// signals, not generic company news.
const NEGOTIATION_CONTEXT_SYSTEM = `You are a compensation research assistant. Given a company name and role, perform exactly one web_search and produce a 150 to 220 word terse summary focused on negotiation-relevant signals: how this company structures offers (base vs equity vs signing weighting), where it tends to have flexibility, recent funding or headcount or hiring-posture signals that affect candidate leverage, and any public comp-band signals. No fluff, no preamble. Plain text only, no markdown. Never use em dashes.`

const SYSTEM_PROMPT = `You are a senior compensation negotiation advisor. You produce a tight, actionable negotiation playbook for one job offer, centered on what THIS candidate told you matters most. Use the submit_negotiation tool for your entire response.

GROUNDING:
- Center the plan on the candidate's [PRIORITIES] (what they want most). If none are given, assume base salary plus package levers (signing bonus, equity, PTO, title, earlier review).
- Anchor the asks to the candidate's [TARGET] (in their words) and the offer's year-1 figure. Coach them to ask for their chosen priority.
- Use [LEVERAGE] to shape leverage_analysis and the scripts. With a competing offer, coach using it respectfully. With "None yet", coach building soft leverage (fit, enthusiasm, market rate) without bluffing.
- There is no company-PATTERNS research. A best-effort [MARKET COMP] range may be provided; when present, use it to calibrate the asks (see rule 2). Give strong GENERAL negotiation tactics. Never fabricate company-specific claims (no invented flex percentages, bands, or policies). You may name the company generically.

${NEGOTIATION_STATS}

SCRIPTS must adapt to the chosen priorities and this offer, not be a generic list. Draw from and tailor these where they fit:
- Package pivot (when base is fixed): "If base is fixed, could we close the gap with a signing bonus or additional equity/PTO?"
- Market-anchored base counter (when Base is a priority): a respectful counter citing the market range (use [MARKET COMP] when present) and the candidate's fit, without inventing a company band.
- Get it in writing: confirm any agreed change in the written offer.
- Let silence work: make the ask, then stop talking.
Each script is a named scenario plus word-for-word language the candidate can say.

HARD RULES:
1. Numbers. Use ONLY the normalized figure provided in [OFFER FIGURES] when referencing the offer's value, and refer to it in words ("your year-1 total figure shown") rather than restating exact dollars. Never reference steady-state or cost-of-living-adjusted figures; year-1 total is the only offer anchor. Never invent any dollar amount, and never derive a number from [TARGET] or [OFFER FIGURES] (no floor, no gap). The ONLY external numbers you may cite are (a) the static research benchmarks above, framed as general research, and (b) the [MARKET COMP] range when present, cited as a sourced range. Never present either as this offer's or this company's exact internal numbers.
2. Market comp. When [MARKET COMP] is present, compare the candidate's year-1 figure and stated target against the range: tell them where the offer sits (below, within, or above the range) and what to counter toward (for a below-range offer, the upper part of the range). Cite it as a market range with its source, and call it "a market range, not a company-exact band" UNLESS the block is marked company-specific. When [MARKET COMP] is ABSENT, keep the plan tactics-only and tell the candidate to look up their number on levels.fyi for their role, level, and location. Never fabricate a range.
3. company_patterns: describe how offers are generally structured and where flexibility usually lives (base vs equity vs signing, one time vs recurring), framed as general patterns and backed by the relevant stats. Never claim company-specific facts. When [MARKET COMP] is present, this module is the home for the where-your-offer-sits read.
4. Output. company_patterns, leverage_analysis, and walk_away_guidance are non-empty prose. scripts has at least 2 entries, each a named scenario plus word-for-word language the candidate can say.

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
  const priorities =
    input.priorities.length > 0
      ? input.priorities.join(", ")
      : "(none selected, assume base salary plus package levers)"
  lines.push(`[PRIORITIES] (what the candidate wants most)\n${priorities}`)
  const target =
    input.target.trim().length > 0 ? input.target.trim() : "(not provided)"
  lines.push(`[TARGET]\n${target}`)
  const leverage =
    input.leverage.length > 0 ? input.leverage.join(", ") : "(none provided)"
  lines.push(`[LEVERAGE]\n${leverage}`)
  if (input.marketComp) {
    lines.push(
      `[MARKET COMP] (best-effort, sourced; treat as a market range unless marked company-specific)\n${input.marketComp}`
    )
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
  company: string
  role: string
  priorities: string[]
  target: string
  leverage: string[]
}): string {
  // Arrays are order-independent: normalized, lowercased, sorted, joined so the
  // same selections in any order hash identically (edit invalidates, reorder
  // does not).
  const normList = (arr: string[]): string =>
    [...arr].map((s) => s.trim().toLowerCase()).sort().join("|")
  const obj: Record<string, unknown> = {
    company: normHash(args.company),
    role: normHash(args.role),
    base: args.comp.base ?? 0,
    signing_bonus: args.comp.signing_bonus ?? 0,
    annual_bonus_pct: args.comp.annual_bonus_pct ?? 0,
    equity_grant_total: args.comp.equity_grant_total ?? 0,
    vesting_years: args.comp.vesting_years ?? 4,
    location: normHash(args.comp.location),
    priorities: normList(args.priorities),
    target: normHash(args.target),
    leverage: normList(args.leverage),
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

type MarketCompInput = {
  role: string
  company: string
  // Structured curated metro from the comp-edit modal (or null). Primary
  // location signal; jdSnippet is the fallback the model reads.
  location: string | null
  jdSnippet: string | null
}

// Best-effort market-comp lookup: one bounded Haiku web_search for a real comp
// RANGE for the role+level+location (company-specific only when confidently
// found). Modeled on generate-prep's fetchCompanyContext / fetchInterviewerIntel.
// Returns a terse sourced anchor string, or null on NONE / no number / timeout /
// auth / empty so the plan stays tactics-only and never invents a figure. This
// is comp-focused and DISTINCT from the removed fetchNegotiationContext.
async function fetchMarketComp(
  client: Anthropic,
  input: MarketCompInput
): Promise<string | null> {
  const start = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MARKET_COMP_TIMEOUT_MS)
  try {
    const query = [
      `Role: ${input.role}`,
      `Company: ${input.company}`,
      `Structured location: ${input.location && input.location.trim().length > 0 ? input.location : "(not provided)"}`,
      `Job description snippet (use for location only): ${input.jdSnippet && input.jdSnippet.trim().length > 0 ? input.jdSnippet : "(not provided)"}`,
      "",
      "Search and return the comp range per the format, or NONE.",
    ].join("\n")
    const response = await client.messages.create(
      {
        model: QUICK_PREP_MODEL,
        max_tokens: MARKET_COMP_MAX_TOKENS,
        temperature: 0.2,
        system: [
          {
            type: "text",
            text: MARKET_COMP_SYSTEM,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: query }],
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
    // Honesty guard: empty, an explicit NONE, or no digit at all means no
    // confident range was found. Tactics-only.
    if (summary.length === 0 || /^none\b/i.test(summary) || !/\d/.test(summary)) {
      // eslint-disable-next-line no-console
      console.log(
        "[generateNegotiation] Market comp not found, proceeding tactics-only"
      )
      return null
    }
    // eslint-disable-next-line no-console
    console.log(
      `[generateNegotiation] Market comp fetched: ${summary.length} chars in ${Date.now() - start}ms`
    )
    return summary
  } catch (err) {
    const reason =
      err instanceof Anthropic.APIUserAbortError
        ? "timeout"
        : err instanceof Error
          ? err.message
          : String(err)
    // eslint-disable-next-line no-console
    console.log(
      `[generateNegotiation] Market comp fetch failed, proceeding tactics-only: ${reason}`
    )
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

// Exported entry point for the action layer. Self-guards on a missing API key
// and creates its own client (mirrors generate-prep's getInterviewerIntel), so
// the action doesn't import the Anthropic SDK. Best-effort, null on any failure.
export async function getMarketComp(
  input: MarketCompInput
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return fetchMarketComp(client, input)
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

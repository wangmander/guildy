import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { DEEP_PREP_MODEL, QUICK_PREP_MODEL } from "./models"
import {
  prepOutputSchema,
  type PrepInput,
  type PrepOutput,
  type PrepSessionRole,
} from "./prep-types"

const RESUME_CHAR_CAP = 8000
const JD_CHAR_CAP = 12000
const LATEST_MESSAGE_CHAR_CAP = 4000
const NOTE_CHAR_CAP = 4000
// Patch 7: raised from 2048/4096. Diagnostic logs at a242b8f confirmed Haiku
// was hitting the old 2048 cap mid-output (stop_reason=max_tokens) and dropping
// questions_they_ask / questions_you_ask / prep_checklist before the tool call
// closed. New ceilings cover worst-case Haiku verbose output (Quick) and full
// Sonnet Deep output (8 question categories with answer plans + full
// positioning + risks-with-counters + interviewer insights).
const QUICK_MAX_TOKENS = 4096
const DEEP_MAX_TOKENS = 8192

// Hard timeouts on the Anthropic prep-generation call. AbortController fires
// past these and the user sees a "timed out, try again" message. Sonnet is
// single-pass for prep generation post-Patch-5.4; the broader Deep budget
// covers Sonnet's reasoning + structured-output emission.
const QUICK_TIMEOUT_MS = 120_000
const DEEP_TIMEOUT_MS = 180_000

// Patch 5.4: Haiku-backed company-context fetch budget. Single bounded
// research call upstream of Sonnet generation; falls back to ungrounded
// generation on timeout/error.
const COMPANY_CONTEXT_TIMEOUT_MS = 60_000
const COMPANY_CONTEXT_MAX_TOKENS = 1024

const COMPANY_CONTEXT_SYSTEM = `You are a research assistant. Given a company name and role context, perform exactly one web_search and produce a 150-220 word terse summary covering: recent company news, funding/financials, key products or strategic moves, named competitors, hiring posture if visible. No fluff, no preamble. Plain text only, no markdown.`

const SYSTEM_PROMPT = `You are a senior interview prep coach with 15+ years guiding candidates through interviews at top tech companies. You produce sharp, candidate-specific prep — never generic boilerplate.

INPUTS YOU RECEIVE
- Resume text (use specific projects, companies, titles, skills, scope from it)
- Job description (use specific responsibilities, requirements, scope, level)
- Latest message from recruiter or hiring manager (signals about what they care about, who's involved, what stage)
- Current interview stage
- Interviewer name (when known)
- Tier (quick or deep) — controls depth, counts, and which fields populate

QUALITY BAR
1. Every framing point, risk item, and answer plan must reference at least one concrete item from the resume or JD. Zero "research the company" filler.
2. Risks must be REAL gaps. Compare resume scope, seniority, and skills against JD requirements. Surface what will actually trip the candidate up.
3. Questions must be PLAUSIBLE for the stage:
   - screen: motivation, basic background, comp expectations, logistics, fit
   - hiring_manager: scope, judgment, tradeoffs, recent work, team fit
   - interview_loop: deep work samples, process, collaboration, impact, failure
   - offer: motivation specifics, comp negotiation, timing, decision criteria
4. Use the interviewer's name when phrasing positioning frames if provided. Do not invent biographical details about them.
5. Reference specifics from the latest message if it hints at what they care about.
6. Do not invent facts about the company that aren't in the JD or message.
7. When [COMPANY CONTEXT] is present in the user prompt, use it to ground positioning, risks, and questions. Do not invent facts not present in resume, JD, latest message, or company context.
8. When [SESSION] contains a 'Round name' line, treat it as the primary session target. Drive prep emphasis from the round name. The role-keyed Focus/Emphasize/Defer lines that follow are supporting context, not the dominant signal. If round name and role enum imply different emphasis, prioritize the round name.

QUICK PREP TIER RULES (when tier === "quick")

Quick Prep is a USEFUL SKETCH, not a comprehensive plan. Be specific but concise.

Length budgets:
- purpose.summary: max 3 sentences
- purpose.criteria: 3-4 items, each description 1 sentence; integer weights 0-100 summing to roughly 100
- positioning.summary: max 2 sentences
- positioning.frames: exactly 2 items, each description max 2 sentences
- risks.items: 2-3 items, each rationale 1 sentence, NO counters in Quick (set counter to null)
- questions_they_ask: 3-5 items, NO answer_plan (return null), NO category labels (return null)
- questions_you_ask: 3-4 items, NO interviewer_type (return null)
- prep_checklist: 4-6 short items, each one line, each with done set to false

Aim for under 3000 output tokens total. Content should still be specific and grounded in resume/JD/context — concise does not mean generic.

interviewer_insights must be null in Quick.

DEEP PREP TIER RULES (when tier === "deep")
- 8 to 12 items in questions_they_ask distributed across these categories — use the labels meaningfully, do not force every category if the stage doesn't warrant it: Background, Role fit, Behavioral, Product/design judgment, Leadership/conflict, Weakness/gaps, Company motivation, Bar raiser
- Each questions_they_ask item MUST have a non-null answer_plan: a structured 3-5 sentence plan, not a one-liner tip. Reference at least one concrete resume item per plan.
- 3 to 5 items in questions_you_ask, sharper than Quick (specific to the company/team if context allows)
- Exactly 4 items in risks.items, each with a NON-NULL counter (specific prepared response, anchored in resume facts)
- 4 to 6 items in positioning.frames with rich, resume-grounded context
- 6 to 8 items in prep_checklist, each with done set to false
- 4 to 5 items in purpose.criteria with detailed descriptions; integer weights summing to roughly 100
- If interviewer_name is provided, interviewer_insights MUST be a non-null string (3-6 sentences) with prep tailored to that interviewer's likely angle, grounded in the JD and resume. If interviewer_name is not provided, interviewer_insights must be null.

DEEP PREP — RESUME-TO-JD FIT (Deep only, no separate field)
Weave resume-to-JD comparison into existing fields:
- At least 2 of the positioning.frames must explicitly cite specific resume items that match (or fail to match) JD requirements.
- At least 2 of the risks.items must come from specific resume gaps versus JD asks (e.g., "JD asks for B2B SaaS scale; your most recent shipped work is consumer — bridge with the X project").
- Do not generate filler. If no clear gap exists, surface scope or seniority mismatches instead.

REQUIRED FIELDS — every call must return ALL of:
- stage
- purpose (object)
- positioning (object)
- risks (object)
- prep_checklist (array, non-empty)
- questions_they_ask (array of question objects, non-empty — never omit, never empty)
- questions_you_ask (array of question objects, non-empty — never omit, never empty)

OPTIONAL FIELDS:
- interviewer_insights (Deep tier only, when interviewer is provided. Set to null or omit when no interviewer.)

OUTPUT
Call the submit_prep tool with the structured prep. The "stage" field in your output must equal the input stage value. Do not omit any required field.`

// `interviewer_insights` is deliberately NOT in required[]. Sonnet sometimes
// omits the field entirely when no interviewer is provided (interpreting
// "must be null" as "skip the key"). The Zod schema mirrors this with
// `.nullable().optional()` so all three shapes validate: present-string,
// present-null, and missing.
const PREP_OUTPUT_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "stage",
    "purpose",
    "positioning",
    "risks",
    "prep_checklist",
    "questions_they_ask",
    "questions_you_ask",
  ],
  properties: {
    stage: {
      type: "string",
      enum: ["screen", "hiring_manager", "interview_loop", "offer"],
    },
    // Phase 4d: optional + nullable, mirrors the interviewer_insights pattern
    // from patch 6. Not in required[]. Single-session prep leaves it unset.
    session_title: { type: ["string", "null"] },
    purpose: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "summary", "criteria"],
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
        criteria: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "weight", "description"],
            properties: {
              name: { type: "string" },
              weight: { type: "number" },
              description: { type: "string" },
            },
          },
        },
      },
    },
    positioning: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "summary", "frames"],
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
        frames: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "description"],
            properties: {
              title: { type: "string" },
              description: { type: "string" },
            },
          },
        },
      },
    },
    risks: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "summary", "items"],
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["risk", "counter"],
            properties: {
              risk: { type: "string" },
              counter: { type: ["string", "null"] },
            },
          },
        },
      },
    },
    prep_checklist: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "done"],
        properties: {
          item: { type: "string" },
          done: { type: "boolean" },
        },
      },
    },
    questions_they_ask: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        // Patch 8: category and answer_plan dropped from required so Quick
        // can omit them; Deep populates both. `question` stays required.
        required: ["question"],
        properties: {
          category: { type: ["string", "null"] },
          question: { type: "string" },
          answer_plan: { type: ["string", "null"] },
        },
      },
    },
    questions_you_ask: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question"],
        properties: {
          category: { type: ["string", "null"] },
          question: { type: "string" },
        },
      },
    },
    interviewer_insights: { type: ["string", "null"] },
  },
} as const

// Hint appended to the user prompt on the retry path. Sonnet sometimes
// omits required array fields on the first pass; a fresh call with this
// hint usually produces a complete output.
const RETRY_HINT = `

Your previous response was missing one or more required fields. This time, return ALL required fields:
- questions_they_ask: a non-empty array of question objects (NEVER omit, NEVER empty)
- questions_you_ask: a non-empty array of question objects (NEVER omit, NEVER empty)
- purpose, positioning, risks, prep_checklist all present and complete

interviewer_insights remains optional and may be null when no interviewer is provided.`

class PrepValidationError extends Error {
  issues: string
  constructor(issues: string) {
    super(`Anthropic prep output failed schema validation: ${issues}`)
    this.name = "PrepValidationError"
    this.issues = issues
  }
}

// Subclass of PrepValidationError for the specific case where Zod failed AND
// the model stopped because it ran out of output tokens. Retrying with a
// strengthened hint just appends to the prompt and leaves even less room for
// output, so we surface a friendly error instead.
class PrepTruncatedError extends PrepValidationError {
  constructor(issues: string) {
    super(issues)
    this.name = "PrepTruncatedError"
    this.message =
      "Generation exceeded length limits. Try regenerating, or simplify context (shorter JD/resume)."
  }
}

class PrepTimeoutError extends Error {
  constructor() {
    super("Generation timed out, please try again.")
    this.name = "PrepTimeoutError"
  }
}

async function generateOnce(
  client: Anthropic,
  input: PrepInput,
  retryHint: string,
  companyContext: string | null
): Promise<PrepOutput> {
  const isDeep = input.tier === "deep"
  const userPrompt = buildUserPrompt(input, companyContext) + retryHint
  const model = isDeep ? DEEP_PREP_MODEL : QUICK_PREP_MODEL
  const maxTokens = isDeep ? DEEP_MAX_TOKENS : QUICK_MAX_TOKENS
  const timeoutMs = isDeep ? DEEP_TIMEOUT_MS : QUICK_TIMEOUT_MS

  // Patch 5.4: single-pass prep generation. Sonnet no longer carries the
  // web_search server-tool; grounding is fetched upstream by Haiku and
  // injected as a [COMPANY CONTEXT] block in the user prompt. Tools array
  // is just submit_prep; tool_choice forces it; no agentic loop.
  if (isDeep) {
    // eslint-disable-next-line no-console
    console.log("[generatePrep] Sonnet generation start")
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let response: Anthropic.Messages.Message
  try {
    response = await client.messages.create(
      {
        model,
        max_tokens: maxTokens,
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
            name: "submit_prep",
            description:
              "Submit the structured interview prep output. Always use this tool for the response.",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            input_schema: PREP_OUTPUT_TOOL_SCHEMA as any,
          },
        ],
        tool_choice: { type: "tool", name: "submit_prep" },
      },
      { signal: controller.signal }
    )
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) {
      throw new PrepTimeoutError()
    }
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error(
        "Server config error. Check ANTHROPIC_API_KEY in .env.local and restart dev server."
      )
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  const submitToolUse = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === "tool_use" && block.name === "submit_prep"
  )
  if (!submitToolUse) {
    throw new Error("Anthropic did not return a submit_prep tool call")
  }

  const result = prepOutputSchema.safeParse(submitToolUse.input)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
    // Truncation gets its own error so the caller can skip the retry path —
    // a longer retry prompt only leaves less room for output.
    if (response.stop_reason === "max_tokens") {
      throw new PrepTruncatedError(issues)
    }
    throw new PrepValidationError(issues)
  }

  if (input.tier === "quick") {
    // Belt-and-suspenders: model is told to null these for Quick, but force
    // it so the UI's tier-aware rendering never sees Deep-only content.
    result.data.interviewer_insights = null
    result.data.risks.items = result.data.risks.items.map((item) => ({
      ...item,
      counter: null,
    }))
    result.data.questions_they_ask = result.data.questions_they_ask.map(
      (q) => ({ ...q, answer_plan: null })
    )
  }

  // Stage in output must match input stage. Override if the model echoed
  // something weird — caller relies on this for staleness detection.
  result.data.stage = input.stage

  return result.data
}

export async function generatePrep(input: PrepInput): Promise<PrepOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing from environment")
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Patch 5.4: Deep flow is now Haiku-search-then-Sonnet-generate. Quick
  // skips the research step entirely and runs the same single-pass shape
  // it always has.
  const isDeep = input.tier === "deep"
  const deepStart = isDeep ? Date.now() : 0
  if (isDeep) {
    // eslint-disable-next-line no-console
    console.log("[generatePrep] Deep start")
  }

  // Phase 5: smoke-test diagnostic. Confirms the user-edited round label is
  // reaching the prompt. Cleanup post-launch alongside the other diagnostic
  // logs in this file.
  const sessionLabel = input.session_label?.trim()
  if (sessionLabel && sessionLabel.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[generatePrep] Session label injected: ${sessionLabel}`)
  }

  const companyContext = isDeep
    ? await fetchCompanyContext(client, input)
    : null

  try {
    const out = await generateOnce(client, input, "", companyContext)
    if (isDeep) {
      // eslint-disable-next-line no-console
      console.log(
        `[generatePrep] Deep generated in ${Date.now() - deepStart}ms`
      )
    }
    return out
  } catch (err) {
    if (err instanceof PrepTruncatedError) {
      // Retry with a longer prompt would only leave less room for output.
      // Surface the friendly message and let the user retry manually.
      throw err
    }
    if (err instanceof PrepValidationError) {
      // Single retry with the strengthened user prompt. The retry reuses
      // the same companyContext so we don't re-pay the Haiku research cost.
      const out = await generateOnce(client, input, RETRY_HINT, companyContext)
      if (isDeep) {
        // eslint-disable-next-line no-console
        console.log(
          `[generatePrep] Deep generated in ${Date.now() - deepStart}ms`
        )
      }
      return out
    }
    throw err
  }
}

// Patch 5.4: Haiku-backed company-context summary upstream of Sonnet. One
// bounded research call with the web_search server-tool. On any failure
// (timeout, auth, empty response) returns null and the Deep generation
// proceeds ungrounded — no synthetic facts, just resume + JD + message.
async function fetchCompanyContext(
  client: Anthropic,
  input: PrepInput
): Promise<string | null> {
  const start = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    COMPANY_CONTEXT_TIMEOUT_MS
  )
  try {
    const response = await client.messages.create(
      {
        model: QUICK_PREP_MODEL,
        max_tokens: COMPANY_CONTEXT_MAX_TOKENS,
        temperature: 0.2,
        system: [
          {
            type: "text",
            text: COMPANY_CONTEXT_SYSTEM,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Company: ${input.company_name}\nRole context: ${input.role_title}\n\nSearch and summarize.`,
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
    if (summary.length === 0) {
      // eslint-disable-next-line no-console
      console.log(
        "[generatePrep] Company context fetch failed, proceeding ungrounded: empty summary"
      )
      return null
    }
    // eslint-disable-next-line no-console
    console.log(
      `[generatePrep] Company context fetched: ${summary.length} chars in ${Date.now() - start}ms`
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
      `[generatePrep] Company context fetch failed, proceeding ungrounded: ${reason}`
    )
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

// Phase 4d: per-session emphasis injected into the user prompt when
// input.session_role is set. Each role gets its own focus / emphasize /
// defer block so a single Full Loop stage produces materially distinct
// prep across sessions. Threading from the action layer happens in prompt 3.
const SESSION_ROLE_EMPHASIS = {
  hiring_manager: {
    focus:
      "Leadership lens. Conversation about how the candidate operates, prioritizes, and grows a function under this hiring manager.",
    emphasize: [
      "management philosophy and style",
      "team fit and collaboration patterns with leadership",
      "project priorities and scope tradeoffs",
      "calibration on the bar and what success looks like in 90 days",
      "why this role and why now",
      "expectations setting and 1:1 cadence",
    ],
    exclude: [
      "do NOT generate content related to deep technical or craft drill. If it comes up naturally, defer it explicitly to the skills_portfolio tab. This is a hard boundary, not a soft preference.",
      "do NOT generate content related to peer-level collab scenarios. If they come up naturally, defer them explicitly to the cross_functional tab. This is a hard boundary, not a soft preference.",
    ],
    session_title_examples: [
      "VP Engineering Hiring Manager",
      "Director of Design Hiring Manager",
      "Head of Product Hiring Manager",
    ],
  },
  cross_functional: {
    focus:
      "Peer and stakeholder lens. Conversation with partners across PM, Engineering, Design, or Data about how the candidate operates across functions.",
    emphasize: [
      "collaboration patterns and rituals",
      "scope negotiation",
      "conflict resolution and disagreement handling",
      "influence without authority",
      "cross-team failure modes and what was learned",
      "working with PM/Eng/Design/Data counterparts",
    ],
    exclude: [
      "do NOT generate content related to leadership philosophy. If it comes up naturally, defer it explicitly to the hiring_manager tab. This is a hard boundary, not a soft preference.",
      "do NOT generate content related to pure technical or craft depth. If it comes up naturally, defer it explicitly to the skills_portfolio tab. This is a hard boundary, not a soft preference.",
    ],
    session_title_examples: [
      "Cross-functional Partner Round",
      "PM and Eng Panel",
      "Cross-team Collaboration Round",
    ],
  },
  skills_portfolio: {
    focus:
      "Craft lens. Deep technical or portfolio walkthrough. Past artifacts, methodology, and decisions at the artifact level.",
    emphasize: [
      "technical or design depth",
      "system design or design judgment",
      "portfolio walkthrough structure",
      "specific past project deep-dives",
      "methodology and tradeoffs at the decision level",
      "code or critique judgment",
    ],
    exclude: [
      "do NOT generate content related to people or leadership topics. If they come up naturally, defer them explicitly to the hiring_manager tab. This is a hard boundary, not a soft preference.",
      "do NOT generate content related to cross-team dynamics. If they come up naturally, defer them explicitly to the cross_functional tab. This is a hard boundary, not a soft preference.",
    ],
    session_title_examples: [
      "Portfolio Deep Dive",
      "Technical Design Round",
      "Craft and Methodology Round",
    ],
  },
  bar_raiser: {
    focus:
      "Calibration lens. Senior interviewer probing vision, principles, judgment under ambiguity, and intellectual horsepower.",
    emphasize: [
      "vision and long-horizon thinking",
      "principles and tradeoffs",
      "judgment under ambiguity",
      "raw intellectual signal",
      "alignment with the company's bar",
      "hard-call past decisions",
    ],
    exclude: [
      "do NOT generate content related to tactical execution detail. If it comes up naturally, defer it explicitly to the skills_portfolio tab. This is a hard boundary, not a soft preference.",
      "do NOT generate content related to mundane day-to-day collab. If it comes up naturally, defer it explicitly to the cross_functional tab. This is a hard boundary, not a soft preference.",
    ],
    session_title_examples: [
      "Bar Raiser Round",
      "Senior Calibration Round",
      "Director-level Bar Raiser",
    ],
  },
} as const satisfies Record<
  PrepSessionRole,
  {
    focus: string
    emphasize: readonly string[]
    exclude: readonly string[]
    session_title_examples: readonly string[]
  }
>

function buildUserPrompt(
  input: PrepInput,
  companyContext: string | null = null
): string {
  const resume = truncate(input.resume_text, RESUME_CHAR_CAP)
  const jd = truncate(input.jd_text, JD_CHAR_CAP)
  const message = truncate(input.latest_message, LATEST_MESSAGE_CHAR_CAP)
  const note = truncate(input.note_text, NOTE_CHAR_CAP)
  const interviewerName = input.interviewer_name?.trim()
  const interviewerTitle = input.interviewer_title?.trim()
  const interviewerLink = input.interviewer_link?.trim()

  const interviewerBlock =
    interviewerName || interviewerTitle || interviewerLink
      ? [
          "[INTERVIEWER]",
          `  name: ${interviewerName && interviewerName.length > 0 ? interviewerName : "(not provided)"}`,
          `  title: ${interviewerTitle && interviewerTitle.length > 0 ? interviewerTitle : "(not provided)"}`,
          `  link: ${interviewerLink && interviewerLink.length > 0 ? interviewerLink : "(not provided)"}`,
        ].join("\n")
      : "[INTERVIEWER]: (not provided)"

  const lines: string[] = [
    `[STAGE]: ${input.stage}`,
    `[COMPANY]: ${input.company_name}`,
    `[ROLE]: ${input.role_title}`,
    `[TIER]: ${input.tier}`,
    "",
    interviewerBlock,
    "",
    "[RESUME]",
    resume ?? "(not provided)",
    "",
    "[JOB DESCRIPTION]",
    jd ?? "(not provided)",
  ]

  // Patch 5.4: company context (Haiku-fetched summary) immediately after JD,
  // before session-role overrides. Absent when fetch failed or for Quick.
  if (companyContext) {
    lines.push("", "[COMPANY CONTEXT]", companyContext)
  }

  if (input.session_role) {
    const cfg = SESSION_ROLE_EMPHASIS[input.session_role]
    const sessionLabel = input.session_label?.trim()
    const hasLabel = Boolean(sessionLabel && sessionLabel.length > 0)
    lines.push("", "[SESSION]")
    if (hasLabel) {
      lines.push(`Round name: ${sessionLabel}`)
    }
    lines.push(
      `Session role: ${input.session_role}`,
      `Focus: ${cfg.focus}`,
      "Emphasize in this session:",
      ...cfg.emphasize.map((s) => `  - ${s}`),
      "Defer (other sessions cover):",
      ...cfg.exclude.map((s) => `  - ${s}`)
    )
    if (hasLabel) {
      lines.push(
        "Populate session_title in the output to faithfully reflect the round name above (or a contextualized variant fitting the JD/company)."
      )
    } else {
      lines.push(
        "Populate session_title in the output with a contextualized label fitting this role and the JD or company. If no round name is provided, pick from these examples:",
        ...cfg.session_title_examples.map((s) => `  - ${s}`)
      )
    }
  }

  lines.push(
    "",
    "[LATEST MESSAGE]",
    message ?? "(not provided)",
    "",
    "[ADDITIONAL CONTEXT]",
    note ?? "(not provided)",
    "",
    `Generate ${input.tier} prep. Call the submit_prep tool with the structured output.`
  )

  return lines.join("\n")
}

function truncate(text: string | null, cap: number): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (trimmed.length === 0) return null
  return trimmed.length > cap ? trimmed.slice(0, cap) : trimmed
}

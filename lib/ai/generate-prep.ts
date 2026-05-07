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

// Hard timeout on the Anthropic call. Beyond this the SDK promise is aborted
// via AbortController and the user sees a "timed out, try again" message
// instead of a hung UI. Phase 5: Deep budgets 180s to cover the additional
// web_search round-trips on top of Sonnet's existing latency.
const QUICK_TIMEOUT_MS = 120_000
const DEEP_TIMEOUT_MS = 180_000

// Phase 5: Deep agentic loop guard. Server-side web_search typically resolves
// in a single client round-trip (Anthropic loops internally), but a defensive
// client-side cap protects against runaway tool-use chains.
const DEEP_MAX_ITERATIONS = 5

// Phase 5: appended to Deep system as a separate cached block. Forces the
// model to ground company-specific prep in a fresh web search before emitting
// submit_prep. Cached independently so Quick's cache key is unaffected.
const DEEP_GROUNDING_DIRECTIVE = `DEEP PREP GROUNDING REQUIREMENT (Deep tier only)

Before emitting the submit_prep tool, you MUST perform at least one web_search on the company name from the job description. Search for: recent company news, funding announcements, product launches, hiring posture, named competitors. Use search results to ground company-specific positioning and risks. If the company name cannot be confidently identified from the JD, search using the most likely candidate and proceed.`

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
  retryHint: string
): Promise<PrepOutput> {
  const isDeep = input.tier === "deep"
  const userPrompt = buildUserPrompt(input) + retryHint
  const model = isDeep ? DEEP_PREP_MODEL : QUICK_PREP_MODEL
  const maxTokens = isDeep ? DEEP_MAX_TOKENS : QUICK_MAX_TOKENS
  const timeoutMs = isDeep ? DEEP_TIMEOUT_MS : QUICK_TIMEOUT_MS

  // Phase 5: Deep gets the grounding directive as a second cached block, plus
  // the web_search server-tool. Quick is byte-identical to pre-Phase-5: same
  // single tool, same forced tool_choice, same single system block, no loop.
  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ]
  if (isDeep) {
    systemBlocks.push({
      type: "text",
      text: DEEP_GROUNDING_DIRECTIVE,
      cache_control: { type: "ephemeral" },
    })
  }

  const submitPrepTool = {
    name: "submit_prep",
    description:
      "Submit the structured interview prep output. Always use this tool for the response.",
    // Anthropic's input_schema accepts standard JSON Schema; we reuse the
    // same shape we used with OpenAI.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input_schema: PREP_OUTPUT_TOOL_SCHEMA as any,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [submitPrepTool]
  if (isDeep) {
    // Server-managed tool: Anthropic executes the search and feeds results
    // back to the model in-call. max_uses caps total searches per turn.
    tools.push({
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 3,
    })
  }

  const toolChoice: Anthropic.Messages.ToolChoice = isDeep
    ? { type: "auto" }
    : { type: "tool", name: "submit_prep" }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userPrompt },
  ]
  let response: Anthropic.Messages.Message | undefined
  let submitToolUse: Anthropic.Messages.ToolUseBlock | undefined
  let webSearchCount = 0

  try {
    const maxIterations = isDeep ? DEEP_MAX_ITERATIONS : 1
    for (let i = 0; i < maxIterations; i++) {
      response = await client.messages.create(
        {
          model,
          max_tokens: maxTokens,
          temperature: 0.4,
          system: systemBlocks,
          messages,
          tools,
          tool_choice: toolChoice,
        },
        { signal: controller.signal }
      )

      for (const block of response.content) {
        if (block.type === "tool_use" && block.name === "web_search") {
          webSearchCount++
        }
      }

      submitToolUse = response.content.find(
        (block): block is Anthropic.Messages.ToolUseBlock =>
          block.type === "tool_use" && block.name === "submit_prep"
      )
      if (submitToolUse) break

      // No submit_prep yet. Distinguish truncation from "model still working
      // through tools" so the existing PrepTruncatedError path surfaces
      // properly when output is cut mid-emission.
      if (response.stop_reason === "max_tokens") {
        throw new PrepTruncatedError(
          "Output truncated before submit_prep emission"
        )
      }
      if (response.stop_reason !== "tool_use") {
        throw new Error("Anthropic did not return a submit_prep tool call")
      }

      // Continue the conversation: append the assistant message and re-call.
      // web_search is server-managed, so no client-side tool_result needed.
      messages.push({ role: "assistant", content: response.content })
    }

    if (!submitToolUse) {
      throw new PrepValidationError("Deep grounding exceeded iteration cap")
    }
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

  if (isDeep) {
    // eslint-disable-next-line no-console
    console.log(
      `[generatePrep] Deep grounding: ${webSearchCount} web_search calls`
    )
  }

  const result = prepOutputSchema.safeParse(submitToolUse.input)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
    // Truncation gets its own error so the caller can skip the retry path —
    // a longer retry prompt only leaves less room for output.
    if (response && response.stop_reason === "max_tokens") {
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

  try {
    return await generateOnce(client, input, "")
  } catch (err) {
    if (err instanceof PrepTruncatedError) {
      // Retry with a longer prompt would only leave less room for output.
      // Surface the friendly message and let the user retry manually.
      throw err
    }
    if (err instanceof PrepValidationError) {
      // Single retry with the strengthened user prompt. If this also fails,
      // the error from the second attempt surfaces to the caller.
      return await generateOnce(client, input, RETRY_HINT)
    }
    throw err
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

function buildUserPrompt(input: PrepInput): string {
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

  if (input.session_role) {
    const cfg = SESSION_ROLE_EMPHASIS[input.session_role]
    lines.push(
      "",
      "[SESSION]",
      `Session role: ${input.session_role}`,
      `Focus: ${cfg.focus}`,
      "Emphasize in this session:",
      ...cfg.emphasize.map((s) => `  - ${s}`),
      "Defer (other sessions cover):",
      ...cfg.exclude.map((s) => `  - ${s}`),
      "Populate session_title in the output with a contextualized label fitting this role and the JD or company. Examples:",
      ...cfg.session_title_examples.map((s) => `  - ${s}`)
    )
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

import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { DEEP_PREP_MODEL, QUICK_PREP_MODEL } from "./models"
import { prepOutputSchema, type PrepInput, type PrepOutput } from "./prep-types"

const RESUME_CHAR_CAP = 8000
const JD_CHAR_CAP = 12000
const LATEST_MESSAGE_CHAR_CAP = 4000
const NOTE_CHAR_CAP = 4000
const QUICK_MAX_TOKENS = 2048
const DEEP_MAX_TOKENS = 4096

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
- 3 to 5 items in questions_they_ask, plain category labels
- 2 to 3 items in questions_you_ask
- Exactly 3 items in risks.items, each with counter set to null
- Exactly 4 items in positioning.frames
- Exactly 4 items in prep_checklist, each with done set to false
- 3 to 4 items in purpose.criteria; integer weights 0-100 summing to roughly 100
- Each questions_they_ask item must set answer_plan to null
- interviewer_insights must be null

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

OUTPUT
Call the submit_prep tool with the structured prep. The "stage" field in your output must equal the input stage value.`

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
    "interviewer_insights",
  ],
  properties: {
    stage: {
      type: "string",
      enum: ["screen", "hiring_manager", "interview_loop", "offer"],
    },
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
        required: ["category", "question", "answer_plan"],
        properties: {
          category: { type: "string" },
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
        required: ["category", "question"],
        properties: {
          category: { type: "string" },
          question: { type: "string" },
        },
      },
    },
    interviewer_insights: { type: ["string", "null"] },
  },
} as const

export async function generatePrep(input: PrepInput): Promise<PrepOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing from environment")
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const userPrompt = buildUserPrompt(input)
  const model = input.tier === "deep" ? DEEP_PREP_MODEL : QUICK_PREP_MODEL
  const maxTokens = input.tier === "deep" ? DEEP_MAX_TOKENS : QUICK_MAX_TOKENS

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature: 0.4,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // ephemeral cache lasts ~5 min — pays off across regenerations of
        // the same job within a session.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
    tools: [
      {
        name: "submit_prep",
        description:
          "Submit the structured interview prep output. Always use this tool for the response.",
        // Anthropic's input_schema accepts standard JSON Schema; we reuse
        // the same shape we used with OpenAI.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input_schema: PREP_OUTPUT_TOOL_SCHEMA as any,
      },
    ],
    tool_choice: { type: "tool", name: "submit_prep" },
  })

  const toolUse = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === "tool_use" && block.name === "submit_prep"
  )
  if (!toolUse) {
    throw new Error("Anthropic did not return a submit_prep tool call")
  }

  const result = prepOutputSchema.safeParse(toolUse.input)
  if (!result.success) {
    throw new Error(
      `Anthropic prep output failed schema validation: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    )
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

  return [
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
    "",
    "[LATEST MESSAGE]",
    message ?? "(not provided)",
    "",
    "[ADDITIONAL CONTEXT]",
    note ?? "(not provided)",
    "",
    `Generate ${input.tier} prep. Call the submit_prep tool with the structured output.`,
  ].join("\n")
}

function truncate(text: string | null, cap: number): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (trimmed.length === 0) return null
  return trimmed.length > cap ? trimmed.slice(0, cap) : trimmed
}

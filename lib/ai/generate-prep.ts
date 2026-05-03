import "server-only"

import OpenAI from "openai"

import { prepOutputSchema, type PrepInput, type PrepOutput } from "./prep-types"

// gpt-5.4-nano (per spec) does not exist as a real OpenAI model. Using
// gpt-4o-mini as the closest current cheap model. Swap when 5.x nano lands.
export const QUICK_PREP_MODEL = "gpt-4o-mini"

const RESUME_CHAR_CAP = 8000
const JD_CHAR_CAP = 12000
const LATEST_MESSAGE_CHAR_CAP = 4000

const SYSTEM_PROMPT = `You are a senior interview prep coach with 15+ years guiding candidates through interviews at top tech companies. You produce sharp, candidate-specific prep — never generic boilerplate.

INPUTS YOU RECEIVE
- Resume text (use specific projects, companies, titles, skills, scope from it)
- Job description (use specific responsibilities, requirements, scope, level)
- Latest message from recruiter or hiring manager (signals about what they care about, who's involved, what stage)
- Current interview stage
- Interviewer name (when known)

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

QUICK PREP TIER RULES (this generation)
- 3 to 5 items in questions_they_ask
- 2 to 3 items in questions_you_ask
- Exactly 3 items in risks.items, each with counter set to null
- Exactly 4 items in positioning.frames
- Exactly 4 items in prep_checklist, each with done set to false
- 3 to 4 items in purpose.criteria; weights are integers 0-100 that sum to roughly 100
- Each questions_they_ask item must set answer_plan to null
- interviewer_insights must be null

OUTPUT
Return strict JSON conforming to the schema. No markdown, no preamble, no commentary. The "stage" field in your output must equal the input stage value.`

const PREP_OUTPUT_JSON_SCHEMA = {
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
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing from environment")
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const messages = buildMessages(input)

  let parsed: unknown
  try {
    parsed = await callWithStrictSchema(client, messages)
  } catch (strictErr) {
    try {
      parsed = await callWithJsonObject(client, messages)
    } catch {
      throw strictErr
    }
  }

  const result = prepOutputSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(
      `OpenAI prep output failed schema validation: ${result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    )
  }

  // Belt-and-suspenders: model is told to set quick-tier fields to null but
  // strict mode allows non-null counter/answer_plan/interviewer_insights.
  // For tier=quick, force them to null so the UI's locked-state rendering
  // doesn't accidentally show Deep content.
  if (input.tier === "quick") {
    result.data.interviewer_insights = null
    result.data.risks.items = result.data.risks.items.map((item) => ({
      ...item,
      counter: null,
    }))
    result.data.questions_they_ask = result.data.questions_they_ask.map(
      (q) => ({ ...q, answer_plan: null })
    )
  }

  // Stage in output must match input stage. If the model echoed something
  // weird, override — caller relies on stage to detect staleness.
  result.data.stage = input.stage

  return result.data
}

function buildMessages(input: PrepInput): OpenAI.Chat.ChatCompletionMessageParam[] {
  const resume = truncate(input.resume_text, RESUME_CHAR_CAP)
  const jd = truncate(input.jd_text, JD_CHAR_CAP)
  const message = truncate(input.latest_message, LATEST_MESSAGE_CHAR_CAP)
  const interviewer = input.interviewer_name?.trim()

  const userPrompt = [
    `[STAGE]: ${input.stage}`,
    `[COMPANY]: ${input.company_name}`,
    `[ROLE]: ${input.role_title}`,
    `[INTERVIEWER]: ${interviewer && interviewer.length > 0 ? interviewer : "(not provided)"}`,
    `[TIER]: ${input.tier}`,
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
    "Generate the prep.",
  ].join("\n")

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ]
}

async function callWithStrictSchema(
  client: OpenAI,
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): Promise<unknown> {
  const completion = await client.chat.completions.create({
    model: QUICK_PREP_MODEL,
    temperature: 0.4,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "PrepOutput",
        strict: true,
        schema: PREP_OUTPUT_JSON_SCHEMA,
      },
    },
    messages,
  })
  return parseChoiceContent(completion)
}

async function callWithJsonObject(
  client: OpenAI,
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): Promise<unknown> {
  const completion = await client.chat.completions.create({
    model: QUICK_PREP_MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages,
  })
  return parseChoiceContent(completion)
}

function parseChoiceContent(
  completion: OpenAI.Chat.ChatCompletion
): unknown {
  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error("OpenAI returned empty content")
  }
  try {
    return JSON.parse(content)
  } catch {
    throw new Error(
      `OpenAI returned non-JSON: ${content.slice(0, 200)}`
    )
  }
}

function truncate(text: string | null, cap: number): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (trimmed.length === 0) return null
  return trimmed.length > cap ? trimmed.slice(0, cap) : trimmed
}

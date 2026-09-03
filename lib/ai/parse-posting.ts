import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

import { MAX_POSTING_CHARS } from "@/lib/jobLink"

// Parses raw job-posting text into structured fields. This is the first-job
// takeover's paste path, and it is separate from lib/ai/extract-jd.ts on
// purpose: that one is the Add Job modal's gpt-4o-mini three-field extractor
// and stays as it is. This one runs the model and field set the link-parse
// spike validated (~/spikes/job-link-parse/results.md), which got 21/21 parses
// correct at about $0.0086 each.
//
// The spike's other shipping requirement was "pin the output schema": with a
// free-form prompt, the requirements list came back under three different key
// names across 21 calls. Hence the forced tool call below.
export const PARSE_POSTING_MODEL = "claude-sonnet-5"

const MAX_TOKENS = 1500
const TIMEOUT_MS = 45_000

export const parsedPostingSchema = z.object({
  company: z.string().nullable(),
  role_title: z.string().nullable(),
  location: z.string().nullable(),
  employment_type: z.string().nullable(),
  requirements: z.array(z.string()).max(12),
})

export type ParsedPosting = z.infer<typeof parsedPostingSchema>

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    company: {
      type: ["string", "null"],
      description:
        "Exact name of the hiring company as it appears in the posting. Never invent, pluralize, or add suffixes. Null if not stated.",
    },
    role_title: {
      type: ["string", "null"],
      description:
        "The job title as written, with parenthetical location or remote tags stripped. Null if not stated.",
    },
    location: {
      type: ["string", "null"],
      description:
        "Location as written. Join multiple locations with a comma. Null if not stated.",
    },
    employment_type: {
      type: ["string", "null"],
      description:
        "For example Full-time, Part-time, Contract, Internship. Null if not stated.",
    },
    requirements: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
      description:
        "Up to eight requirements, each quoted or closely paraphrased from the posting. Empty array if the posting lists none.",
    },
  },
  required: [
    "company",
    "role_title",
    "location",
    "employment_type",
    "requirements",
  ],
  additionalProperties: false,
} as const

const SYSTEM_PROMPT = `You extract structured fields from the text of a single job posting.

Rules:
- Use only what the posting says. Never invent or infer a value that is not present.
- If a field is not present, return null for it. A missing value is always better than a guessed one.
- Company means the hiring employer, not the applicant tracking system or job board hosting the page.
- If the text is a listing of many jobs rather than one posting, return null for company and role_title.
- Always respond with the submit_posting tool.`

export class PostingParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PostingParseError"
  }
}

export async function parsePosting(rawText: string): Promise<ParsedPosting> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing from environment")
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const trimmed = rawText.slice(0, MAX_POSTING_CHARS)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Anthropic.Messages.Message
  try {
    response = await client.messages.create(
      {
        model: PARSE_POSTING_MODEL,
        max_tokens: MAX_TOKENS,
        // No temperature: claude-sonnet-5 rejects the parameter outright
        // ("`temperature` is deprecated for this model"), which failed every
        // call until it was removed. The forced tool call is what pins the
        // output shape here, not sampling temperature.
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: trimmed }],
        tools: [
          {
            name: "submit_posting",
            description:
              "Submit the structured fields extracted from the job posting.",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            input_schema: TOOL_SCHEMA as any,
          },
        ],
        tool_choice: { type: "tool", name: "submit_posting" },
      },
      { signal: controller.signal }
    )
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) {
      throw new PostingParseError("Parse timed out")
    }
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error(
        "Server config error. Check ANTHROPIC_API_KEY in .env.local and restart dev server."
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === "tool_use" && block.name === "submit_posting"
  )
  if (!toolUse) {
    throw new PostingParseError("Model did not return a submit_posting call")
  }

  const result = parsedPostingSchema.safeParse(toolUse.input)
  if (!result.success) {
    throw new PostingParseError(
      result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    )
  }

  const coerce = (v: string | null): string | null => {
    const t = v?.trim()
    return t && t.length > 0 ? t : null
  }

  return {
    company: coerce(result.data.company),
    role_title: coerce(result.data.role_title),
    location: coerce(result.data.location),
    employment_type: coerce(result.data.employment_type),
    requirements: result.data.requirements
      .map((r) => r.trim())
      .filter((r) => r.length > 0)
      .slice(0, 8),
  }
}

import "server-only"

import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

import { QUICK_PREP_MODEL } from "./models"
import {
  PREP_SESSION_ROLES,
  type FullLoopSessionConfig,
  type PrepSessionRole,
} from "./prep-types"

// Phase 4f: Haiku-backed parser that reads recruiter context and identifies
// which of the four standard interview round types are present in this loop.
// Output is mapped to a FullLoopSessionConfig and persisted on the job by
// parseFullLoopRoundsAction. Trigger wiring (when this fires automatically)
// lives in prompt 3.

const JD_CHAR_CAP = 2000
const LATEST_MESSAGE_CHAR_CAP = 4000
const PARSER_MAX_TOKENS = 2048
const PARSER_TIMEOUT_MS = 60_000

// Mirrors components/app/widgets/session-tabs.tsx ROLE_LABELS exactly.
// Hoisting that const into prep-types is a follow-up; duplicating here is
// the smaller change.
const ROLE_LABELS: Record<PrepSessionRole, string> = {
  hiring_manager: "Hiring Manager",
  cross_functional: "Cross-functional",
  skills_portfolio: "Skills/Portfolio",
  bar_raiser: "Bar Raiser",
}

const SYSTEM_PROMPT = `You read a recruiter or hiring-team message and a job description, and identify which of four standard interview round types are present in this Full Loop.

ROUND TAXONOMY
- hiring_manager: leadership and team-fit conversation, usually a 1:1 with the hiring manager.
- cross_functional: peer or stakeholder round with PM, engineering, design, or data partners.
- skills_portfolio: technical or craft round (system design, coding, portfolio walkthrough, take-home review).
- bar_raiser: senior interviewer probing vision, judgment, and calibration on the company bar. UNCOMMON outside Amazon-influenced loops; do NOT assume present.

RULES
1. Only emit a role in detected_rounds if it is clearly evidenced in the message OR strongly implied by the JD. Do not pad.
2. For each detected role, extract a contextualized label that fits the role and the company/team (e.g., "Engineering Hiring Manager", "Design Bar Raiser", "Cross-functional Partner Round").
3. Roles not detected go in missing_roles.
4. Rounds that are described but do NOT map to any of the 4 standard roles go in extra_rounds (one short string each, do not lose them).
5. Multiple detected rounds may share the same role; emit each separately. The downstream mapper picks the highest-confidence entry for that role.
6. confidence is 0.0 to 1.0 per detected round. overall_confidence reflects the strength of the entire parse.

OUTPUT
Use the parse_rounds tool. No prose response.`

const PARSER_TOOL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "detected_rounds",
    "missing_roles",
    "extra_rounds",
    "overall_confidence",
  ],
  properties: {
    detected_rounds: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "label", "confidence"],
        properties: {
          role: { type: "string", enum: [...PREP_SESSION_ROLES] },
          label: { type: "string", minLength: 1 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
    missing_roles: {
      type: "array",
      items: { type: "string", enum: [...PREP_SESSION_ROLES] },
    },
    extra_rounds: {
      type: "array",
      items: { type: "string" },
    },
    overall_confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
    },
  },
} as const

const parserOutputSchema = z.object({
  detected_rounds: z.array(
    z.object({
      role: z.enum(PREP_SESSION_ROLES),
      label: z.string().min(1),
      confidence: z.number().min(0).max(1),
    })
  ),
  missing_roles: z.array(z.enum(PREP_SESSION_ROLES)),
  extra_rounds: z.array(z.string()),
  overall_confidence: z.enum(["high", "medium", "low"]),
})

export type ParserOutput = z.infer<typeof parserOutputSchema>

export type ParseFullLoopRoundsInput = {
  latest_message: string | null
  jd_text: string | null
  interviewer_name: string | null
}

export type ParseFullLoopRoundsResult = {
  config: FullLoopSessionConfig
  raw: ParserOutput
}

export class ParserTimeoutError extends Error {
  constructor() {
    super("Parse timed out, please try again.")
    this.name = "ParserTimeoutError"
  }
}

export async function parseFullLoopRounds(
  input: ParseFullLoopRoundsInput
): Promise<ParseFullLoopRoundsResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is missing from environment")
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PARSER_TIMEOUT_MS)

  let response: Anthropic.Messages.Message
  try {
    response = await client.messages.create(
      {
        model: QUICK_PREP_MODEL,
        max_tokens: PARSER_MAX_TOKENS,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(input) }],
        tools: [
          {
            name: "parse_rounds",
            description:
              "Submit the structured Full Loop round parse. Always use this tool for the response.",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            input_schema: PARSER_TOOL_SCHEMA as any,
          },
        ],
        tool_choice: { type: "tool", name: "parse_rounds" },
      },
      { signal: controller.signal }
    )
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) {
      throw new ParserTimeoutError()
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

  const toolUse = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === "tool_use" && block.name === "parse_rounds"
  )
  if (!toolUse) {
    throw new Error("Anthropic did not return a parse_rounds tool call")
  }

  const result = parserOutputSchema.safeParse(toolUse.input)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
    throw new Error(`Parser output failed schema validation: ${issues}`)
  }

  return {
    config: mapParserOutputToConfig(result.data),
    raw: result.data,
  }
}

// Multiple detected rounds for the same role: highest confidence wins. The
// other entries are dropped here but stay accessible via the raw output for
// future surfacing (e.g., listing extra session rounds in the UI).
function mapParserOutputToConfig(
  output: ParserOutput
): FullLoopSessionConfig {
  const detectedByRole = new Map<
    PrepSessionRole,
    { label: string; confidence: number }
  >()
  for (const r of output.detected_rounds) {
    const existing = detectedByRole.get(r.role)
    if (!existing || r.confidence > existing.confidence) {
      detectedByRole.set(r.role, { label: r.label, confidence: r.confidence })
    }
  }

  const missingSet = new Set<PrepSessionRole>(output.missing_roles)

  const result = {} as FullLoopSessionConfig
  for (const role of PREP_SESSION_ROLES) {
    const detected = detectedByRole.get(role)
    if (detected) {
      result[role] = {
        enabled: true,
        label: detected.label,
        source: "parsed",
      }
      continue
    }
    if (missingSet.has(role)) {
      result[role] = {
        enabled: false,
        label: ROLE_LABELS[role],
        source: "parsed",
      }
      continue
    }
    // Parser didn't list this role in either bucket — unexpected. Default
    // to enabled with the canonical label so the UI keeps working.
    // eslint-disable-next-line no-console
    console.warn(
      `[parseFullLoopRounds] role ${role} appeared in neither detected nor missing; defaulting to enabled`
    )
    result[role] = {
      enabled: true,
      label: ROLE_LABELS[role],
      source: "parsed",
    }
  }
  return result
}

function buildUserPrompt(input: ParseFullLoopRoundsInput): string {
  const message =
    truncate(input.latest_message, LATEST_MESSAGE_CHAR_CAP) ??
    "No message provided"
  const jd = truncate(input.jd_text, JD_CHAR_CAP) ?? "No JD provided"
  const interviewerName = input.interviewer_name?.trim()
  const interviewer =
    interviewerName && interviewerName.length > 0
      ? interviewerName
      : "(not provided)"

  return [
    "[LATEST_MESSAGE]",
    message,
    "",
    "[JD]",
    jd,
    "",
    "[INTERVIEWER]",
    interviewer,
    "",
    "Use the parse_rounds tool to return the structured rounds.",
  ].join("\n")
}

function truncate(text: string | null, cap: number): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (trimmed.length === 0) return null
  return trimmed.length > cap ? trimmed.slice(0, cap) : trimmed
}

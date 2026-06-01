// AI fallback for the Job Source Advisor. Used only when a role title does
// not match any curated seed in boardRatings.ts. Uses the Quick Prep model
// (Haiku) via the existing Anthropic client for a cheap, bounded call.
//
// Returns null on any failure so the caller can fall back to GENERIC_BOARDS.
// Never throws to the caller.

import Anthropic from "@anthropic-ai/sdk"

import { QUICK_PREP_MODEL } from "@/lib/ai/models"
import type { BoardRating } from "./boardRatings"

const SYSTEM_PROMPT = `You are a job search advisor. Given a role title, rank the best places to find that role: major job boards, niche role-specific boards, and company career pages. Score each from 1 to 10 where 10 means highest quality and volume of relevant openings for that role. Give a single short reason per board (under 12 words). Return 6 to 8 entries. Never use em dashes in any reason; use commas or periods.`

const TOOL_SCHEMA = {
  type: "object",
  properties: {
    boards: {
      type: "array",
      minItems: 6,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          board: { type: "string", description: "Job board or channel name" },
          score: { type: "integer", minimum: 1, maximum: 10 },
          reason: { type: "string", description: "One short reason, no em dashes" },
        },
        required: ["board", "score", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["boards"],
  additionalProperties: false,
}

const TIMEOUT_MS = 30_000

function sanitizeReason(reason: string): string {
  // Strip any em dash (U+2014) the model emits despite the instruction.
  return reason.split(String.fromCharCode(0x2014)).join(",").trim()
}

export async function generateBoardMap(
  roleTitle: string
): Promise<BoardRating[] | null> {
  const trimmed = roleTitle.trim()
  if (!trimmed) return null

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const client = new Anthropic({ apiKey })
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await client.messages.create(
      {
        model: QUICK_PREP_MODEL,
        max_tokens: 900,
        temperature: 0.3,
        system: [{ type: "text", text: SYSTEM_PROMPT }],
        messages: [
          {
            role: "user",
            content: `Role title: ${trimmed}\n\nRank the best boards and channels to find this role.`,
          },
        ],
        tools: [
          {
            name: "submit_board_map",
            description:
              "Submit the ranked list of job boards. Always use this tool for the response.",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            input_schema: TOOL_SCHEMA as any,
          },
        ],
        tool_choice: { type: "tool", name: "submit_board_map" },
      },
      { signal: controller.signal }
    )

    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === "tool_use" && block.name === "submit_board_map"
    )
    if (!toolUse) return null

    const raw = toolUse.input as { boards?: unknown }
    if (!raw || !Array.isArray(raw.boards)) return null

    const boards: BoardRating[] = []
    for (const entry of raw.boards) {
      if (!entry || typeof entry !== "object") continue
      const e = entry as { board?: unknown; score?: unknown; reason?: unknown }
      if (typeof e.board !== "string" || typeof e.reason !== "string") continue
      const scoreNum = typeof e.score === "number" ? e.score : Number(e.score)
      if (!Number.isFinite(scoreNum)) continue
      const score = Math.max(1, Math.min(10, Math.round(scoreNum)))
      boards.push({ board: e.board.trim(), score, reason: sanitizeReason(e.reason) })
    }

    if (boards.length === 0) return null

    boards.sort((a, b) => b.score - a.score)
    return boards.slice(0, 8)
  } catch {
    // Timeout, auth, network, or parse error: caller falls back to generic.
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

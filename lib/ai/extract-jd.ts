import OpenAI from "openai"
import { z } from "zod"

export const extractedJobSchema = z.object({
  company_name: z.string().nullable(),
  role_title: z.string().nullable(),
  tc: z.string().nullable(),
})

export type ExtractedJob = z.infer<typeof extractedJobSchema>

const SYSTEM_PROMPT = `You extract structured fields from job posting text. Return JSON with exactly these keys: company_name, role_title, tc.

- company_name: the EXACT name of the hiring company as it appears in the post (e.g. "Microsoft", "Stripe", "Acme Inc"). Do not invent variations, add suffixes, pluralize, or modify the name in any way. "Microsoft" stays "Microsoft" — never "Microsofter", "Microsofts", "Microsoft Corp" unless those exact strings appear in the source. Strip only obvious trailing marketing text ("Acme - We're hiring!" -> "Acme"). If the company name is unclear or not stated, return null.
- role_title: the role/job title as written (e.g. "Senior Product Designer", "Staff Software Engineer"). Strip parenthetical location/remote tags ("Senior Product Designer (Remote)" -> "Senior Product Designer"). If multiple roles are mentioned, pick the primary one being hired for in this post. If no clear title, return null.
- tc: total compensation as written (e.g. "$180k-$220k", "180k base + equity", "$200,000 - $250,000"). Return null if no compensation is stated.

Rules:
- Do not invent or alter values. Return values exactly as they appear in the source.
- When in doubt, return null. Hallucinated values are worse than missing ones.
- Return raw JSON only, no commentary, no markdown fences.`

export async function extractJobFields(rawText: string): Promise<ExtractedJob> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing from environment")
  }

  const trimmed = rawText.slice(0, 12000)
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: trimmed },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error("OpenAI returned empty content")
  }

  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch {
    throw new Error(`OpenAI returned non-JSON: ${content.slice(0, 200)}`)
  }

  if (typeof raw !== "object" || raw === null) {
    throw new Error(`OpenAI returned non-object JSON: ${content.slice(0, 200)}`)
  }

  const obj = raw as Record<string, unknown>
  const coerce = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v.trim() : null

  return extractedJobSchema.parse({
    company_name: coerce(obj.company_name),
    role_title: coerce(obj.role_title),
    tc: coerce(obj.tc),
  })
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

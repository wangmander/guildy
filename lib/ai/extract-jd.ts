import OpenAI from "openai"
import { z } from "zod"

export const extractedJobSchema = z.object({
  company_name: z.string().nullable(),
  role_title: z.string().nullable(),
  tc: z.string().nullable(),
})

export type ExtractedJob = z.infer<typeof extractedJobSchema>

const SYSTEM_PROMPT = `You extract structured fields from job posting text.

Return JSON with exactly these keys: company_name, role_title, tc.
- company_name: the hiring company. Null if not stated.
- role_title: the job title. Null if not stated.
- tc: total compensation as written (e.g. "$180k-$220k", "180k base + equity"). Null if not stated.

Rules:
- Do not invent values. If a field is not clearly stated, return null.
- Strip marketing fluff from role_title. "Senior Product Designer (Remote)" -> "Senior Product Designer".
- Strip marketing fluff from company_name. "Acme Inc - We're hiring!" -> "Acme".
- Return raw JSON only, no commentary.`

export async function extractJobFields(rawText: string): Promise<ExtractedJob> {
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

  const content = completion.choices[0]?.message?.content ?? "{}"
  const parsed = JSON.parse(content)
  return extractedJobSchema.parse({
    company_name: parsed.company_name ?? null,
    role_title: parsed.role_title ?? null,
    tc: parsed.tc ?? null,
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

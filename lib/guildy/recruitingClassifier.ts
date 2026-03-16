// ============================================================
// Guildy Gmail Detection V3 — gpt-4o-mini Recruiting Classifier
// Responsible ONLY for: is_recruiting + stage_delta (fast, cheap)
// Rich prep generation (gpt-4o) stays in the sync route.
// ============================================================

import OpenAI from "openai"
import type { EmailSignal, RecruitingAnalysisResult } from "./types"
import { safeJsonParse } from "./normalizers"

const LLM_CALL_TIMEOUT_MS = 8_000

// System prompt — returns minimal JSON, no prep content
const CLASSIFIER_SYSTEM_PROMPT = `You are Guildy's recruiting email classifier.

Analyze ONE Gmail message and return ONLY valid JSON with this exact schema:
{
  "is_recruiting_thread_related": boolean,
  "confidence": number,
  "company_name": string|null,
  "job_title": string|null,
  "message_type": "recruiter_outreach"|"application_confirmation"|"scheduling"|"interview_invite"|"interview_followup"|"rejection"|"offer"|"assessment"|"thread_reply"|"non_recruiting",
  "current_stage": "applied"|"screen"|"hm_screen"|"technical"|"onsite"|"offer"|"rejected"|"withdrawn"|"other",
  "stage_delta": "none"|"applied"|"screen"|"hm_screen"|"technical"|"onsite"|"offer"|"rejected"|"withdrawn",
  "summary": string
}

COMPANY NAME RULES — CRITICAL:
- Extract the HIRING COMPANY name, never the ATS/vendor platform name.
- If sender is greenhouse.io, lever.co, goodtime.io, ashbyhq.com, etc., look IN THE BODY for the actual company. "Your interview at Stripe" → company_name = "Stripe".
- NEVER return these as company names: "Unknown", "HR Team", "Talent Acquisition", "Recruiting", "Greenhouse", "Lever", "Goodtime", "Ashby", "Workday", "HireVue".
- If you genuinely cannot determine the company, return company_name = null.

Rules:
- is_recruiting_thread_related=true for: recruiter outreach, ATS application confirmations, interview scheduling, interview invites, follow-ups, rejections, offers, coding assessments, and short thread replies clearly belonging to a recruiting process.
- ATS/vendor emails (Greenhouse, Lever, Ashby, Workday, GoodTime, HireVue, ICIMS, SmartRecruiters, Jobvite, Taleo) count as recruiting-related when content is job-process related.
- Application confirmation emails ("Thanks for applying", "We received your application") ARE recruiting-related: set is_recruiting_thread_related=true, message_type="application_confirmation", stage_delta="applied".
- Rejection emails: set is_recruiting_thread_related=true, current_stage="rejected", stage_delta="rejected", message_type="rejection".
- Short CANDIDATE replies ("Tuesday works", "Thanks, confirmed", "See you then") set message_type="thread_reply", stage_delta="none".
- RECRUITER/COMPANY emails that invite, schedule, or advance the candidate MUST set a stage_delta:
  • Recruiter screen / phone screen / intro call → stage_delta="screen"
  • Hiring manager interview / manager screen / meet-the-manager → stage_delta="hm_screen"
  • Technical interview / coding challenge / take-home / system design → stage_delta="technical"
  • Onsite / panel / final round / loop / super day → stage_delta="onsite"
  • Offer letter / verbal offer / compensation → stage_delta="offer"
  • Rejection / not moving forward → stage_delta="rejected"
- If known_thread=true, treat the email as recruiting unless clearly unrelated.
- current_stage reflects the stage this email represents, even if stage_delta="none".
- confidence: 0.9-1.0 for unambiguous, 0.6-0.8 for probable, 0.3-0.5 for uncertain.
- For non-recruiting: set is_recruiting_thread_related=false, message_type="non_recruiting", current_stage="other", stage_delta="none".
- Return ONLY JSON. No markdown. No commentary.`

function buildClassifierInput(signal: EmailSignal, opts: { knownThread: boolean }) {
  return {
    known_thread: opts.knownThread,
    email: {
      subject: signal.subject,
      from: signal.from,
      snippet: signal.snippet,
      // Cap body for speed — classifier doesn't need full text
      body_text: signal.bodyText.slice(0, 2500),
    },
  }
}

export async function analyzeRecruitingEmailWithLLM(
  signal: EmailSignal,
  opts: { knownThread: boolean },
  openai: OpenAI
): Promise<RecruitingAnalysisResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LLM_CALL_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 350,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(buildClassifierInput(signal, opts)) },
        ],
      },
      { signal: controller.signal }
    )

    clearTimeout(timeout)

    const content = response.choices?.[0]?.message?.content || ""
    const parsed = safeJsonParse<any>(content)

    if (!parsed) {
      throw new Error(`Classifier JSON parse failed: ${content.slice(0, 200)}`)
    }

    return {
      is_recruiting_thread_related: parsed.is_recruiting_thread_related === true,
      confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      company_name: parsed.company_name ?? null,
      job_title: parsed.job_title ?? null,
      message_type: parsed.message_type ?? "non_recruiting",
      current_stage: parsed.current_stage ?? "other",
      stage_delta: parsed.stage_delta ?? "none",
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    }
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === "AbortError") {
      throw new Error("Classifier timeout after 8s")
    }
    throw err
  }
}

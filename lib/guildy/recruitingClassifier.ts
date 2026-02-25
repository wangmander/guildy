// ============================================================
// Guildy Gmail Detection V2 — gpt-4o-mini Recruiting Classifier
// Responsible ONLY for: is_recruiting + stage_delta (fast, cheap)
// Rich prep generation (gpt-4o) stays in the sync route.
// ============================================================

import OpenAI from "openai"
import type { EmailSignal, RecruitingAnalysisResult } from "./types"
import { safeJsonParse } from "./normalizers"

// System prompt — returns minimal JSON, no prep content
const RECRUITING_ANALYSIS_SYSTEM_PROMPT = `You are Guildy's recruiting email classifier.

Analyze ONE Gmail message and return ONLY valid JSON with this exact schema:
{
  "is_recruiting_thread_related": boolean,
  "confidence": number,
  "company_name": string|null,
  "job_title": string|null,
  "message_type": "recruiter_outreach"|"application_confirmation"|"scheduling"|"interview_invite"|"interview_followup"|"rejection"|"offer"|"assessment"|"thread_reply"|"non_recruiting",
  "current_stage": "applied"|"screen"|"technical"|"onsite"|"offer"|"rejected"|"withdrawn"|"other",
  "stage_delta": "none"|"applied"|"screen"|"technical"|"onsite"|"offer"|"rejected"|"withdrawn",
  "summary": string
}

Rules:
- is_recruiting_thread_related=true for: recruiter outreach, ATS application confirmations, interview scheduling, interview invites, follow-ups, rejections, offers, coding assessments, and short thread replies clearly belonging to a recruiting process.
- ATS/vendor emails (Greenhouse, Lever, Ashby, Workday, GoodTime, HireVue, ICIMS, SmartRecruiters, Jobvite, Taleo) count as recruiting-related when content is job-process related.
- Application confirmation emails ("Thanks for applying", "We received your application") ARE recruiting-related: set is_recruiting_thread_related=true, message_type="application_confirmation", stage_delta="applied".
- Rejection emails: set is_recruiting_thread_related=true, current_stage="rejected", stage_delta="rejected", message_type="rejection".
- Short CANDIDATE replies ("Tuesday works", "Thanks, confirmed", "See you then", "Sounds great") set message_type="thread_reply", stage_delta="none". These are confirmations FROM the candidate, not stage advances.
- RECRUITER/COMPANY emails that invite, schedule, or advance the candidate MUST set a stage_delta. Do not return "none" for these:
  • Any scheduling or interview invite from the company/recruiter → use the most appropriate stage (screen, technical, onsite).
  • "We'd like to move forward", "advance to the next round/stage", "next steps" → set stage_delta to the most logical next stage.
  • Coding assessment or take-home invite → stage_delta="technical".
  • Hiring manager or panel interview invite → stage_delta="screen" (for HM screen) or "onsite" (for panel/loop).
  • Offer letter or verbal offer → stage_delta="offer".
- If known_thread=true, treat the email as recruiting unless clearly unrelated (e.g. forwarded newsletter).
- current_stage reflects the stage this email represents, even if stage_delta="none" (e.g. a candidate reply mid-technical-stage should have current_stage="technical").
- confidence: 0.9-1.0 for unambiguous signals, 0.6-0.8 for probable, 0.3-0.5 for uncertain.
- For non-recruiting: set is_recruiting_thread_related=false, message_type="non_recruiting", current_stage="other", stage_delta="none".
- Return ONLY JSON. No markdown. No commentary.`

export async function analyzeRecruitingEmailWithLLM(
  signal: EmailSignal,
  context: {
    knownThread: boolean
    existingCompanyName?: string | null
    existingJobTitle?: string | null
  },
  openai: OpenAI
): Promise<RecruitingAnalysisResult | null> {
  const inputPayload = {
    known_thread: context.knownThread,
    existing_company_name: context.existingCompanyName ?? null,
    existing_job_title: context.existingJobTitle ?? null,
    email: {
      subject: signal.subject,
      from: signal.from,
      snippet: signal.snippet,
      // Cap body for speed — classifier doesn't need full text
      body_text: signal.bodyText.slice(0, 2500),
    },
  }

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: RECRUITING_ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(inputPayload) },
      ],
    })

    const content = res.choices?.[0]?.message?.content || ""
    const parsed = safeJsonParse<any>(content)

    if (!parsed) {
      console.error("[CLASSIFIER] JSON parse failed:", content.slice(0, 200))
      return null
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
  } catch (err) {
    console.error("[CLASSIFIER] OpenAI error:", err)
    return null
  }
}

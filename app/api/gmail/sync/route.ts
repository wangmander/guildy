import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { google } from "googleapis"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

/**
 * DO NOT REMOVE PHRASES.
 * This list = ALL phrases you provided + extra (only additions).
 * We use WEIGHTED scoring so trash doesn't pass.
 */
const PHRASE_WEIGHTS: Array<{ phrase: string; w: number }> = [
  // 1) High-signal interview scheduling phrases (VERY HIGH)
  { phrase: "interview", w: 6 },
  { phrase: "interview request", w: 10 },
  { phrase: "interview invitation", w: 10 },
  { phrase: "invite you to interview", w: 10 },
  { phrase: "interview scheduling", w: 9 },
  { phrase: "schedule an interview", w: 10 },
  { phrase: "book an interview", w: 9 },
  { phrase: "interview availability", w: 8 },
  { phrase: "interview time", w: 8 },
  { phrase: "interview slot", w: 9 },
  { phrase: "interview confirmation", w: 10 },
  { phrase: "confirmed interview", w: 10 },
  { phrase: "reschedule interview", w: 10 },
  { phrase: "interview rescheduled", w: 10 },
  { phrase: "interview calendar", w: 8 },
  { phrase: "calendar invite", w: 8 },
  { phrase: "zoom interview", w: 9 },
  { phrase: "google meet interview", w: 9 },
  { phrase: "teams interview", w: 9 },
  { phrase: "phone interview", w: 9 },
  { phrase: "video interview", w: 9 },
  { phrase: "onsite interview", w: 9 },
  { phrase: "on-site interview", w: 9 },

  // 2) Recruiter / hiring-pipeline phrases (HIGH)
  { phrase: "recruiter", w: 7 },
  { phrase: "talent team", w: 7 },
  { phrase: "talent acquisition", w: 7 },
  { phrase: "hiring team", w: 7 },
  { phrase: "hiring manager", w: 7 },
  { phrase: "people team", w: 6 },
  { phrase: "people operations", w: 6 },
  { phrase: "hr team", w: 6 },
  { phrase: "human resources", w: 6 },
  { phrase: "staffing", w: 6 },
  { phrase: "we would like to move forward", w: 9 },
  { phrase: "next step", w: 7 },
  { phrase: "next round", w: 8 },
  { phrase: "moving you forward", w: 9 },
  { phrase: "advance to the next stage", w: 9 },

  // 3) Interview stage / round indicators (HIGH)
  { phrase: "first round", w: 8 },
  { phrase: "second round", w: 8 },
  { phrase: "final round", w: 9 },
  { phrase: "technical interview", w: 9 },
  { phrase: "behavioral interview", w: 8 },
  { phrase: "case interview", w: 8 },
  { phrase: "panel interview", w: 8 },
  { phrase: "loop interview", w: 9 },
  { phrase: "interview loop", w: 9 },
  { phrase: "onsite loop", w: 9 },
  { phrase: "screening interview", w: 9 },
  { phrase: "phone screen", w: 9 },
  { phrase: "initial screen", w: 8 },
  { phrase: "coding interview", w: 9 },
  { phrase: "system design interview", w: 9 },
  { phrase: "take-home interview", w: 8 },
  { phrase: "assignment interview", w: 8 },
  { phrase: "assessment interview", w: 8 },

  // 4) Application + interview transition phrases (MED/HIGH)
  { phrase: "application status", w: 6 },
  { phrase: "application update", w: 6 },
  { phrase: "thank you for applying", w: 6 },
  { phrase: "reviewed your application", w: 7 },
  { phrase: "we reviewed your background", w: 7 },
  { phrase: "we reviewed your resume", w: 7 },
  { phrase: "shortlisted", w: 8 },
  { phrase: "selected to move forward", w: 9 },
  { phrase: "moving ahead with your application", w: 9 },
  { phrase: "we’d like to learn more about you", w: 8 },
  { phrase: "we'd like to learn more about you", w: 8 },

  // 5) Offer-stage & post-interview signals (HIGH)
  { phrase: "offer", w: 6 },
  { phrase: "job offer", w: 9 },
  { phrase: "verbal offer", w: 9 },
  { phrase: "written offer", w: 9 },
  { phrase: "offer letter", w: 9 },
  { phrase: "compensation", w: 7 },
  { phrase: "salary", w: 6 },
  { phrase: "equity", w: 7 },
  { phrase: "benefits", w: 6 },
  { phrase: "background check", w: 8 },
  { phrase: "reference check", w: 8 },
  { phrase: "references", w: 7 },
  { phrase: "start date", w: 7 },

  // 6) Rejection / closure phrases (HIGH — still belongs in pipeline)
  { phrase: "we will not be moving forward", w: 9 },
  { phrase: "decided to move forward with other candidates", w: 9 },
  { phrase: "regret to inform you", w: 8 },
  { phrase: "unfortunately", w: 4 },
  { phrase: "position has been filled", w: 8 },
  { phrase: "keep your resume on file", w: 7 },
  { phrase: "future opportunities", w: 6 },

  // 7) Calendar & logistics keywords (LOW — helpful only with other hits)
  { phrase: "availability", w: 3 },
  { phrase: "time zone", w: 2 },
  { phrase: "pst", w: 1 },
  { phrase: "est", w: 1 },
  { phrase: "cst", w: 1 },
  { phrase: "gmt", w: 1 },
  { phrase: "30 minutes", w: 2 },
  { phrase: "45 minutes", w: 2 },
  { phrase: "60 minutes", w: 2 },
  { phrase: "calendar", w: 2 },
  { phrase: "invite attached", w: 3 },
  { phrase: "meeting link", w: 3 },
  { phrase: "dial in", w: 2 },
  { phrase: "conference link", w: 3 },

  // ===== ADDITIONS (ONLY ADDING — NOT REMOVING) =====
  { phrase: "interviewing", w: 7 },
  { phrase: "interviewer", w: 7 },
  { phrase: "recruiting", w: 6 },
  { phrase: "recruitment", w: 6 },
  { phrase: "candidate", w: 5 },
  { phrase: "application received", w: 6 },
  { phrase: "application submitted", w: 6 },
  { phrase: "thank you for your interest", w: 5 },
  { phrase: "phone screening", w: 9 },
  { phrase: "screening call", w: 8 },
  { phrase: "recruiter screen", w: 9 },
  { phrase: "hiring manager screen", w: 9 },
  { phrase: "hm interview", w: 8 },
  { phrase: "panel", w: 4 },
  { phrase: "presentation", w: 5 },
  { phrase: "case study", w: 6 },
  { phrase: "work sample", w: 7 },
  { phrase: "take home", w: 6 },
  { phrase: "take-home", w: 6 },
  { phrase: "assignment", w: 5 },
  { phrase: "assessment", w: 6 },
  { phrase: "coding challenge", w: 8 },
  { phrase: "technical challenge", w: 8 },
  { phrase: "code challenge", w: 8 },
  { phrase: "system design", w: 7 },
  { phrase: "behavioral", w: 5 },
  { phrase: "loop", w: 4 },
  { phrase: "onsite", w: 6 },
  { phrase: "on-site", w: 6 },
  { phrase: "final interview", w: 9 },
  { phrase: "offer call", w: 8 },
  { phrase: "offer discussion", w: 8 },
  { phrase: "comp discussion", w: 7 },
  { phrase: "compensation discussion", w: 7 },
  { phrase: "negotiation", w: 6 },
  { phrase: "negotiate", w: 6 },
  { phrase: "verbal", w: 2 },
  { phrase: "background screening", w: 7 },
  { phrase: "reference", w: 5 },
  { phrase: "start your role", w: 6 },
  { phrase: "welcome", w: 1 },
]

// ATS / recruiting domains (HUGE signal, but NOT hard-block)
const ATS_DOMAINS = [
  "@greenhouse.io",
  "@lever.co",
  "@ashbyhq.com",
  "@workday.com",
  "@smartrecruiters.com",
  "@icims.com",
  "@hirevue.com",
  "@myworkday.com",
]

// UI bucket stages (still buckets), LLM returns a bespoke stage_detail too
type StageBucket = "APPLIED" | "RECRUITER_SCREEN" | "INTERVIEW" | "OFFER"

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractEmailAddress(fromHeader: string) {
  const m = (fromHeader || "").match(/<([^>]+)>/)
  return (m?.[1] || fromHeader || "").trim().toLowerCase()
}

function computeRuleScore(text: string) {
  const t = text.toLowerCase()
  let score = 0
  const hits: Array<{ phrase: string; w: number }> = []

  for (const { phrase, w } of PHRASE_WEIGHTS) {
    if (t.includes(phrase.toLowerCase())) {
      score += w
      hits.push({ phrase, w })
    }
  }

  for (const d of ATS_DOMAINS) {
    if (t.includes(d)) {
      score += 10
      hits.push({ phrase: d, w: 10 })
    }
  }

  return { score, hits }
}

/**
 * Gate logic:
 * MUST have some signal: score >= MIN_SCORE OR (>=2 phrase hits)
 */
const MIN_SCORE = 9
const MIN_HITS = 2

function shouldSendToLLM(ruleScore: number, hitCount: number) {
  return ruleScore >= MIN_SCORE || hitCount >= MIN_HITS
}

function stageBucketFromLLM(s: any): StageBucket {
  const v = String(s || "").toUpperCase()
  if (v.includes("OFFER")) return "OFFER"
  if (v.includes("INTERVIEW")) return "INTERVIEW"
  if (v.includes("RECRUITER") || v.includes("SCREEN")) return "RECRUITER_SCREEN"
  if (v.includes("APPLIED")) return "APPLIED"
  return "RECRUITER_SCREEN"
}

const STAGE_ORDER: Record<StageBucket, number> = {
  APPLIED: 1,
  RECRUITER_SCREEN: 2,
  INTERVIEW: 3,
  OFFER: 4,
}

function advanceOnly(prev: StageBucket, next: StageBucket) {
  return STAGE_ORDER[next] > STAGE_ORDER[prev] ? next : prev
}

// Keep pipeline header "company/role" (never sender name/email unless truly unknown)
function safeCompanyRole(decision: any, fromHeader: string, subject: string) {
  const company = (decision?.company || "").trim()
  const role = (decision?.role || "").trim()

  const fromEmail = extractEmailAddress(fromHeader)
  const domain = fromEmail.split("@")[1] || ""
  const heuristicCompany =
    company ||
    (domain ? domain.split(".")[0].replace(/[^a-z0-9]/gi, "").toUpperCase() : "") ||
    ""

  const heuristicRole =
    role ||
    (subject || "")
      .replace(/re:\s*/i, "")
      .replace(/fwd:\s*/i, "")
      .slice(0, 120)
      .trim()

  return {
    company: heuristicCompany || "Unknown",
    role: heuristicRole || "Interview",
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "NO SESSION" }, { status: 401 })

    const accessToken = (session as any).accessToken
    const userEmail = session.user?.email
    if (!accessToken || !userEmail) {
      return NextResponse.json({ error: "MISSING TOKEN OR EMAIL", session }, { status: 401 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: "v1", auth })

    // last 30 days
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "newer_than:30d",
      maxResults: 500,
    })

    const messages = listRes.data.messages ?? []

    let scanned = messages.length
    let llmCalls = 0
    let inserted = 0
    let updated = 0
    let emailsInserted = 0

    // Pull pipelines once
    const { data: existingPipelines } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)

    const pipelines = existingPipelines ?? []

    for (const msg of messages) {
      if (!msg.id) continue

      // skip if already ingested
      const { data: existingEmail } = await supabase
        .from("emails")
        .select("id")
        .eq("gmail_message_id", msg.id)
        .maybeSingle()
      if (existingEmail) continue

      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      })

      const headers = full.data.payload?.headers ?? []
      const subject = headers.find((h) => h.name === "Subject")?.value ?? ""
      const fromHeader = headers.find((h) => h.name === "From")?.value ?? ""
      const dateHeader = headers.find((h) => h.name === "Date")?.value ?? ""
      const snippet = full.data.snippet ?? ""

      const fromEmail = extractEmailAddress(fromHeader)
      const blob = `${subject}\n${fromHeader}\n${fromEmail}\n${snippet}`

      const { score, hits } = computeRuleScore(blob)
      const passesRules = shouldSendToLLM(score, hits.length)
      if (!passesRules) continue

      llmCalls++

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You are Guildy, an ultra-conservative recruiting classifier.",
              "CRITICAL:",
              "- Return ONLY JSON (no markdown).",
              "- If unsure, set isInterviewRelated=false.",
              "- Never call shopping/receipts/promotions interview-related unless clear recruiting intent.",
              "- Prefer extracting COMPANY + ROLE from the content; do not use sender name/email unless unavoidable.",
              "- Infer BOTH:",
              "  (1) stage_bucket in {APPLIED, RECRUITER_SCREEN, INTERVIEW, OFFER}",
              "  (2) stage_detail: bespoke to company/role/hiring style (e.g., 'Recruiter screen', 'Hiring manager 1:1', 'Portfolio review', 'System design', 'Panel loop', 'Offer negotiation').",
              "- Stage must match the email content (outreach/screening => RECRUITER_SCREEN; scheduled rounds => INTERVIEW).",
              "- Use rule hits as supporting evidence.",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                email: {
                  from: fromHeader,
                  fromEmail,
                  subject,
                  snippet,
                  date: dateHeader,
                },
                ruleEvidence: {
                  score,
                  hits,
                },
                outputFormat: {
                  isInterviewRelated: "boolean",
                  confidence: "number 0..1",
                  company: "string|null",
                  role: "string|null",
                  stage_bucket: "APPLIED|RECRUITER_SCREEN|INTERVIEW|OFFER|null",
                  stage_detail: "string|null",
                  reasoning_tags: "string[]",
                },
              },
              null,
              2
            ),
          },
        ],
      })

      const raw = completion.choices?.[0]?.message?.content || ""
      let decision: any
      try {
        decision = JSON.parse(raw)
      } catch {
        continue
      }

      const isInterviewRelated = !!decision?.isInterviewRelated
      const confidence = Number(decision?.confidence ?? 0)
      if (!isInterviewRelated || confidence < 0.7) continue

      const { company, role } = safeCompanyRole(decision, fromHeader, subject)
      const stageBucket = stageBucketFromLLM(decision?.stage_bucket)

      const companyN = normalize(company)
      const roleN = normalize(role)

      let match = pipelines.find((p: any) => normalize(p.company) === companyN && normalize(p.role) === roleN)

      let pipelineId: string

      if (!match) {
        const { data: created, error: createErr } = await supabase
          .from("pipelines")
          .insert({
            user_email: userEmail,
            company,
            role,
            stage: stageBucket,
            last_email_subject: subject,
            last_email_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (createErr || !created?.id) continue
        pipelineId = created.id
        pipelines.push(created)
        inserted++
      } else {
        pipelineId = match.id

        const prevStage: StageBucket =
          (String(match.stage || "").toUpperCase() as StageBucket) || "RECRUITER_SCREEN"
        const nextStage = advanceOnly(prevStage, stageBucket)

        const { error: updErr } = await supabase
          .from("pipelines")
          .update({
            stage: nextStage,
            last_email_subject: subject,
            last_email_at: new Date().toISOString(),
          })
          .eq("id", pipelineId)

        if (!updErr) {
          match.stage = nextStage
          match.last_email_subject = subject
          match.last_email_at = new Date().toISOString()
          updated++
        }
      }

      const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()

      const { error: emailErr } = await supabase.from("emails").insert({
        user_email: userEmail,
        pipeline_id: pipelineId,
        gmail_message_id: msg.id,
        from_email: fromEmail || fromHeader,
        subject,
        snippet,
        received_at: receivedAt,
      })

      if (!emailErr) emailsInserted++
    }

    return NextResponse.json({
      scanned,
      llmCalls,
      inserted,
      updated,
      emailsInserted,
    })
  } catch (err: any) {
    return NextResponse.json({
      error: "EXCEPTION",
      message: err?.message || String(err),
    })
  }
}

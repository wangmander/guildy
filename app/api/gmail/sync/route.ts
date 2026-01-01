// FILE: app/api/gmail/sync/route.ts

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

/* -----------------------------
   INTERVIEW SIGNALS (ALL KEPT)
-------------------------------- */

// Strongest “this is interview/recruiting”
const STRONG_PHRASES = [
  // High-signal interview scheduling phrases
  "interview",
  "interview request",
  "interview invitation",
  "invite you to interview",
  "interview scheduling",
  "schedule an interview",
  "book an interview",
  "interview availability",
  "interview time",
  "interview slot",
  "interview confirmation",
  "confirmed interview",
  "reschedule interview",
  "interview rescheduled",
  "interview calendar",
  "calendar invite",
  "zoom interview",
  "google meet interview",
  "teams interview",
  "phone interview",
  "video interview",
  "onsite interview",
  "on-site interview",

  // Recruiter / hiring-pipeline phrases (very strong)
  "recruiter",
  "talent team",
  "talent acquisition",
  "hiring team",
  "hiring manager",
  "people team",
  "people operations",
  "hr team",
  "human resources",
  "staffing",
  "we would like to move forward",
  "next step",
  "next round",
  "moving you forward",
  "advance to the next stage",

  // Interview stage / round indicators
  "first round",
  "second round",
  "final round",
  "technical interview",
  "behavioral interview",
  "case interview",
  "panel interview",
  "loop interview",
  "interview loop",
  "onsite loop",
  "screening interview",
  "phone screen",
  "initial screen",
  "coding interview",
  "system design interview",
  "take-home interview",
  "assignment interview",
  "assessment interview",

  // Application + interview transition phrases
  "application status",
  "application update",
  "thank you for applying",
  "reviewed your application",
  "we reviewed your background",
  "we reviewed your resume",
  "shortlisted",
  "selected to move forward",
  "moving ahead with your application",
  "we’d like to learn more about you",

  // Offer-stage & post-interview signals
  "offer",
  "job offer",
  "verbal offer",
  "written offer",
  "offer letter",
  "compensation",
  "salary",
  "equity",
  "benefits",
  "background check",
  "reference check",
  "references",
  "start date",

  // Rejection / closure phrases (still useful signals)
  "we will not be moving forward",
  "decided to move forward with other candidates",
  "regret to inform you",
  "unfortunately",
  "position has been filled",
  "keep your resume on file",
  "future opportunities",
]

// Low-weight “anchors” (never enough alone)
const LOW_PHRASES = [
  "availability",
  "time zone",
  "pst",
  "est",
  "cst",
  "gmt",
  "30 minutes",
  "45 minutes",
  "60 minutes",
  "calendar",
  "invite attached",
  "meeting link",
  "dial in",
  "conference link",
]

// ATS / recruiting system domains (bonus signal, not a hard block)
const ATS_DOMAINS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workday.com",
  "smartrecruiters.com",
  "icims.com",
  "hirevue.com",
  "myworkday.com",
]

function safeLower(s: string) {
  return (s || "").toLowerCase()
}

function extractEmailAddress(fromHeader: string) {
  const m = (fromHeader || "").match(/<([^>]+)>/)
  if (m?.[1]) return m[1].trim()
  // Sometimes it's just an email without <>
  const m2 = (fromHeader || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return m2?.[0]?.trim() ?? ""
}

function getDomain(email: string) {
  const at = email.indexOf("@")
  if (at === -1) return ""
  return email.slice(at + 1).toLowerCase()
}

function normalizeCompanyName(raw: string) {
  return (raw || "")
    .replace(/<.*?>/g, "")
    .replace(/".*?"/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeRole(raw: string) {
  return (raw || "")
    .replace(/\s+/g, " ")
    .trim()
}

function parseMaybeJson(raw: string) {
  const txt = (raw || "").trim()
  // Strip ```json fences if model returns them
  const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const body = (fenced?.[1] ?? txt).trim()
  return JSON.parse(body)
}

/**
 * Weighted gate:
 * - Do NOT let Disney+/shopping through unless real recruiting signals exist.
 * - Still not hard-blocking by company name.
 *
 * Pass rules:
 * - If strongHits >= 1 -> PASS
 * - Else if totalHits >= 2 AND (strongHits + lowHits) >= 2 -> PASS
 *   (i.e., at least 2 hits, but low-only won't pass)
 */
function scoreSignals(subject: string, snippet: string, fromHeader: string) {
  const text = safeLower(`${subject} ${snippet}`)
  const strongHits = STRONG_PHRASES.filter((p) => text.includes(p)).length
  const lowHits = LOW_PHRASES.filter((p) => text.includes(p)).length
  const totalHits = strongHits + lowHits

  const fromEmail = extractEmailAddress(fromHeader)
  const domain = getDomain(fromEmail)
  const atsBonus = ATS_DOMAINS.some((d) => domain.endsWith(d)) ? 2 : 0

  // Weighted score mainly for debugging; gate uses hit logic above.
  const score = strongHits * 5 + lowHits * 1 + atsBonus

  const pass =
    strongHits >= 1 ||
    (totalHits >= 2 && (strongHits + lowHits) >= 2 && !(strongHits === 0 && lowHits >= 2))

  return { pass, score, strongHits, lowHits, totalHits, fromEmail, domain }
}

const STAGE_ORDER = ["APPLIED", "RECRUITER", "INTERVIEW", "OFFER"] as const
type Stage = (typeof STAGE_ORDER)[number]

function clampStage(s: any): Stage {
  const up = String(s || "").toUpperCase()
  if (up === "RECRUITER_SCREEN" || up === "RECRUITER") return "RECRUITER"
  if (up === "INTERVIEW") return "INTERVIEW"
  if (up === "OFFER") return "OFFER"
  return "APPLIED"
}

function stageRank(s: Stage) {
  return STAGE_ORDER.indexOf(s)
}

function chooseForwardStage(existing: string | null | undefined, incoming: Stage) {
  const current = clampStage(existing)
  return stageRank(incoming) > stageRank(current) ? incoming : current
}

function parseHeader(headers: any[], name: string) {
  return headers.find((h: any) => h.name === name)?.value ?? ""
}

function parseEmailDate(dateHeader: string) {
  const d = new Date(dateHeader)
  if (isNaN(d.getTime())) return new Date().toISOString()
  return d.toISOString()
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "NO SESSION" }, { status: 401 })
    }

    const accessToken = (session as any).accessToken as string | undefined
    const userEmail = session.user.email
    if (!accessToken) {
      return NextResponse.json({ error: "NO TOKEN" }, { status: 401 })
    }

    // Gmail auth
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: "v1", auth })

    // Last 30 days (Gmail query uses epoch seconds in after:)
    const after = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30

    // Paginate up to 500 messages for now (fast enough + safe)
    const MAX_SCAN = 500
    let nextPageToken: string | undefined = undefined
    let scanned = 0

    let inserted = 0
    let updated = 0
    let llmCalls = 0

    while (scanned < MAX_SCAN) {
      const list = await gmail.users.messages.list({
        userId: "me",
        q: `after:${after}`,
        maxResults: Math.min(100, MAX_SCAN - scanned),
        pageToken: nextPageToken,
      })

      const batch = list.data.messages ?? []
      nextPageToken = list.data.nextPageToken ?? undefined
      if (batch.length === 0) break

      for (const m of batch) {
        scanned++
        if (!m.id) continue

        // Dedup: if already stored in emails table, skip early
        const { data: existingEmail } = await supabase
          .from("emails")
          .select("id")
          .eq("gmail_message_id", m.id)
          .maybeSingle()

        if (existingEmail) continue

        const full = await gmail.users.messages.get({
          userId: "me",
          id: m.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        })

        const headers = full.data.payload?.headers ?? []
        const subject = parseHeader(headers, "Subject")
        const fromHeader = parseHeader(headers, "From")
        const dateHeader = parseHeader(headers, "Date")
        const snippet = full.data.snippet ?? ""
        const receivedAt = parseEmailDate(dateHeader)

        // Gate (THIS is what stops Disney+/shopping spam)
        const sig = scoreSignals(subject, snippet, fromHeader)
        if (!sig.pass) continue

        // LLM extraction (only after gate)
        llmCalls++

        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                'Return ONLY valid JSON (no markdown). You extract COMPANY and ROLE for a job interview/recruiting thread. If uncertain, infer from sender domain and subject. Do NOT output sender person name as company unless that is truly the company. Stages must be one of: APPLIED, RECRUITER, INTERVIEW, OFFER.',
            },
            {
              role: "user",
              content: JSON.stringify(
                {
                  email: {
                    from: fromHeader,
                    fromEmail: sig.fromEmail,
                    fromDomain: sig.domain,
                    subject,
                    snippet,
                    receivedAt,
                  },
                  signals: {
                    strongHits: sig.strongHits,
                    lowHits: sig.lowHits,
                    totalHits: sig.totalHits,
                    score: sig.score,
                    atsDomainBonus: ATS_DOMAINS.some((d) => sig.domain.endsWith(d)),
                  },
                  required_output_schema: {
                    company: "string",
                    role: "string",
                    stage: "APPLIED | RECRUITER | INTERVIEW | OFFER",
                    confidence: "number 0..1",
                  },
                },
                null,
                2
              ),
            },
          ],
        })

        const raw = resp.choices[0]?.message?.content ?? ""
        let parsed: any
        try {
          parsed = parseMaybeJson(raw)
        } catch {
          // If LLM returns non-JSON, skip this message rather than polluting pipelines
          continue
        }

        const companyRaw =
          typeof parsed.company === "string" && parsed.company.trim()
            ? parsed.company.trim()
            : ""
        const roleRaw =
          typeof parsed.role === "string" && parsed.role.trim()
            ? parsed.role.trim()
            : ""

        // Strong defaults that avoid “sender name/email” as header:
        // - Company fallback: sender domain (e.g. talent.io) instead of "Michael Wang"
        // - Role fallback: try subject, else "Interview"
        const fallbackCompany =
          sig.domain ? sig.domain.replace(/^www\./, "") : normalizeCompanyName(fromHeader)
        const company = normalizeCompanyName(companyRaw || fallbackCompany)
        const role = normalizeRole(roleRaw || subject || "Interview")
        const incomingStage = clampStage(parsed.stage)

        // Find existing pipeline by (user_email, company, role)
        const { data: pipeline } = await supabase
          .from("pipelines")
          .select("*")
          .eq("user_email", userEmail)
          .eq("company", company)
          .eq("role", role)
          .maybeSingle()

        let pipelineId: string
        const lastEmailSubject = subject || ""
        const lastEmailAt = receivedAt

        if (!pipeline) {
          const { data: created, error } = await supabase
            .from("pipelines")
            .insert({
              user_email: userEmail,
              company,
              role,
              stage: incomingStage,
              last_email_subject: lastEmailSubject,
              last_email_at: lastEmailAt,
            })
            .select()
            .single()

          if (error || !created?.id) continue
          pipelineId = created.id
          inserted++
        } else {
          pipelineId = pipeline.id
          const nextStage = chooseForwardStage(pipeline.stage, incomingStage)

          // Always update "last email" info; stage only advances (never regresses)
          const { error } = await supabase
            .from("pipelines")
            .update({
              stage: nextStage,
              last_email_subject: lastEmailSubject,
              last_email_at: lastEmailAt,
            })
            .eq("id", pipelineId)

          if (!error) updated++
        }

        // Insert email row
        await supabase.from("emails").insert({
          user_email: userEmail,
          pipeline_id: pipelineId,
          gmail_message_id: m.id,
          from_email: sig.fromEmail || fromHeader,
          subject,
          snippet,
          received_at: receivedAt,
        })
      }

      if (!nextPageToken) break
    }

    return NextResponse.json({
      scanned,
      inserted,
      updated,
      llmCalls,
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "EXCEPTION",
        message: err?.message ?? String(err),
      },
      { status: 500 }
    )
  }
}

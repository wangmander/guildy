// app/api/gmail/sync/route.ts

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { google } from "googleapis"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"

/* =========================
   CLIENTS
========================= */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

/* =========================
   CONFIG
========================= */

const MAX_LLM_CALLS = 8
const DAYS = 30

const STAGES = ["APPLIED", "RECRUITER_SCREEN", "INTERVIEW", "OFFER"] as const
type Stage = (typeof STAGES)[number]
const stageRank = (s: Stage) => STAGES.indexOf(s)

/* =========================
   TRANSACTIONAL NEGATIVES
========================= */

const TRANSACTIONAL_TERMS = [
  "order",
  "shipment",
  "tracking",
  "invoice",
  "receipt",
  "refund",
  "payment",
  "verification code",
  "otp",
]

/* =========================
   🔴 ALL INTERVIEW PHRASES
   (NONE REMOVED)
========================= */

const HIGH_SIGNAL_INTERVIEW_PHRASES = [
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
]

const RECRUITER_PIPELINE_PHRASES = [
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
]

const INTERVIEW_STAGE_PHRASES = [
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
]

const APPLICATION_TRANSITION_PHRASES = [
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
]

const OFFER_PHRASES = [
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
]

const REJECTION_PHRASES = [
  "we will not be moving forward",
  "decided to move forward with other candidates",
  "regret to inform you",
  "unfortunately",
  "position has been filled",
  "keep your resume on file",
  "future opportunities",
]

const LOGISTICS_PHRASES = [
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

/* =========================
   HELPERS
========================= */

const countMatches = (t: string, arr: string[]) =>
  arr.reduce((n, p) => (t.includes(p) ? n + 1 : n), 0)

const containsAny = (t: string, arr: string[]) =>
  arr.some((p) => t.includes(p))

function inferStage(text: string): Stage {
  if (containsAny(text, OFFER_PHRASES)) return "OFFER"
  if (containsAny(text, INTERVIEW_STAGE_PHRASES)) return "INTERVIEW"
  if (containsAny(text, RECRUITER_PIPELINE_PHRASES)) return "RECRUITER_SCREEN"
  return "APPLIED"
}

/* =========================
   MAIN
========================= */

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !(session as any).accessToken || !session.user?.email) {
      return NextResponse.json({ error: "NO SESSION" }, { status: 401 })
    }

    const userEmail = session.user.email
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: (session as any).accessToken })
    const gmail = google.gmail({ version: "v1", auth })

    const after = Math.floor(
      (Date.now() - DAYS * 24 * 60 * 60 * 1000) / 1000
    )

    const list = await gmail.users.messages.list({
      userId: "me",
      q: `after:${after}`,
      maxResults: 500,
    })

    const messages = list.data.messages ?? []

    let inserted = 0
    let updated = 0
    let llmCalls = 0

    for (const msg of messages) {
      if (!msg.id) continue

      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject"],
      })

      const headers = full.data.payload?.headers ?? []
      const subject =
        headers.find((h) => h.name === "Subject")?.value ?? ""
      const from =
        headers.find((h) => h.name === "From")?.value ?? ""
      const snippet = full.data.snippet ?? ""

      const text = `${from} ${subject} ${snippet}`.toLowerCase()

      if (countMatches(text, TRANSACTIONAL_TERMS) >= 2) continue

      let score = 0
      if (containsAny(text, HIGH_SIGNAL_INTERVIEW_PHRASES)) score += 6
      if (containsAny(text, RECRUITER_PIPELINE_PHRASES)) score += 4
      if (containsAny(text, APPLICATION_TRANSITION_PHRASES)) score += 3
      if (containsAny(text, OFFER_PHRASES)) score += 4
      if (containsAny(text, LOGISTICS_PHRASES)) score += 1

      let isInterview = score >= 3
      let stage = inferStage(text)
      let company: string | null = null
      let role: string | null = null

      if (llmCalls < MAX_LLM_CALLS) {
        llmCalls++
        const res = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "Return ONLY valid JSON. No markdown. No backticks.",
            },
            {
              role: "user",
              content: `From: ${from}
Subject: ${subject}
Snippet: ${snippet}

Return:
{
  "isInterview": boolean,
  "company": string | null,
  "role": string | null,
  "stage": "APPLIED" | "RECRUITER_SCREEN" | "INTERVIEW" | "OFFER"
}`,
            },
          ],
        })

        const parsed = JSON.parse(res.choices[0].message.content!)
        if (!parsed.isInterview) continue
        isInterview = true
        stage = parsed.stage ?? stage
        company = parsed.company
        role = parsed.role
      }

      if (!isInterview) continue

      const { data: existing } = await supabase
        .from("pipelines")
        .select("*")
        .eq("user_email", userEmail)
        .ilike("company", `%${company ?? ""}%`)
        .ilike("role", `%${role ?? ""}%`)
        .limit(1)

      if (existing?.length) {
        const current = existing[0]
        const nextStage =
          stageRank(stage) > stageRank(current.stage)
            ? stage
            : current.stage

        await supabase
          .from("pipelines")
          .update({
            stage: nextStage,
            last_email_subject: subject,
            last_email_at: new Date().toISOString(),
          })
          .eq("id", current.id)

        updated++
      } else {
        await supabase.from("pipelines").insert({
          user_email: userEmail,
          company: company ?? "Unknown company",
          role: role ?? "Unknown role",
          stage,
          last_email_subject: subject,
          last_email_at: new Date().toISOString(),
        })
        inserted++
      }
    }

    return NextResponse.json({
      scanned: messages.length,
      inserted,
      updated,
      llmCalls,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message })
  }
}

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
   STAGES
========================= */

const STAGES = ["APPLIED", "RECRUITER_SCREEN", "INTERVIEW", "OFFER"] as const
type Stage = (typeof STAGES)[number]

const stageRank = (s: Stage) => STAGES.indexOf(s)

/* =========================
   HARD NEGATIVES
========================= */

const HARD_NEGATIVES = [
  "order",
  "shipment",
  "tracking",
  "invoice",
  "receipt",
  "refund",
  "payment",
  "security alert",
  "verification code",
  "otp",
  "newsletter",
  "promotion",
  "amazon",
  "walmart",
  "doordash",
  "ubereats",
]

/* =========================
   🔴 FULL PHRASE SET — UNCHANGED
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

const INTERVIEW_STAGE_PHRASES: Record<string, Stage> = {
  "phone screen": "RECRUITER_SCREEN",
  "initial screen": "RECRUITER_SCREEN",
  "screening interview": "RECRUITER_SCREEN",

  "technical interview": "INTERVIEW",
  "behavioral interview": "INTERVIEW",
  "case interview": "INTERVIEW",
  "panel interview": "INTERVIEW",
  "loop interview": "INTERVIEW",
  "interview loop": "INTERVIEW",
  "onsite loop": "INTERVIEW",
  "coding interview": "INTERVIEW",
  "system design interview": "INTERVIEW",
  "take-home interview": "INTERVIEW",
  "assignment interview": "INTERVIEW",
  "assessment interview": "INTERVIEW",

  "offer": "OFFER",
  "job offer": "OFFER",
  "verbal offer": "OFFER",
  "written offer": "OFFER",
  "offer letter": "OFFER",
  "compensation": "OFFER",
  "salary": "OFFER",
  "equity": "OFFER",
  "benefits": "OFFER",
  "background check": "OFFER",
  "reference check": "OFFER",
  "references": "OFFER",
  "start date": "OFFER",
}

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

/* =========================
   HELPERS
========================= */

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "")

const containsAny = (text: string, phrases: string[]) =>
  phrases.some((p) => text.includes(p))

const detectStageFromRules = (text: string): Stage => {
  for (const key in INTERVIEW_STAGE_PHRASES) {
    if (text.includes(key)) return INTERVIEW_STAGE_PHRASES[key]
  }
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

    // 🔴 🔴 🔴 ONLY CHANGE: LAST 30 DAYS 🔴 🔴 🔴
    const thirtyDaysAgo = Math.floor(
      (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
    )

    const list = await gmail.users.messages.list({
      userId: "me",
      q: `after:${thirtyDaysAgo}`,
      maxResults: 500,
    })

    const messages = list.data.messages ?? []

    let inserted = 0
    let updated = 0

    for (const msg of messages) {
      if (!msg.id) continue

      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      })

      const headers = full.data.payload?.headers ?? []
      const subject =
        headers.find((h) => h.name === "Subject")?.value ?? ""
      const from =
        headers.find((h) => h.name === "From")?.value ?? ""
      const snippet = full.data.snippet ?? ""

      const text = `${from} ${subject} ${snippet}`.toLowerCase()

      if (containsAny(text, HARD_NEGATIVES)) continue

      let score = 0
      if (containsAny(text, HIGH_SIGNAL_INTERVIEW_PHRASES)) score += 6
      if (containsAny(text, RECRUITER_PIPELINE_PHRASES)) score += 4
      if (containsAny(text, APPLICATION_TRANSITION_PHRASES)) score += 3
      if (containsAny(text, LOGISTICS_PHRASES)) score += 1
      if (ATS_DOMAINS.some((d) => from.includes(d))) score += 6

      let isInterview = score >= 3
      let stage = detectStageFromRules(text)

      if (!isInterview) {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0,
          messages: [
            { role: "system", content: "Return ONLY valid JSON." },
            {
              role: "user",
              content: `
FROM: ${from}
SUBJECT: ${subject}
SNIPPET: ${snippet}

Is this part of a job interview or recruiting process?

Return:
{
  "isInterview": boolean,
  "stage": "APPLIED" | "RECRUITER_SCREEN" | "INTERVIEW" | "OFFER" | null
}
`,
            },
          ],
        })

        const parsed = JSON.parse(
          completion.choices[0].message.content!
        )

        if (!parsed.isInterview) continue
        stage = parsed.stage ?? stage
      }

      const { data: existing } = await supabase
        .from("pipelines")
        .select("*")
        .eq("user_email", userEmail)
        .ilike("company", `%${normalize(from)}%`)
        .ilike("role", `%${normalize(subject)}%`)
        .limit(1)

      if (existing && existing.length > 0) {
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
          company: from,
          role: subject,
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
    })
  } catch (err: any) {
    return NextResponse.json({
      error: "EXCEPTION",
      message: err.message,
    })
  }
}

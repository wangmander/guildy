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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

/* ============================
   SIGNAL DEFINITIONS
============================ */

const HARD_NEGATIVES = [
  "order",
  "shipment",
  "tracking",
  "invoice",
  "receipt",
  "refund",
  "payment",
  "amazon",
  "subscription",
  "security alert",
  "verification code",
  "otp",
  "newsletter",
  "promotion",
]

const INTERVIEW_PHRASES = [
  "interview",
  "interview request",
  "interview invitation",
  "schedule an interview",
  "book an interview",
  "interview availability",
  "interview time",
  "interview slot",
  "interview confirmation",
  "reschedule interview",
  "calendar invite",
  "zoom interview",
  "google meet interview",
  "teams interview",
  "phone interview",
  "video interview",
  "onsite interview",
  "on-site interview",
]

const RECRUITER_PHRASES = [
  "recruiter",
  "talent team",
  "talent acquisition",
  "hiring team",
  "hiring manager",
  "people team",
  "people operations",
  "hr",
  "human resources",
  "staffing",
  "move forward",
  "next step",
  "next round",
  "advance to the next stage",
]

const STAGE_PHRASES: Record<string, "APPLIED" | "RECRUITER_SCREEN" | "INTERVIEW" | "OFFER"> = {
  "phone screen": "RECRUITER_SCREEN",
  "initial screen": "RECRUITER_SCREEN",
  "technical interview": "INTERVIEW",
  "behavioral interview": "INTERVIEW",
  "case interview": "INTERVIEW",
  "panel interview": "INTERVIEW",
  "loop interview": "INTERVIEW",
  "final round": "INTERVIEW",
  "offer": "OFFER",
  "offer letter": "OFFER",
  "verbal offer": "OFFER",
  "written offer": "OFFER",
}

const CALENDAR_PHRASES = [
  "availability",
  "calendar",
  "invite attached",
  "meeting link",
  "dial in",
  "conference link",
  "30 minutes",
  "45 minutes",
  "60 minutes",
  "pst",
  "est",
  "cst",
  "gmt",
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

/* ============================
   HELPERS
============================ */

function contains(text: string, list: string[]) {
  const t = text.toLowerCase()
  return list.some((k) => t.includes(k))
}

function detectStage(text: string) {
  const t = text.toLowerCase()
  for (const key in STAGE_PHRASES) {
    if (t.includes(key)) return STAGE_PHRASES[key]
  }
  return "APPLIED"
}

/* ============================
   MAIN HANDLER
============================ */

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !(session as any).accessToken || !session.user?.email) {
      return NextResponse.json({ error: "NO SESSION" }, { status: 401 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: (session as any).accessToken })
    const gmail = google.gmail({ version: "v1", auth })

    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: 25,
    })

    const messages = list.data.messages ?? []
    let inserted = 0

    for (const msg of messages) {
      if (!msg.id) continue

      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject"],
      })

      const headers = full.data.payload?.headers ?? []
      const subject = headers.find((h) => h.name === "Subject")?.value ?? ""
      const from = headers.find((h) => h.name === "From")?.value ?? ""
      const snippet = full.data.snippet ?? ""
      const blob = `${from} ${subject} ${snippet}`

      // HARD NEGATIVE
      if (contains(blob, HARD_NEGATIVES)) continue

      // SIGNAL SCORING
      let score = 0
      if (contains(blob, INTERVIEW_PHRASES)) score += 5
      if (contains(blob, RECRUITER_PHRASES)) score += 4
      if (contains(blob, CALENDAR_PHRASES)) score += 1
      if (contains(blob, ATS_DOMAINS)) score += 6

      let stage = detectStage(blob)

      // AMBIGUOUS → LLM
      if (score < 4) {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                "Return ONLY JSON. If unsure, interviewRelated=false.",
            },
            {
              role: "user",
              content: `
FROM: ${from}
SUBJECT: ${subject}
SNIPPET: ${snippet}

Is this part of a job interview or recruiting process?

Return:
{
  "interviewRelated": boolean,
  "stage": "APPLIED" | "RECRUITER_SCREEN" | "INTERVIEW" | "OFFER" | null,
  "confidence": number
}
`,
            },
          ],
        })

        const parsed = JSON.parse(
          completion.choices[0].message.content!
        )

        if (!parsed.interviewRelated || parsed.confidence < 0.7) continue
        stage = parsed.stage ?? stage
      }

      await supabase.from("pipelines").insert({
        user_email: session.user.email,
        company: from,
        role: subject,
        stage,
        last_email_subject: subject,
        last_email_at: new Date().toISOString(),
      })

      inserted++
    }

    return NextResponse.json({
      scanned: messages.length,
      inserted,
    })
  } catch (err: any) {
    return NextResponse.json({
      error: "EXCEPTION",
      message: err.message,
    })
  }
}

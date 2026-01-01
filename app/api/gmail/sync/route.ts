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

/* -----------------------------
   INTERVIEW SIGNALS (UNCHANGED)
-------------------------------- */

const PHRASES = [
  // High-signal interview scheduling
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

  // Recruiter / pipeline
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

  // Interview rounds
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

  // Application → interview
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

  // Offer
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

  // Rejection (still pipeline signal)
  "we will not be moving forward",
  "decided to move forward with other candidates",
  "regret to inform you",
  "unfortunately",
  "position has been filled",
  "keep your resume on file",
  "future opportunities",

  // Calendar / logistics (LOW WEIGHT)
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

function containsSignal(text: string) {
  const t = text.toLowerCase()
  return PHRASES.some((p) => t.includes(p))
}

function normalizeCompany(raw: string) {
  return raw
    .replace(/<.*?>/g, "")
    .replace(/".*?"/g, "")
    .trim()
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email)
    return NextResponse.json({ error: "NO SESSION" }, { status: 401 })

  const accessToken = (session as any).accessToken
  const userEmail = session.user.email
  if (!accessToken)
    return NextResponse.json({ error: "NO TOKEN" }, { status: 401 })

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const gmail = google.gmail({ version: "v1", auth })

  // Last 30 days
  const after = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30

  const list = await gmail.users.messages.list({
    userId: "me",
    q: `after:${after}`,
    maxResults: 500,
  })

  let inserted = 0
  let updated = 0
  let llmCalls = 0

  for (const m of list.data.messages ?? []) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: m.id!,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    })

    const headers = full.data.payload?.headers ?? []
    const subject =
      headers.find((h) => h.name === "Subject")?.value ?? ""
    const from =
      headers.find((h) => h.name === "From")?.value ?? ""
    const snippet = full.data.snippet ?? ""
    const combined = `${subject} ${snippet}`

    // HARD FILTER: must contain signal
    if (!containsSignal(combined)) continue

    // Dedup email
    const { data: existingEmail } = await supabase
      .from("emails")
      .select("id")
      .eq("gmail_message_id", m.id!)
      .maybeSingle()

    if (existingEmail) continue

    // LLM extraction
    llmCalls++
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Return ONLY valid JSON. Extract company, role, and interview stage.",
        },
        {
          role: "user",
          content: `
Email:
From: ${from}
Subject: ${subject}
Snippet: ${snippet}

Return:
{
  "company": string,
  "role": string,
  "stage": "APPLIED" | "RECRUITER" | "INTERVIEW" | "OFFER"
}
          `,
        },
      ],
    })

    const parsed = JSON.parse(resp.choices[0].message.content!)
    const company = normalizeCompany(parsed.company || from)
    const role = parsed.role || "Interview"
    const stage = parsed.stage || "APPLIED"

    // Find pipeline
    const { data: pipeline } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)
      .eq("company", company)
      .eq("role", role)
      .maybeSingle()

    let pipelineId: string

    if (!pipeline) {
      const { data: created } = await supabase
        .from("pipelines")
        .insert({
          user_email: userEmail,
          company,
          role,
          stage,
          last_email_subject: subject,
          last_email_at: new Date().toISOString(),
        })
        .select()
        .single()

      pipelineId = created.id
      inserted++
    } else {
      pipelineId = pipeline.id
      if (pipeline.stage !== stage) {
        await supabase
          .from("pipelines")
          .update({
            stage,
            last_email_subject: subject,
            last_email_at: new Date().toISOString(),
          })
          .eq("id", pipeline.id)
        updated++
      }
    }

    // Insert email
    await supabase.from("emails").insert({
      user_email: userEmail,
      pipeline_id: pipelineId,
      gmail_message_id: m.id!,
      from_email: from,
      subject,
      snippet,
      received_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({
    scanned: list.data.messages?.length ?? 0,
    inserted,
    updated,
    llmCalls,
  })
}

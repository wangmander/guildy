// FILE: app/api/gmail/sync/route.ts
// FULL REPLACEMENT — paste this entire file exactly

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

/**
 * HARD GATE KEYWORDS — ALL PHRASES PRESERVED
 * Nothing reaches the LLM unless ≥1 of these is present
 */
const INTERVIEW_KEYWORDS = [
  // 1. High-signal interview scheduling phrases
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

  // 2. Recruiter / hiring pipeline phrases
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

  // 3. Interview stages
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

  // 4. Application → interview transition
  "application status",
  "application update",
  "thank you for applying",
  "reviewed your application",
  "reviewed your resume",
  "shortlisted",
  "selected to move forward",
  "moving ahead with your application",
  "we’d like to learn more about you",

  // 5. Offer stage
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

  // 6. Rejections
  "not moving forward",
  "other candidates",
  "regret to inform you",
  "unfortunately",
  "position has been filled",
  "keep your resume on file",
  "future opportunities",

  // 7. Calendar & logistics (low weight but valid)
  "availability",
  "time zone",
  "pst",
  "est",
  "cst",
  "gmt",
  "30 minutes",
  "45 minutes",
  "60 minutes",
  "meeting link",
  "dial in",
  "conference link",
]

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "NO SESSION" }, { status: 401 })
    }

    const accessToken = (session as any).accessToken
    const userEmail = session.user?.email
    if (!accessToken || !userEmail) {
      return NextResponse.json({ error: "MISSING TOKEN OR EMAIL" }, { status: 401 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: "v1", auth })

    // last 30 days, up to 500 messages
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: "newer_than:30d",
      maxResults: 500,
    })

    const messages = listRes.data.messages ?? []

    let inserted = 0
    let updated = 0
    let llmCalls = 0

    for (const msg of messages) {
      if (!msg.id) continue

      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      })

      const headers = full.data.payload?.headers ?? []
      const subject = headers.find(h => h.name === "Subject")?.value ?? ""
      const from = headers.find(h => h.name === "From")?.value ?? ""
      const snippet = full.data.snippet ?? ""

      const textBlob = `${subject} ${from} ${snippet}`.toLowerCase()
      const keywordHits = INTERVIEW_KEYWORDS.filter(k =>
        textBlob.includes(k)
      )

      // HARD GATE — NOTHING PASSES WITHOUT KEYWORDS
      if (keywordHits.length === 0) continue

      // prevent duplicate email ingestion
      const { data: existingEmail } = await supabase
        .from("emails")
        .select("id")
        .eq("gmail_message_id", msg.id)
        .maybeSingle()

      if (existingEmail) continue

      // LLM CLASSIFICATION
      llmCalls++
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are a recruiting expert. Return ONLY valid JSON. Be conservative.",
          },
          {
            role: "user",
            content: `
Given this email, extract interview pipeline info.

Email:
From: ${from}
Subject: ${subject}
Snippet: ${snippet}

Return EXACT JSON:
{
  "isInterviewRelated": boolean,
  "company": string | null,
  "role": string | null,
  "stage": "RECRUITER" | "SCREENING" | "INTERVIEW" | "FULL_LOOP" | "OFFER" | null,
  "confidence": number
}
            `,
          },
        ],
      })

      const raw = completion.choices[0].message.content
      if (!raw) continue

      let decision: any
      try {
        decision = JSON.parse(raw)
      } catch {
        continue
      }

      // SECOND GATE — LLM CONFIDENCE
      if (!decision.isInterviewRelated || decision.confidence < 0.6) continue

      const company = decision.company ?? "Unknown"
      const role = decision.role ?? "Interview"
      const stage = decision.stage ?? "RECRUITER"

      // UPSERT PIPELINE
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
        await supabase
          .from("pipelines")
          .update({
            stage,
            last_email_subject: subject,
            last_email_at: new Date().toISOString(),
          })
          .eq("id", pipelineId)

        updated++
      }

      // INSERT EMAIL ROW
      await supabase.from("emails").insert({
        user_email: userEmail,
        pipeline_id: pipelineId,
        gmail_message_id: msg.id,
        from_email: from,
        subject,
        snippet,
        received_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      scanned: messages.length,
      inserted,
      updated,
      llmCalls,
    })
  } catch (err: any) {
    return NextResponse.json({
      error: "EXCEPTION",
      message: err.message,
    })
  }
}

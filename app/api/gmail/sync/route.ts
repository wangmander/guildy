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

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "NO SESSION" }, { status: 401 })
    }

    const accessToken = (session as any).accessToken
    const userEmail = session.user?.email

    if (!accessToken || !userEmail) {
      return NextResponse.json({
        error: "MISSING TOKEN OR EMAIL",
        session,
      })
    }

    // Gmail auth
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: "v1", auth })

    // 1️⃣ Get recent Gmail messages (broad, inclusive)
    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
    })

    const messages = listRes.data.messages ?? []

    if (messages.length === 0) {
      return NextResponse.json({
        gmailMessageCount: 0,
        note: "No Gmail messages found",
      })
    }

    let insertedCount = 0
    const decisions: any[] = []

    // 2️⃣ Process each message through ChatGPT
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

      // 3️⃣ Ask ChatGPT to classify + extract
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are an expert recruiting assistant. You must return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `
Given this email, determine if it is related to a job interview or recruiting process.

Email:
From: ${from}
Subject: ${subject}
Snippet: ${snippet}

Return JSON exactly in this format:
{
  "isInterviewRelated": boolean,
  "company": string | null,
  "role": string | null,
  "stage": "APPLIED" | "RECRUITER_SCREEN" | "INTERVIEW" | "OFFER" | null,
  "confidence": number
}
            `,
          },
        ],
      })

      const raw = completion.choices[0].message.content
      if (!raw) continue

      let decision
      try {
        decision = JSON.parse(raw)
      } catch {
        continue
      }

      decisions.push({
        subject,
        from,
        decision,
      })

      // 4️⃣ Only insert interview-related emails
      if (!decision.isInterviewRelated) {
        continue
      }

      await supabase.from("pipelines").insert({
        user_email: userEmail,
        company: decision.company ?? from,
        role: decision.role ?? subject,
        stage: decision.stage ?? "APPLIED",
        last_email_subject: subject,
        last_email_at: new Date().toISOString(),
        confidence: decision.confidence,
      })

      insertedCount++
    }

    return NextResponse.json({
      gmailMessageCount: messages.length,
      inserted: insertedCount,
      decisions,
    })
  } catch (err: any) {
    return NextResponse.json({
      error: "EXCEPTION",
      message: err.message,
      stack: err.stack,
    })
  }
}

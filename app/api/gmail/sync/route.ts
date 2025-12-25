import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { google } from "googleapis"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "NO SESSION" }, { status: 401 })
    }

    const accessToken = (session as any).accessToken
    const email = session.user?.email

    if (!accessToken || !email) {
      return NextResponse.json({
        error: "MISSING TOKEN OR EMAIL",
        session,
      })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })

    const gmail = google.gmail({ version: "v1", auth })

    // 🔍 STEP 1: LIST MESSAGES (NO FILTER)
    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: 5,
    })

    const messages = listRes.data.messages ?? []

    // 🔍 STEP 2: RETURN WHAT GMAIL GAVE US
    if (messages.length === 0) {
      return NextResponse.json({
        gmailMessageCount: 0,
        note: "Gmail returned ZERO messages",
      })
    }

    // 🔍 STEP 3: INSERT FIRST MESSAGE ONLY (DEBUG)
    const msg = messages[0]

    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    })

    const headers = full.data.payload?.headers ?? []

    const subject =
      headers.find((h) => h.name === "Subject")?.value ?? "NO SUBJECT"
    const from =
      headers.find((h) => h.name === "From")?.value ?? "NO FROM"

    const insertResult = await supabase.from("pipelines").insert({
      user_email: email,
      company: from,
      role: subject,
      stage: "APPLIED",
      last_email_subject: subject,
      last_email_at: new Date().toISOString(),
    })

    return NextResponse.json({
      gmailMessageCount: messages.length,
      inserted: 1,
      sample: { from, subject },
      supabaseResult: insertResult,
    })
  } catch (err: any) {
    return NextResponse.json({
      error: "EXCEPTION",
      message: err.message,
      stack: err.stack,
    })
  }
}

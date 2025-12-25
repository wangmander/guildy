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
  const session = await getServerSession(authOptions)

  if (!session || !(session as any).accessToken || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({
    access_token: (session as any).accessToken,
  })

  const gmail = google.gmail({ version: "v1", auth })

  // 🔴 FORCE: pull the 5 most recent emails, no filter
  const list = await gmail.users.messages.list({
    userId: "me",
    maxResults: 5,
  })

  const messages = list.data.messages ?? []

  for (const msg of messages) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    })

    const headers = full.data.payload?.headers ?? []
    const subject =
      headers.find((h) => h.name === "Subject")?.value ?? "No subject"
    const from =
      headers.find((h) => h.name === "From")?.value ?? "Unknown sender"

    await supabase.from("pipelines").insert({
      user_email: session.user.email, // ← YOUR REAL GMAIL
      company: from,
      role: subject,
      stage: "APPLIED",
      last_email_subject: subject,
      last_email_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({
    inserted: messages.length,
    user: session.user.email,
  })
}

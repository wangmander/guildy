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

  // Pull recent emails that look like interviews
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "interview OR recruiter OR screening OR offer",
    maxResults: 20,
  })

  const messages = res.data.messages ?? []

  for (const msg of messages) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    })

    const headers = full.data.payload?.headers ?? []
    const subject = headers.find(h => h.name === "Subject")?.value ?? ""
    const from = headers.find(h => h.name === "From")?.value ?? ""

    await supabase.from("pipelines").insert({
      user_email: session.user.email,
      company: from,
      role: subject,
      stage: "APPLIED",
      last_email_subject: subject,
      last_email_at: new Date().toISOString(),
    })
  }

  return NextResponse.json({ inserted: messages.length })
}

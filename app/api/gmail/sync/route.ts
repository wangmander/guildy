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

// ============================================================
// INSTANT REJECT PATTERNS
// ============================================================
const INSTANT_REJECT_PATTERNS: string[] = [
  "support ticket", "ticket number", "customer support",
  "billing", "billing update", "billing statement",
  "your order", "order status", "order confirmation", "order shipped",
  "special offer", "exclusive offer", "limited offer",
  "unsubscribe", "email preferences", "opt out", "opt-out",
  "tracking number", "track your order", "shipment",
  "your receipt", "payment receipt", "your invoice",
  "% off", "discount code", "promo code", "coupon",
  "shop now", "buy now", "sale ends", "free shipping",
  "verification code", "verify your email", "security code",
  "password reset", "new sign-in", "login attempt",
  "your statement", "bank statement", "your bill",
  "payment due", "apy", "cashback", "reward points",
  "now streaming", "new episode", "watch now",
  "friend request", "tagged you", "new follower",
  "food delivery", "flight confirmation", "hotel reservation",
  "refund processed", "return label",
  "newsletter", "weekly digest", "daily digest",
]

const BLOCKED_SENDER_PATTERNS: string[] = [
  "noreply@", "no-reply@", "notifications@", "marketing@",
  "promo@", "newsletter@", "support@", "billing@",
  "orders@", "shipping@", "alerts@", "donotreply@",
  "sendgrid.", "mailchimp.", "mailgun.",
]

// ============================================================
// EXPANDED POSITIVE PHRASES - Lower weights, more coverage
// ============================================================
const PHRASE_WEIGHTS: Array<{ phrase: string; w: number }> = [
  // Core recruiting signals
  { phrase: "interview", w: 8 },
  { phrase: "application", w: 6 },
  { phrase: "applying", w: 6 },
  { phrase: "applied", w: 6 },
  { phrase: "candidate", w: 5 },
  { phrase: "candidacy", w: 6 },
  { phrase: "recruiter", w: 7 },
  { phrase: "recruiting", w: 7 },
  { phrase: "talent", w: 5 },
  { phrase: "hiring", w: 6 },
  
  // Scheduling signals - EXPANDED
  { phrase: "schedule", w: 5 },
  { phrase: "scheduling", w: 5 },
  { phrase: "availability", w: 5 },
  { phrase: "available", w: 3 },
  { phrase: "slots", w: 5 },
  { phrase: "time slots", w: 6 },
  { phrase: "select", w: 3 },
  { phrase: "calendly", w: 6 },
  { phrase: "goodtime", w: 6 },
  { phrase: "calendar", w: 4 },
  { phrase: "book time", w: 5 },
  { phrase: "schedule time", w: 6 },
  { phrase: "set up a call", w: 6 },
  { phrase: "set up a chat", w: 6 },
  { phrase: "zoom", w: 4 },
  { phrase: "google meet", w: 4 },
  { phrase: "teams call", w: 4 },
  { phrase: "video call", w: 4 },
  { phrase: "phone call", w: 4 },
  { phrase: "30 minute", w: 4 },
  { phrase: "30-minute", w: 4 },
  { phrase: "45 minute", w: 4 },
  { phrase: "this week", w: 3 },
  { phrase: "next week", w: 3 },
  
  // Outreach signals - EXPANDED
  { phrase: "reaching out", w: 5 },
  { phrase: "reach out", w: 4 },
  { phrase: "on behalf of", w: 5 },
  { phrase: "move you forward", w: 7 },
  { phrase: "move forward", w: 6 },
  { phrase: "moving forward", w: 6 },
  { phrase: "next steps", w: 5 },
  { phrase: "love to", w: 4 },
  { phrase: "like to", w: 3 },
  { phrase: "discuss the role", w: 6 },
  { phrase: "discuss this role", w: 6 },
  { phrase: "discuss the position", w: 6 },
  { phrase: "discuss this opportunity", w: 6 },
  { phrase: "learn more about you", w: 5 },
  { phrase: "hear from you", w: 4 },
  { phrase: "connect with you", w: 4 },
  { phrase: "chat with you", w: 4 },
  { phrase: "speak with you", w: 4 },
  { phrase: "talk with you", w: 4 },
  
  // Job/role signals
  { phrase: "opportunity", w: 4 },
  { phrase: "position", w: 3 },
  { phrase: "role", w: 3 },
  { phrase: "job", w: 3 },
  { phrase: "open role", w: 5 },
  { phrase: "open position", w: 5 },
  
  // Screen/interview types
  { phrase: "phone screen", w: 7 },
  { phrase: "screening call", w: 7 },
  { phrase: "intro call", w: 6 },
  { phrase: "initial call", w: 6 },
  { phrase: "quick call", w: 5 },
  { phrase: "brief call", w: 5 },
  { phrase: "introductory", w: 5 },
  { phrase: "hiring manager", w: 7 },
  { phrase: "team lead", w: 6 },
  { phrase: "technical interview", w: 8 },
  { phrase: "onsite", w: 8 },
  { phrase: "on-site", w: 8 },
  { phrase: "final round", w: 8 },
  { phrase: "panel", w: 6 },
  
  // Assessments
  { phrase: "take-home", w: 7 },
  { phrase: "take home", w: 7 },
  { phrase: "coding challenge", w: 7 },
  { phrase: "assessment", w: 6 },
  { phrase: "hackerrank", w: 7 },
  { phrase: "codesignal", w: 7 },
  
  // Offers
  { phrase: "offer", w: 5 },
  { phrase: "offer letter", w: 8 },
  { phrase: "compensation", w: 6 },
  { phrase: "salary", w: 5 },
  { phrase: "background check", w: 7 },
  
  // Rejections
  { phrase: "unfortunately", w: 5 },
  { phrase: "regret", w: 5 },
  { phrase: "not moving forward", w: 8 },
  { phrase: "other candidates", w: 6 },
  { phrase: "position filled", w: 7 },
  
  // ATS systems
  { phrase: "greenhouse", w: 5 },
  { phrase: "lever", w: 5 },
  { phrase: "ashby", w: 5 },
  { phrase: "workday", w: 5 },
  
  // Profile interest
  { phrase: "your profile", w: 5 },
  { phrase: "your background", w: 5 },
  { phrase: "your experience", w: 5 },
  { phrase: "your resume", w: 5 },
  { phrase: "impressed", w: 4 },
  { phrase: "excited", w: 3 },
]

// LOWERED THRESHOLDS to catch more emails
const MIN_SCORE = 6
const MIN_STRONG_HIT_WEIGHT = 4

function normalize(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function normalizeForMatch(s: string) {
  return " " + normalize(s) + " "
}

function shouldInstantReject(textLower: string, fromEmail: string): boolean {
  const fromLower = fromEmail.toLowerCase()
  for (const pattern of BLOCKED_SENDER_PATTERNS) {
    if (fromLower.includes(pattern)) return true
  }
  for (const pattern of INSTANT_REJECT_PATTERNS) {
    if (textLower.includes(pattern.toLowerCase())) return true
  }
  return false
}

function hasBannerImages(html: string): boolean {
  if (!html) return false
  const imgTags = html.toLowerCase().match(/<img[^>]*>/g) || []
  if (imgTags.length > 4) return true
  for (const img of imgTags) {
    const widthMatch = img.match(/width\s*[=:]\s*["']?(\d+)/)
    if (widthMatch && parseInt(widthMatch[1]) > 500) return true
  }
  return false
}

function scoreEmailText(textLower: string) {
  const hay = normalizeForMatch(textLower)
  let score = 0
  let strongestHitWeight = 0
  const hits: string[] = []

  for (const item of PHRASE_WEIGHTS) {
    const needle = " " + normalize(item.phrase) + " "
    if (hay.includes(needle)) {
      score += item.w
      if (item.w > strongestHitWeight) strongestHitWeight = item.w
      hits.push(`${item.phrase}(${item.w})`)
    }
  }

  return { score, strongestHitWeight, hits }
}

function safeJsonParse<T>(s: any): T | null {
  try {
    if (!s) return null
    let cleaned = s
    if (typeof s === "string") {
      cleaned = s.trim()
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7)
      else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3)
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3)
      cleaned = cleaned.trim()
    }
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}

function decodeBase64Url(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/")
  const pad = normalized.length % 4
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized
  return Buffer.from(padded, "base64").toString("utf-8")
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractBodyFromPayload(payload: any): { text: string; html: string } {
  let text = ""
  let html = ""

  function walk(part: any) {
    if (!part) return
    const mime = (part.mimeType || "").toLowerCase()
    const bodyData = part.body?.data

    if (bodyData && typeof bodyData === "string") {
      const decoded = decodeBase64Url(bodyData)
      if (mime === "text/plain") text += "\n" + decoded
      if (mime === "text/html") html += "\n" + decoded
    }

    if (Array.isArray(part.parts)) {
      for (const p of part.parts) walk(p)
    }
  }

  walk(payload)
  return { text: text.trim(), html: html.trim() }
}

// ============================================================
// COMPREHENSIVE STAGE DETECTION GUIDE FOR LLM
// ============================================================
const STAGE_GUIDE = `
STAGE DETECTION - Be precise:

RECRUITER_SCREEN (UI: "SCREENING"):
- Application received/acknowledged
- Recruiter reaching out about a role
- Scheduling FIRST call (phone screen, intro call, 30-min chat)
- Keywords: "reaching out", "your application", "schedule a call", "availability", "phone screen", "intro call"

HM_SCREEN (UI: "HM"):
- Meeting with hiring manager specifically
- Meeting with team lead, director, VP (the person you'd report to)
- Keywords: "hiring manager", "team lead", "manager interview", "[Name] who leads"

ASSESSMENT (UI: "ASSESSMENT"):
- Take-home assignment sent
- Coding challenge (HackerRank, CodeSignal, etc.)
- Case study, design exercise, writing sample
- Keywords: "take-home", "coding challenge", "assessment", "assignment", "complete by"

LOOP (UI: "FULL_LOOP"):
- Multiple interviews in one day
- Onsite or virtual onsite
- Final round, panel interviews
- Keywords: "onsite", "virtual onsite", "final round", "panel", "full loop", "interview day"

OFFER (UI: "OFFER_DISCUSSION"):
- Offer extended
- Compensation discussion
- Background check initiated
- Keywords: "offer letter", "pleased to offer", "compensation", "background check", "start date"

REJECTED (UI: "REJECTED"):
- Application rejected
- Position filled
- Keywords: "unfortunately", "other candidates", "not moving forward", "position filled"

IMPORTANT: 
- If email says "schedule a call" or "share availability" for first conversation → RECRUITER_SCREEN
- If they mention specific person's title like "hiring manager" → HM_SCREEN
- Default to RECRUITER_SCREEN if unclear
`

// ============================================================
// LLM ANALYSIS - Returns camelCase for frontend compatibility
// ============================================================
async function analyzeEmail(input: {
  subject: string
  snippet: string
  fromEmail: string
  bodyExcerpt: string
  existingEmails?: Array<{ subject: string; snippet: string; from: string; date: string }>
}) {
  let threadContext = ""
  if (input.existingEmails && input.existingEmails.length > 0) {
    threadContext = `\nPREVIOUS EMAILS:\n` + input.existingEmails.map(e => 
      `- ${e.date}: ${e.subject} (${e.snippet.slice(0, 100)})`
    ).join("\n") + "\n\nNEW EMAIL:\n"
  }

  const systemPrompt = `You are Guildy, an expert interview pipeline analyzer.
${STAGE_GUIDE}

Analyze emails and return structured JSON with:
1. Is this a recruiting/interview email? (NOT marketing, support, newsletters)
2. Company name and job title
3. Current interview stage
4. Actionable insights and prep

Be SPECIFIC. Reference actual email content. No generic placeholders.
Output ONLY valid JSON.`

  const userPrompt = `${threadContext}From: ${input.fromEmail}
Subject: ${input.subject}
Snippet: ${input.snippet}
Body: ${input.bodyExcerpt.slice(0, 2000)}

Return JSON (use camelCase keys):
{
  "isRecruiting": boolean,
  "company": "Company Name",
  "role": "Job Title",
  "stageBucket": "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stageDetail": "Specific stage description",
  "insights": {
    "stageReason": "Why this stage - cite email text",
    "waitingOn": "you" | "them",
    "nextAction": "Specific action with deadline if mentioned",
    "urgency": "low" | "med" | "high",
    "responseLikelihood": "low" | "med" | "high", 
    "tone": "friendly" | "formal" | "neutral" | "urgent"
  },
  "prep": {
    "prepFocus": "What to prepare for this specific stage/company/role",
    "questionsTheyMightAsk": ["5 specific questions for this role"],
    "questionsYouShouldAsk": ["5 smart questions to ask them"],
    "whatToEmphasize": ["3 skills/experiences to highlight"],
    "storiesToPrepare": ["3 STAR story topics"],
    "homeworkNext24h": ["3 concrete prep tasks"],
    "companyIntel": {
      "industry": "string",
      "size": "string",
      "hqLocation": "string",
      "glassdoorRating": "string",
      "summary": "Brief company description",
      "recentNews": []
    }
  }
}`

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const parsed = safeJsonParse<any>(res.choices?.[0]?.message?.content || "")
    if (!parsed) return null

    // Ensure all required fields exist with defaults
    return {
      isRecruiting: parsed.isRecruiting ?? false,
      company: parsed.company || "Unknown",
      role: parsed.role || "Unknown",
      stageBucket: parsed.stageBucket || "RECRUITER_SCREEN",
      stageDetail: parsed.stageDetail || "Initial contact",
      insights: {
        stageReason: parsed.insights?.stageReason || "Email indicates recruiting activity",
        waitingOn: parsed.insights?.waitingOn || "you",
        nextAction: parsed.insights?.nextAction || "Review and respond to email",
        urgency: parsed.insights?.urgency || "med",
        responseLikelihood: parsed.insights?.responseLikelihood || "med",
        tone: parsed.insights?.tone || "neutral",
      },
      prep: {
        prepFocus: parsed.prep?.prepFocus || `Prepare for interview at ${parsed.company || "company"}`,
        questionsTheyMightAsk: parsed.prep?.questionsTheyMightAsk?.length > 0 
          ? parsed.prep.questionsTheyMightAsk 
          : ["Tell me about yourself", "Why this role?", "Relevant experience?", "Your strengths?", "Questions for us?"],
        questionsYouShouldAsk: parsed.prep?.questionsYouShouldAsk?.length > 0 
          ? parsed.prep.questionsYouShouldAsk 
          : ["What does success look like?", "Team structure?", "Biggest challenges?", "Growth opportunities?", "Next steps?"],
        whatToEmphasize: parsed.prep?.whatToEmphasize?.length > 0 
          ? parsed.prep.whatToEmphasize 
          : ["Relevant experience", "Problem-solving skills", "Communication"],
        storiesToPrepare: parsed.prep?.storiesToPrepare?.length > 0 
          ? parsed.prep.storiesToPrepare 
          : ["Challenging project", "Team collaboration", "Leadership moment"],
        homeworkNext24h: parsed.prep?.homeworkNext24h?.length > 0 
          ? parsed.prep.homeworkNext24h 
          : [`Research ${parsed.company || "company"}`, "Review job description", "Prepare intro pitch"],
        companyIntel: {
          industry: parsed.prep?.companyIntel?.industry || "Unknown",
          size: parsed.prep?.companyIntel?.size || "Unknown",
          hqLocation: parsed.prep?.companyIntel?.hqLocation || "Unknown",
          glassdoorRating: parsed.prep?.companyIntel?.glassdoorRating || "Unknown",
          summary: parsed.prep?.companyIntel?.summary || "Research needed",
          recentNews: parsed.prep?.companyIntel?.recentNews || [],
        },
      },
    }
  } catch (err) {
    console.error("LLM error:", err)
    return null
  }
}

// Map stage bucket to UI stage string
function getUiStage(bucket: string): string {
  const map: Record<string, string> = {
    "RECRUITER_SCREEN": "SCREENING",
    "HM_SCREEN": "HM",
    "ASSESSMENT": "ASSESSMENT",
    "LOOP": "FULL_LOOP",
    "OFFER": "OFFER_DISCUSSION",
    "REJECTED": "REJECTED",
  }
  return map[bucket] || "SCREENING"
}

// ============================================================
// MAIN SYNC
// ============================================================
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "NO SESSION" }, { status: 401 })

    const accessToken = (session as any).accessToken
    const userEmail = session.user?.email
    if (!accessToken || !userEmail) {
      return NextResponse.json({ error: "MISSING TOKEN OR EMAIL" }, { status: 401 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: "v1", auth })

    // Get messages
    const { data: lastEmailRows } = await supabase
      .from("emails")
      .select("received_at")
      .eq("user_email", userEmail)
      .order("received_at", { ascending: false })
      .limit(1)

    const lastMs = lastEmailRows?.[0]?.received_at ? new Date(lastEmailRows[0].received_at).getTime() : null
    const afterUnix = lastMs ? Math.floor((lastMs - 21 * 24 * 60 * 60 * 1000) / 1000) : null
    const q = afterUnix ? `after:${afterUnix} -in:trash -in:chats` : "newer_than:5y -in:trash -in:chats"

    let messages: Array<{ id?: string | null }> = []
    let pageToken: string | undefined

    do {
      const page = await gmail.users.messages.list({ userId: "me", q, maxResults: 100, pageToken })
      messages = messages.concat(page.data.messages ?? [])
      pageToken = page.data.nextPageToken ?? undefined
    } while (pageToken && messages.length < 300)

    const stats = { scanned: messages.length, skipped: 0, rejected: 0, accepted: 0, inserted: 0, updated: 0 }

    const { data: existingPipelines } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)

    const pipelines = existingPipelines ?? []

    for (const msg of messages) {
      if (!msg.id) continue

      // Skip if already processed
      const { data: existing } = await supabase
        .from("emails")
        .select("id")
        .eq("user_email", userEmail)
        .eq("gmail_message_id", msg.id)
        .maybeSingle()

      if (existing) {
        stats.skipped++
        continue
      }

      // Fetch message
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" })
      const headers = full.data.payload?.headers ?? []
      const subject = headers.find(h => h.name === "Subject")?.value || ""
      const fromHeader = headers.find(h => h.name === "From")?.value || ""
      const dateHeader = headers.find(h => h.name === "Date")?.value || ""
      const snippet = full.data.snippet || ""

      const fromMatch = fromHeader.match(/<([^>]+)>/)
      const fromEmail = (fromMatch?.[1] || fromHeader || "").trim()

      const internalMs = full.data.internalDate ? Number(full.data.internalDate) : NaN
      const receivedAt = Number.isFinite(internalMs)
        ? new Date(internalMs).toISOString()
        : dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()

      const { text: bodyPlain, html: bodyHtml } = extractBodyFromPayload(full.data.payload)
      const bodyText = bodyPlain || (bodyHtml ? stripHtml(bodyHtml) : "")
      const fullText = `${subject}\n${snippet}\n${fromHeader}\n${bodyText}`
      const textLower = fullText.toLowerCase()

      // Gate 1: Instant reject
      if (shouldInstantReject(textLower, fromEmail)) {
        stats.rejected++
        continue
      }

      // Gate 2: Banner images
      if (hasBannerImages(bodyHtml)) {
        stats.rejected++
        continue
      }

      // Gate 3: Score
      const { score, strongestHitWeight, hits } = scoreEmailText(textLower)
      console.log(`[SCORE] "${subject.slice(0, 40)}": ${score} (strongest: ${strongestHitWeight}) - ${hits.join(", ")}`)
      
      if (score < MIN_SCORE || strongestHitWeight < MIN_STRONG_HIT_WEIGHT) {
        stats.rejected++
        continue
      }

      // Find existing pipeline by domain
      const fromDomain = fromEmail.split("@")[1]?.split(".")[0] || ""
      const existingPipeline = pipelines.find((p: any) => {
        const pc = normalize(p.company)
        const ed = normalize(fromDomain)
        return pc.includes(ed) || ed.includes(pc)
      })

      // Get thread context
      let existingEmails: Array<{ subject: string; snippet: string; from: string; date: string }> = []
      if (existingPipeline) {
        const { data: pEmails } = await supabase
          .from("emails")
          .select("subject, snippet, from_email, received_at")
          .eq("pipeline_id", existingPipeline.id)
          .order("received_at", { ascending: true })

        existingEmails = (pEmails || []).map(e => ({
          subject: e.subject || "",
          snippet: e.snippet || "",
          from: e.from_email || "",
          date: e.received_at || "",
        }))
      }

      // LLM Analysis
      const analysis = await analyzeEmail({
        subject,
        snippet,
        fromEmail,
        bodyExcerpt: bodyText.slice(0, 3000),
        existingEmails: existingEmails.length > 0 ? existingEmails : undefined,
      })

      if (!analysis || !analysis.isRecruiting) {
        stats.rejected++
        continue
      }

      stats.accepted++

      const company = analysis.company || "Unknown"
      const role = analysis.role || "Unknown"
      const uiStage = getUiStage(analysis.stageBucket)

      // Find or create pipeline
      const companyN = normalize(company)
      let matchedPipeline = pipelines.find((p: any) => {
        const pc = normalize(p.company)
        return pc === companyN || pc.includes(companyN) || companyN.includes(pc)
      })

      let pipelineId: string

      if (!matchedPipeline) {
        // Create new
        const { data: created, error } = await supabase
          .from("pipelines")
          .insert({
            user_email: userEmail,
            company,
            role,
            stage: uiStage,
            stage_detail: analysis.stageDetail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail || fromHeader,
            last_email_snippet: snippet,
            insights_json: analysis.insights,
            prep_json: analysis.prep,
          })
          .select()
          .single()

        if (error || !created?.id) {
          console.error("Create error:", error)
          continue
        }

        pipelineId = created.id
        pipelines.push(created)
        stats.inserted++

      } else {
        // Update existing
        pipelineId = matchedPipeline.id

        await supabase
          .from("pipelines")
          .update({
            stage: uiStage,
            stage_detail: analysis.stageDetail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail || fromHeader,
            last_email_snippet: snippet,
            insights_json: analysis.insights,
            prep_json: analysis.prep,
          })
          .eq("id", pipelineId)

        // Update local cache
        matchedPipeline.stage = uiStage
        matchedPipeline.stage_detail = analysis.stageDetail
        matchedPipeline.insights_json = analysis.insights
        matchedPipeline.prep_json = analysis.prep

        stats.updated++
      }

      // Insert email
      await supabase.from("emails").insert({
        user_email: userEmail,
        pipeline_id: pipelineId,
        gmail_message_id: msg.id,
        from_email: fromEmail || fromHeader,
        subject,
        snippet,
        received_at: receivedAt,
      })
    }

    return NextResponse.json({ success: true, stats })
  } catch (err: any) {
    console.error("Sync error:", err)
    return NextResponse.json({ error: "EXCEPTION", message: err?.message }, { status: 500 })
  }
}

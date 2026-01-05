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
// INSTANT REJECT - Only obvious non-recruiting
// ============================================================
const INSTANT_REJECT_PATTERNS: string[] = [
  // Transactional
  "your order has shipped", "tracking number:", "out for delivery",
  "payment received", "payment failed", "invoice attached",
  "receipt for your", "your receipt from",
  
  // Marketing
  "unsubscribe from", "email preferences", "opt out of",
  "% off", "limited time offer", "flash sale", "shop now",
  "exclusive deal", "promo code:", "coupon code:",
  
  // Security
  "verify your email", "verification code:", "reset your password",
  "suspicious sign-in", "two-factor authentication",
  
  // Social
  "friend request", "tagged you in", "liked your post",
  "new follower", "commented on your",
  
  // Support
  "ticket #", "case #", "support ticket",
]

// ============================================================
// BLOCKED SENDERS - Automated/Marketing addresses
// ============================================================
const BLOCKED_SENDER_PATTERNS: string[] = [
  "noreply@", "no-reply@", "donotreply@",
  "notifications@", "marketing@", "promo@",
  "newsletter@", "updates@", "alerts@",
  "mailer-daemon", "postmaster@",
  "sendgrid.net", "mailchimp", "mailgun",
]

// ============================================================
// RECRUITING SIGNALS - Comprehensive
// ============================================================
const PHRASE_WEIGHTS: Array<{ phrase: string; w: number }> = [
  // Tier 1: Definitive (10)
  { phrase: "interview", w: 10 },
  { phrase: "your application", w: 10 },
  { phrase: "application status", w: 10 },
  { phrase: "thanks for applying", w: 10 },
  { phrase: "thank you for applying", w: 10 },
  { phrase: "received your application", w: 10 },
  { phrase: "your candidacy", w: 10 },
  { phrase: "not moving forward", w: 10 },
  { phrase: "regret to inform", w: 10 },
  
  // Tier 2: Strong (8-9)
  { phrase: "phone screen", w: 9 },
  { phrase: "screening call", w: 9 },
  { phrase: "recruiter", w: 8 },
  { phrase: "recruiting", w: 8 },
  { phrase: "hiring manager", w: 9 },
  { phrase: "hiring team", w: 8 },
  { phrase: "talent team", w: 8 },
  { phrase: "talent acquisition", w: 8 },
  { phrase: "people team", w: 8 },
  { phrase: "onsite", w: 9 },
  { phrase: "on-site", w: 9 },
  { phrase: "virtual onsite", w: 9 },
  { phrase: "final round", w: 9 },
  { phrase: "offer letter", w: 9 },
  { phrase: "job offer", w: 9 },
  { phrase: "extend an offer", w: 9 },
  { phrase: "take-home", w: 8 },
  { phrase: "take home", w: 8 },
  { phrase: "coding challenge", w: 8 },
  { phrase: "technical assessment", w: 8 },
  { phrase: "move you forward", w: 9 },
  { phrase: "moving forward", w: 8 },
  { phrase: "next round", w: 8 },
  { phrase: "next steps", w: 7 },
  { phrase: "interested in your profile", w: 9 },
  { phrase: "interested in your background", w: 9 },
  { phrase: "impressed by your", w: 8 },
  
  // Tier 3: Medium (6-7)
  { phrase: "schedule a call", w: 7 },
  { phrase: "schedule time", w: 7 },
  { phrase: "set up a call", w: 7 },
  { phrase: "intro call", w: 7 },
  { phrase: "introductory call", w: 7 },
  { phrase: "initial call", w: 7 },
  { phrase: "quick call", w: 6 },
  { phrase: "chat about", w: 6 },
  { phrase: "discuss the role", w: 8 },
  { phrase: "discuss this role", w: 8 },
  { phrase: "discuss the position", w: 8 },
  { phrase: "discuss the opportunity", w: 7 },
  { phrase: "open role", w: 7 },
  { phrase: "open position", w: 7 },
  { phrase: "job opportunity", w: 7 },
  { phrase: "career opportunity", w: 7 },
  { phrase: "reaching out on behalf", w: 8 },
  { phrase: "reaching out about", w: 7 },
  { phrase: "love to chat", w: 7 },
  { phrase: "love to connect", w: 7 },
  { phrase: "calendly", w: 6 },
  { phrase: "goodtime", w: 6 },
  { phrase: "greenhouse", w: 6 },
  { phrase: "lever", w: 6 },
  { phrase: "ashby", w: 6 },
  { phrase: "workday", w: 6 },
  
  // Tier 4: Supportive (4-5)
  { phrase: "availability", w: 5 },
  { phrase: "available", w: 4 },
  { phrase: "select a few slots", w: 6 },
  { phrase: "select slots", w: 5 },
  { phrase: "time slots", w: 5 },
  { phrase: "your resume", w: 5 },
  { phrase: "your cv", w: 5 },
  { phrase: "your background", w: 5 },
  { phrase: "your experience", w: 5 },
  { phrase: "your profile", w: 5 },
  { phrase: "candidate", w: 4 },
  { phrase: "position", w: 3 },
  { phrase: "role", w: 3 },
  { phrase: "opportunity", w: 3 },
  { phrase: "30 minute", w: 4 },
  { phrase: "zoom", w: 3 },
  { phrase: "google meet", w: 3 },
  { phrase: "teams call", w: 3 },
]

const MIN_SCORE = 6
const MIN_STRONG_HIT = 4

// ============================================================
// STAGE DETECTION PROMPT - Concise but comprehensive
// ============================================================
const STAGE_DETECTION_PROMPT = `
STAGE DETECTION SYSTEM - Determine interview stage accurately.

## STAGES (in order of progression):

### RECRUITER_SCREEN (UI: "Screening")
First contact, application acknowledgment, scheduling initial call.
Signals: "received your application", "reaching out", "schedule a call", "phone screen", "intro call", "select slots", "share your availability", "love to chat", "discuss the role"

### HM_SCREEN (UI: "Hiring manager") 
Meeting with hiring manager / potential direct manager.
Signals: "hiring manager", "team lead", "engineering manager", "design manager", "director", "VP", "[Name] who leads", "manager interview"
By function: Eng→"engineering manager/tech lead/CTO", Design→"design manager/head of design", PM→"product lead/head of product", Sales→"sales director/VP sales"

### ASSESSMENT (UI: "Assessment")
Technical tests, take-homes, coding challenges, case studies, exercises.
Signals: "take-home", "coding challenge", "technical assessment", "HackerRank", "CodeSignal", "case study", "design exercise", "assignment", "complete by [deadline]"
By function: Eng→"coding test/system design exercise", Design→"portfolio review/design challenge", PM→"product case/PRD exercise", Sales→"mock pitch/role play", Finance→"modeling test"

### LOOP (UI: "Full loop")
Final rounds - onsite, virtual onsite, panel, multiple back-to-back interviews.
Signals: "onsite", "virtual onsite", "full loop", "interview loop", "panel interview", "final round", "meet the team", "series of interviews", "superday", "bar raiser", "full day of interviews"

### OFFER (UI: "Offer discussion")
Offer extended, compensation discussion, negotiation.
Signals: "offer letter", "extend an offer", "pleased to offer", "compensation", "salary", "equity", "RSUs", "background check", "start date", "welcome to the team"

### REJECTED
Process ended.
Signals: "not moving forward", "other candidates", "position filled", "unfortunately", "regret to inform", "not selected"

## RULES:
1. Use MOST RECENT email to determine current stage
2. Look for explicit stage indicators
3. Default to RECRUITER_SCREEN if scheduling first conversation
4. Stage only advances forward (except rejection at any point)
5. Be specific in stage_detail about exactly what's happening
`

// ============================================================
// HELPERS
// ============================================================
function normalize(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function normalizeForMatch(s: string) {
  return " " + normalize(s) + " "
}

function shouldInstantReject(textLower: string, fromEmail: string): boolean {
  const fromLower = fromEmail.toLowerCase()
  for (const p of BLOCKED_SENDER_PATTERNS) {
    if (fromLower.includes(p)) {
      console.log(`[REJECT] Blocked sender: ${p}`)
      return true
    }
  }
  for (const p of INSTANT_REJECT_PATTERNS) {
    if (textLower.includes(p.toLowerCase())) {
      console.log(`[REJECT] Instant reject pattern: ${p}`)
      return true
    }
  }
  return false
}

function hasBannerImages(html: string): boolean {
  if (!html) return false
  const imgTags = html.toLowerCase().match(/<img[^>]*>/g) || []
  if (imgTags.length > 5) return true
  for (const img of imgTags) {
    const w = img.match(/width\s*[=:]\s*["']?(\d+)/)
    if (w && parseInt(w[1]) > 550) return true
  }
  return false
}

function scoreEmailText(textLower: string) {
  const hay = normalizeForMatch(textLower)
  let score = 0
  let strongest = 0
  const hits: string[] = []

  for (const item of PHRASE_WEIGHTS) {
    const needle = " " + normalize(item.phrase) + " "
    if (hay.includes(needle)) {
      score += item.w
      if (item.w > strongest) strongest = item.w
      hits.push(`${item.phrase}(${item.w})`)
    }
  }

  return { score, strongest, hits }
}

function safeJsonParse<T>(s: any): T | null {
  try {
    if (!s) return null
    let cleaned = typeof s === "string" ? s.trim() : s
    if (typeof cleaned === "string") {
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
  const n = data.replace(/-/g, "+").replace(/_/g, "/")
  const pad = n.length % 4
  return Buffer.from(pad ? n + "=".repeat(4 - pad) : n, "base64").toString("utf-8")
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
    if (bodyData) {
      const decoded = decodeBase64Url(bodyData)
      if (mime === "text/plain") text += "\n" + decoded
      if (mime === "text/html") html += "\n" + decoded
    }
    if (Array.isArray(part.parts)) part.parts.forEach(walk)
  }
  walk(payload)
  return { text: text.trim(), html: html.trim() }
}

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
// LLM ANALYSIS
// ============================================================
async function analyzeEmail(input: {
  subject: string
  snippet: string
  fromEmail: string
  fromName: string
  bodyExcerpt: string
  threadEmails?: Array<{ subject: string; snippet: string; from: string; date: string }>
}) {
  let threadContext = ""
  if (input.threadEmails && input.threadEmails.length > 0) {
    threadContext = "\n\nPREVIOUS EMAILS (oldest first):\n"
    for (const e of input.threadEmails) {
      threadContext += `[${e.date}] ${e.from}: ${e.subject} - ${e.snippet.slice(0, 150)}\n`
    }
    threadContext += "\nNEW EMAIL:\n"
  }

  const systemPrompt = `You are Guildy, an expert interview pipeline analyzer.

${STAGE_DETECTION_PROMPT}

COMPANY TYPES for context-aware prep:
- STARTUP: <100 employees, founder interviews common, informal
- SCALE_UP: 100-1000 employees, structured but fast
- ENTERPRISE: 1000+ employees, formal multi-stage
- FAANG: Google, Meta, Apple, Amazon, Netflix, Microsoft - "loop", "bar raiser", levels (L3-L7)
- CONSULTING: McKinsey, BCG, Bain - case interviews, fit interviews
- FINANCE: Goldman, JP Morgan, hedge funds - superday, modeling tests

JOB FUNCTIONS:
ENGINEERING, DESIGN, PRODUCT, SALES, MARKETING, FINANCE, OPERATIONS, HR, LEGAL, EXECUTIVE, OTHER

Analyze the email and return ONLY valid JSON.`

  const userPrompt = `${threadContext}From: ${input.fromName} <${input.fromEmail}>
Subject: ${input.subject}
Snippet: ${input.snippet}
Body: ${input.bodyExcerpt.slice(0, 2000)}

Return JSON:
{
  "is_recruiting": boolean,
  "company": "Company Name",
  "role": "Job Title or Unknown",
  "company_type": "STARTUP|SCALE_UP|ENTERPRISE|FAANG|CONSULTING|FINANCE|OTHER",
  "job_function": "ENGINEERING|DESIGN|PRODUCT|SALES|MARKETING|FINANCE|OPERATIONS|HR|LEGAL|EXECUTIVE|OTHER",
  "stage_bucket": "RECRUITER_SCREEN|HM_SCREEN|ASSESSMENT|LOOP|OFFER|REJECTED",
  "stage_detail": "Specific description of current stage",
  "insights": {
    "stageReason": "Why this stage - cite specific email signals",
    "waitingOn": "you|them",
    "nextAction": "Specific action to take",
    "urgency": "low|med|high",
    "responseLikelihood": "low|med|high",
    "tone": "friendly|formal|neutral|urgent"
  },
  "prep": {
    "stageFocus": "What to prepare for this stage/company/role",
    "questionsTheyMightAsk": ["5 specific questions for this role at this company type"],
    "questionsYouShouldAsk": ["5 smart questions to ask them"],
    "whatToEmphasize": ["3 key things to highlight"],
    "storiesToPrepare": ["3 STAR story topics"],
    "homeworkNext24h": ["3 concrete prep tasks"],
    "companyIntel": {
      "industry": "string",
      "size": "string",
      "hqLocation": "string or Unknown",
      "glassdoorRating": "string or Unknown",
      "summary": "Brief company description",
      "recentNews": []
    }
  }
}`

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const content = res.choices?.[0]?.message?.content || ""
    console.log(`[LLM] Response length: ${content.length}`)
    
    const parsed = safeJsonParse<any>(content)
    if (!parsed) {
      console.error("[LLM] Parse failed:", content.slice(0, 300))
      return null
    }

    // Ensure defaults
    return {
      is_recruiting: parsed.is_recruiting ?? false,
      company: parsed.company || "Unknown",
      role: parsed.role || "Unknown",
      company_type: parsed.company_type || "OTHER",
      job_function: parsed.job_function || "OTHER",
      stage_bucket: parsed.stage_bucket || "RECRUITER_SCREEN",
      stage_detail: parsed.stage_detail || "Initial contact",
      insights: {
        stageReason: parsed.insights?.stageReason || "Recruiting email detected",
        waitingOn: parsed.insights?.waitingOn || "you",
        nextAction: parsed.insights?.nextAction || "Review and respond",
        urgency: parsed.insights?.urgency || "med",
        responseLikelihood: parsed.insights?.responseLikelihood || "med",
        tone: parsed.insights?.tone || "neutral",
      },
      prep: {
        stageFocus: parsed.prep?.stageFocus || "Prepare for interview",
        questionsTheyMightAsk: parsed.prep?.questionsTheyMightAsk?.length > 0 ? parsed.prep.questionsTheyMightAsk : ["Tell me about yourself", "Why this role?", "Relevant experience?", "Your strengths?", "Questions for us?"],
        questionsYouShouldAsk: parsed.prep?.questionsYouShouldAsk?.length > 0 ? parsed.prep.questionsYouShouldAsk : ["What does success look like?", "Team structure?", "Biggest challenges?", "Growth opportunities?", "Next steps?"],
        whatToEmphasize: parsed.prep?.whatToEmphasize?.length > 0 ? parsed.prep.whatToEmphasize : ["Relevant experience", "Problem-solving", "Communication"],
        storiesToPrepare: parsed.prep?.storiesToPrepare?.length > 0 ? parsed.prep.storiesToPrepare : ["Challenging project", "Team collaboration", "Leadership moment"],
        homeworkNext24h: parsed.prep?.homeworkNext24h?.length > 0 ? parsed.prep.homeworkNext24h : ["Research company", "Review job description", "Prepare intro"],
        companyIntel: parsed.prep?.companyIntel || { industry: "Unknown", size: "Unknown", hqLocation: "Unknown", glassdoorRating: "Unknown", summary: "", recentNews: [] },
      },
    }
  } catch (err) {
    console.error("[LLM] Error:", err)
    return null
  }
}

// ============================================================
// MAIN SYNC - GET for status, POST for sync
// ============================================================
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: "NO SESSION" }, { status: 401 })
    
    const { count } = await supabase
      .from("emails")
      .select("*", { count: "exact", head: true })
      .eq("user_email", session.user.email)
    
    return NextResponse.json({ emailCount: count || 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST() {
  console.log("[SYNC] Starting...")
  
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

    // Get last sync time
    const { data: lastEmailRows } = await supabase
      .from("emails")
      .select("received_at")
      .eq("user_email", userEmail)
      .order("received_at", { ascending: false })
      .limit(1)

    const lastMs = lastEmailRows?.[0]?.received_at ? new Date(lastEmailRows[0].received_at).getTime() : null
    const afterUnix = lastMs ? Math.floor((lastMs - 21 * 24 * 60 * 60 * 1000) / 1000) : null
    const q = afterUnix ? `after:${afterUnix} -in:trash -in:chats` : "newer_than:1y -in:trash -in:chats"

    console.log(`[SYNC] Query: ${q}`)

    // Fetch messages
    let messages: Array<{ id?: string | null }> = []
    let pageToken: string | undefined

    do {
      const page = await gmail.users.messages.list({ userId: "me", q, maxResults: 50, pageToken })
      messages = messages.concat(page.data.messages ?? [])
      pageToken = page.data.nextPageToken ?? undefined
    } while (pageToken && messages.length < 200)

    console.log(`[SYNC] Found ${messages.length} messages`)

    const stats = { scanned: messages.length, skipped: 0, rejected: 0, accepted: 0, inserted: 0, updated: 0 }

    const { data: existingPipelines } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)

    const pipelines = existingPipelines ?? []

    for (const msg of messages) {
      if (!msg.id) continue

      // Check if already processed
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

      // Fetch full message
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" })
      const headers = full.data.payload?.headers ?? []
      const subject = headers.find(h => h.name === "Subject")?.value || "(no subject)"
      const fromHeader = headers.find(h => h.name === "From")?.value || ""
      const dateHeader = headers.find(h => h.name === "Date")?.value || ""
      const snippet = full.data.snippet || ""

      const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/)
      const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : fromHeader
      const fromEmail = fromMatch ? fromMatch[2].trim() : fromHeader

      const internalMs = full.data.internalDate ? Number(full.data.internalDate) : NaN
      const receivedAt = Number.isFinite(internalMs) ? new Date(internalMs).toISOString() : new Date(dateHeader || Date.now()).toISOString()

      const { text: bodyPlain, html: bodyHtml } = extractBodyFromPayload(full.data.payload)
      const bodyText = bodyPlain || (bodyHtml ? stripHtml(bodyHtml) : "")
      const fullText = `${subject}\n${snippet}\n${fromHeader}\n${bodyText}`
      const textLower = fullText.toLowerCase()

      // Gate 1: Instant reject
      if (shouldInstantReject(textLower, fromEmail)) {
        stats.rejected++
        continue
      }

      // Gate 2: Banner check
      if (hasBannerImages(bodyHtml)) {
        console.log(`[REJECT] Banner images: ${subject.slice(0, 40)}`)
        stats.rejected++
        continue
      }

      // Gate 3: Score check
      const { score, strongest, hits } = scoreEmailText(textLower)
      console.log(`[SCORE] "${subject.slice(0, 40)}": ${score} (max=${strongest}) [${hits.slice(0, 5).join(", ")}]`)

      if (score < MIN_SCORE || strongest < MIN_STRONG_HIT) {
        stats.rejected++
        continue
      }

      // Find existing pipeline by domain
      const fromDomain = fromEmail.split("@")[1]?.split(".")[0] || ""
      const existingPipeline = pipelines.find((p: any) => {
        const pc = normalize(p.company)
        const ed = normalize(fromDomain)
        return pc && ed && (pc.includes(ed) || ed.includes(pc))
      })

      // Get thread context
      let threadEmails: Array<{ subject: string; snippet: string; from: string; date: string }> = []
      if (existingPipeline) {
        const { data: pEmails } = await supabase
          .from("emails")
          .select("subject, snippet, from_email, received_at")
          .eq("pipeline_id", existingPipeline.id)
          .order("received_at", { ascending: true })

        threadEmails = (pEmails || []).map(e => ({
          subject: e.subject || "",
          snippet: e.snippet || "",
          from: e.from_email || "",
          date: e.received_at || "",
        }))
      }

      // LLM Analysis
      console.log(`[LLM] Analyzing: ${subject.slice(0, 50)}`)
      const analysis = await analyzeEmail({
        subject,
        snippet,
        fromEmail,
        fromName,
        bodyExcerpt: bodyText.slice(0, 2500),
        threadEmails: threadEmails.length > 0 ? threadEmails : undefined,
      })

      if (!analysis) {
        console.log(`[LLM] No analysis returned`)
        stats.rejected++
        continue
      }

      console.log(`[LLM] is_recruiting=${analysis.is_recruiting}, company=${analysis.company}, stage=${analysis.stage_bucket}`)

      if (!analysis.is_recruiting) {
        console.log(`[REJECT] LLM: not recruiting`)
        stats.rejected++
        continue
      }

      stats.accepted++

      const company = analysis.company || "Unknown"
      const role = analysis.role || "Unknown"
      const uiStage = getUiStage(analysis.stage_bucket)

      // Find or create pipeline
      const companyN = normalize(company)
      let matchedPipeline = pipelines.find((p: any) => {
        const pc = normalize(p.company)
        return pc && companyN && (pc === companyN || pc.includes(companyN) || companyN.includes(pc))
      })

      let pipelineId: string

      if (!matchedPipeline) {
        console.log(`[NEW] Creating pipeline: ${company} - ${role} @ ${uiStage}`)
        
        const { data: created, error } = await supabase
          .from("pipelines")
          .insert({
            user_email: userEmail,
            company,
            role,
            stage: uiStage,
            stage_detail: analysis.stage_detail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail,
            last_email_from_name: fromName,
            last_email_snippet: snippet,
            insights_json: analysis.insights,
            prep_json: analysis.prep,
          })
          .select()
          .single()

        if (error) {
          console.error(`[ERROR] Insert pipeline:`, error)
          continue
        }

        pipelineId = created.id
        pipelines.push(created)
        stats.inserted++

      } else {
        pipelineId = matchedPipeline.id
        const oldStage = matchedPipeline.stage

        console.log(`[UPDATE] ${company}: ${oldStage} → ${uiStage}`)

        await supabase
          .from("pipelines")
          .update({
            stage: uiStage,
            stage_detail: analysis.stage_detail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail,
            last_email_from_name: fromName,
            last_email_snippet: snippet,
            insights_json: analysis.insights,
            prep_json: analysis.prep,
          })
          .eq("id", pipelineId)

        matchedPipeline.stage = uiStage
        stats.updated++
      }

      // Insert email
      await supabase.from("emails").insert({
        user_email: userEmail,
        pipeline_id: pipelineId,
        gmail_message_id: msg.id,
        from_email: fromEmail,
        subject,
        snippet,
        received_at: receivedAt,
      })
    }

    console.log(`[SYNC] Done:`, stats)
    return NextResponse.json({ success: true, stats })

  } catch (err: any) {
    console.error("[SYNC] Error:", err)
    return NextResponse.json({ error: "EXCEPTION", message: err?.message }, { status: 500 })
  }
}

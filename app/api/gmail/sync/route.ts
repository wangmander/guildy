import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { google } from "googleapis"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import OpenAI from "openai"

const openaiKey = process.env.OPENAI_API_KEY

// Service role client from supabaseAdmin (bypasses RLS)
const supabase = supabaseAdmin

const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null

// ============================================================
// INSTANT REJECT - Minimal, only obvious non-recruiting
// ============================================================
const INSTANT_REJECT_PATTERNS: string[] = [
  // Shipping/Orders
  "your order has shipped", "tracking number", "out for delivery",
  "order confirmation", "shipping confirmation",

  // Payments
  "payment received", "payment failed", "your receipt",

  // Marketing
  "% off", "limited time offer", "flash sale",
  "promo code", "coupon code", "exclusive deal",
  "unsubscribe here", "manage email preferences",

  // Security
  "verify your email address", "verification code",
  "reset your password", "suspicious sign-in",

  // Social
  "friend request", "tagged you", "liked your post",
  "new follower", "commented on",
]

const BLOCKED_SENDER_PATTERNS: string[] = [
  "noreply@", "no-reply@", "donotreply@",
  "mailer-daemon", "postmaster@",
  "sendgrid.net", "mailchimp.com", "mailgun.org",
]

// ============================================================
// RECRUITING PHRASE WEIGHTS - Comprehensive
// ============================================================
const PHRASE_WEIGHTS: Array<{ phrase: string; w: number }> = [
  // === DEFINITIVE SIGNALS (10) ===
  { phrase: "interview", w: 10 },
  { phrase: "your application", w: 10 },
  { phrase: "thanks for applying", w: 10 },
  { phrase: "thank you for applying", w: 10 },
  { phrase: "received your application", w: 10 },
  { phrase: "application status", w: 10 },
  { phrase: "your candidacy", w: 10 },
  { phrase: "not moving forward", w: 10 },
  { phrase: "regret to inform", w: 10 },

  // === STRONG SIGNALS (8-9) ===
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
  { phrase: "extend an offer", w: 9 },
  { phrase: "job offer", w: 9 },
  { phrase: "take-home", w: 8 },
  { phrase: "take home", w: 8 },
  { phrase: "coding challenge", w: 8 },
  { phrase: "technical assessment", w: 8 },
  { phrase: "move you forward", w: 9 },
  { phrase: "moving you forward", w: 9 },
  { phrase: "moving forward", w: 8 },
  { phrase: "move forward", w: 8 },
  { phrase: "next round", w: 8 },
  { phrase: "next steps", w: 7 },
  { phrase: "interested in your profile", w: 9 },
  { phrase: "interested in your background", w: 9 },
  { phrase: "impressed by your", w: 8 },
  { phrase: "love to move you forward", w: 9 },

  // === MEDIUM SIGNALS (6-7) ===
  { phrase: "schedule a call", w: 7 },
  { phrase: "schedule time", w: 7 },
  { phrase: "schedule an interview", w: 8 },
  { phrase: "set up a call", w: 7 },
  { phrase: "set up time", w: 6 },
  { phrase: "intro call", w: 7 },
  { phrase: "introductory call", w: 7 },
  { phrase: "initial call", w: 7 },
  { phrase: "quick call", w: 6 },
  { phrase: "brief call", w: 6 },
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
  { phrase: "reaching out regarding", w: 7 },
  { phrase: "love to chat", w: 7 },
  { phrase: "love to connect", w: 7 },
  { phrase: "would love to", w: 6 },
  { phrase: "calendly", w: 6 },
  { phrase: "goodtime", w: 6 },
  { phrase: "greenhouse", w: 6 },
  { phrase: "lever", w: 6 },
  { phrase: "ashby", w: 6 },
  { phrase: "workday", w: 6 },

  // === SUPPORTIVE SIGNALS (4-5) ===
  { phrase: "availability", w: 5 },
  { phrase: "share your availability", w: 6 },
  { phrase: "select a few slots", w: 6 },
  { phrase: "select slots", w: 5 },
  { phrase: "time slots", w: 5 },
  { phrase: "pick a time", w: 5 },
  { phrase: "your resume", w: 5 },
  { phrase: "your cv", w: 5 },
  { phrase: "your background", w: 5 },
  { phrase: "your experience", w: 5 },
  { phrase: "your profile", w: 5 },
  { phrase: "candidate", w: 4 },
  { phrase: "candidacy", w: 5 },
  { phrase: "position", w: 3 },
  { phrase: "role", w: 3 },
  { phrase: "opportunity", w: 3 },
  { phrase: "30 minute", w: 4 },
  { phrase: "30-minute", w: 4 },
  { phrase: "45 minute", w: 4 },
  { phrase: "zoom call", w: 4 },
  { phrase: "zoom interview", w: 5 },
  { phrase: "google meet", w: 4 },
  { phrase: "teams call", w: 4 },
  { phrase: "video call", w: 4 },
  { phrase: "this week", w: 3 },
  { phrase: "next week", w: 3 },
  { phrase: "hiring", w: 4 },
  { phrase: "talent", w: 3 },
  { phrase: "application", w: 4 },
  { phrase: "applied", w: 4 },
  { phrase: "applying", w: 4 },
]

const MIN_SCORE = 5
const MIN_STRONG_HIT = 4

// ============================================================
// HELPERS
// ============================================================
function normalize(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function normalizeForMatch(s: string) {
  return " " + normalize(s) + " "
}

function shouldInstantReject(textLower: string, fromEmail: string): { reject: boolean; reason?: string } {
  const fromLower = fromEmail.toLowerCase()
  for (const p of BLOCKED_SENDER_PATTERNS) {
    if (fromLower.includes(p)) return { reject: true, reason: `blocked_sender:${p}` }
  }
  for (const p of INSTANT_REJECT_PATTERNS) {
    if (textLower.includes(p.toLowerCase())) return { reject: true, reason: `instant_reject:${p}` }
  }
  return { reject: false }
}

function hasBannerImages(html: string): boolean {
  if (!html) return false
  const imgTags = html.toLowerCase().match(/<img[^>]*>/g) || []
  if (imgTags.length > 6) return true
  for (const img of imgTags) {
    const w = img.match(/width\s*[=:]\s*["']?(\d+)/)
    if (w && parseInt(w[1]) > 600) return true
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
// LLM ANALYSIS - Comprehensive stage detection
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
    threadContext = "\n\nPREVIOUS EMAILS IN THREAD (oldest first):\n"
    for (const e of input.threadEmails) {
      threadContext += `[${e.date}] ${e.from}: "${e.subject}" - ${e.snippet.slice(0, 100)}\n`
    }
    threadContext += "\nNEW EMAIL TO ANALYZE:\n"
  }

  const systemPrompt = `IDENTITY:
You are a WORLD-CLASS TECHNICAL INTERVIEW COACH and STRATEGIST. You do not give generic advice. You are "spicy", opinionated, and highly specific. You reverse-engineer the company's culture, stack, and hidden challenges to give the candidate an UNFAIR ADVANTAGE.

GOLD STANDARD EXAMPLE (This is the quality bar. Match this depth and tone):
If analyzing a "Founding Designer" role for an AI Hardware/EDA tool:
{
  "narrative": "I design AI-native technical workflows where the UI is a reasoning surface: constraints → exploration → verification. I’ve led platform redesigns for engineer-heavy products, and I’m strongest where correctness and trust matter.",
  "proof_stories": [
    { "title": "Systems Design", "detail": "Redesigned a complex workflow (entities, pipelines, debugging) merging 5 tools into 1." },
    { "title": "Trust + AI", "detail": "Handled automation risk: confidence scores, human override, and audit trails for high-stakes decisions." }
  ],
  "primitives": [
    { "name": "Constraint Editor", "description": "Source of truth, validation, diffs" },
    { "name": "Verification View", "description": "Pass/fail evidence, repro, rollback" }
  ],
  "spicy_opinion": "For high-stakes design, the AI must always be verifiable: it can propose, but it must attach the evidence trail. Chat interfaces are often the wrong primitive for architectural work.",
  "questions_they_ask": [
    { "category": "Founder Reality", "question": "How do you prioritize when founders pull in different directions?" },
    { "category": "Domain", "question": "How do you design for users far more technical than you (ASIC engineers)?" }
  ],
  "questions_you_ask": [
    { "category": "Product Wedge", "question": "What’s the first product moment you’re betting on—spec→constraints or verification and why?" },
    { "category": "Trust", "question": "When the AI proposes a design, what evidence must it attach—sim results, formal checks, or citations?" }
  ]
}

TASK:
Analyze the email thread. Determine if it is a recruiting email. If yes, generate a BESPOKE prep playbook matching the depth and "spice" of the example above.

GUIDELINES:
1. **NO GENERIC FLUFF**: Never say "Show team spirit" or "Be yourself".
2. **BE SPICY**: Give opinions that might be controversial but show seniority (e.g., "Chatbots are bad for X").
3. **INFER DEEPLY**: Guess the stack/challenges. If it's a crypto wallet, talk about "signing phrases" and "custody". If it's a devtool, talk about "CI/CD pipelines" and "determinism".
4. **NARRATIVE**: Write the 30-second intro pitch in the FIRST PERSON ("I...").
5. **PRIMITIVES**: Noun-oriented concepts specific to this domain.

OUTPUT FORMAT (JSON ONLY):
{
  "is_recruiting": boolean,
  "company": string,
  "role": string,
  "stage_bucket": "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stage_detail": string,
  "predicted_stages": string[],
  "action_needed": string | null,
  "insights": {
    "stageReason": string,
    "waitingOn": "you" | "them",
    "nextAction": string,
    "urgency": "low" | "med" | "high",
    "responseLikelihood": "low" | "med" | "high",
    "tone": "friendly" | "formal" | "neutral" | "urgent"
  },
  "prep": {
    "stageFocus": string,
    "narrative": string,
    "proof_stories": [{ "title": string, "detail": string }],
    "primitives": [{ "name": string, "description": string }],
    "spicy_opinion": string,
    "questions_they_ask": [{ "category": string, "question": string }],
    "questions_you_ask": [{ "category": string, "question": string }],
    "companyIntel": {
      "summary": string,
      "recentNews": string[]
    }
  }
}`

  const userPrompt = `${threadContext}From: ${input.fromName} <${input.fromEmail}>
Subject: ${input.subject}
Snippet: ${input.snippet}
Body: ${input.bodyExcerpt.slice(0, 2500)}

Analyze and return JSON:`

  try {
    if (!openai) {
      console.error("[LLM] OpenAI not configured")
      return null
    }

    console.log(`[LLM] Calling OpenAI for: "${input.subject.slice(0, 40)}"`)

    const res = await openai.chat.completions.create({
      model: "gpt-4o", // Upgraded to GPT-4o for deeper reasoning
      temperature: 0.4, // Slightly higher temp for "spiciness"
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const content = res.choices?.[0]?.message?.content || ""
    console.log(`[LLM] Response: ${content.slice(0, 200)}...`)

    const parsed = safeJsonParse<any>(content)
    if (!parsed) {
      console.error("[LLM] JSON parse failed")
      return null
    }

    console.log(`[LLM] Parsed: is_recruiting=${parsed.is_recruiting}, stage=${parsed.stage_bucket}`)

    // Return with defaults
    return {
      is_recruiting: parsed.is_recruiting ?? false,
      company: parsed.company || "Unknown",
      role: parsed.role || "Unknown",
      stage_bucket: parsed.stage_bucket || "RECRUITER_SCREEN",
      stage_detail: parsed.stage_detail || "Initial contact",
      insights: {
        stageReason: parsed.insights?.stageReason || "Recruiting email",
        waitingOn: parsed.insights?.waitingOn || "you",
        nextAction: parsed.insights?.nextAction || "Review and respond",
        urgency: parsed.insights?.urgency || "med",
        responseLikelihood: parsed.insights?.responseLikelihood || "med",
        tone: parsed.insights?.tone || "neutral",
      },
      prep: {
        stageFocus: parsed.prep?.stageFocus || "Prepare for interview",
        narrative: parsed.prep?.narrative || "",
        proofStories: parsed.prep?.proof_stories || [],
        primitives: parsed.prep?.primitives || [],
        spicyOpinion: parsed.prep?.spicy_opinion || "",
        questionsTheyMightAsk: parsed.prep?.questions_they_ask || parsed.prep?.questions_they_might_ask || [],
        questionsYouShouldAsk: parsed.prep?.questions_you_ask || parsed.prep?.questions_you_should_ask || [],
        whatToEmphasize: parsed.prep?.whatToEmphasize || [],
        storiesToPrepare: parsed.prep?.storiesToPrepare || [],
        homeworkNext24h: parsed.prep?.homeworkNext24h || [],
        companyIntel: parsed.prep?.companyIntel || { industry: "Unknown", size: "Unknown", hqLocation: "Unknown", glassdoorRating: "Unknown", summary: "", recentNews: [] },
      },
      predicted_stages: parsed.predicted_stages || [],
    }
  } catch (err) {
    console.error("[LLM] Error:", err)
    return null
  }
}

// ============================================================
// INSTRUMENTATION HELPERS
// ============================================================
async function createSyncRun(userEmail: string): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from("sync_runs")
      .insert({ user_email: userEmail, status: "running" })
      .select("id")
      .single()

    if (error) {
      console.error("[SYNC] Failed to create sync_run:", error)
      return null
    }
    return data.id
  } catch (err) {
    console.error("[SYNC] Exception creating sync_run:", err)
    return null
  }
}

async function updateSyncRun(
  syncRunId: string | null,
  stats: { scanned: number; detected: number; inserted: number; updated: number; skipped: number; rejected: number; errors: number },
  status: "completed" | "failed",
  errorMessage?: string
) {
  if (!syncRunId || !supabase) return

  try {
    await supabase
      .from("sync_runs")
      .update({
        completed_at: new Date().toISOString(),
        status,
        scanned: stats.scanned,
        detected: stats.detected,
        inserted: stats.inserted,
        updated: stats.updated,
        skipped: stats.skipped,
        rejected: stats.rejected,
        errors: stats.errors,
        error_message: errorMessage,
      })
      .eq("id", syncRunId)
  } catch (err) {
    console.error("[SYNC] Failed to update sync_run:", err)
  }
}

async function logEmailProcessing(log: {
  user_email: string
  gmail_thread_id?: string
  gmail_message_id: string
  from_email?: string
  from_domain?: string
  company_guess?: string
  subject?: string
  detected: boolean
  score?: number
  strongest_hit?: number
  matched_keywords?: string[]
  rejection_reason?: string
  llm_called?: boolean
  llm_is_recruiting?: boolean
  llm_company?: string
  llm_role?: string
  llm_stage?: string
  created_pipeline_id?: string
  action_taken: string
}) {
  if (!supabase) return
  try {
    await supabase.from("email_processing_log").insert(log)
  } catch (err) {
    console.error("[SYNC] Failed to log email processing:", err)
  }
}

// ============================================================
// MAIN SYNC
// ============================================================
export async function POST() {
  console.log("[SYNC] ========== Starting sync ==========")

  const stats = { scanned: 0, detected: 0, inserted: 0, updated: 0, skipped: 0, rejected: 0, errors: 0 }
  let syncRunId: string | null = null
  let userEmail = ""

  try {
    // Guard against missing env vars
    if (!supabase || !openai) {
      console.log("[SYNC] Missing env vars - supabase or openai not configured")
      return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 500 })
    }

    const session = await getServerSession(authOptions)
    if (!session) {
      console.log("[SYNC] No session")
      return NextResponse.json({ error: "NO SESSION" }, { status: 401 })
    }

    const accessToken = (session as any).accessToken
    userEmail = session.user?.email || ""
    if (!accessToken || !userEmail) {
      console.log("[SYNC] Missing token or email")
      return NextResponse.json({ error: "MISSING TOKEN OR EMAIL" }, { status: 401 })
    }

    console.log(`[SYNC] User: ${userEmail}`)

    // Create sync run record for tracking
    syncRunId = await createSyncRun(userEmail)
    console.log(`[SYNC] Created sync_run: ${syncRunId}`)

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
    // Limit to 3 months max for new accounts to prevent long sync times
    const q = afterUnix ? `after:${afterUnix} -in:trash -in:chats` : "newer_than:3m -in:trash -in:chats"

    console.log(`[SYNC] Gmail query: ${q}`)

    // Fetch messages
    let messages: Array<{ id?: string | null; threadId?: string | null }> = []
    let pageToken: string | undefined

    try {
      do {
        const page = await gmail.users.messages.list({ userId: "me", q, maxResults: 50, pageToken })
        messages = messages.concat(page.data.messages ?? [])
        pageToken = page.data.nextPageToken ?? undefined
        // Hard limit to prevent timeout loops
      } while (pageToken && messages.length < 50)
    } catch (gmailErr: any) {
      console.error("[SYNC] Gmail API error (likely token expired):", gmailErr?.message)
      stats.errors++
      await updateSyncRun(syncRunId, stats, "failed", `Gmail API error: ${gmailErr?.message}`)
      return NextResponse.json({
        error: "GMAIL_API_ERROR",
        message: gmailErr?.message,
        hint: "Your Gmail access may have expired. Please reconnect Gmail.",
        stats
      }, { status: 401 })
    }

    stats.scanned = messages.length
    console.log(`[SYNC] Found ${messages.length} messages to process`)

    const { data: existingPipelines } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)

    const pipelines = existingPipelines ?? []
    console.log(`[SYNC] Existing pipelines: ${pipelines.length}`)

    for (const msg of messages) {
      if (!msg.id) continue

      const threadId = msg.threadId || undefined

      // Check if already processed
      const { data: existing } = await supabase
        .from("emails")
        .select("id")
        .eq("user_email", userEmail)
        .eq("gmail_message_id", msg.id)
        .maybeSingle()

      if (existing) {
        // DEV OVERRIDE: Force re-analysis for "Talent.io" or just everything for now to refresh quality.
        // In production we would skip, but to fix the user's data we allow re-processing.
        // stats.skipped++
        // continue
        console.log(`[SYNC] Re-processing existing email ${msg.id} to upgrade prep quality...`)
      }

      // Fetch full message
      let full
      try {
        full = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" })
      } catch (err: any) {
        console.error(`[SYNC] Failed to fetch message ${msg.id}:`, err?.message)
        stats.errors++
        await logEmailProcessing({
          user_email: userEmail,
          gmail_thread_id: threadId,
          gmail_message_id: msg.id,
          detected: false,
          rejection_reason: `fetch_error: ${err?.message}`,
          action_taken: "error",
        })
        continue
      }

      const headers = full.data.payload?.headers ?? []
      const subject = headers.find(h => h.name === "Subject")?.value || "(no subject)"
      const fromHeader = headers.find(h => h.name === "From")?.value || ""
      const dateHeader = headers.find(h => h.name === "Date")?.value || ""
      const snippet = full.data.snippet || ""

      const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/)
      const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : fromHeader
      const fromEmail = fromMatch ? fromMatch[2].trim() : fromHeader
      const fromDomain = fromEmail.split("@")[1]?.split(".")[0] || ""

      const internalMs = full.data.internalDate ? Number(full.data.internalDate) : NaN
      const receivedAt = Number.isFinite(internalMs) ? new Date(internalMs).toISOString() : new Date(dateHeader || Date.now()).toISOString()

      const { text: bodyPlain, html: bodyHtml } = extractBodyFromPayload(full.data.payload)
      const bodyText = bodyPlain || (bodyHtml ? stripHtml(bodyHtml) : "")
      const fullText = `${subject}\n${snippet}\n${fromHeader}\n${bodyText}`
      const textLower = fullText.toLowerCase()

      // Gate 1: Instant reject
      const instantRejectResult = shouldInstantReject(textLower, fromEmail)
      if (instantRejectResult.reject) {
        console.log(`[REJECT] Instant reject: "${subject.slice(0, 30)}" - ${instantRejectResult.reason}`)
        stats.rejected++
        await logEmailProcessing({
          user_email: userEmail,
          gmail_thread_id: threadId,
          gmail_message_id: msg.id,
          from_email: fromEmail,
          from_domain: fromDomain,
          subject: subject.slice(0, 200),
          detected: false,
          rejection_reason: instantRejectResult.reason,
          action_taken: "rejected",
        })
        continue
      }

      // Gate 2: Banner check (relaxed)
      if (hasBannerImages(bodyHtml)) {
        console.log(`[REJECT] Banner images: "${subject.slice(0, 30)}"`)
        stats.rejected++
        await logEmailProcessing({
          user_email: userEmail,
          gmail_thread_id: threadId,
          gmail_message_id: msg.id,
          from_email: fromEmail,
          from_domain: fromDomain,
          subject: subject.slice(0, 200),
          detected: false,
          rejection_reason: "banner_images",
          action_taken: "rejected",
        })
        continue
      }

      // Gate 3: Score check
      const { score, strongest, hits } = scoreEmailText(textLower)
      console.log(`[SCORE] "${subject.slice(0, 40)}": ${score} (max=${strongest}) [${hits.slice(0, 5).join(", ")}]`)

      if (score < MIN_SCORE || strongest < MIN_STRONG_HIT) {
        console.log(`[REJECT] Low score`)
        stats.rejected++
        await logEmailProcessing({
          user_email: userEmail,
          gmail_thread_id: threadId,
          gmail_message_id: msg.id,
          from_email: fromEmail,
          from_domain: fromDomain,
          subject: subject.slice(0, 200),
          detected: false,
          score,
          strongest_hit: strongest,
          matched_keywords: hits,
          rejection_reason: `low_score:${score}<${MIN_SCORE}_or_strongest:${strongest}<${MIN_STRONG_HIT}`,
          action_taken: "rejected",
        })
        continue
      }

      // Find existing pipeline
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
      const analysis = await analyzeEmail({
        subject,
        snippet,
        fromEmail,
        fromName,
        bodyExcerpt: bodyText.slice(0, 2500),
        threadEmails: threadEmails.length > 0 ? threadEmails : undefined,
      })

      if (!analysis) {
        console.log(`[REJECT] LLM returned null`)
        stats.rejected++
        stats.errors++
        await logEmailProcessing({
          user_email: userEmail,
          gmail_thread_id: threadId,
          gmail_message_id: msg.id,
          from_email: fromEmail,
          from_domain: fromDomain,
          company_guess: fromDomain,
          subject: subject.slice(0, 200),
          detected: false,
          score,
          strongest_hit: strongest,
          matched_keywords: hits,
          llm_called: true,
          rejection_reason: "llm_returned_null",
          action_taken: "error",
        })
        continue
      }

      if (!analysis.is_recruiting) {
        console.log(`[REJECT] LLM: not recruiting`)
        stats.rejected++
        await logEmailProcessing({
          user_email: userEmail,
          gmail_thread_id: threadId,
          gmail_message_id: msg.id,
          from_email: fromEmail,
          from_domain: fromDomain,
          company_guess: analysis.company,
          subject: subject.slice(0, 200),
          detected: false,
          score,
          strongest_hit: strongest,
          matched_keywords: hits,
          llm_called: true,
          llm_is_recruiting: false,
          llm_company: analysis.company,
          llm_role: analysis.role,
          rejection_reason: "llm_not_recruiting",
          action_taken: "rejected",
        })
        continue
      }

      stats.detected++

      // Create or update pipeline
      let pipelineId = existingPipeline?.id

      // Determine clean stage
      const finalStage = getUiStage(analysis.stage_bucket)

      if (!pipelineId) {
        // Create new pipeline
        console.log(`[PIPELINE] Creating for ${analysis.company}`)
        const { data: newP, error: pErr } = await supabase
          .from("pipelines")
          .insert({
            user_email: userEmail,
            company: analysis.company,
            role: analysis.role,
            status: "WAITING", // Default
            stage: finalStage,
            stage_detail: analysis.stage_detail,
            next_action: analysis.insights.nextAction,
            action_needed: !!analysis.insights.nextAction,
            last_email_at: receivedAt,
            last_email_subject: subject,
            last_email_snippet: snippet,
            last_email_from_name: fromName,
            last_email_from_email: fromEmail,
            prep_json: analysis.prep,
            predicted_stages: analysis.predicted_stages,
            insights_json: analysis.insights,
            company_intel_json: analysis.prep.companyIntel,
          })
          .select("id")
          .single()

        if (pErr) {
          console.error("[PIPELINE] Creation failed:", pErr)
          stats.errors++
          await logEmailProcessing({
            user_email: userEmail,
            gmail_thread_id: threadId,
            gmail_message_id: msg.id,
            company_guess: analysis.company,
            subject: subject.slice(0, 200),
            detected: true,
            action_taken: "error_creating_pipeline",
          })
          continue
        }
        pipelineId = newP.id
        stats.inserted++
      } else {
        // Update existing pipeline.
        // We only update if the new email is more recent than what's on the pipeline
        // OR if we want to overwrite prep information. For now, generally overwrite.
        console.log(`[PIPELINE] Updating ${analysis.company}`)
        await supabase
          .from("pipelines")
          .update({
            stage: finalStage,
            stage_detail: analysis.stage_detail,
            last_email_at: receivedAt,
            last_email_subject: subject,
            last_email_snippet: snippet,
            last_email_from_name: fromName,
            last_email_from_email: fromEmail,
            prep_json: analysis.prep, // Overwrite prep with latest thoughts
            insights_json: analysis.insights,
            predicted_stages: analysis.predicted_stages,
            company_intel_json: analysis.prep.companyIntel,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pipelineId)
        stats.updated++
      }

      // Insert email record
      await supabase.from("emails").insert({
        user_email: userEmail,
        pipeline_id: pipelineId,
        gmail_id: msg.id,
        gmail_thread_id: threadId, // We use threadId if available
        gmail_message_id: msg.id,
        subject,
        snippet,
        from_name: fromName,
        from_email: fromEmail,
        body_text: bodyText,
        received_at: receivedAt,
        analysis_json: analysis,
        is_recruiting: true,
      })

      // Log success
      await logEmailProcessing({
        user_email: userEmail,
        gmail_thread_id: threadId,
        gmail_message_id: msg.id,
        from_email: fromEmail,
        from_domain: fromDomain,
        company_guess: analysis.company,
        subject: subject.slice(0, 200),
        detected: true,
        score,
        strongest_hit: strongest,
        matched_keywords: hits,
        llm_called: true,
        llm_is_recruiting: true,
        llm_company: analysis.company,
        llm_role: analysis.role,
        llm_stage: analysis.stage_bucket,
        created_pipeline_id: pipelineId,
        action_taken: existingPipeline ? "updated_pipeline" : "created_pipeline",
      })

    } // end for messages

    console.log("[SYNC] Done. Stats:", stats)

    await updateSyncRun(syncRunId, stats, "completed")

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (err: any) {
    console.error("[SYNC] Fatal error:", err)
    if (syncRunId) {
      await updateSyncRun(syncRunId, stats, "failed", err?.message)
    }
    return NextResponse.json({
      error: "INTERNAL_ERROR",
      message: err?.message
    }, { status: 500 })
  }
}

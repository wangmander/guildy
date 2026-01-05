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
  // Support / Tickets / Billing
  "support ticket", "ticket number", "ticket #", "ticket id", "case number",
  "customer support", "customer service", "support team", "support request",
  "billing", "billing update", "billing statement", "billing issue",
  "upgrade your", "upgrade now", "upgrade to", "upgrade plan", "downgrade",
  "ordering", "orders", "your order", "order status", "order update",
  
  // Offer (marketing context)
  "special offer", "exclusive offer", "limited offer", "offer expires",
  "offer ends", "claim your offer", "redeem offer", "offer code",
  
  // Unsubscribe
  "unsubscribe", "email preferences", "manage your preferences",
  "manage preferences", "update preferences", "opt out", "opt-out",
  
  // Orders & Shipping
  "order confirmation", "order shipped", "has been shipped", "tracking number",
  "track your order", "track your package", "shipment notification",
  "shipping confirmation", "shipping update", "delivery notification",
  "out for delivery", "was delivered", "has been delivered", "your package",
  
  // Receipts & Payments
  "your receipt", "order receipt", "payment receipt", "purchase confirmation",
  "payment confirmation", "payment received", "your invoice",
  
  // Promotions & Sales
  "limited time offer", "deal of the day", "daily deals", "flash sale",
  "% off", "percent off", "discount code", "promo code", "coupon code",
  "shop now", "buy now", "order now", "sale ends", "don't miss out",
  "free shipping", "black friday", "cyber monday", "clearance",
  
  // Account & Security
  "verification code", "verify your email", "confirm your email",
  "one-time password", "your otp", "security code", "security alert",
  "password reset", "reset your password", "new sign-in", "login attempt",
  
  // Banking & Financial
  "your statement", "account statement", "bank statement", "your bill",
  "bill is ready", "payment due", "amount due", "minimum payment",
  "auto-pay", "account balance", "apy", "cashback", "reward points",
  
  // Entertainment & Social
  "now streaming", "new episode", "watch now", "your playlist",
  "friend request", "tagged you", "mentioned you", "new follower",
  
  // Food & Travel
  "your order is on the way", "your driver", "food delivery",
  "flight confirmation", "hotel reservation", "boarding pass",
  
  // Returns & Subscriptions
  "return request", "refund processed", "return label",
  "subscription", "your subscription", "renew your", "trial ending",
  
  // Newsletters
  "newsletter", "weekly digest", "daily digest", "weekly roundup",
  
  // Product companies (support context)
  "supabase", "vercel", "github", "notion", "slack", "figma",
  "linear", "stripe", "twilio",
]

// ============================================================
// BLOCKED SENDER PATTERNS
// ============================================================
const BLOCKED_SENDER_PATTERNS: string[] = [
  "noreply@", "no-reply@", "notifications@", "notification@",
  "updates@", "marketing@", "promo@", "deals@", "offers@",
  "newsletter@", "info@", "support@", "help@", "billing@",
  "orders@", "shipping@", "tracking@", "alerts@", "donotreply@",
  "mailer@", "automated@", "transactional@", "engage@",
  "messaging.", "mail.", "email.", "sendgrid.", "mailchimp.",
]

// ============================================================
// POSITIVE PHRASES
// ============================================================
const PHRASE_WEIGHTS: Array<{ phrase: string; w: number }> = [
  // TIER 1: VERY HIGH (w=10)
  { phrase: "interview request", w: 10 },
  { phrase: "interview invitation", w: 10 },
  { phrase: "invite you to interview", w: 10 },
  { phrase: "schedule an interview", w: 10 },
  { phrase: "interview confirmation", w: 10 },
  { phrase: "your application", w: 10 },
  { phrase: "application status", w: 10 },
  { phrase: "reviewing your application", w: 10 },
  { phrase: "received your application", w: 10 },
  { phrase: "thanks for applying", w: 10 },
  { phrase: "thank you for applying", w: 10 },
  { phrase: "your candidacy", w: 10 },
  { phrase: "not moving forward", w: 10 },
  { phrase: "move forward with other candidates", w: 10 },

  // TIER 2: HIGH (w=8-9)
  { phrase: "interview", w: 8 },
  { phrase: "interviewing", w: 8 },
  { phrase: "phone screen", w: 8 },
  { phrase: "screening call", w: 8 },
  { phrase: "recruiter screen", w: 9 },
  { phrase: "recruiter call", w: 8 },
  { phrase: "technical screen", w: 8 },
  { phrase: "technical interview", w: 9 },
  { phrase: "hiring manager", w: 8 },
  { phrase: "hiring manager interview", w: 9 },
  { phrase: "talent acquisition", w: 8 },
  { phrase: "recruiting team", w: 9 },
  { phrase: "recruiter", w: 8 },
  { phrase: "onsite interview", w: 9 },
  { phrase: "virtual onsite", w: 9 },
  { phrase: "full loop", w: 9 },
  { phrase: "panel interview", w: 9 },
  { phrase: "final round", w: 9 },
  { phrase: "final interview", w: 9 },
  { phrase: "offer letter", w: 9 },
  { phrase: "job offer", w: 9 },
  { phrase: "extend an offer", w: 9 },
  { phrase: "background check", w: 8 },
  { phrase: "take-home assignment", w: 9 },
  { phrase: "coding challenge", w: 8 },
  { phrase: "case study interview", w: 9 },
  { phrase: "design exercise", w: 8 },
  { phrase: "portfolio review", w: 8 },
  { phrase: "job opportunity", w: 8 },
  { phrase: "career opportunity", w: 8 },
  { phrase: "open role", w: 8 },
  { phrase: "open position", w: 8 },
  { phrase: "interested in your profile", w: 9 },
  { phrase: "interested in your background", w: 9 },
  { phrase: "discuss the role", w: 8 },
  { phrase: "not selected", w: 9 },
  { phrase: "position has been filled", w: 9 },

  // TIER 3: MEDIUM (w=6-7)
  { phrase: "people team", w: 6 },
  { phrase: "hr team", w: 6 },
  { phrase: "introductory call", w: 7 },
  { phrase: "intro call", w: 7 },
  { phrase: "screening", w: 6 },
  { phrase: "round 2", w: 7 },
  { phrase: "second round", w: 7 },
  { phrase: "third round", w: 7 },
  { phrase: "team interview", w: 7 },
  { phrase: "meet the team", w: 7 },
  { phrase: "next steps", w: 6 },
  { phrase: "move forward", w: 6 },
  { phrase: "compensation", w: 6 },
  { phrase: "salary range", w: 7 },
  { phrase: "greenhouse", w: 6 },
  { phrase: "lever", w: 6 },
  { phrase: "ashby", w: 6 },
  { phrase: "hirevue", w: 7 },
  { phrase: "your resume", w: 6 },
  { phrase: "join our team", w: 6 },
  { phrase: "hiring for", w: 7 },

  // TIER 4: LOW (w=1-4)
  { phrase: "opportunity", w: 3 },
  { phrase: "position", w: 2 },
  { phrase: "role", w: 2 },
  { phrase: "candidate", w: 3 },
  { phrase: "availability", w: 2 },
  { phrase: "offer", w: 1 },
  { phrase: "screen", w: 1 },
  { phrase: "decided", w: 1 },
  { phrase: "salary", w: 3 },
  { phrase: "zoom", w: 2 },
  { phrase: "schedule a call", w: 4 },
]

type StageBucket =
  | "RECRUITER_SCREEN"
  | "HM_SCREEN"
  | "ASSESSMENT"
  | "LOOP"
  | "OFFER"
  | "REJECTED"
  | "NOT_RECRUITING"

type Stage =
  | "APPLIED"
  | "SCREENING"
  | "HM"
  | "ASSESSMENT"
  | "FULL_LOOP"
  | "OFFER_DISCUSSION"
  | "REJECTED"

const MIN_SCORE = 15
const MIN_STRONG_HIT_WEIGHT = 8

function normalize(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function normalizeForMatch(s: string) {
  return " " + normalize(s) + " "
}

function shouldInstantReject(textLower: string, fromEmail: string): { reject: boolean; reason: string } {
  const fromLower = fromEmail.toLowerCase()
  for (const pattern of BLOCKED_SENDER_PATTERNS) {
    if (fromLower.includes(pattern)) {
      return { reject: true, reason: `sender:${pattern}` }
    }
  }
  
  for (const pattern of INSTANT_REJECT_PATTERNS) {
    if (textLower.includes(pattern.toLowerCase())) {
      return { reject: true, reason: pattern }
    }
  }
  
  return { reject: false, reason: "" }
}

function hasBannerImages(html: string): { hasBanner: boolean; reason: string } {
  if (!html) return { hasBanner: false, reason: "" }
  
  const htmlLower = html.toLowerCase()
  const imgTags = htmlLower.match(/<img[^>]*>/g) || []
  
  if (imgTags.length > 3) {
    return { hasBanner: true, reason: `${imgTags.length} images` }
  }
  
  for (const img of imgTags) {
    const widthMatch = img.match(/width\s*[=:]\s*["']?(\d+)/)
    if (widthMatch && parseInt(widthMatch[1]) > 400) {
      return { hasBanner: true, reason: `large width: ${widthMatch[1]}px` }
    }
    
    const heightMatch = img.match(/height\s*[=:]\s*["']?(\d+)/)
    if (heightMatch && parseInt(heightMatch[1]) > 200) {
      return { hasBanner: true, reason: `large height: ${heightMatch[1]}px` }
    }
    
    const srcMatch = img.match(/src\s*=\s*["']([^"']+)["']/)
    if (srcMatch) {
      const src = srcMatch[1].toLowerCase()
      const marketingPatterns = ["banner", "header", "hero", "promo", "campaign", "newsletter", "marketing", "mailchimp", "sendgrid"]
      for (const pattern of marketingPatterns) {
        if (src.includes(pattern)) {
          return { hasBanner: true, reason: `marketing image: ${pattern}` }
        }
      }
    }
  }
  
  const tableCount = (htmlLower.match(/<table/g) || []).length
  if (tableCount > 5) {
    return { hasBanner: true, reason: `${tableCount} tables` }
  }
  
  return { hasBanner: false, reason: "" }
}

type ShortPhrase = { chunk: string; w: number; parent: string; cap: number }

function splitIntoChunks(words: string[]) {
  const chunks: string[] = []
  const join = (a: string[]) => a.join(" ").trim()
  const ngram = (n: number) => {
    if (words.length < n) return
    for (let i = 0; i <= words.length - n; i++) {
      chunks.push(join(words.slice(i, i + n)))
    }
  }
  ngram(3)
  ngram(2)
  ngram(1)
  return chunks
}

function buildShortPhraseWeights(list: Array<{ phrase: string; w: number }>): ShortPhrase[] {
  const stop = new Set(["we", "have", "has", "had", "to", "the", "a", "an", "and", "or", "of", "in", "on", "for", "with", "at", "this", "that", "are", "is", "be", "not", "will", "you", "your", "our", "us", "i"])

  const out: ShortPhrase[] = []
  const seen = new Set<string>()

  for (const item of list) {
    const raw = item.phrase || ""
    const w = item.w || 0
    if (!raw.trim() || w <= 0) continue

    const words = normalize(raw).split(" ").filter(Boolean)

    if (words.length <= 3) {
      const chunk = words.join(" ")
      const key = `${chunk}|${chunk}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ chunk, w, parent: chunk, cap: w })
      }
      continue
    }

    const parent = words.join(" ")
    const cap = w
    const chunks = splitIntoChunks(words)

    for (const c of chunks) {
      const cw = c.split(" ").filter(Boolean).length
      if (cw === 0) continue
      if (cw === 1 && (c.length <= 3 || stop.has(c))) continue
      
      let chunkW = cw === 3 ? Math.max(2, Math.round(w * 0.6)) : cw === 2 ? Math.max(2, Math.round(w * 0.5)) : 1

      const key = `${c}|${parent}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ chunk: c, w: chunkW, parent, cap })
    }
  }

  return out
}

const SHORT_PHRASE_WEIGHTS: ShortPhrase[] = buildShortPhraseWeights(PHRASE_WEIGHTS)

function scoreEmailText(textLower: string) {
  const hay = normalizeForMatch(textLower)
  let score = 0
  const hits: Array<{ phrase: string; w: number }> = []
  const parentAccum: Record<string, number> = {}
  let strongestHitWeight = 0

  for (const item of SHORT_PHRASE_WEIGHTS) {
    const needle = " " + item.chunk + " "
    if (!hay.includes(needle)) continue

    const prev = parentAccum[item.parent] ?? 0
    const next = Math.min(item.cap, prev + item.w)
    const delta = next - prev
    if (delta <= 0) continue

    parentAccum[item.parent] = next
    score += delta
    hits.push({ phrase: item.chunk, w: delta })

    if (item.w > strongestHitWeight) strongestHitWeight = item.w
  }

  return { score, hits, strongestHitWeight }
}

function stageBucketToUiStage(bucket: StageBucket): Stage {
  switch (bucket) {
    case "RECRUITER_SCREEN": return "SCREENING"
    case "HM_SCREEN": return "HM"
    case "ASSESSMENT": return "ASSESSMENT"
    case "LOOP": return "FULL_LOOP"
    case "OFFER": return "OFFER_DISCUSSION"
    case "REJECTED": return "REJECTED"
    default: return "SCREENING"
  }
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
// LLM: CLASSIFY EMAIL (initial check)
// ============================================================
async function classifyEmailAsRecruiting(input: {
  subject: string
  snippet: string
  fromEmail: string
  bodyExcerpt: string
}): Promise<{ is_recruiting: boolean; company: string; role: string } | null> {
  const systemPrompt = `You are a strict email classifier. Determine if an email is about job recruiting/interviews.
Be EXTREMELY skeptical. Default to NOT recruiting.
Output ONLY valid JSON.`

  const userPrompt = `Is this email about job recruiting/interviews?

From: ${input.fromEmail}
Subject: ${input.subject}
Snippet: ${input.snippet}
Body: ${input.bodyExcerpt.slice(0, 1000)}

Return JSON:
{
  "is_recruiting": boolean,
  "company": "company name or Unknown",
  "role": "job title or Unknown"
}`

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  })

  const txt = res.choices?.[0]?.message?.content || ""
  return safeJsonParse<{ is_recruiting: boolean; company: string; role: string }>(txt)
}

// ============================================================
// LLM: DETERMINE STAGE FROM FULL THREAD
// This is the KEY function - it gets ALL emails for the pipeline
// and determines the correct stage based on the full history
// ============================================================
async function determineStageFromThread(input: {
  company: string
  role: string
  emails: Array<{
    subject: string
    snippet: string
    from: string
    date: string
  }>
}): Promise<{ stage_bucket: StageBucket; stage_detail: string; confidence: number } | null> {
  
  // Build thread summary (oldest to newest)
  const threadSummary = input.emails
    .map((e, i) => `[Email ${i + 1}] Date: ${e.date}\nFrom: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}`)
    .join("\n\n---\n\n")

  const systemPrompt = `You are an expert at determining interview pipeline stages.
Analyze the FULL email thread history and determine the CURRENT stage.

STAGES (in order of progression):
1. RECRUITER_SCREEN - Initial outreach, application received, recruiter call scheduled/completed
2. HM_SCREEN - Hiring manager interview scheduled/completed
3. ASSESSMENT - Take-home, coding challenge, case study assigned/submitted
4. LOOP - Onsite, panel interviews, final rounds scheduled/completed
5. OFFER - Offer extended, compensation discussion, negotiation
6. REJECTED - Rejection received

RULES:
- Look at the MOST RECENT emails to determine current stage
- If they scheduled a hiring manager interview, stage is HM_SCREEN
- If they sent a take-home or coding challenge, stage is ASSESSMENT
- If they scheduled onsite/panel/final rounds, stage is LOOP
- If they extended an offer or discussing compensation, stage is OFFER
- If they rejected, stage is REJECTED
- Only use RECRUITER_SCREEN if no progression beyond initial contact

Output ONLY valid JSON.`

  const userPrompt = `Company: ${input.company}
Role: ${input.role}

Full email thread (${input.emails.length} emails, oldest to newest):

${threadSummary}

Based on this thread, what is the CURRENT interview stage?

Return JSON:
{
  "stage_bucket": "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stage_detail": "Brief explanation of current stage",
  "confidence": 0.0-1.0
}`

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  })

  const txt = res.choices?.[0]?.message?.content || ""
  return safeJsonParse<{ stage_bucket: StageBucket; stage_detail: string; confidence: number }>(txt)
}

// ============================================================
// LLM: GENERATE PREP
// ============================================================
async function generateBespokePrep(input: {
  company: string
  role: string
  stage_bucket: StageBucket
  stage_detail: string
  latestEmail: { subject: string; snippet: string; from: string }
}) {
  const systemPrompt = `You are Guildy, an interview prep assistant. Generate SPECIFIC prep.
NO generic advice. If unknown, say "Unknown". Output ONLY valid JSON.`

  const userPrompt = `Generate prep for:
Company: ${input.company}
Role: ${input.role}
Stage: ${input.stage_bucket} (${input.stage_detail})
Latest email from: ${input.latestEmail.from}
Subject: ${input.latestEmail.subject}
Snippet: ${input.latestEmail.snippet}

Return JSON:
{
  "insights": {
    "stage_reason": "Why ${input.stage_bucket}",
    "waiting_on": "you" | "them",
    "next_action": "Specific action",
    "urgency": "low" | "med" | "high",
    "response_likelihood": "low" | "med" | "high",
    "tone": "friendly" | "formal" | "neutral"
  },
  "prep": {
    "prep_focus": "Focus for ${input.stage_bucket} at ${input.company}",
    "questions_they_might_ask_you": ["3-5 questions"],
    "questions_you_should_ask_them": ["3-5 questions"],
    "what_to_emphasize": ["Skills to highlight"],
    "stories_to_prepare": ["STAR stories"],
    "homework_next_24h": ["Prep tasks"],
    "company_intel": {
      "industry": "or Unknown",
      "size": "or Unknown",
      "hq_location": "or Unknown",
      "glassdoor_rating": "or Unknown",
      "summary": "or 'Insufficient data'",
      "recent_news": [],
      "truthful_note": "What we couldn't verify"
    }
  }
}`

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  })

  return safeJsonParse<any>(res.choices?.[0]?.message?.content || "")
}

// ============================================================
// MAIN SYNC ENDPOINT
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

    const MAX_MESSAGES_PER_RUN = 400
    const PAGE_SIZE = 100
    const SAFETY_LOOKBACK_DAYS = 21

    const nowMs = Date.now()
    const nowUnix = Math.floor(nowMs / 1000)

    const { data: lastEmailRows } = await supabase
      .from("emails")
      .select("received_at")
      .eq("user_email", userEmail)
      .order("received_at", { ascending: false })
      .limit(1)

    const lastReceivedAtMs = lastEmailRows?.[0]?.received_at ? new Date(lastEmailRows[0].received_at).getTime() : null
    const safeLastMs = lastReceivedAtMs && lastReceivedAtMs <= nowMs + 60_000 ? lastReceivedAtMs : null

    const afterUnix = safeLastMs
      ? Math.floor((safeLastMs - SAFETY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000)
      : null

    const qBase = afterUnix && afterUnix <= nowUnix ? `after:${afterUnix}` : "newer_than:5y"
    const q = `${qBase} -in:trash -in:chats`

    let pageToken: string | undefined = undefined
    const messages: Array<{ id?: string | null; threadId?: string | null }> = []

    do {
      const page = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: PAGE_SIZE,
        pageToken,
        includeSpamTrash: true,
      })

      const pageMsgs = page.data.messages ?? []
      for (const msg of pageMsgs) {
        messages.push(msg)
        if (messages.length >= MAX_MESSAGES_PER_RUN) break
      }

      pageToken = page.data.nextPageToken ?? undefined
    } while (pageToken && messages.length < MAX_MESSAGES_PER_RUN)

    let scanned = messages.length
    let skippedExisting = 0
    let rejectedInstant = 0
    let rejectedBanner = 0
    let rejectedGating = 0
    let rejectedLLM = 0
    let acceptedCount = 0
    let inserted = 0
    let updated = 0
    let emailsInserted = 0

    const { data: existingPipelines } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)

    const pipelines = existingPipelines ?? []

    for (const msg of messages) {
      if (!msg.id) continue

      const { data: existingEmail } = await supabase
        .from("emails")
        .select("id")
        .eq("user_email", userEmail)
        .eq("gmail_message_id", msg.id)
        .maybeSingle()
      
      if (existingEmail) {
        skippedExisting++
        continue
      }

      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      })

      const headers = full.data.payload?.headers ?? []
      const subject = headers.find((h) => h.name === "Subject")?.value || ""
      const fromHeader = headers.find((h) => h.name === "From")?.value || ""
      const dateHeader = headers.find((h) => h.name === "Date")?.value || ""
      const snippet = full.data.snippet || ""

      const fromEmailMatch = fromHeader.match(/<([^>]+)>/)
      const fromEmail = (fromEmailMatch?.[1] || fromHeader || "").trim()

      const internalDateMs = full.data.internalDate ? Number(full.data.internalDate) : NaN
      const receivedAt = Number.isFinite(internalDateMs)
        ? new Date(internalDateMs).toISOString()
        : dateHeader
          ? new Date(dateHeader).toISOString()
          : new Date().toISOString()

      const payload = full.data.payload
      const { text: bodyTextPlain, html: bodyHtml } = extractBodyFromPayload(payload)
      const bodyText = bodyTextPlain || (bodyHtml ? stripHtml(bodyHtml) : "")
      const bodyExcerpt = bodyText.slice(0, 3000)

      const fullText = `${subject}\n${snippet}\n${fromHeader}\n${bodyText}`
      const textLower = fullText.toLowerCase()

      // GATE 1: Instant reject
      const instantCheck = shouldInstantReject(textLower, fromEmail)
      if (instantCheck.reject) {
        rejectedInstant++
        continue
      }

      // GATE 2: Banner images
      const bannerCheck = hasBannerImages(bodyHtml)
      if (bannerCheck.hasBanner) {
        rejectedBanner++
        continue
      }

      // GATE 3: Score threshold
      const { score, hits, strongestHitWeight } = scoreEmailText(textLower)
      if (score < MIN_SCORE || strongestHitWeight < MIN_STRONG_HIT_WEIGHT) {
        rejectedGating++
        continue
      }

      // GATE 4: LLM initial classification
      const classification = await classifyEmailAsRecruiting({
        subject,
        snippet,
        fromEmail,
        bodyExcerpt,
      })

      if (!classification?.is_recruiting) {
        rejectedLLM++
        continue
      }

      acceptedCount++

      const company = (classification.company || "").trim() || "Unknown"
      const role = (classification.role || "").trim() || "Unknown"

      const companyN = normalize(company)
      const roleN = normalize(role)

      // Find existing pipeline
      let match = pipelines.find((p: any) => 
        normalize(p.company) === companyN && normalize(p.role) === roleN
      )
      const isNewPipeline = !match

      let pipelineId: string | null = null
      let stageBucket: StageBucket = "RECRUITER_SCREEN"
      let stageDetail = "Initial screening"

      if (isNewPipeline) {
        // NEW PIPELINE: Just use RECRUITER_SCREEN for first email
        stageBucket = "RECRUITER_SCREEN"
        stageDetail = "Initial contact"

        const { data: created, error: createErr } = await supabase
          .from("pipelines")
          .insert({
            user_email: userEmail,
            company,
            role,
            stage: stageBucketToUiStage(stageBucket),
            stage_detail: stageDetail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail || fromHeader,
            last_email_snippet: snippet,
          })
          .select()
          .single()

        if (createErr || !created?.id) continue
        pipelineId = created.id
        pipelines.push(created)
        inserted++

      } else {
        // EXISTING PIPELINE: Fetch ALL emails and determine stage from full thread
        pipelineId = match.id

        // Get all existing emails for this pipeline
        const { data: pipelineEmails } = await supabase
          .from("emails")
          .select("subject, snippet, from_email, received_at")
          .eq("pipeline_id", pipelineId)
          .order("received_at", { ascending: true })

        // Build thread including the new email
        const threadEmails = [
          ...(pipelineEmails || []).map(e => ({
            subject: e.subject || "",
            snippet: e.snippet || "",
            from: e.from_email || "",
            date: e.received_at || "",
          })),
          {
            subject,
            snippet,
            from: fromEmail,
            date: receivedAt,
          }
        ]

        // LLM determines stage from FULL thread
        const stageResult = await determineStageFromThread({
          company,
          role,
          emails: threadEmails,
        })

        if (stageResult) {
          stageBucket = stageResult.stage_bucket
          stageDetail = stageResult.stage_detail
        }

        // Update pipeline with new stage
        const { error: updErr } = await supabase
          .from("pipelines")
          .update({
            stage: stageBucketToUiStage(stageBucket),
            stage_detail: stageDetail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail || fromHeader,
            last_email_snippet: snippet,
          })
          .eq("id", pipelineId)

        if (!updErr) {
          Object.assign(match, {
            stage: stageBucketToUiStage(stageBucket),
            stage_detail: stageDetail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail || fromHeader,
            last_email_snippet: snippet,
          })
          updated++
        }
      }

      // Generate prep
      const prepPack = await generateBespokePrep({
        company,
        role,
        stage_bucket: stageBucket,
        stage_detail: stageDetail,
        latestEmail: { subject, snippet, from: fromEmail },
      })

      if (prepPack) {
        await supabase
          .from("pipelines")
          .update({
            insights_json: prepPack.insights,
            prep_json: prepPack.prep,
          })
          .eq("id", pipelineId)
      }

      // Insert email record
      const { error: emailErr } = await supabase.from("emails").insert({
        user_email: userEmail,
        pipeline_id: pipelineId,
        gmail_message_id: msg.id,
        from_email: fromEmail || fromHeader,
        subject,
        snippet,
        received_at: receivedAt,
      })

      if (!emailErr) emailsInserted++
    }

    return NextResponse.json({
      success: true,
      stats: {
        scanned,
        skippedExisting,
        rejectedInstant,
        rejectedBanner,
        rejectedGating,
        rejectedLLM,
        acceptedCount,
        inserted,
        updated,
        emailsInserted,
      },
    })
  } catch (err: any) {
    console.error("Sync error:", err)
    return NextResponse.json({ error: "EXCEPTION", message: err?.message || String(err) }, { status: 500 })
  }
}

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
// If ANY of these appear in the email, it's OUT. No scoring. No LLM.
// These are 100% non-recruiting patterns.
// ============================================================
const INSTANT_REJECT_PATTERNS: string[] = [
  // Unsubscribe = marketing/newsletter, never real recruiting
  "unsubscribe",
  "email preferences",
  "manage your preferences",
  "opt out",
  "opt-out",
  
  // Orders & Shipping
  "your order",
  "order confirmation",
  "order shipped",
  "order has shipped",
  "has been shipped",
  "tracking number",
  "track your order",
  "track your package",
  "track shipment",
  "shipment notification",
  "shipping confirmation",
  "shipping update",
  "delivery notification",
  "delivery update",
  "out for delivery",
  "was delivered",
  "has been delivered",
  "estimated delivery",
  "your package",
  "your shipment",
  
  // Receipts & Payments
  "your receipt",
  "order receipt",
  "payment receipt",
  "purchase confirmation",
  "payment confirmation",
  "payment received",
  "transaction confirmation",
  "invoice attached",
  "your invoice",
  
  // Promotions & Sales
  "special offer",
  "limited time offer",
  "exclusive offer",
  "deal of the day",
  "daily deals",
  "flash sale",
  "% off",
  "percent off",
  "discount code",
  "promo code",
  "coupon code",
  "use code",
  "shop now",
  "buy now",
  "order now",
  "sale ends",
  "don't miss out",
  "act now",
  "limited time",
  "while supplies last",
  "free shipping",
  "black friday",
  "cyber monday",
  "holiday sale",
  "clearance",
  
  // Account & Security (transactional)
  "verification code",
  "verify your email",
  "confirm your email",
  "one-time password",
  "one time password",
  "your otp",
  "otp is",
  "security code",
  "authentication code",
  "security alert",
  "unusual activity",
  "suspicious activity",
  "password reset",
  "reset your password",
  "new sign-in",
  "new login",
  "login attempt",
  "two-factor",
  "2fa",
  
  // Banking & Financial
  "your statement",
  "account statement",
  "bank statement",
  "credit card statement",
  "your bill",
  "bill is ready",
  "payment due",
  "amount due",
  "minimum payment",
  "auto-pay",
  "autopay",
  "direct deposit",
  "account balance",
  "available balance",
  "current balance",
  "annual fee",
  "interest rate",
  "apr",
  "apy",
  "cashback",
  "cash back",
  "reward points",
  "rewards balance",
  "redeem your",
  
  // Entertainment & Streaming
  "now streaming",
  "new episode",
  "new season",
  "watch now",
  "stream now",
  "your playlist",
  "continue watching",
  "because you watched",
  "recommended for you",
  
  // Social Media
  "friend request",
  "connection request",
  "tagged you",
  "mentioned you",
  "liked your",
  "commented on",
  "new follower",
  "new message from",
  
  // Food & Delivery
  "your order is on the way",
  "your driver",
  "food delivery",
  "order ready",
  "preparing your order",
  "your reservation",
  "table for",
  
  // Travel (non-recruiting)
  "flight confirmation",
  "booking confirmation",
  "hotel reservation",
  "boarding pass",
  "check-in reminder",
  "your itinerary",
  
  // Returns
  "return request",
  "refund processed",
  "refund issued",
  "return label",
  
  // Subscriptions
  "subscription",
  "your subscription",
  "renew your",
  "renewal notice",
  "trial ending",
  "trial expired",
  "trial ends",
  "upgrade your plan",
  "downgrade",
  
  // Newsletters explicitly
  "newsletter",
  "weekly digest",
  "daily digest",
  "weekly roundup",
  "monthly roundup",
  "weekly update",
  "news roundup",
]

// ============================================================
// POSITIVE PHRASES - Only genuinely recruiting-related
// w >= 10: Almost certainly recruiting
// w >= 8: Strong recruiting signal (REQUIRED for acceptance)
// w >= 6: Supporting signal
// w <= 4: Weak/ambiguous (cannot trigger acceptance alone)
// ============================================================
const PHRASE_WEIGHTS: Array<{ phrase: string; w: number }> = [
  // TIER 1: VERY HIGH (w=10) - Unmistakably recruiting
  { phrase: "interview request", w: 10 },
  { phrase: "interview invitation", w: 10 },
  { phrase: "invite you to interview", w: 10 },
  { phrase: "schedule an interview", w: 10 },
  { phrase: "interview confirmation", w: 10 },
  { phrase: "confirmed interview", w: 10 },
  { phrase: "your application", w: 10 },
  { phrase: "application status", w: 10 },
  { phrase: "application update", w: 10 },
  { phrase: "reviewing your application", w: 10 },
  { phrase: "received your application", w: 10 },
  { phrase: "thanks for applying", w: 10 },
  { phrase: "thank you for applying", w: 10 },
  { phrase: "following up on your application", w: 10 },
  { phrase: "your candidacy", w: 10 },
  { phrase: "move forward with your candidacy", w: 10 },
  { phrase: "not moving forward", w: 10 },
  { phrase: "move forward with other candidates", w: 10 },
  { phrase: "decided not to move forward", w: 10 },
  { phrase: "pursue other candidates", w: 10 },

  // TIER 2: HIGH (w=8-9) - Strong recruiting indicator
  { phrase: "interview", w: 8 },
  { phrase: "interviewing", w: 8 },
  { phrase: "interview scheduling", w: 9 },
  { phrase: "book an interview", w: 9 },
  { phrase: "interview slot", w: 9 },
  { phrase: "interview time", w: 8 },
  { phrase: "reschedule interview", w: 9 },
  { phrase: "phone screen", w: 8 },
  { phrase: "screening call", w: 8 },
  { phrase: "recruiter screen", w: 9 },
  { phrase: "recruiter call", w: 8 },
  { phrase: "technical screen", w: 8 },
  { phrase: "technical interview", w: 9 },
  { phrase: "hiring manager", w: 8 },
  { phrase: "hiring manager interview", w: 9 },
  { phrase: "hiring team", w: 8 },
  { phrase: "talent acquisition", w: 8 },
  { phrase: "talent team", w: 8 },
  { phrase: "recruiting team", w: 9 },
  { phrase: "recruitment team", w: 9 },
  { phrase: "recruiter", w: 8 },
  { phrase: "onsite interview", w: 9 },
  { phrase: "on-site interview", w: 9 },
  { phrase: "virtual onsite", w: 9 },
  { phrase: "full loop", w: 9 },
  { phrase: "interview loop", w: 9 },
  { phrase: "panel interview", w: 9 },
  { phrase: "final round", w: 9 },
  { phrase: "final interview", w: 9 },
  { phrase: "offer letter", w: 9 },
  { phrase: "employment offer", w: 9 },
  { phrase: "job offer", w: 9 },
  { phrase: "extend an offer", w: 9 },
  { phrase: "signing bonus", w: 8 },
  { phrase: "start date", w: 8 },
  { phrase: "background check", w: 8 },
  { phrase: "take-home assignment", w: 9 },
  { phrase: "take-home exercise", w: 9 },
  { phrase: "take home assignment", w: 9 },
  { phrase: "coding challenge", w: 8 },
  { phrase: "coding exercise", w: 8 },
  { phrase: "case study interview", w: 9 },
  { phrase: "design exercise", w: 8 },
  { phrase: "portfolio review", w: 8 },
  { phrase: "job opportunity", w: 8 },
  { phrase: "career opportunity", w: 8 },
  { phrase: "open role", w: 8 },
  { phrase: "open position", w: 8 },
  { phrase: "interested in your profile", w: 9 },
  { phrase: "interested in your background", w: 9 },
  { phrase: "love to chat about", w: 8 },
  { phrase: "discuss the role", w: 8 },
  { phrase: "discuss this opportunity", w: 8 },
  { phrase: "discuss this role", w: 8 },
  { phrase: "not selected", w: 9 },
  { phrase: "position has been filled", w: 9 },
  { phrase: "role has been filled", w: 9 },
  { phrase: "other candidates", w: 8 },
  { phrase: "unable to move forward", w: 9 },
  { phrase: "regret to inform", w: 8 },

  // TIER 3: MEDIUM (w=6-7) - Supporting signals
  { phrase: "people team", w: 6 },
  { phrase: "people operations", w: 6 },
  { phrase: "hr team", w: 6 },
  { phrase: "human resources", w: 6 },
  { phrase: "introductory call", w: 7 },
  { phrase: "intro call", w: 7 },
  { phrase: "initial call", w: 6 },
  { phrase: "screening", w: 6 },
  { phrase: "interview availability", w: 7 },
  { phrase: "round 2", w: 7 },
  { phrase: "round two", w: 7 },
  { phrase: "second round", w: 7 },
  { phrase: "third round", w: 7 },
  { phrase: "round 3", w: 7 },
  { phrase: "team interview", w: 7 },
  { phrase: "meet the team", w: 7 },
  { phrase: "assessment", w: 6 },
  { phrase: "whiteboard", w: 7 },
  { phrase: "next steps", w: 6 },
  { phrase: "move forward", w: 6 },
  { phrase: "moving forward", w: 6 },
  { phrase: "progress to the next round", w: 7 },
  { phrase: "advance to the next round", w: 7 },
  { phrase: "compensation", w: 6 },
  { phrase: "salary range", w: 7 },
  { phrase: "total compensation", w: 7 },
  { phrase: "greenhouse", w: 6 },
  { phrase: "lever", w: 6 },
  { phrase: "ashby", w: 6 },
  { phrase: "smartrecruiters", w: 6 },
  { phrase: "icims", w: 6 },
  { phrase: "hirevue", w: 7 },
  { phrase: "goodtime", w: 6 },
  { phrase: "your resume", w: 6 },
  { phrase: "your cv", w: 6 },
  { phrase: "join our team", w: 6 },
  { phrase: "hiring for", w: 7 },
  { phrase: "we are hiring", w: 7 },
  { phrase: "position closed", w: 7 },
  { phrase: "role closed", w: 7 },

  // TIER 4: LOW (w=2-4) - Ambiguous, cannot trigger alone
  { phrase: "opportunity", w: 3 },
  { phrase: "position", w: 2 },
  { phrase: "role", w: 2 },
  { phrase: "candidate", w: 3 },
  { phrase: "availability", w: 2 },
  { phrase: "offer", w: 2 },  // "special offer" problem
  { phrase: "screen", w: 1 },  // "screen resolution" problem
  { phrase: "decided", w: 1 },
  { phrase: "decision", w: 1 },
  { phrase: "salary", w: 3 },
  { phrase: "equity", w: 3 },
  { phrase: "loop", w: 3 },
  { phrase: "panel", w: 3 },
  { phrase: "calendly", w: 3 },
  { phrase: "google meet", w: 2 },
  { phrase: "zoom", w: 2 },
  { phrase: "teams", w: 1 },
  { phrase: "schedule a call", w: 4 },
  { phrase: "schedule time", w: 3 },
  { phrase: "book time", w: 3 },
  { phrase: "connect with you", w: 3 },
  { phrase: "chat with you", w: 2 },
  { phrase: "speak with you", w: 2 },
  { phrase: "reach out", w: 2 },
  { phrase: "great fit", w: 3 },
  { phrase: "good fit", w: 2 },
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

// ===== GATING THRESHOLDS =====
const MIN_SCORE = 15              // Total positive score must be >= 15
const MIN_STRONG_HIT_WEIGHT = 8   // Must have at least one phrase with w >= 8

function normalize(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function normalizeForMatch(s: string) {
  return " " + normalize(s) + " "
}

// ============================================================
// INSTANT REJECT CHECK
// Returns true if email should be instantly rejected
// ============================================================
function shouldInstantReject(textLower: string): { reject: boolean; reason: string } {
  const normalized = normalizeForMatch(textLower)
  
  for (const pattern of INSTANT_REJECT_PATTERNS) {
    const needle = " " + normalize(pattern) + " "
    if (normalized.includes(needle)) {
      return { reject: true, reason: pattern }
    }
    // Also check without space padding for patterns at start/end
    if (textLower.includes(pattern.toLowerCase())) {
      return { reject: true, reason: pattern }
    }
  }
  
  return { reject: false, reason: "" }
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
  const stop = new Set([
    "we", "have", "has", "had", "to", "the", "a", "an", "and", "or", "of",
    "in", "on", "for", "with", "at", "this", "that", "are", "is", "be",
    "not", "will", "wont", "cant", "cannot", "you", "your", "our", "us", "i",
  ])

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
      if (cw === 1) {
        const tok = c
        if (tok.length <= 3) continue
        if (stop.has(tok)) continue
      }
      let chunkW = 1
      if (cw === 3) chunkW = Math.max(2, Math.round(w * 0.6))
      else if (cw === 2) chunkW = Math.max(2, Math.round(w * 0.5))
      else chunkW = 1

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

    if (item.w > strongestHitWeight) {
      strongestHitWeight = item.w
    }
  }

  return { score, hits, strongestHitWeight }
}

function defaultStageDetail(bucket: StageBucket) {
  switch (bucket) {
    case "RECRUITER_SCREEN": return "Recruiter screening"
    case "HM_SCREEN": return "Hiring manager screen"
    case "ASSESSMENT": return "Take-home / assessment"
    case "LOOP": return "Full interview loop"
    case "OFFER": return "Offer stage"
    case "REJECTED": return "Rejected"
    case "NOT_RECRUITING": return "Not recruiting"
    default: return "Screening"
  }
}

function stageBucketToUiStage(bucket: StageBucket): Stage {
  switch (bucket) {
    case "RECRUITER_SCREEN": return "SCREENING"
    case "HM_SCREEN": return "HM"
    case "ASSESSMENT": return "ASSESSMENT"
    case "LOOP": return "FULL_LOOP"
    case "OFFER": return "OFFER_DISCUSSION"
    case "REJECTED": return "REJECTED"
    case "NOT_RECRUITING": return "REJECTED"
    default: return "SCREENING"
  }
}

function advanceOnly(prev: StageBucket, next: StageBucket): StageBucket {
  const order: StageBucket[] = ["RECRUITER_SCREEN", "HM_SCREEN", "ASSESSMENT", "LOOP", "OFFER", "REJECTED"]
  const pi = order.indexOf(prev)
  const ni = order.indexOf(next)
  if (pi === -1) return next
  if (ni === -1) return prev
  if (next === "REJECTED") return "REJECTED"
  return ni >= pi ? next : prev
}

function capInterviewIfNoSchedulingEvidence(proposed: StageBucket, scheduleStrong: boolean) {
  if (!scheduleStrong && (proposed === "LOOP" || proposed === "OFFER")) {
    return "RECRUITER_SCREEN"
  }
  return proposed
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

    const parts = part.parts
    if (Array.isArray(parts)) {
      for (const p of parts) walk(p)
    }
  }

  walk(payload)
  return { text: text.trim(), html: html.trim() }
}

// ============================================================
// LLM: STRICT CLASSIFICATION
// ============================================================
async function classifyWithLLM(input: {
  subject: string
  snippet: string
  fromEmail: string
  userEmail: string
  score: number
  hits: Array<{ phrase: string; w: number }>
  bodyExcerpt: string
}) {
  const systemPrompt = `You are a strict email classifier for a job search app. Your ONLY job is to determine if an email is about job recruiting/interviews.

CRITICAL RULES:
1. Be EXTREMELY skeptical. Default to NOT_RECRUITING unless clearly about jobs.
2. Real recruiting emails come from actual people (recruiters, HR, hiring managers) about specific job opportunities.
3. Marketing emails, newsletters, promotional content = NOT_RECRUITING, even if from a company that might hire.
4. If the email has "unsubscribe" or is promotional in nature = NOT_RECRUITING.
5. Output ONLY valid JSON. No markdown. No explanation outside JSON.`

  const userPrompt = `Classify this email. Is it genuinely about a job/interview?

Email:
From: ${input.fromEmail}
Subject: ${input.subject}
Snippet: ${input.snippet}

Body (excerpt):
${input.bodyExcerpt.slice(0, 2000)}

Return ONLY this JSON:
{
  "is_recruiting": boolean,
  "confidence": number (0-1),
  "reason": "one sentence explanation",
  "stage_bucket": "NOT_RECRUITING" | "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stage_detail": "brief stage description",
  "company": "company name or Unknown",
  "role": "job title or Unknown"
}

Stage definitions (only if is_recruiting=true):
- RECRUITER_SCREEN: Initial outreach, application acknowledgment, recruiter call
- HM_SCREEN: Hiring manager interview scheduled/confirmed
- ASSESSMENT: Take-home, coding challenge, case study assigned
- LOOP: Onsite/virtual onsite, panel interviews, final rounds
- OFFER: Offer extended, compensation discussion
- REJECTED: Rejection email

If NOT about recruiting: is_recruiting=false, stage_bucket="NOT_RECRUITING"`

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  })

  const txt = res.choices?.[0]?.message?.content || ""
  return safeJsonParse<{
    is_recruiting: boolean
    confidence: number
    reason: string
    stage_bucket: StageBucket
    stage_detail: string
    company: string
    role: string
  }>(txt)
}

// ============================================================
// LLM: BESPOKE PREP GENERATION
// ============================================================
async function generateBespokePrep(input: {
  company: string
  role: string
  stage_bucket: StageBucket
  stage_detail: string
  subject: string
  snippet: string
  fromEmail: string
  receivedAt: string
  bodyExcerpt: string
}) {
  const systemPrompt = `You are Guildy, an interview prep assistant. Generate SPECIFIC, ACTIONABLE prep.

ABSOLUTE RULES:
1. NO generic advice. Every bullet must be specific to ${input.company} and ${input.role}.
2. NO hallucinating. If you don't know something, say "Unknown" or "Insufficient data".
3. NO filler phrases like "research the company" - give specific research tasks.
4. Tailor everything to the ${input.stage_bucket} stage.
5. Be concise. Value over volume.
6. Output ONLY valid JSON.`

  const userPrompt = `Generate interview prep for:

Company: ${input.company}
Role: ${input.role}  
Stage: ${input.stage_bucket} (${input.stage_detail})
Email from: ${input.fromEmail}
Subject: ${input.subject}
Date: ${input.receivedAt}

Email body:
${input.bodyExcerpt.slice(0, 1500)}

Return ONLY this JSON:
{
  "insights": {
    "stage_reason": "Why classified as ${input.stage_bucket}",
    "waiting_on": "you" | "them",
    "next_action": "Specific next action for the candidate",
    "urgency": "low" | "med" | "high",
    "response_likelihood": "low" | "med" | "high",
    "tone": "friendly" | "formal" | "neutral" | "urgent"
  },
  "prep": {
    "prep_focus": "What to specifically prepare for ${input.stage_bucket} stage at ${input.company}",
    "questions_they_might_ask_you": [
      "3-5 specific questions likely for ${input.role} at ${input.company}"
    ],
    "questions_you_should_ask_them": [
      "3-5 smart questions to ask about ${input.company} and ${input.role}"
    ],
    "what_to_emphasize": [
      "Specific skills/experiences to highlight for ${input.role}"
    ],
    "stories_to_prepare": [
      "Specific STAR story topics relevant to ${input.role}"
    ],
    "homework_next_24h": [
      "Concrete prep tasks to complete"
    ],
    "company_intel": {
      "industry": "Industry or Unknown",
      "size": "Company size or Unknown", 
      "hq_location": "Location or Unknown",
      "glassdoor_rating": "Rating or Unknown",
      "summary": "Brief verified summary OR 'Insufficient data available'",
      "recent_news": [],
      "truthful_note": "What we could not verify from this email context"
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

  const txt = res.choices?.[0]?.message?.content || ""
  return safeJsonParse<any>(txt)
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

    // Stats
    let scanned = messages.length
    let skippedExisting = 0
    let rejectedInstant = 0
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

      // Skip if already processed
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

      // Fetch full message
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

      // Combine all text for analysis
      const fullText = `${subject}\n${snippet}\n${fromHeader}\n${bodyText}`
      const textLower = fullText.toLowerCase()

      // ===== GATE 1: INSTANT REJECT =====
      const instantCheck = shouldInstantReject(textLower)
      if (instantCheck.reject) {
        rejectedInstant++
        continue
      }

      // ===== GATE 2: SCORE THRESHOLD =====
      const { score, hits, strongestHitWeight } = scoreEmailText(textLower)
      const hasStrongHit = strongestHitWeight >= MIN_STRONG_HIT_WEIGHT
      
      if (score < MIN_SCORE || !hasStrongHit) {
        rejectedGating++
        continue
      }

      // ===== GATE 3: LLM CLASSIFICATION =====
      const classification = await classifyWithLLM({
        subject,
        snippet,
        fromEmail,
        userEmail,
        score,
        hits,
        bodyExcerpt,
      })

      if (!classification || !classification.is_recruiting || classification.stage_bucket === "NOT_RECRUITING") {
        rejectedLLM++
        continue
      }

      // ===== ACCEPTED: Process pipeline =====
      acceptedCount++

      const scheduleStrong =
        textLower.includes("schedule an interview") ||
        textLower.includes("interview confirmation") ||
        textLower.includes("calendar invite") ||
        textLower.includes("phone screen") ||
        textLower.includes("screening call")

      const proposed = classification.stage_bucket
      const cappedStage = capInterviewIfNoSchedulingEvidence(proposed, scheduleStrong)

      const company = (classification.company || "").trim() || "Unknown"
      const role = (classification.role || "").trim() || "Unknown"
      const stageDetail = (classification.stage_detail || "").trim() || defaultStageDetail(cappedStage)

      const companyN = normalize(company)
      const roleN = normalize(role)

      let match = pipelines.find((p: any) => normalize(p.company) === companyN && normalize(p.role) === roleN)
      const isNewPipeline = !match

      // Generate bespoke prep
      const prepPack = await generateBespokePrep({
        company,
        role,
        stage_bucket: cappedStage,
        stage_detail: stageDetail,
        subject,
        snippet,
        fromEmail,
        receivedAt,
        bodyExcerpt,
      })

      const insights_json = prepPack?.insights ?? null
      const prep_json = prepPack?.prep ?? null

      let pipelineId: string | null = null

      if (isNewPipeline) {
        const { data: created, error: createErr } = await supabase
          .from("pipelines")
          .insert({
            user_email: userEmail,
            company,
            role,
            stage: stageBucketToUiStage(cappedStage),
            stage_detail: stageDetail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail || fromHeader,
            last_email_snippet: snippet,
            insights_json,
            prep_json,
          })
          .select()
          .single()

        if (createErr || !created?.id) continue
        pipelineId = created.id
        pipelines.push(created)
        inserted++
      } else {
        pipelineId = match.id

        const prevBucket: StageBucket = (() => {
          const s = String(match.stage || "").toUpperCase()
          if (s.includes("REJECT")) return "REJECTED"
          if (s.includes("OFFER")) return "OFFER"
          if (s.includes("FULL_LOOP") || s.includes("LOOP") || s.includes("ONSITE")) return "LOOP"
          if (s.includes("ASSESS")) return "ASSESSMENT"
          if (s.includes("HM") || s.includes("HIRING")) return "HM_SCREEN"
          return "RECRUITER_SCREEN"
        })()

        const nextStage = advanceOnly(prevBucket, cappedStage)

        const { error: updErr } = await supabase
          .from("pipelines")
          .update({
            stage: stageBucketToUiStage(nextStage),
            stage_detail: stageDetail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail || fromHeader,
            last_email_snippet: snippet,
            insights_json,
            prep_json,
          })
          .eq("id", pipelineId)

        if (!updErr) {
          Object.assign(match, {
            stage: stageBucketToUiStage(nextStage),
            stage_detail: stageDetail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail || fromHeader,
            last_email_snippet: snippet,
            insights_json,
            prep_json,
          })
          updated++
        }
      }

      // Record email
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

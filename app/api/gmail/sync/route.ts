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

/**
 * DO NOT REMOVE PHRASES.
 * You may ONLY add phrases or increase detection strength.
 */
const PHRASE_WEIGHTS: Array<{ phrase: string; w: number }> = [
  // 1) High-signal interview scheduling phrases (VERY HIGH)
  { phrase: "interview", w: 6 },
  { phrase: "interview request", w: 10 },
  { phrase: "interview invitation", w: 10 },
  { phrase: "invite you to interview", w: 10 },
  { phrase: "interview scheduling", w: 9 },
  { phrase: "schedule an interview", w: 10 },
  { phrase: "book an interview", w: 9 },
  { phrase: "interview availability", w: 8 },
  { phrase: "interview time", w: 8 },
  { phrase: "interview slot", w: 9 },
  { phrase: "interview confirmation", w: 10 },
  { phrase: "confirmed interview", w: 10 },
  { phrase: "reschedule interview", w: 9 },
  { phrase: "rescheduling interview", w: 9 },
  { phrase: "interview rescheduled", w: 9 },
  { phrase: "calendar invite", w: 8 },
  { phrase: "calendar invitation", w: 8 },
  { phrase: "invite sent", w: 7 },
  { phrase: "send an invite", w: 7 },
  { phrase: "zoom invite", w: 7 },
  { phrase: "google meet invite", w: 7 },
  { phrase: "microsoft teams invite", w: 7 },
  { phrase: "teams invite", w: 6 },

  // 2) Screening / recruiter phrases (HIGH)
  { phrase: "recruiter", w: 6 },
  { phrase: "talent acquisition", w: 6 },
  { phrase: "talent team", w: 6 },
  { phrase: "people team", w: 6 },
  { phrase: "people operations", w: 6 },
  { phrase: "hr team", w: 6 },
  { phrase: "human resources", w: 6 },
  { phrase: "screening", w: 7 },
  { phrase: "screen", w: 5 },
  { phrase: "phone screen", w: 7 },
  { phrase: "introductory call", w: 7 },
  { phrase: "intro call", w: 7 },
  { phrase: "initial call", w: 6 },
  { phrase: "quick call", w: 6 },
  { phrase: "brief call", w: 6 },
  { phrase: "15 minute call", w: 6 },
  { phrase: "30 minute call", w: 6 },
  { phrase: "short call", w: 5 },
  { phrase: "screening call", w: 7 },

  // 3) Later stage / onsite / loop phrases (HIGH)
  { phrase: "onsite", w: 9 },
  { phrase: "on-site", w: 9 },
  { phrase: "full loop", w: 9 },
  { phrase: "loop", w: 7 },
  { phrase: "panel", w: 7 },
  { phrase: "panel interview", w: 9 },
  { phrase: "interview panel", w: 9 },
  { phrase: "final round", w: 9 },
  { phrase: "final interview", w: 9 },
  { phrase: "round 2", w: 7 },
  { phrase: "round two", w: 7 },
  { phrase: "second round", w: 7 },
  { phrase: "third round", w: 7 },
  { phrase: "round 3", w: 7 },
  { phrase: "round three", w: 7 },
  { phrase: "hiring manager", w: 8 },
  { phrase: "hiring manager interview", w: 9 },
  { phrase: "team interview", w: 8 },
  { phrase: "meet the team", w: 8 },

  // 4) Assessments / exercises (MED/HIGH)
  { phrase: "assessment", w: 7 },
  { phrase: "take-home", w: 7 },
  { phrase: "take home", w: 7 },
  { phrase: "homework", w: 6 },
  { phrase: "exercise", w: 6 },
  { phrase: "case study", w: 7 },
  { phrase: "design exercise", w: 8 },
  { phrase: "portfolio review", w: 7 },
  { phrase: "whiteboard", w: 7 },
  { phrase: "technical screen", w: 7 },
  { phrase: "coding challenge", w: 7 },

  // 5) Positive progression / next steps (MED/HIGH)
  { phrase: "next steps", w: 7 },
  { phrase: "move forward", w: 7 },
  { phrase: "moving forward", w: 7 },
  { phrase: "progress to the next round", w: 8 },
  { phrase: "advance to the next round", w: 8 },
  { phrase: "we'd like to proceed", w: 7 },
  { phrase: "we'd love to move you forward", w: 8 },
  { phrase: "we would like to move you forward", w: 8 },
  { phrase: "schedule time", w: 6 },
  { phrase: "schedule a call", w: 7 },
  { phrase: "book time", w: 7 },
  { phrase: "availability", w: 6 },

  // 6) Offers / closing (HIGH) — but keep low weight
  { phrase: "offer", w: 7 },
  { phrase: "offer letter", w: 9 },
  { phrase: "compensation", w: 7 },
  { phrase: "equity", w: 6 },
  { phrase: "salary", w: 6 },
  { phrase: "signing bonus", w: 8 },
  { phrase: "start paperwork", w: 8 },
  { phrase: "onboarding", w: 7 },
  { phrase: "employment offer", w: 9 },

  // 7) Rejection variants (HIGH)
  { phrase: "not moving forward", w: 9 },
  { phrase: "move forward with other candidates", w: 9 },
  { phrase: "we have decided not to move forward", w: 9 },
  { phrase: "we are unable to move forward", w: 9 },
  { phrase: "closed the role", w: 8 },

  // 8) ATS / recruiting tool names inside body (MED/HIGH)
  { phrase: "greenhouse", w: 6 },
  { phrase: "lever", w: 5 },
  { phrase: "workday", w: 6 },
  { phrase: "ashby", w: 6 },
  { phrase: "smartrecruiters", w: 6 },
  { phrase: "icims", w: 6 },
  { phrase: "hirevue", w: 6 },
  { phrase: "goodtime", w: 6 },
  { phrase: "calendly", w: 6 },

  // ---- Added (ONLY appended; nothing removed)
  { phrase: "phone screen", w: 6 },
  { phrase: "phone screening", w: 6 },
  { phrase: "screening call", w: 7 },
  { phrase: "intro call", w: 7 },
  { phrase: "initial call", w: 6 },
  { phrase: "30-minute", w: 6 },
  { phrase: "30 minute", w: 6 },
  { phrase: "15-minute", w: 5 },
  { phrase: "zoom interview", w: 8 },
  { phrase: "video interview", w: 8 },
  { phrase: "google meet", w: 7 },
  { phrase: "meet with the team", w: 7 },
  { phrase: "portfolio review", w: 7 },
  { phrase: "design exercise", w: 8 },
  { phrase: "take-home", w: 7 },
  { phrase: "take home", w: 7 },
  { phrase: "case study", w: 7 },
  { phrase: "whiteboard", w: 7 },
  { phrase: "technical screen", w: 7 },
  { phrase: "panel interview", w: 8 },
  { phrase: "hiring manager interview", w: 8 },
  { phrase: "final round", w: 8 },

  // ===== Added: short rejection markers (non-rigid; <= 3 words each) =====
  { phrase: "unfortunately", w: 8 },
  { phrase: "regret", w: 7 },
  { phrase: "regrets", w: 7 },
  { phrase: "decided", w: 6 },
  { phrase: "decision", w: 5 },
  { phrase: "unable", w: 7 },
  { phrase: "cannot", w: 6 },
  { phrase: "will not", w: 7 },
  { phrase: "we won't", w: 7 },
  { phrase: "not selected", w: 9 },
  { phrase: "other candidates", w: 8 },
  { phrase: "position filled", w: 8 },
  { phrase: "role filled", w: 8 },
  { phrase: "position closed", w: 8 },
  { phrase: "role closed", w: 8 },
  { phrase: "moving on", w: 6 },
  { phrase: "moved on", w: 6 },

  // ===== NEW: High-signal recruiting phrases (v2) =====
  { phrase: "job opportunity", w: 8 },
  { phrase: "job opening", w: 8 },
  { phrase: "open role", w: 8 },
  { phrase: "open position", w: 8 },
  { phrase: "career opportunity", w: 8 },
  { phrase: "interested in your profile", w: 9 },
  { phrase: "interested in your background", w: 9 },
  { phrase: "your application", w: 8 },
  { phrase: "application status", w: 8 },
  { phrase: "application update", w: 8 },
  { phrase: "reviewing your application", w: 9 },
  { phrase: "received your application", w: 9 },
  { phrase: "thanks for applying", w: 9 },
  { phrase: "thank you for applying", w: 9 },
  { phrase: "following up on this role", w: 10 },
  { phrase: "following up on your application", w: 10 },
  { phrase: "reach out about", w: 7 },
  { phrase: "reaching out about", w: 7 },
  { phrase: "your resume", w: 7 },
  { phrase: "your cv", w: 7 },
  { phrase: "your candidacy", w: 9 },
  { phrase: "candidate", w: 5 },
  { phrase: "candidates", w: 5 },
  { phrase: "hiring for", w: 8 },
  { phrase: "we are hiring", w: 8 },
  { phrase: "join our team", w: 7 },
  { phrase: "join the team", w: 7 },
  { phrase: "speak with you", w: 6 },
  { phrase: "chat with you", w: 6 },
  { phrase: "connect with you", w: 6 },
  { phrase: "discuss the role", w: 8 },
  { phrase: "discuss this role", w: 8 },
  { phrase: "discuss the opportunity", w: 8 },
  { phrase: "discuss this opportunity", w: 8 },
  { phrase: "learn more about your experience", w: 8 },
  { phrase: "great fit", w: 7 },
  { phrase: "strong fit", w: 7 },
  { phrase: "good fit", w: 6 },
]

// ===== NEGATIVE PHRASES: signals this is NOT recruiting =====
const NEGATIVE_PHRASES: Array<{ phrase: string; w: number }> = [
  // Orders / Shipping / Receipts
  { phrase: "your order", w: 15 },
  { phrase: "order confirmation", w: 15 },
  { phrase: "order shipped", w: 15 },
  { phrase: "has shipped", w: 12 },
  { phrase: "tracking number", w: 15 },
  { phrase: "track your", w: 12 },
  { phrase: "delivery update", w: 12 },
  { phrase: "out for delivery", w: 15 },
  { phrase: "delivered", w: 10 },
  { phrase: "shipment", w: 10 },
  { phrase: "shipping confirmation", w: 15 },
  { phrase: "receipt", w: 10 },
  { phrase: "invoice", w: 10 },
  { phrase: "payment received", w: 12 },
  { phrase: "payment confirmation", w: 12 },
  { phrase: "purchase", w: 8 },
  { phrase: "bought", w: 8 },
  { phrase: "cart", w: 8 },
  { phrase: "checkout", w: 8 },

  // Newsletters / Marketing
  { phrase: "unsubscribe", w: 12 },
  { phrase: "newsletter", w: 12 },
  { phrase: "weekly digest", w: 12 },
  { phrase: "daily digest", w: 12 },
  { phrase: "weekly update", w: 10 },
  { phrase: "monthly update", w: 10 },
  { phrase: "daily deals", w: 15 },
  { phrase: "special offer", w: 10 },
  { phrase: "limited time", w: 10 },
  { phrase: "discount code", w: 12 },
  { phrase: "promo code", w: 12 },
  { phrase: "coupon", w: 10 },
  { phrase: "% off", w: 10 },
  { phrase: "sale ends", w: 12 },
  { phrase: "flash sale", w: 12 },
  { phrase: "black friday", w: 12 },
  { phrase: "cyber monday", w: 12 },
  { phrase: "holiday sale", w: 12 },

  // Account / Security notifications
  { phrase: "verification code", w: 15 },
  { phrase: "verify your email", w: 12 },
  { phrase: "confirm your email", w: 10 },
  { phrase: "one-time password", w: 15 },
  { phrase: "otp", w: 10 },
  { phrase: "security alert", w: 12 },
  { phrase: "password reset", w: 12 },
  { phrase: "reset your password", w: 12 },
  { phrase: "new sign-in", w: 10 },
  { phrase: "login attempt", w: 10 },
  { phrase: "two-factor", w: 10 },
  { phrase: "2fa", w: 10 },

  // Financial / Banking (non-recruiting)
  { phrase: "your statement", w: 12 },
  { phrase: "account statement", w: 12 },
  { phrase: "bank statement", w: 12 },
  { phrase: "credit card", w: 10 },
  { phrase: "apy", w: 10 },
  { phrase: "interest rate", w: 8 },
  { phrase: "your bill", w: 12 },
  { phrase: "bill is ready", w: 12 },
  { phrase: "payment due", w: 12 },
  { phrase: "amount due", w: 12 },
  { phrase: "auto-pay", w: 10 },
  { phrase: "direct deposit", w: 8 },

  // Social / Entertainment
  { phrase: "new episode", w: 12 },
  { phrase: "now streaming", w: 12 },
  { phrase: "watch now", w: 10 },
  { phrase: "new release", w: 8 },
  { phrase: "your playlist", w: 10 },
  { phrase: "friend request", w: 12 },
  { phrase: "tagged you", w: 12 },
  { phrase: "mentioned you", w: 10 },
  { phrase: "liked your", w: 10 },
  { phrase: "commented on", w: 8 },

  // Food / Restaurant
  { phrase: "your reservation", w: 10 },
  { phrase: "table for", w: 10 },
  { phrase: "food delivery", w: 12 },
  { phrase: "your meal", w: 10 },
  { phrase: "menu", w: 6 },

  // Travel (non-recruiting)
  { phrase: "flight confirmation", w: 12 },
  { phrase: "booking confirmation", w: 10 },
  { phrase: "hotel reservation", w: 12 },
  { phrase: "itinerary", w: 8 },
  { phrase: "check-in", w: 6 },

  // Returns / Refunds
  { phrase: "return request", w: 12 },
  { phrase: "refund", w: 10 },
  { phrase: "return label", w: 12 },
  { phrase: "exchange", w: 6 },
]

type StageBucket =
  | "RECRUITER_SCREEN"
  | "HM_SCREEN"
  | "ASSESSMENT"
  | "LOOP"
  | "OFFER"
  | "REJECTED"
  | "NOT_RECRUITING" // NEW: LLM can reject

type Stage =
  | "APPLIED"
  | "SCREENING"
  | "HM"
  | "ASSESSMENT"
  | "FULL_LOOP"
  | "OFFER_DISCUSSION"
  | "REJECTED"

// ===== TIGHTENED GATES =====
// Require BOTH score threshold AND at least one strong hit
const MIN_SCORE = 12          // Raised from 6
const MIN_STRONG_HIT_WEIGHT = 7  // At least one phrase with w >= 7
const MAX_NEGATIVE_SCORE = 15    // If negative score exceeds this, reject unless recruiting score is very high

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

type ShortPhrase = { chunk: string; w: number; parent: string; cap: number }

function normalizeForMatch(s: string) {
  return " " + normalize(s) + " "
}

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
    "we",
    "have",
    "has",
    "had",
    "to",
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "in",
    "on",
    "for",
    "with",
    "at",
    "this",
    "that",
    "are",
    "is",
    "be",
    "not",
    "will",
    "won't",
    "cant",
    "cannot",
    "you",
    "your",
    "our",
    "us",
    "i",
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

// Build negative phrase matcher (simpler - just direct matches)
function scoreNegativePhrases(textLower: string): { score: number; hits: string[] } {
  const hay = normalizeForMatch(textLower)
  let score = 0
  const hits: string[] = []

  for (const item of NEGATIVE_PHRASES) {
    const needle = " " + normalize(item.phrase) + " "
    if (hay.includes(needle)) {
      score += item.w
      hits.push(item.phrase)
    }
  }

  return { score, hits }
}

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

    // Track the strongest single hit
    if (item.w > strongestHitWeight) {
      strongestHitWeight = item.w
    }
  }

  return { score, hits, strongestHitWeight }
}

function defaultStageDetail(bucket: StageBucket) {
  switch (bucket) {
    case "RECRUITER_SCREEN":
      return "Screening"
    case "HM_SCREEN":
      return "Hiring manager"
    case "ASSESSMENT":
      return "Assessment"
    case "LOOP":
      return "Full loop"
    case "OFFER":
      return "Offer discussion"
    case "REJECTED":
      return "Rejected"
    case "NOT_RECRUITING":
      return "Not recruiting"
    default:
      return "Screening"
  }
}

function stageBucketToUiStage(bucket: StageBucket): Stage {
  switch (bucket) {
    case "RECRUITER_SCREEN":
      return "SCREENING"
    case "HM_SCREEN":
      return "HM"
    case "ASSESSMENT":
      return "ASSESSMENT"
    case "LOOP":
      return "FULL_LOOP"
    case "OFFER":
      return "OFFER_DISCUSSION"
    case "REJECTED":
      return "REJECTED"
    case "NOT_RECRUITING":
      return "REJECTED" // Won't be used since we skip these
    default:
      return "SCREENING"
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
  if (!scheduleStrong) {
    if (proposed === "LOOP" || proposed === "OFFER") return "RECRUITER_SCREEN"
  }
  return proposed
}

function safeJsonParse<T>(s: any): T | null {
  try {
    if (!s) return null
    // Handle case where LLM returns markdown-wrapped JSON
    let cleaned = s
    if (typeof s === "string") {
      cleaned = s.trim()
      // Remove markdown code blocks if present
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.slice(7)
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.slice(3)
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3)
      }
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

async function estimateStageFromLLM(input: {
  subject: string
  snippet: string
  fromEmail: string
  userEmail: string
  scheduleStrong: boolean
  offerStrong: boolean
  score: number
  hits: Array<{ phrase: string; w: number }>
  negativeScore: number
  negativeHits: string[]
  bodyExcerpt: string
}) {
  const sys = `You are an expert recruiter ops assistant that classifies emails. Output ONLY strict JSON with no extra text or markdown.

CRITICAL: Your primary job is to FILTER OUT non-recruiting emails. Be VERY skeptical. Most emails are NOT recruiting-related.`

  const prompt = `Classify this email. Is it a recruiting/job interview email, or something else (marketing, newsletter, order, notification, etc)?

Return JSON with:
{
  "is_recruiting": boolean,
  "stage_bucket": "NOT_RECRUITING" | "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stage_detail": string,
  "company": string,
  "role": string,
  "reason": string,
  "confidence": number
}

RULES:
1. If this is NOT a recruiting/interview email, set is_recruiting=false and stage_bucket="NOT_RECRUITING"
2. NOT recruiting includes: orders, receipts, newsletters, marketing, promotions, account notifications, social media, entertainment, banking alerts, shipping updates, verification codes
3. ONLY set is_recruiting=true if this is clearly about a job application, interview, recruiting outreach, or hiring process
4. If unsure, default to NOT_RECRUITING (be conservative)

If it IS recruiting:
- RECRUITER_SCREEN: Initial outreach, application received, first call scheduling
- HM_SCREEN: Explicitly mentions hiring manager call
- ASSESSMENT: Take-home, exercise, case study mentioned
- LOOP: Onsite, panel, final rounds, multiple interviewers
- OFFER: Compensation, offer letter, negotiation
- REJECTED: Rejection language, "not moving forward", "other candidates"

Email:
From: ${input.fromEmail}
To (user): ${input.userEmail}
Subject: ${input.subject}
Snippet: ${input.snippet}

Body excerpt (first 2500 chars):
${input.bodyExcerpt}

Detection signals:
recruitingScore=${input.score}
recruitingHits=${input.hits.map((h) => `${h.phrase}(${h.w})`).join(", ")}
negativeScore=${input.negativeScore}
negativeHits=${input.negativeHits.join(", ")}
scheduleStrong=${input.scheduleStrong}
offerStrong=${input.offerStrong}
`

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: prompt },
    ],
  })

  const txt = res.choices?.[0]?.message?.content || ""
  const parsed = safeJsonParse<{
    is_recruiting: boolean
    stage_bucket: StageBucket
    stage_detail: string
    company: string
    role: string
    reason: string
    confidence: number
  }>(txt)

  if (!parsed) return null
  return parsed
}

async function generateInsightsAndPrep(input: {
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
  const sys = `You are Guildy, a job pipeline + interview prep assistant. Output ONLY strict JSON with no markdown or extra text.

CRITICAL RULES:
1. Generate prep that is SPECIFIC to this exact company, role, and stage
2. Do NOT hallucinate company facts. If you don't know something, say "Unknown" or "Not available"
3. No generic advice. Every bullet should reference the specific company/role/stage
4. If context is insufficient, say so explicitly rather than making things up`

  const prompt = `Generate bespoke, stage-specific insights + interview prep for THIS job.

Return JSON with this exact shape:
{
  "insights": {
    "stage_reason": string,
    "stage_confidence": number,
    "signals": [{"type": string, "label": string, "confidence": number, "at": string}],
    "waiting_on": "you" | "them",
    "next_action": string,
    "urgency": "low" | "med" | "high",
    "response_likelihood": "low" | "med" | "high",
    "tone": string
  },
  "prep": {
    "prep_focus": string,
    "questions_they_might_ask_you": string[],
    "questions_you_should_ask_them": string[],
    "what_to_emphasize": string[],
    "stories_to_prepare": string[],
    "homework_next_24h": string[],
    "company_intel": {
      "industry": string,
      "size": string,
      "hq_location": string,
      "glassdoor_rating": string,
      "summary": string,
      "recent_news": string[],
      "truthful_note": string
    }
  }
}

REQUIREMENTS:
- prep_focus: What to prepare for THIS stage at THIS company (not generic)
- questions_they_might_ask_you: 3-5 questions specific to ${input.role} at ${input.company} for ${input.stage_bucket} stage
- questions_you_should_ask_them: 3-5 questions to ask about ${input.company} and ${input.role}
- what_to_emphasize: Skills/experiences to highlight for THIS role
- stories_to_prepare: STAR stories relevant to THIS role
- homework_next_24h: Concrete prep tasks for this specific interview
- company_intel: ONLY include what you can verify. Set fields to "Unknown" if not sure. Set truthful_note to explain what's unknown.

Context:
Company: ${input.company}
Role: ${input.role}
Stage: ${input.stage_bucket} (${input.stage_detail})
From: ${input.fromEmail}
Subject: ${input.subject}
Snippet: ${input.snippet}
ReceivedAt: ${input.receivedAt}

Body excerpt:
${input.bodyExcerpt}
`

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: prompt },
    ],
  })

  const txt = res.choices?.[0]?.message?.content || ""
  return safeJsonParse<any>(txt)
}

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
    // FIXED: Added -in:trash to exclude trash
    const q = `${qBase} -in:trash -in:chats`

    let pageToken: string | undefined = undefined
    const messages: Array<{ id?: string | null; threadId?: string | null }> = []

    do {
      const page = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: PAGE_SIZE,
        pageToken,
        includeSpamTrash: true, // Include spam (recruiting emails land there) but query excludes trash
      })

      const pageMsgs = page.data.messages ?? []
      for (const msg of pageMsgs) {
        messages.push(msg)
        if (messages.length >= MAX_MESSAGES_PER_RUN) break
      }

      pageToken = page.data.nextPageToken ?? undefined
    } while (pageToken && messages.length < MAX_MESSAGES_PER_RUN)

    let scanned = messages.length
    let llmCalls = 0
    let inserted = 0
    let updated = 0
    let emailsInserted = 0
    let prepGenerated = 0
    let acceptedCount = 0
    let rejectedByGating = 0
    let rejectedByLLM = 0

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
      if (existingEmail) continue

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
      const bodyExcerpt = bodyText.slice(0, 2500)

      const textLower = `${subject}\n${snippet}\n${fromHeader}\n${bodyText}`.toLowerCase()
      const { score, hits, strongestHitWeight } = scoreEmailText(textLower)
      const { score: negativeScore, hits: negativeHits } = scoreNegativePhrases(textLower)

      const scheduleStrong =
        textLower.includes("schedule an interview") ||
        textLower.includes("calendar invite") ||
        textLower.includes("calendar invitation") ||
        textLower.includes("availability") ||
        textLower.includes("zoom") ||
        textLower.includes("google meet") ||
        textLower.includes("teams") ||
        textLower.includes("book time") ||
        textLower.includes("phone screen") ||
        textLower.includes("screening call") ||
        textLower.includes("interview time") ||
        textLower.includes("interview slot")

      const offerStrong =
        textLower.includes("offer letter") ||
        textLower.includes("compensation") ||
        textLower.includes("equity") ||
        textLower.includes("salary") ||
        textLower.includes("signing bonus") ||
        textLower.includes("employment offer") ||
        textLower.includes("offer")

      // ===== TIGHTENED GATING LOGIC =====
      // Must have: score >= MIN_SCORE AND at least one strong hit (w >= 7)
      // If negative score is high, require even stronger recruiting signals
      const hasStrongHit = strongestHitWeight >= MIN_STRONG_HIT_WEIGHT
      const netScore = score - (negativeScore * 0.5) // Negative signals reduce effective score

      let accepted = false
      if (negativeScore >= MAX_NEGATIVE_SCORE) {
        // High negative signal: require very strong recruiting evidence
        accepted = score >= 20 && hasStrongHit && netScore >= 10
      } else {
        // Normal case: require both score threshold AND strong hit
        accepted = score >= MIN_SCORE && hasStrongHit && netScore >= 8
      }

      if (!accepted) {
        rejectedByGating++
        continue
      }

      // ===== LLM CLASSIFICATION (can reject) =====
      const stageGuess = await estimateStageFromLLM({
        subject,
        snippet,
        fromEmail,
        userEmail,
        scheduleStrong,
        offerStrong,
        score,
        hits,
        negativeScore,
        negativeHits,
        bodyExcerpt,
      })
      llmCalls++

      if (!stageGuess) continue

      // LLM rejected as non-recruiting
      if (!stageGuess.is_recruiting || stageGuess.stage_bucket === "NOT_RECRUITING") {
        rejectedByLLM++
        continue
      }

      acceptedCount++

      const proposed = stageGuess.stage_bucket
      const cappedStage = capInterviewIfNoSchedulingEvidence(proposed, scheduleStrong)

      const company = (stageGuess.company || "").trim() || "Unknown"
      const role = (stageGuess.role || "").trim() || "Unknown"
      const stageDetail = (stageGuess.stage_detail || "").trim() || defaultStageDetail(cappedStage)

      const companyN = normalize(company)
      const roleN = normalize(role)

      let match = pipelines.find((p: any) => normalize(p.company) === companyN && normalize(p.role) === roleN)
      const isNewPipeline = !match

      const prepPack = await generateInsightsAndPrep({
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
      prepGenerated++

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
          match.stage = stageBucketToUiStage(nextStage)
          match.stage_detail = stageDetail
          match.last_email_subject = subject
          match.last_email_at = receivedAt
          match.last_email_from = fromEmail || fromHeader
          match.last_email_snippet = snippet
          match.insights_json = insights_json
          match.prep_json = prep_json
          updated++
        }
      }

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
      q,
      scanned,
      rejectedByGating,
      rejectedByLLM,
      acceptedCount,
      llmCalls,
      inserted,
      updated,
      emailsInserted,
      prepGenerated,
    })
  } catch (err: any) {
    return NextResponse.json({ error: "EXCEPTION", message: err?.message || String(err) }, { status: 500 })
  }
}

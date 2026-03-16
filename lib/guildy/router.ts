// ============================================================
// Guildy Gmail Detection V3 — Hard Junk Sieve + Warm Lead Router
// Router uses subject + snippet ONLY — never body text.
// ============================================================

import type { RouterDecision } from "./types"
import { normalize, containsWholePhrase } from "./normalizers"

// ============================================================
// BLOCKED SENDERS
// ============================================================
const BLOCKED_SENDERS = ["mailer-daemon", "postmaster@"]

export function isBlockedSender(from: string): boolean {
  const f = (from || "").toLowerCase()
  return BLOCKED_SENDERS.some((p) => f.includes(p))
}

// ============================================================
// HARD JUNK SIEVE
// Subject + snippet only — never body (footers cause false rejects)
// ============================================================
const HARD_JUNK_PHRASES = [
  // Shipping / orders
  "your order has shipped",
  "tracking number",
  "out for delivery",
  "order confirmation",
  "shipping confirmation",
  // Payments
  "payment received",
  "payment failed",
  "your receipt",
  // Auth / security
  "verification code",
  "verify your email address",
  "reset your password",
  "suspicious sign-in",
  // School-specific (not job) interviews
  "school admission",
  "school application",
  "student enrollment",
  "parent interview",
  "school interview",
  "tuition payment",
  "school newsletter",
]

export function isHardJunk(subject: string, snippet: string): boolean {
  const hay = normalize(`${subject} ${snippet}`)
  return HARD_JUNK_PHRASES.some((p) => hay.includes(p))
}

// ============================================================
// ATS DOMAINS — always route to LLM
// ============================================================
const ATS_DOMAINS = [
  "greenhouse.io",
  "greenhouse-mail.io",
  "lever.co",
  "ashbyhq.com",
  "myworkdayjobs.com",
  "workday.com",
  "goodtime.io",
  "hirevue.com",
  "icims.com",
  "smartrecruiters.com",
  "jobvite.com",
  "taleo.net",
  "successfactors.com",
  "brassring.com",
  "bamboohr.com",
  "rippling.com",
  "gem.com",
  "eightfold.ai",
  "pinpoint.com",
  "recruitingbypaychex.com",
]

// ============================================================
// ROUTER DECISION
// Uses subject + snippet only — never body text.
// Threshold ≥ 2 to reduce false positives from generic professional emails.
// ============================================================
export function getRouterDecision(
  signal: Pick<{ subject: string; snippet: string; fromEmail: string }, "subject" | "snippet" | "fromEmail">
): RouterDecision {
  const fromEmail = (signal.fromEmail || "").toLowerCase()
  const subject = normalize(signal.subject || "")
  const text = normalize(`${signal.subject || ""} ${signal.snippet || ""}`)

  // 1. ATS domain → hard route (no score needed)
  const isATS = ATS_DOMAINS.some((d) => fromEmail.includes(d))
  if (isATS) {
    return { routeToLLM: true, reason: "ats_domain", score: 10, isATS: true, isJobishSubject: false }
  }

  // 2. High-signal subject → hard route
  const HARD_ROUTE_SUBJECT = [
    "interview",
    "application received",
    "application confirmation",
    "next steps",
    "phone screen",
    "hiring manager",
    "onsite",
    "final round",
    "offer letter",
    "take home",
    "technical assessment",
    "coding challenge",
    "rejection",
    "not moving forward",
    "we have decided",
    "unfortunately",
  ]
  const isJobishSubject = HARD_ROUTE_SUBJECT.some((p) => containsWholePhrase(subject, p))
  if (isJobishSubject) {
    return { routeToLLM: true, reason: "jobish_subject", score: 10, isATS: false, isJobishSubject: true }
  }

  // 3. Weighted soft scoring — subject + snippet ONLY
  // NOTE: Permanently removed generic phrases that fire on all professional email:
  //   role, position, opportunity, job, schedule, availability, reaching out,
  //   quick chat, brief chat, your profile, your background, your experience,
  //   came across, come across, cv, resume
  const WEIGHTED_PHRASES: [string, number][] = [
    // +2: unambiguous recruiting signals
    ["interview", 2],
    ["phone screen", 2],
    ["onsite", 2],
    ["final round", 2],
    ["offer", 2],
    ["rejection", 2],
    ["technical assessment", 2],
    ["take home", 2],
    ["hiring manager", 2],
    ["coding challenge", 2],

    // +1: strong but need corroboration
    ["recruiter", 1],
    ["recruiting", 1],
    ["talent acquisition", 1],
    ["application", 1],
    ["candidate", 1],
    ["calendly", 1],
    ["goodtime", 1],
    ["greenhouse", 1],
    ["lever", 1],
    ["ashby", 1],
    ["workday", 1],
    ["hirevue", 1],
    ["icims", 1],
    ["smartrecruiters", 1],
    ["screening call", 1],
    ["moving forward", 1],
    ["offer letter", 1],
    ["not moving forward", 1],
  ]

  let score = 0
  for (const [phrase, weight] of WEIGHTED_PHRASES) {
    if (containsWholePhrase(text, phrase)) score += weight
  }

  const routeToLLM = score >= 2
  return {
    routeToLLM,
    reason: routeToLLM ? "warm_lead_score" : "no_signal",
    score,
    isATS: false,
    isJobishSubject: false,
  }
}

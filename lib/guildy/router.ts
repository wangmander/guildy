// ============================================================
// Guildy Gmail Detection V2 — Hard Junk Sieve + Warm Lead Router
// ============================================================

import type { EmailSignal, RouterDecision } from "./types"
import { normalize, containsWholePhrase } from "./normalizers"

// ============================================================
// HARD JUNK SIEVE
// Rules:
//  - Only checks subject + snippet + sender (never body — footers cause false rejects)
//  - Minimal list: only unambiguously non-recruiting
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
  // Auth / security — never recruiting
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

const BLOCKED_SENDERS = ["mailer-daemon", "postmaster@"]

export function isHardJunk(signal: EmailSignal): boolean {
  const from = (signal.from || "").toLowerCase()
  const subject = (signal.subject || "").toLowerCase()
  const snippet = (signal.snippet || "").toLowerCase()
  const hay = `${subject} ${snippet}`

  if (BLOCKED_SENDERS.some((p) => from.includes(p))) return true
  return HARD_JUNK_PHRASES.some((p) => hay.includes(p))
}

// ============================================================
// ATS DOMAIN CHECK
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

export function isATSDomain(fromEmail: string): boolean {
  const from = (fromEmail || "").toLowerCase()
  return ATS_DOMAINS.some((d) => from.includes(d))
}

// ============================================================
// JOBISH SUBJECT CHECK
// ============================================================
const JOBISH_SUBJECT_PATTERNS = [
  "interview",
  "application",
  "candidate",
  "recruiter",
  "hiring",
  "next steps",
  "phone screen",
  "onsite",
  "offer",
  "position",
  "role",
]

export function looksJobishSubject(subject: string): boolean {
  const s = normalize(subject || "")
  return JOBISH_SUBJECT_PATTERNS.some((p) => s.includes(normalize(p)))
}

// ============================================================
// WARM LEAD SCORE
// Low bar intentional — router only gates LLM, not final decision
// ============================================================
const WARM_LEAD_PHRASES = [
  "interview",
  "recruiter",
  "recruiting",
  "hiring manager",
  "talent acquisition",
  "application",
  "candidate",
  "phone screen",
  "screening call",
  "onsite",
  "final round",
  "next steps",
  "schedule",
  "availability",
  "calendly",
  "goodtime",
  "greenhouse",
  "lever",
  "ashby",
  "workday",
  "hirevue",
  "icims",
  "smartrecruiters",
  "role",
  "position",
  "opportunity",
  "job",
  "resume",
  "cv",
  "your profile",
  "your background",
  "your experience",
  "came across",
  "come across",
  "reaching out",
  "quick chat",
  "brief chat",
  "offer letter",
  "take home",
  "coding challenge",
  "technical assessment",
  "rejection",
  "unfortunately",
  "not moving forward",
  "moving forward",
]

export function calculateWarmLeadScore(text: string): number {
  let score = 0
  for (const p of WARM_LEAD_PHRASES) {
    if (containsWholePhrase(text, p)) score++
  }
  return score
}

// ============================================================
// ROUTER DECISION
// Broad net: prefer LLM calls over missed recruiting emails
// ============================================================
export function getRouterDecision(signal: EmailSignal): RouterDecision {
  const text = normalize(`${signal.subject}\n${signal.snippet}\n${signal.bodyText}`)
  const isATS = isATSDomain(signal.fromEmail)
  const isJobishSubject = looksJobishSubject(signal.subject || "")
  const score = calculateWarmLeadScore(text)

  // Route if ANY signal fires — intentionally broad
  const routeToLLM = isATS || isJobishSubject || score >= 1

  const reason: RouterDecision["reason"] = isATS
    ? "ats_domain"
    : isJobishSubject
    ? "jobish_subject"
    : score >= 1
    ? "warm_lead_score"
    : "no_signal"

  return { routeToLLM, reason, score, isATS, isJobishSubject }
}

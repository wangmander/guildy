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
  "support ticket", "ticket number", "customer support", "customer service",
  "billing", "billing update", "billing statement", "upgrade your", "upgrade now",
  "your order", "order status", "order confirmation", "order shipped",
  "special offer", "exclusive offer", "limited offer", "offer expires",
  "unsubscribe", "email preferences", "manage preferences", "opt out", "opt-out",
  "tracking number", "track your order", "shipment notification", "shipping confirmation",
  "your receipt", "payment receipt", "purchase confirmation", "your invoice",
  "% off", "percent off", "discount code", "promo code", "coupon code",
  "shop now", "buy now", "sale ends", "free shipping", "clearance",
  "verification code", "verify your email", "confirm your email", "security code",
  "password reset", "reset your password", "new sign-in", "login attempt",
  "your statement", "account statement", "bank statement", "your bill",
  "payment due", "apy", "cashback", "reward points",
  "now streaming", "new episode", "watch now",
  "friend request", "tagged you", "new follower",
  "food delivery", "flight confirmation", "hotel reservation",
  "refund processed", "return label", "subscription", "renew your", "trial ending",
  "newsletter", "weekly digest", "daily digest",
  "supabase", "vercel", "github", "notion", "slack", "figma", "linear", "stripe",
]

const BLOCKED_SENDER_PATTERNS: string[] = [
  "noreply@", "no-reply@", "notifications@", "updates@", "marketing@",
  "promo@", "newsletter@", "info@", "support@", "help@", "billing@",
  "orders@", "shipping@", "alerts@", "donotreply@", "automated@",
  "sendgrid.", "mailchimp.", "mailgun.",
]

// ============================================================
// POSITIVE PHRASES FOR INITIAL RECRUITING DETECTION
// ============================================================
const PHRASE_WEIGHTS: Array<{ phrase: string; w: number }> = [
  { phrase: "interview", w: 10 },
  { phrase: "application", w: 8 },
  { phrase: "applying", w: 8 },
  { phrase: "applied", w: 8 },
  { phrase: "candidate", w: 8 },
  { phrase: "candidacy", w: 9 },
  { phrase: "recruiter", w: 9 },
  { phrase: "recruiting", w: 9 },
  { phrase: "talent acquisition", w: 9 },
  { phrase: "hiring", w: 8 },
  { phrase: "job opportunity", w: 9 },
  { phrase: "career opportunity", w: 9 },
  { phrase: "open role", w: 9 },
  { phrase: "open position", w: 9 },
  { phrase: "phone screen", w: 10 },
  { phrase: "screening call", w: 10 },
  { phrase: "schedule time", w: 7 },
  { phrase: "select slots", w: 8 },
  { phrase: "calendly", w: 7 },
  { phrase: "goodtime", w: 8 },
  { phrase: "greenhouse", w: 8 },
  { phrase: "lever", w: 7 },
  { phrase: "ashby", w: 8 },
  { phrase: "workday", w: 7 },
  { phrase: "icims", w: 8 },
  { phrase: "offer letter", w: 10 },
  { phrase: "compensation", w: 8 },
  { phrase: "salary", w: 7 },
  { phrase: "background check", w: 9 },
  { phrase: "reference check", w: 9 },
  { phrase: "not moving forward", w: 10 },
  { phrase: "other candidates", w: 9 },
  { phrase: "unfortunately", w: 6 },
  { phrase: "regret to inform", w: 10 },
]

type StageBucket = "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED"

const MIN_SCORE = 10
const MIN_STRONG_HIT_WEIGHT = 6

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
  const htmlLower = html.toLowerCase()
  const imgTags = htmlLower.match(/<img[^>]*>/g) || []
  if (imgTags.length > 3) return true
  for (const img of imgTags) {
    const widthMatch = img.match(/width\s*[=:]\s*["']?(\d+)/)
    if (widthMatch && parseInt(widthMatch[1]) > 400) return true
    const heightMatch = img.match(/height\s*[=:]\s*["']?(\d+)/)
    if (heightMatch && parseInt(heightMatch[1]) > 200) return true
  }
  return false
}

function scoreEmailText(textLower: string) {
  const hay = normalizeForMatch(textLower)
  let score = 0
  let strongestHitWeight = 0

  for (const item of PHRASE_WEIGHTS) {
    const needle = " " + normalize(item.phrase) + " "
    if (hay.includes(needle)) {
      score += item.w
      if (item.w > strongestHitWeight) strongestHitWeight = item.w
    }
  }

  return { score, strongestHitWeight }
}

function stageBucketToUiStage(bucket: StageBucket): string {
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
// COMPREHENSIVE STAGE DETECTION REFERENCE
// This is the authoritative guide for the LLM
// ============================================================
const STAGE_DETECTION_GUIDE = `
## COMPREHENSIVE STAGE DETECTION GUIDE

You MUST accurately classify the interview stage. Use this exhaustive reference:

### STAGE 1: RECRUITER_SCREEN
Initial contact, application acknowledgment, or scheduling first conversation.

**Signals - Application Received:**
- "received your application", "application has been received"
- "thank you for applying", "thanks for applying"
- "application for [role]", "submitted your application"
- "we have received your resume", "your resume has been forwarded"
- "application is being reviewed", "reviewing your materials"
- "we'll be in touch", "someone will reach out"

**Signals - Recruiter Outreach:**
- "reaching out on behalf of", "reaching out about"
- "saw your profile", "came across your profile"
- "interested in your background", "impressed by your experience"
- "thought you'd be a great fit", "you'd be perfect for"
- "love to chat", "love to connect", "would love to speak"
- "quick call", "brief conversation", "informal chat"
- "learn more about your experience", "hear about your background"

**Signals - Scheduling Initial Call:**
- "schedule a call", "schedule time to chat", "schedule a conversation"
- "select a few slots", "pick a time", "choose a time"
- "calendly", "goodtime", "calendar link"
- "30 minute call", "15 minute chat", "quick 20 minutes"
- "phone screen", "screening call", "intro call", "introductory call"
- "initial conversation", "first call", "preliminary call"
- "recruiter call", "talent call", "TA call"
- "get to know you", "learn more about you"

**Signals - Recruiter Screen Completed:**
- "great speaking with you", "enjoyed our conversation"
- "following up from our call", "as discussed"
- "next steps in the process", "moving you forward"

### STAGE 2: HM_SCREEN
Hiring manager or team lead interview (the person you'd report to).

**Signals - HM Interview Scheduling:**
- "hiring manager", "your future manager", "the manager"
- "team lead", "team leader", "engineering lead", "design lead"
- "director", "senior director", "VP", "vice president"
- "department head", "head of [department]"
- "manager interview", "leadership interview"
- "[Name], who leads the team", "[Name], who manages"
- "meet with the team lead", "speak with the hiring manager"
- "interview with [manager title]"

**Signals - By Job Type:**
- Engineering: "engineering manager", "tech lead", "principal engineer"
- Design: "design manager", "head of design", "design director"
- Product: "product lead", "head of product", "CPO", "product director"
- Sales: "sales manager", "sales director", "VP sales", "head of sales"
- Marketing: "marketing manager", "CMO", "head of marketing"
- Finance: "finance manager", "controller", "CFO", "FP&A manager"
- Operations: "operations manager", "COO", "head of ops"
- HR: "HR manager", "people manager", "head of people"
- Legal: "general counsel", "legal director", "CLO"

**Signals - HM Screen Completed:**
- "the team was impressed", "manager enjoyed speaking with you"
- "positive feedback from [manager name]"
- "move to the next round", "proceed to technical"

### STAGE 3: ASSESSMENT
Take-home assignments, coding challenges, case studies, or skills tests.

**Signals - Coding/Technical Assessments:**
- "coding challenge", "coding test", "coding assessment"
- "technical assessment", "technical test", "skills assessment"
- "HackerRank", "LeetCode", "CodeSignal", "Codility", "CoderPad"
- "HireVue", "Karat", "TripleByte", "Qualified.io"
- "online assessment", "OA", "timed assessment"
- "algorithm questions", "data structures", "system design exercise"
- "complete the following problems", "solve these challenges"
- "48 hours to complete", "due in 3 days", "one week deadline"

**Signals - Take-Home Projects:**
- "take-home", "take home", "homework assignment"
- "project assignment", "design project", "coding project"
- "sample project", "test project", "mini project"
- "build a [feature/app]", "create a [component]"
- "we'd like you to build", "please complete this exercise"
- "return the completed assignment", "submit your work"

**Signals - Case Studies (Consulting/PM/Strategy):**
- "case study", "case interview prep", "case exercise"
- "business case", "strategy case", "market sizing"
- "consulting case", "McKinsey case", "BCG case", "Bain case"
- "product case", "estimation question", "framework"
- "prepare a presentation on", "present your analysis"

**Signals - Design Exercises:**
- "design exercise", "design challenge", "whiteboard design"
- "portfolio review", "show us your work", "walk through your portfolio"
- "design critique", "design presentation"
- "UX exercise", "UI challenge", "product design test"
- "Figma exercise", "design in Figma"

**Signals - Finance/Analytical:**
- "modeling test", "financial model", "Excel test"
- "stock pitch", "investment memo", "valuation exercise"
- "LBO model", "DCF model", "three-statement model"
- "analytical exercise", "data analysis test"
- "SQL test", "Excel assessment"

**Signals - Sales/BD:**
- "sales presentation", "pitch deck", "demo presentation"
- "role play", "mock call", "cold call exercise"
- "prospecting exercise", "outreach exercise"

**Signals - Writing/Content:**
- "writing sample", "writing test", "content exercise"
- "edit this document", "write a [blog post/article]"
- "copywriting test", "content strategy exercise"

### STAGE 4: LOOP
Final rounds - onsite, virtual onsite, panel interviews, or multiple back-to-back interviews.

**Signals - Onsite/Virtual Onsite:**
- "onsite", "on-site", "virtual onsite", "virtual on-site"
- "office visit", "come to the office", "visit our headquarters"
- "full day of interviews", "day of interviews"
- "interview day", "final day", "super day"
- "fly you out", "travel to [city]", "visit our [location] office"

**Signals - Interview Loop:**
- "interview loop", "full loop", "final loop"
- "panel interview", "panel discussion"
- "meet the team", "team interviews", "cross-functional interviews"
- "series of interviews", "multiple interviews", "several conversations"
- "back-to-back interviews", "consecutive interviews"
- "4-5 interviews", "5-6 rounds", "full interview slate"

**Signals - Final Round:**
- "final round", "final interview", "last round"
- "final stage", "last step before offer"
- "concluding interviews", "wrap-up interviews"

**Signals - Executive/Leadership:**
- "meet with leadership", "executive interview"
- "CEO interview", "founder interview", "C-suite"
- "partner interview" (consulting/law/VC)
- "managing director", "senior partner"
- "board member", "investor meeting"

**Signals - By Industry:**
- Tech: "system design interview", "behavioral loop", "culture fit"
- Finance: "superday", "Super Day", "final rounds in [city]"
- Consulting: "partner interview", "case day", "final case"
- Law: "callback", "call-back interview", "summer associate interview"
- Academia: "job talk", "campus visit", "faculty interview"

**Signals - Specialized Rounds:**
- "culture fit", "values interview", "team fit"
- "bar raiser" (Amazon), "cross-functional interview"
- "presentation to the team", "present your work"
- "lunch interview", "coffee chat with team"
- "reverse interview", "ask us anything"

### STAGE 5: OFFER
Offer extended, compensation discussion, or negotiation.

**Signals - Offer Extended:**
- "offer letter", "formal offer", "written offer"
- "extend an offer", "pleased to offer", "excited to offer"
- "offering you the position", "offering you the role"
- "you got the job", "welcome to the team"
- "congratulations", "we'd like to bring you on"
- "pending offer", "verbal offer"

**Signals - Compensation Discussion:**
- "compensation package", "total compensation", "comp package"
- "base salary", "salary offer", "annual salary"
- "equity", "stock options", "RSUs", "stock grant"
- "signing bonus", "sign-on bonus", "relocation bonus"
- "benefits package", "health insurance", "401k"
- "PTO", "vacation policy", "time off"
- "discuss compensation", "talk through the offer"

**Signals - Negotiation:**
- "negotiate", "negotiation", "counter offer"
- "flexibility on", "room to move on"
- "let us know your thoughts", "open to discussion"
- "what would it take", "what are you looking for"
- "competing offer", "other offers"

**Signals - Pre-Start:**
- "background check", "background verification"
- "reference check", "provide references"
- "start date", "when can you start", "proposed start"
- "onboarding", "first day", "orientation"
- "paperwork", "employment agreement", "I-9", "W-4"
- "drug test", "pre-employment screening"

### STAGE 6: REJECTED
Application rejected or process ended.

**Signals - Direct Rejection:**
- "not moving forward", "won't be moving forward"
- "decided not to proceed", "unable to proceed"
- "not selected", "not been selected"
- "gone with other candidates", "pursuing other candidates"
- "position has been filled", "role has been filled"
- "no longer considering", "removed from consideration"

**Signals - Soft Rejection:**
- "unfortunately", "regret to inform", "sorry to say"
- "competitive applicant pool", "many qualified candidates"
- "difficult decision", "tough decision"
- "not the right fit at this time", "not a match"
- "keep your resume on file", "reach out in the future"
- "encourage you to apply again", "other opportunities"

**Signals - Process Ended:**
- "position has been put on hold", "role is on hold"
- "hiring freeze", "no longer hiring"
- "team restructuring", "org changes"
- "budget constraints", "headcount frozen"

## STAGE PROGRESSION RULES:
1. Stages progress forward: RECRUITER_SCREEN → HM_SCREEN → ASSESSMENT → LOOP → OFFER
2. REJECTED can happen at any stage
3. Some companies skip stages (e.g., no assessment, straight to loop)
4. Look for the MOST ADVANCED stage mentioned
5. If scheduling an interview with hiring manager, it's HM_SCREEN (not RECRUITER_SCREEN)
6. If multiple interviews mentioned in one day, it's likely LOOP
7. Take-home/assessment can come before or after HM_SCREEN depending on company
`

// ============================================================
// SINGLE LLM CALL: Classify, Stage, and Generate Prep
// ============================================================
async function analyzeEmailAndGeneratePrep(input: {
  subject: string
  snippet: string
  fromEmail: string
  bodyExcerpt: string
  existingEmails?: Array<{ subject: string; snippet: string; from: string; date: string }>
}): Promise<{
  is_recruiting: boolean
  company: string
  role: string
  stage_bucket: StageBucket
  stage_detail: string
  insights: {
    stage_reason: string
    waiting_on: "you" | "them"
    next_action: string
    urgency: "low" | "med" | "high"
    response_likelihood: "low" | "med" | "high"
    tone: "friendly" | "formal" | "neutral" | "urgent"
  }
  prep: {
    prep_focus: string
    questions_they_might_ask_you: string[]
    questions_you_should_ask_them: string[]
    what_to_emphasize: string[]
    stories_to_prepare: string[]
    homework_next_24h: string[]
    company_intel: {
      industry: string
      size: string
      hq_location: string
      glassdoor_rating: string
      summary: string
      recent_news: string[]
    }
  }
} | null> {

  // Build thread context
  let threadContext = ""
  if (input.existingEmails && input.existingEmails.length > 0) {
    threadContext = `\n\n=== PREVIOUS EMAILS IN THREAD (oldest first) ===\n`
    for (const e of input.existingEmails) {
      threadContext += `---\nDate: ${e.date}\nFrom: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}\n`
    }
    threadContext += `---\n\n=== NEWEST EMAIL (classify based on this + history) ===\n`
  }

  const systemPrompt = `You are Guildy, an expert interview pipeline analyzer.

${STAGE_DETECTION_GUIDE}

## YOUR TASK:
1. Determine if this is a recruiting email (NOT marketing, support, or transactional)
2. Extract company name and job title
3. Determine the EXACT stage using the comprehensive guide above
4. Generate specific, actionable prep content

## PREP GENERATION RULES:
- Questions must be SPECIFIC to the company, role, and industry
- For tech roles: include technical questions relevant to the stack/domain
- For business roles: include strategy, metrics, stakeholder questions
- For creative roles: include portfolio, process, collaboration questions
- Stories should be STAR format topics relevant to the role
- Homework should be concrete, completable in 24 hours

Output ONLY valid JSON. No markdown, no explanation.`

  const userPrompt = `${threadContext}
From: ${input.fromEmail}
Subject: ${input.subject}
Snippet: ${input.snippet}

Body:
${input.bodyExcerpt.slice(0, 2500)}

Return this EXACT JSON structure with ALL fields populated:
{
  "is_recruiting": true or false,
  "company": "Company Name",
  "role": "Job Title or Unknown",
  "stage_bucket": "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stage_detail": "Specific description like 'Scheduling recruiter phone screen' or 'Technical assessment via HackerRank'",
  "insights": {
    "stage_reason": "Quote specific text from email that indicates this stage",
    "waiting_on": "you" or "them",
    "next_action": "Specific action like 'Select interview slots by Friday' or 'Complete HackerRank within 48 hours'",
    "urgency": "low" | "med" | "high",
    "response_likelihood": "low" | "med" | "high",
    "tone": "friendly" | "formal" | "neutral" | "urgent"
  },
  "prep": {
    "prep_focus": "What to specifically prepare for this stage at this company for this role",
    "questions_they_might_ask_you": [
      "Specific question 1 for this role/company/stage",
      "Specific question 2 for this role/company/stage",
      "Specific question 3 for this role/company/stage",
      "Specific question 4 for this role/company/stage",
      "Specific question 5 for this role/company/stage"
    ],
    "questions_you_should_ask_them": [
      "Smart question about the team/role",
      "Question about company strategy/direction",
      "Question about day-to-day responsibilities",
      "Question about growth/learning opportunities",
      "Question about success metrics for this role"
    ],
    "what_to_emphasize": [
      "Relevant skill/experience 1",
      "Relevant skill/experience 2",
      "Relevant skill/experience 3"
    ],
    "stories_to_prepare": [
      "STAR story: [specific scenario relevant to role]",
      "STAR story: [specific scenario relevant to role]",
      "STAR story: [specific scenario relevant to role]"
    ],
    "homework_next_24h": [
      "Research task specific to company",
      "Prep task specific to interview type",
      "Practice task for likely questions"
    ],
    "company_intel": {
      "industry": "Industry sector",
      "size": "Company size (startup/mid/enterprise) or Unknown",
      "hq_location": "Headquarters or Unknown",
      "glassdoor_rating": "Rating if known or Unknown",
      "summary": "Brief company description based on what you know",
      "recent_news": ["Recent news item if known"]
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

    const txt = res.choices?.[0]?.message?.content || ""
    const parsed = safeJsonParse<any>(txt)
    
    // Validate and ensure all fields exist
    if (parsed && parsed.is_recruiting) {
      // Ensure insights exists with all fields
      if (!parsed.insights) {
        parsed.insights = {}
      }
      parsed.insights = {
        stage_reason: parsed.insights.stage_reason || "Initial contact detected",
        waiting_on: parsed.insights.waiting_on || "you",
        next_action: parsed.insights.next_action || "Review email and respond",
        urgency: parsed.insights.urgency || "med",
        response_likelihood: parsed.insights.response_likelihood || "med",
        tone: parsed.insights.tone || "neutral",
      }
      
      // Ensure prep exists with all fields
      if (!parsed.prep) {
        parsed.prep = {}
      }
      parsed.prep = {
        prep_focus: parsed.prep.prep_focus || `Prepare for ${parsed.stage_bucket} at ${parsed.company}`,
        questions_they_might_ask_you: parsed.prep.questions_they_might_ask_you?.length ? parsed.prep.questions_they_might_ask_you : [
          "Tell me about yourself",
          "Why are you interested in this role?",
          "What relevant experience do you have?",
          "What are your strengths?",
          "Where do you see yourself in 5 years?"
        ],
        questions_you_should_ask_them: parsed.prep.questions_you_should_ask_them?.length ? parsed.prep.questions_you_should_ask_them : [
          "What does success look like in this role?",
          "How is the team structured?",
          "What are the biggest challenges?",
          "What's the company culture like?",
          "What are the next steps?"
        ],
        what_to_emphasize: parsed.prep.what_to_emphasize?.length ? parsed.prep.what_to_emphasize : [
          "Relevant experience",
          "Problem-solving skills",
          "Communication abilities"
        ],
        stories_to_prepare: parsed.prep.stories_to_prepare?.length ? parsed.prep.stories_to_prepare : [
          "A time you solved a difficult problem",
          "A time you worked with a team",
          "A time you showed leadership"
        ],
        homework_next_24h: parsed.prep.homework_next_24h?.length ? parsed.prep.homework_next_24h : [
          `Research ${parsed.company}`,
          "Review the job description",
          "Prepare your intro pitch"
        ],
        company_intel: parsed.prep.company_intel || {
          industry: "Unknown",
          size: "Unknown",
          hq_location: "Unknown",
          glassdoor_rating: "Unknown",
          summary: "Research needed",
          recent_news: []
        }
      }
    }
    
    return parsed
  } catch (err) {
    console.error("LLM error:", err)
    return null
  }
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

    const MAX_MESSAGES = 300
    const PAGE_SIZE = 100
    const LOOKBACK_DAYS = 21

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
      ? Math.floor((safeLastMs - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000)
      : null

    const qBase = afterUnix && afterUnix <= nowUnix ? `after:${afterUnix}` : "newer_than:5y"
    const q = `${qBase} -in:trash -in:chats`

    let pageToken: string | undefined = undefined
    const messages: Array<{ id?: string | null }> = []

    do {
      const page = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: PAGE_SIZE,
        pageToken,
      })

      const pageMsgs = page.data.messages ?? []
      for (const msg of pageMsgs) {
        messages.push(msg)
        if (messages.length >= MAX_MESSAGES) break
      }

      pageToken = page.data.nextPageToken ?? undefined
    } while (pageToken && messages.length < MAX_MESSAGES)

    let scanned = messages.length
    let skipped = 0
    let rejected = 0
    let accepted = 0
    let inserted = 0
    let updated = 0

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
        skipped++
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
        : dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()

      const payload = full.data.payload
      const { text: bodyTextPlain, html: bodyHtml } = extractBodyFromPayload(payload)
      const bodyText = bodyTextPlain || (bodyHtml ? stripHtml(bodyHtml) : "")
      const bodyExcerpt = bodyText.slice(0, 3000)

      const fullText = `${subject}\n${snippet}\n${fromHeader}\n${bodyText}`
      const textLower = fullText.toLowerCase()

      // Gate 1: Instant reject
      if (shouldInstantReject(textLower, fromEmail)) {
        rejected++
        continue
      }

      // Gate 2: Banner images
      if (hasBannerImages(bodyHtml)) {
        rejected++
        continue
      }

      // Gate 3: Score threshold
      const { score, strongestHitWeight } = scoreEmailText(textLower)
      if (score < MIN_SCORE || strongestHitWeight < MIN_STRONG_HIT_WEIGHT) {
        rejected++
        continue
      }

      // Check for existing pipeline (fuzzy match on domain)
      const fromDomain = fromEmail.split("@")[1]?.split(".")[0] || ""
      let existingPipeline = pipelines.find((p: any) => {
        const pCompany = normalize(p.company)
        const emailDomain = normalize(fromDomain)
        return pCompany.includes(emailDomain) || emailDomain.includes(pCompany)
      })

      // Get existing emails for context
      let existingEmails: Array<{ subject: string; snippet: string; from: string; date: string }> = []
      if (existingPipeline) {
        const { data: pipelineEmails } = await supabase
          .from("emails")
          .select("subject, snippet, from_email, received_at")
          .eq("pipeline_id", existingPipeline.id)
          .order("received_at", { ascending: true })

        existingEmails = (pipelineEmails || []).map(e => ({
          subject: e.subject || "",
          snippet: e.snippet || "",
          from: e.from_email || "",
          date: e.received_at || "",
        }))
      }

      // LLM Analysis
      const analysis = await analyzeEmailAndGeneratePrep({
        subject,
        snippet,
        fromEmail,
        bodyExcerpt,
        existingEmails: existingEmails.length > 0 ? existingEmails : undefined,
      })

      if (!analysis || !analysis.is_recruiting) {
        rejected++
        continue
      }

      accepted++

      const company = (analysis.company || "").trim() || "Unknown"
      const role = (analysis.role || "").trim() || "Unknown"
      const stageBucket = analysis.stage_bucket || "RECRUITER_SCREEN"
      const stageDetail = analysis.stage_detail || "Initial contact"

      // Re-match pipeline with LLM-identified company
      const companyN = normalize(company)
      const roleN = normalize(role)
      
      let matchedPipeline = pipelines.find((p: any) => 
        normalize(p.company) === companyN && normalize(p.role) === roleN
      )
      
      if (!matchedPipeline) {
        matchedPipeline = pipelines.find((p: any) => {
          const pCompany = normalize(p.company)
          return pCompany.includes(companyN) || companyN.includes(pCompany)
        })
      }

      const isNewPipeline = !matchedPipeline
      let pipelineId: string

      if (isNewPipeline) {
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
            insights_json: analysis.insights,
            prep_json: analysis.prep,
          })
          .select()
          .single()

        if (createErr || !created?.id) {
          console.error("Failed to create pipeline:", createErr)
          continue
        }
        
        pipelineId = created.id
        pipelines.push(created)
        inserted++

      } else {
        pipelineId = matchedPipeline.id

        const { error: updErr } = await supabase
          .from("pipelines")
          .update({
            stage: stageBucketToUiStage(stageBucket),
            stage_detail: stageDetail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail || fromHeader,
            last_email_snippet: snippet,
            insights_json: analysis.insights,
            prep_json: analysis.prep,
          })
          .eq("id", pipelineId)

        if (!updErr) {
          Object.assign(matchedPipeline, {
            stage: stageBucketToUiStage(stageBucket),
            stage_detail: stageDetail,
          })
          updated++
        }
      }

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

    return NextResponse.json({
      success: true,
      stats: { scanned, skipped, rejected, accepted, inserted, updated },
    })
  } catch (err: any) {
    console.error("Sync error:", err)
    return NextResponse.json({ error: "EXCEPTION", message: err?.message || String(err) }, { status: 500 })
  }
}

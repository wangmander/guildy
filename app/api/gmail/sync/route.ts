import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { google } from "googleapis"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import OpenAI from "openai"

// Allow up to 120s on Vercel Pro (default is 10s on Hobby)
export const maxDuration = 120

const openaiKey = process.env.OPENAI_API_KEY

// Service role client from supabaseAdmin (bypasses RLS)
const supabase = supabaseAdmin

const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null

// Max LLM calls per sync to stay within timeout
const MAX_LLM_CALLS_PER_SYNC = 15

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

  // Schools/Education (NOT job interviews)
  "school admission", "school application", "student enrollment",
  "parent interview", "school interview", "school tour",
  "tuition", "school calendar", "school newsletter",
  "christian school", "elementary school", "high school",
  "middle school", "preschool", "kindergarten",

  // Auto-confirmation emails are NOT instant-rejected anymore.
  // The LLM handles this classification — instant reject was killing
  // legitimate recruiter emails that include phrases like
  // "thank you for your interest — we'd like to schedule an interview".
]

const BLOCKED_SENDER_PATTERNS: string[] = [
  // Only block actual mail infrastructure - NOT noreply/sendgrid/mailgun
  // since Greenhouse, Lever, Workday, Ashby, and most ATS send from those
  "mailer-daemon", "postmaster@",
]

// ============================================================
// RECRUITING PHRASE WEIGHTS - Comprehensive
// ============================================================
const PHRASE_WEIGHTS: Array<{ phrase: string; w: number }> = [
  // === DEFINITIVE SIGNALS (10) - Only real recruiter outreach ===
  { phrase: "interview", w: 10 },
  { phrase: "interviews", w: 10 },
  { phrase: "interviewing", w: 10 },
  { phrase: "your candidacy", w: 10 },
  { phrase: "not moving forward", w: 10 },
  { phrase: "regret to inform", w: 10 },
  { phrase: "we are hiring", w: 10 },
  { phrase: "i am hiring", w: 10 },
  { phrase: "im hiring", w: 10 },
  { phrase: "you'd join as", w: 10 },
  { phrase: "you would join as", w: 10 },

  // === STRONG SIGNALS (8-9) ===
  { phrase: "phone screen", w: 9 },
  { phrase: "screening call", w: 9 },
  { phrase: "recruiter", w: 8 },
  { phrase: "recruiting", w: 8 },
  { phrase: "recruiting team", w: 8 },
  { phrase: "talent partner", w: 8 },
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
  { phrase: "new role", w: 8 },
  { phrase: "new position", w: 8 },
  { phrase: "new opportunity", w: 8 },
  { phrase: "job opening", w: 9 },
  { phrase: "open to new opportunities", w: 9 },
  { phrase: "open to work", w: 9 },
  { phrase: "come across your work", w: 8 },
  { phrase: "came across your work", w: 8 },
  { phrase: "came across your profile", w: 8 },
  { phrase: "come across your profile", w: 8 },
  { phrase: "sparks curiosity", w: 8 },
  { phrase: "open to a quick chat", w: 9 },
  { phrase: "grab a time", w: 8 },

  // === MEDIUM SIGNALS (6-7) ===
  { phrase: "schedule a call", w: 8 },
  { phrase: "schedule time", w: 8 },
  { phrase: "schedule an interview", w: 8 },
  { phrase: "set up a call", w: 8 },
  { phrase: "set up time", w: 6 },
  { phrase: "intro call", w: 8 },
  { phrase: "introductory call", w: 7 },
  { phrase: "initial call", w: 8 },
  { phrase: "time to chat", w: 8 },
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
  { phrase: "reaching out", w: 6 },
  { phrase: "love to chat", w: 7 },
  { phrase: "love to connect", w: 7 },
  { phrase: "would love to", w: 6 },
  { phrase: "share more", w: 7 },
  { phrase: "calendly", w: 6 },
  { phrase: "goodtime", w: 6 },
  { phrase: "greenhouse", w: 6 },
  { phrase: "lever", w: 6 },
  { phrase: "ashby", w: 6 },
  { phrase: "workday", w: 6 },
  { phrase: "saw your profile", w: 7 },
  { phrase: "across your profile", w: 7 },
  { phrase: "software engineer", w: 5 },
  { phrase: "product designer", w: 5 },
  { phrase: "foundation model", w: 5 },
  { phrase: "founding engineer", w: 6 },
  { phrase: "staff engineer", w: 5 },

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
  { phrase: "hiring", w: 5 },
  { phrase: "talent", w: 3 },
  { phrase: "application", w: 4 },
  { phrase: "applied", w: 4 },
  { phrase: "applying", w: 4 },
]

const MIN_SCORE = 4  // Lowered from 8 to catch more potential interviews
const MIN_STRONG_HIT = 3  // Lowered from 6 to allow medium signals to trigger detection

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
  // DISABLED: This was blocking too many legitimate recruiter emails
  return false
  // if (!html) return false
  // const imgTags = html.toLowerCase().match(/<img[^>]*>/g) || []
  // if (imgTags.length > 6) return true
  // for (const img of imgTags) {
  //   const w = img.match(/width\s*[=:]\s*["']?(\d+)/)
  //   if (w && parseInt(w[1]) > 600) return true
  // }
  // return false
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

// Stage ordering for regression prevention
const STAGE_ORDER: Record<string, number> = {
  "SCREENING": 0,
  "HIRING_MANAGER": 1,
  "PRESENTATION": 2,
  "FULL_LOOP": 3,
  "OFFER_DISCUSSION": 4,
  "REJECTED": -1,
}

function getUiStage(bucket: string): string {
  const map: Record<string, string> = {
    "RECRUITER_SCREEN": "SCREENING",
    "HM_SCREEN": "HIRING_MANAGER",
    "ASSESSMENT": "PRESENTATION",
    "LOOP": "FULL_LOOP",
    "OFFER": "OFFER_DISCUSSION",
    "REJECTED": "REJECTED",
  }
  return map[bucket] || "SCREENING"
}

// Prevent stage regression: only allow forward movement or "REJECTED"
function resolveStage(newStage: string, existingStage?: string): string {
  if (!existingStage) return newStage
  if (newStage === "REJECTED") return "REJECTED"
  const newOrder = STAGE_ORDER[newStage] ?? 0
  const existingOrder = STAGE_ORDER[existingStage] ?? 0
  return newOrder >= existingOrder ? newStage : existingStage
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

  const systemPrompt = `You are an elite interview research assistant. You provide factual company intelligence, realistic interview questions, and actionable interview strategy. You NEVER fabricate information about the candidate — you don't know who they are. Everything you produce is based on the COMPANY, ROLE, STAGE, and INTERVIEWER.

CRITICAL — is_recruiting RULES:
- Set is_recruiting=TRUE only when a REAL HUMAN (recruiter, hiring manager, interviewer) is reaching out or responding to the candidate.
- Set is_recruiting=FALSE for: auto-confirmation emails ("Thanks for applying", "We received your application", "Application submitted"), marketing blasts, job board notifications (LinkedIn, Indeed, Glassdoor digest emails), and newsletters.
- The test: Did a specific person at a company write or trigger this email because they want to talk to THIS candidate? If no → is_recruiting=false.

CRITICAL — advances_pipeline RULES:
- Set advances_pipeline=TRUE only when this email represents FORWARD MOVEMENT in the interview process.
- Examples of emails that ADVANCE the pipeline:
  * Scheduling an interview, phone screen, or call
  * Moving to the next round ("We'd like to move you forward")
  * Sending a take-home assignment or coding challenge
  * Extending an offer
  * Providing feedback and next steps
  * A recruiter or hiring manager initiating contact for the first time
- Examples that do NOT advance the pipeline (advances_pipeline=FALSE):
  * "We received your application" / "Thanks for applying" (these are auto-confirmations, NOT pipeline advancement)
  * "Your application is being reviewed" (no action, just status)
  * Generic status updates with no concrete next step
  * Automated rejection emails with no feedback
  * Calendar holds or logistics-only emails that don't represent a new stage
- The test: Does this email create a NEW obligation or opportunity for the candidate to act on? Does it move them to a different stage? If no → advances_pipeline=false.

=== SECTION 1: COMPANY DEEP DIVE (companyIntel) ===
Provide FACTUAL information. If you are not confident, say "Unknown".
- summary: 2-3 sentences on what they build, who their customers are, and their market position.
- product: What exactly is their core product? Be specific — not "a tech company" but "a real-time feature platform that lets ML teams compute features from streaming data for model inference."
- businessModel: How do they make money? (SaaS, usage-based, enterprise contracts, marketplace, ads, etc.)
- competitors: 2-4 direct competitors and how this company differentiates.
- techStack: Known technologies they use (from your knowledge of their engineering blog, job posts, etc.). Say "Unknown" if unsure.
- culture: Their culture archetype in one sentence. (e.g., "Engineering-excellence culture with strong written communication norms" or "Move-fast startup energy, founder-led decisions")
- industry, size, hqLocation, recentNews as before.

=== SECTION 2: INTERVIEW STRATEGY (interviewStrategy) ===
Stage-specific tactical advice. Be direct, specific, and actionable.
- goalForThisStage: One sentence on what success looks like at this stage. e.g., "The goal of a recruiter screen is to get to the next round — demonstrate fit and enthusiasm, don't go deep on technical details."
- whatTheyEvaluate: 2-3 bullet points on what this specific stage assesses. e.g., "Communication clarity, motivation for the role, salary alignment."
- howToSucceed: 3-4 specific, actionable tactics. NOT "be yourself" or "show enthusiasm." e.g., "Keep answers under 90 seconds. Lead with the result, then explain how. Ask about the team's biggest challenge this quarter."
- commonMistakes: 3-4 things that get people rejected at this stage. e.g., "Rambling for 3+ minutes on a single answer. Badmouthing a previous employer. Not having questions prepared."
- answerLength: How long answers should be at this stage. e.g., "60-90 seconds for screening, 2-3 minutes for behavioral, 5-10 minutes for technical deep-dives."

=== SECTION 3: INTERVIEWER INTEL (interviewerIntel) ===
Based on the sender's name and email, infer what you can:
- name: The interviewer's name from the email.
- likelyRole: Their probable title/function. e.g., "Technical Recruiter", "Engineering Manager", "VP of Product."
- seniority: junior / mid / senior / executive.
- whatTheyEvaluate: What someone in this role typically probes for. e.g., "A recruiter evaluates culture fit, comp expectations, and communication skills. They're gatekeepers, not technical evaluators."
- topicsTheyProbe: 3-5 specific topics this person will likely focus on based on their role.
- howToCalibrateAnswers: How to adjust your communication style for this person's level. e.g., "Speak in business outcomes, not technical implementation details — this person cares about impact, not architecture."

=== SECTION 4: STAGE ROADMAP (stageRoadmap) ===
An array of stages showing the likely interview pipeline:
- Each entry: { "stage": "Stage Name", "status": "completed" | "current" | "upcoming", "whatItTests": "One sentence on what this stage evaluates" }
- Mark the current stage based on the email evidence.
- Generate 4-6 stages typical for this role at this type of company.

=== SECTION 5: COMPENSATION INTEL (compensationIntel) ===
Based on the company's size, stage, location, and role:
- salaryRange: Estimated total comp range. e.g., "$150K-$200K base + equity" or "Unknown for this company."
- equityInfo: What type of equity is typical at their stage. e.g., "Series B startup — likely ISO stock options with 4-year vest, 1-year cliff."
- negotiationTips: 2-3 specific tips for negotiating with this type of company. e.g., "At this stage, equity is negotiable but base salary ranges are tighter. Ask about refresh grants."
- whenToDiscuss: When in the process to bring up comp. e.g., "Let the recruiter bring it up first in the screen. If they ask your expectations, give a range based on total comp, not just base."
NOTE: Only populate this in detail for OFFER stage. For earlier stages, provide brief estimates and say "Focus on this after you have an offer in hand."

=== SECTION 6: 24-HOUR PREP CHECKLIST (prepChecklist) ===
5-8 specific, actionable things to do before the interview. These must be CONCRETE tasks, not vague advice.
Good examples:
- "Look up [interviewer name] on LinkedIn — note their career path and recent posts"
- "Try [company]'s product for 10 minutes — note one thing you'd improve"
- "Read their most recent blog post or press release"
- "Prepare 2 specific examples of [relevant skill for this role]"
- "Review their pricing page to understand their market positioning"
- "Google '[company name] interview questions' on Glassdoor for real examples"
- "Prepare a 60-second answer to 'Why [company]?' that references something specific"
Bad examples (DO NOT use):
- "Research the company" (too vague)
- "Practice your answers" (not specific)
- "Get a good night's sleep" (not interview prep)

=== QUESTIONS (the core value — go deep here) ===
IMPORTANT: Weight the number of questions PER CATEGORY by how important that category is for this specific role, seniority, and interviewer. The most critical categories get 5-7 questions, moderately important categories get 3-4, and minor categories get 2-3. Total should be 20-35 questions across all categories. The higher the stage/seniority, the MORE questions you should generate.

For each question, also include a "priority" field (1=highest, 3=lowest) indicating how likely this question is to be asked at this specific stage by this specific interviewer. Priority 1 = almost certainly asked, Priority 2 = commonly asked, Priority 3 = sometimes asked.

- questions_they_ask: Generate questions grouped into 4-8 categories. Categories must be tailored to the role, seniority, and interviewer.
  Examples by role:
  - Senior Engineer + HM interview: "System Design" (5 questions), "Leadership & Influence" (4), "Technical Deep-Dive" (3), "Culture & Collaboration" (2), "Role-Specific" (2)
  - Junior PM + Recruiter screen: "Product Sense" (3), "Motivation & Fit" (4), "Analytical Thinking" (2), "Communication" (2)
  - Staff Designer + VP interview: "Design Leadership" (5), "Strategic Thinking" (4), "Cross-functional Impact" (3), "Portfolio Deep-Dive" (3)
  The heaviest categories should reflect what THIS interviewer at THIS stage will actually spend the most time on. Include the HARD questions — the ones that trip people up, not softballs.

- questions_you_ask: Generate questions grouped into 4-8 categories, also weighted by importance. More questions in categories that will make the biggest impression on THIS interviewer.
  Examples: "About the Team" (4-5), "Technical Direction" (4-5), "Growth & Impact" (3-4), "Company Strategy" (2-3), "Role Expectations" (2-3).
  These must signal seniority and genuine curiosity. NOT "What's a typical day like?" — instead "What's the biggest technical bet your team is making right now and what would it look like if it fails?"

=== KEY TOPICS (primitives) ===
4+ topics in plain language with WHY they matter to this company.

OUTPUT (JSON ONLY, no markdown wrapping):
{
  "is_recruiting": boolean,
  "advances_pipeline": boolean,
  "company": "string",
  "role": "string",
  "stage_bucket": "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stage_detail": "string describing the specific stage",
  "predicted_stages": ["Stage 1", "Stage 2", "..."],
  "action_needed": "string | null",
  "insights": {
    "stageReason": "Why this is the current stage",
    "waitingOn": "you" | "them",
    "nextAction": "Specific next step",
    "urgency": "low" | "med" | "high",
    "responseLikelihood": "low" | "med" | "high",
    "tone": "friendly" | "formal" | "neutral" | "urgent"
  },
  "prep": {
    "stageFocus": "One sentence on what to optimize for",
    "primitives": [{ "name": "Topic", "description": "Why it matters here" }],
    "questions_they_ask": [{ "category": "Meaningful Category", "question": "Question", "priority": 1 }, "... 20-35 total"],
    "questions_you_ask": [{ "category": "Meaningful Category", "question": "Question", "priority": 1 }, "... 20-35 total"],
    "companyIntel": {
      "industry": "string",
      "size": "string",
      "hqLocation": "string",
      "summary": "string",
      "product": "What they build specifically",
      "businessModel": "How they make money",
      "competitors": ["Competitor 1", "Competitor 2"],
      "techStack": "Known technologies",
      "culture": "Culture description",
      "recentNews": ["News 1", "News 2"]
    },
    "interviewStrategy": {
      "goalForThisStage": "string",
      "whatTheyEvaluate": ["Point 1", "Point 2"],
      "howToSucceed": ["Tactic 1", "Tactic 2", "Tactic 3"],
      "commonMistakes": ["Mistake 1", "Mistake 2", "Mistake 3"],
      "answerLength": "string"
    },
    "interviewerIntel": {
      "name": "string",
      "likelyRole": "string",
      "seniority": "string",
      "whatTheyEvaluate": "string",
      "topicsTheyProbe": ["Topic 1", "Topic 2"],
      "howToCalibrateAnswers": "string"
    },
    "stageRoadmap": [
      { "stage": "Stage Name", "status": "completed | current | upcoming", "whatItTests": "string" }
    ],
    "compensationIntel": {
      "salaryRange": "string",
      "equityInfo": "string",
      "negotiationTips": ["Tip 1", "Tip 2"],
      "whenToDiscuss": "string"
    },
    "prepChecklist": ["Task 1", "Task 2", "Task 3", "Task 4", "Task 5"]
  }
}`

  const userPrompt = `${threadContext}From: ${input.fromName} <${input.fromEmail}>
Subject: ${input.subject}
Snippet: ${input.snippet}

Email body:
${input.bodyExcerpt}

Analyze this email. Return JSON only.`

  try {
    if (!openai) {
      console.error("[LLM] OpenAI not configured")
      return null
    }

    console.log(`[LLM] Calling OpenAI for: "${input.subject.slice(0, 40)}"`)

    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.5,
      max_tokens: 6000,
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
      advances_pipeline: parsed.advances_pipeline ?? parsed.is_recruiting ?? false,
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
        primitives: parsed.prep?.primitives || [],
        questionsTheyMightAsk: parsed.prep?.questions_they_ask || parsed.prep?.questions_they_might_ask || [],
        questionsYouShouldAsk: parsed.prep?.questions_you_ask || parsed.prep?.questions_you_should_ask || [],
        companyIntel: {
          industry: parsed.prep?.companyIntel?.industry || "Unknown",
          size: parsed.prep?.companyIntel?.size || "Unknown",
          hqLocation: parsed.prep?.companyIntel?.hqLocation || parsed.prep?.companyIntel?.hq_location || "Unknown",
          summary: parsed.prep?.companyIntel?.summary || "",
          product: parsed.prep?.companyIntel?.product || "",
          businessModel: parsed.prep?.companyIntel?.businessModel || "",
          competitors: parsed.prep?.companyIntel?.competitors || [],
          techStack: parsed.prep?.companyIntel?.techStack || "",
          culture: parsed.prep?.companyIntel?.culture || "",
          recentNews: parsed.prep?.companyIntel?.recentNews || parsed.prep?.companyIntel?.recent_news || [],
        },
        interviewStrategy: {
          goalForThisStage: parsed.prep?.interviewStrategy?.goalForThisStage || "",
          whatTheyEvaluate: parsed.prep?.interviewStrategy?.whatTheyEvaluate || [],
          howToSucceed: parsed.prep?.interviewStrategy?.howToSucceed || [],
          commonMistakes: parsed.prep?.interviewStrategy?.commonMistakes || [],
          answerLength: parsed.prep?.interviewStrategy?.answerLength || "",
        },
        interviewerIntel: {
          name: parsed.prep?.interviewerIntel?.name || "",
          likelyRole: parsed.prep?.interviewerIntel?.likelyRole || "",
          seniority: parsed.prep?.interviewerIntel?.seniority || "",
          whatTheyEvaluate: parsed.prep?.interviewerIntel?.whatTheyEvaluate || "",
          topicsTheyProbe: parsed.prep?.interviewerIntel?.topicsTheyProbe || [],
          howToCalibrateAnswers: parsed.prep?.interviewerIntel?.howToCalibrateAnswers || "",
        },
        stageRoadmap: parsed.prep?.stageRoadmap || [],
        compensationIntel: {
          salaryRange: parsed.prep?.compensationIntel?.salaryRange || "",
          equityInfo: parsed.prep?.compensationIntel?.equityInfo || "",
          negotiationTips: parsed.prep?.compensationIntel?.negotiationTips || [],
          whenToDiscuss: parsed.prep?.compensationIntel?.whenToDiscuss || "",
        },
        prepChecklist: parsed.prep?.prepChecklist || [],
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

  const stats: { scanned: number; detected: number; inserted: number; updated: number; skipped: number; rejected: number; errors: number; lastError?: string } = { scanned: 0, detected: 0, inserted: 0, updated: 0, skipped: 0, rejected: 0, errors: 0 }
  let syncRunId: string | null = null
  let userEmail = ""
  let llmCallCount = 0

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
        const page = await gmail.users.messages.list({ userId: "me", q, maxResults: 100, pageToken })
        messages = messages.concat(page.data.messages ?? [])
        pageToken = page.data.nextPageToken ?? undefined
      } while (pageToken && messages.length < 100)
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

      // Check if already processed — but re-process if pipeline has empty prep
      const { data: existing } = await supabase
        .from("emails")
        .select("id, pipeline_id")
        .eq("user_email", userEmail)
        .eq("gmail_message_id", msg.id)
        .maybeSingle()

      if (existing) {
        // Check if the linked pipeline needs a prep refresh
        let needsRefresh = false
        if (existing.pipeline_id) {
          const { data: pl } = await supabase
            .from("pipelines")
            .select("prep_json, stage")
            .eq("id", existing.pipeline_id)
            .maybeSingle()
          // Re-process if prep is missing/empty or stage is stale
          if (!pl?.prep_json || !pl.prep_json.narrative || pl.stage === "HM" || pl.stage === "ASSESSMENT" || pl.stage === "Applied") {
            needsRefresh = true
            console.log(`[SYNC] Re-processing ${msg.id} — pipeline needs prep refresh`)
          }
        }
        if (!needsRefresh) {
          stats.skipped++
          continue
        }
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

      // Gate 1: Instant reject — only check subject+snippet, NOT full body
      // (footer text like "unsubscribe here" was killing legit recruiter emails)
      const rejectText = `${subject}\n${snippet}`.toLowerCase()
      const instantRejectResult = shouldInstantReject(rejectText, fromEmail)
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

      // Get thread context from existing pipeline OR from Gmail thread
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
      } else if (threadId) {
        // Even for new pipelines, try to get Gmail thread context
        try {
          const thread = await gmail.users.threads.get({ userId: "me", id: threadId, format: "metadata", metadataHeaders: ["Subject", "From", "Date"] })
          const threadMsgs = thread.data.messages || []
          for (const tm of threadMsgs) {
            if (tm.id === msg.id) continue // Skip current message
            const tmHeaders = tm.payload?.headers || []
            threadEmails.push({
              subject: tmHeaders.find(h => h.name === "Subject")?.value || "",
              snippet: tm.snippet || "",
              from: tmHeaders.find(h => h.name === "From")?.value || "",
              date: tmHeaders.find(h => h.name === "Date")?.value || "",
            })
          }
        } catch {
          // Thread fetch failed, continue without context
        }
      }

      // Budget check — stop making LLM calls if we've hit the limit
      if (llmCallCount >= MAX_LLM_CALLS_PER_SYNC) {
        console.log(`[SYNC] LLM budget exhausted (${MAX_LLM_CALLS_PER_SYNC}), skipping remaining`)
        stats.skipped++
        continue
      }

      // LLM Analysis
      llmCallCount++
      const analysis = await analyzeEmail({
        subject,
        snippet,
        fromEmail,
        fromName,
        bodyExcerpt: bodyText.slice(0, 4000),
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

      // LLM recruiting check - only create pipelines for actual interviews
      if (!analysis.is_recruiting) {
        console.log(`[REJECT] LLM: not recruiting for "${subject.slice(0, 40)}"`)
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
          rejection_reason: "llm_not_recruiting",
          action_taken: "rejected",
        })
        continue
      }

      // Pipeline advancement check - only process emails that move the pipeline forward
      if (!analysis.advances_pipeline) {
        console.log(`[SKIP] LLM: does not advance pipeline for "${subject.slice(0, 40)}" at ${analysis.company}`)
        stats.skipped++
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
          llm_is_recruiting: true,
          rejection_reason: "does_not_advance_pipeline",
          action_taken: "skipped_no_advancement",
        })
        continue
      }

      stats.detected++

      // Create or update pipeline
      // FIXED: Match by LLM-extracted company name to prevent duplicates
      const llmCompanyNormalized = normalize(analysis.company)
      let matchedPipeline = existingPipeline

      // If no match by domain, try matching by exact company name (this prevents duplicates)
      if (!matchedPipeline && llmCompanyNormalized) {
        matchedPipeline = pipelines.find((p: any) => {
          const pCompanyNorm = normalize(p.company)
          return pCompanyNorm === llmCompanyNormalized
        })
        if (matchedPipeline) {
          console.log(`[PIPELINE] Found existing by company name: "${analysis.company}"`)
        }
      }

      // Also try fuzzy substring match on company name (e.g. "Stripe" matches "Stripe, Inc.")
      if (!matchedPipeline && llmCompanyNormalized) {
        matchedPipeline = pipelines.find((p: any) => {
          const pn = normalize(p.company)
          if (!pn || !llmCompanyNormalized) return false
          return pn.includes(llmCompanyNormalized) || llmCompanyNormalized.includes(pn)
        })
        if (matchedPipeline) {
          console.log(`[PIPELINE] Fuzzy company match: "${analysis.company}" ≈ "${matchedPipeline.company}"`)
        }
      }

      let pipelineId = matchedPipeline?.id

      // Determine clean stage
      const finalStage = getUiStage(analysis.stage_bucket)

      if (!pipelineId) {
        // Create new pipeline — never include predicted_stages in insert (column may not exist)
        console.log(`[PIPELINE] Creating for ${analysis.company}`)

        const payload: any = {
          user_email: userEmail,
          company: analysis.company,
          role: analysis.role,
          status: "WAITING",
          stage: finalStage,
          stage_detail: analysis.stage_detail,
          next_action: analysis.insights.nextAction,
          last_email_at: receivedAt,
          last_email_subject: subject,
          last_email_snippet: snippet,
          last_email_from_name: fromName,
          last_email_from_email: fromEmail,
          prep_json: analysis.prep,
          insights_json: analysis.insights,
          company_intel_json: analysis.prep.companyIntel,
        }

        const { data: newP, error: pErr } = await supabase.from("pipelines").insert(payload).select("*").single()

        if (pErr) {
          console.error("[PIPELINE] Insert failed:", pErr.message)
          // Fallback: core fields only but ALWAYS include prep_json
          const fallback: any = {
            user_email: userEmail,
            company: analysis.company,
            role: analysis.role,
            status: "WAITING",
            stage: finalStage,
            last_email_at: receivedAt,
            last_email_subject: subject,
            prep_json: analysis.prep,
            insights_json: analysis.insights,
          }
          const { data: newP2, error: pErr2 } = await supabase.from("pipelines").insert(fallback).select("*").single()

          if (pErr2) {
            console.error("[PIPELINE] Fallback also failed:", pErr2.message)
            stats.errors++
            continue
          }
          pipelineId = newP2.id
          // Push into local array so subsequent emails in this sync find it
          pipelines.push(newP2)
        } else {
          pipelineId = newP.id
          // Push into local array so subsequent emails in this sync find it
          pipelines.push(newP)
        }

        // Try to set predicted_stages separately (OK if column doesn't exist)
        if (analysis.predicted_stages?.length > 0) {
          try {
            await supabase.from("pipelines").update({ predicted_stages: analysis.predicted_stages }).eq("id", pipelineId)
          } catch {
            console.log("[PIPELINE] predicted_stages column not available, skipping")
          }
        }

        stats.inserted++
      } else {
        // Update existing pipeline — only overwrite prep_json if new content is richer
        // Prevent stage regression: only move forward
        const existingStage = matchedPipeline?.stage
        console.log(`[PIPELINE] Updating ${analysis.company} (ID: ${pipelineId}), stage: ${existingStage} → ${finalStage}`)

        // Compare prep richness: count non-empty fields in old vs new
        const existingPrep = matchedPipeline?.prep_json || {}
        const newPrep = analysis.prep || {}
        const prepRichness = (p: any) => {
          let score = 0
          if (p?.questionsTheyMightAsk?.length || p?.questions_they_ask?.length) score += 3
          if (p?.questionsYouShouldAsk?.length || p?.questions_you_ask?.length) score += 3
          if (p?.primitives?.length) score += 2
          if (p?.companyIntel?.summary) score += 2
          if (p?.companyIntel?.product) score += 1
          if (p?.companyIntel?.competitors?.length) score += 1
          if (p?.interviewStrategy?.goalForThisStage) score += 2
          if (p?.interviewStrategy?.howToSucceed?.length) score += 2
          if (p?.interviewerIntel?.name) score += 1
          if (p?.stageRoadmap?.length) score += 1
          if (p?.prepChecklist?.length) score += 1
          if (p?.compensationIntel?.salaryRange) score += 1
          return score
        }

        const oldScore = prepRichness(existingPrep)
        const newScore = prepRichness(newPrep)
        const useNewPrep = newScore >= oldScore

        console.log(`[PIPELINE] Prep richness: existing=${oldScore}, new=${newScore}, using ${useNewPrep ? "new" : "existing"}`)

        // Resolve stage with regression prevention
        const resolvedStage = resolveStage(finalStage, existingStage)
        console.log(`[PIPELINE] Resolved stage: ${resolvedStage} (was ${existingStage}, LLM said ${finalStage})`)

        const updatePayload: any = {
          stage: resolvedStage,
          stage_detail: analysis.stage_detail,
          last_email_at: receivedAt,
          last_email_subject: subject,
          last_email_snippet: snippet,
          last_email_from_name: fromName,
          last_email_from_email: fromEmail,
          insights_json: analysis.insights,
          updated_at: new Date().toISOString(),
        }

        // Only overwrite prep if new is richer
        if (useNewPrep) {
          updatePayload.prep_json = newPrep
          updatePayload.company_intel_json = analysis.prep.companyIntel
        }

        const { error: updErr } = await supabase.from("pipelines").update(updatePayload).eq("id", pipelineId)

        if (updErr) {
          console.error(`[PIPELINE] Update FAILED for ${analysis.company}:`, updErr.message)
        } else {
          // Update the local array so subsequent matches see the latest data
          const idx = pipelines.findIndex((p: any) => p.id === pipelineId)
          if (idx !== -1) {
            pipelines[idx] = { ...pipelines[idx], ...updatePayload }
          }
        }

        // Try predicted_stages separately
        if (analysis.predicted_stages?.length > 0) {
          try {
            await supabase.from("pipelines").update({ predicted_stages: analysis.predicted_stages }).eq("id", pipelineId)
          } catch {
            // Column may not exist, that's OK
          }
        }

        stats.updated++
      }

      // Upsert email record (prevents duplicate errors on re-sync)
      await supabase.from("emails").upsert({
        user_email: userEmail,
        pipeline_id: pipelineId,
        gmail_id: msg.id,
        gmail_thread_id: threadId,
        gmail_message_id: msg.id,
        subject,
        snippet,
        from_name: fromName,
        from_email: fromEmail,
        body_text: bodyText,
        received_at: receivedAt,
        analysis_json: analysis,
        is_recruiting: true,
      }, { onConflict: "gmail_message_id" })

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

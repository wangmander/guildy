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

  // Schools/Education (NOT job interviews)
  "school admission", "school application", "student enrollment",
  "parent interview", "school interview", "school tour",
  "tuition", "school calendar", "school newsletter",
  "christian school", "elementary school", "high school",
  "middle school", "preschool", "kindergarten",
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
  // === DEFINITIVE SIGNALS (10) ===
  { phrase: "interview", w: 10 },
  { phrase: "interviews", w: 10 },
  { phrase: "interviewing", w: 10 },
  { phrase: "your application", w: 10 },
  { phrase: "job application", w: 10 },
  { phrase: "thanks for applying", w: 10 },
  { phrase: "thank you for applying", w: 10 },
  { phrase: "received your application", w: 10 },
  { phrase: "application status", w: 10 },
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

  const systemPrompt = `You are the world's most elite interview strategist. You produce prep material so specific and insightful that it feels like insider knowledge. You never give generic advice. Every word is tailored to THIS company, THIS role, THIS stage, and THIS interviewer.

INTERVIEWER PROFILING:
When you see a sender name/title, you MUST profile them:
- Infer their likely role, seniority, and what they evaluate (a "Senior Engineering Manager" cares about system design and team scaling; a "Recruiter" cares about culture fit and comp expectations; a "VP Product" cares about strategic thinking and customer empathy).
- Tailor ALL questions and stories to what THIS person would probe for.
- If the sender is a recruiter from an ATS (Greenhouse, Lever), infer who the NEXT interviewer likely is based on the stage and tailor prep for that upcoming conversation.

ROLE-SPECIFIC PIPELINE STAGES (predicted_stages):
Generate bespoke pipeline stages based on the actual role type. Examples:
- Software Engineer: ["Recruiter Screen", "Technical Phone Screen", "Coding Challenge", "System Design", "Team Fit / Bar Raiser", "Offer"]
- Product Designer: ["Recruiter Screen", "Portfolio Review", "Design Challenge", "Hiring Manager", "Cross-functional Panel", "Offer"]
- Product Manager: ["Recruiter Screen", "PM Screen", "Case Study / Product Sense", "Technical Depth", "Leadership / Cross-functional", "Offer"]
- Data Scientist: ["Recruiter Screen", "Technical Screen", "Take-Home Analysis", "Modeling Deep Dive", "Stakeholder Presentation", "Offer"]
- Sales/BizDev: ["Recruiter Screen", "Hiring Manager", "Mock Pitch / Role Play", "VP/C-Suite Final", "Offer"]
- General/Unknown: ["Recruiter Screen", "Hiring Manager Screen", "Skills Assessment", "Final Round", "Offer"]
Adapt these to the specific company (e.g., FAANG has "Bar Raiser", startups have "Founder Chat").

STAGE-SPECIFIC PREP DEPTH:
- RECRUITER_SCREEN: Narrative-heavy. "Why you, why them, why now." Comp expectations. Culture signals. Questions that show you've researched the company deeply.
- HM_SCREEN: Impact stories mapped to their team's actual problems. "How would you approach X in your first 90 days?" Questions about roadmap, team structure, what success looks like.
- ASSESSMENT: Deep technical prep. For engineers: data structures, system design patterns relevant to their stack. For designers: portfolio walkthrough strategy, critique frameworks. For PMs: product sense frameworks, estimation practice. Questions about evaluation rubric.
- LOOP: Full coverage. One story per competency (technical, collaboration, leadership, ambiguity). Questions about decision-making culture, conflict resolution, how they ship.
- OFFER: Negotiation leverage. Research comp bands. Questions about equity structure, vesting, refreshers, growth trajectory, team budget.

COMPANY DEEP DIVE:
For the company, you MUST infer and provide:
- What they actually build (not just the industry category)
- Their likely tech stack and architecture decisions
- Their competitive landscape and what differentiates them
- Their stage (seed, Series A-D, public) and what that implies for the role
- Recent strategic moves, funding, product launches based on your knowledge
- The company culture archetype (move-fast-break-things, engineering-excellence, design-led, sales-driven)

GUIDELINES:
1. NO GENERIC FLUFF: Never say "Show enthusiasm" or "Be yourself" or "Research the company". Every bullet must contain a specific, actionable insight.
2. BE SPICY: Give opinions that demonstrate deep domain expertise. "Most companies get X wrong because..." or "The real challenge at their scale is..."
3. NARRATIVE: Write a 30-second pitch in FIRST PERSON ("I...") that connects the candidate's likely strengths to THIS company's specific challenges. Not a resume summary—a story arc.
4. PROOF STORIES: 3-4 sentences each. Context (what was broken), Action (what you did and why that approach), Result (quantified impact). Tailored to what THIS interviewer evaluates.
5. PRIMITIVES: 4+ domain-specific concepts the candidate must fluently discuss. For Stripe: "payment intents", "idempotency keys". For Figma: "multiplayer cursors", "component variants". NOT generic CS terms.
6. QUESTIONS THEY ASK: Exactly 8. Categorized by what the interviewer probes for. Include the HARD questions—the ones that trip people up.
7. QUESTIONS YOU ASK: Exactly 8. Questions that signal seniority and genuine curiosity. "What's the hardest technical decision your team made this quarter?" NOT "What's a typical day like?"
8. WHAT TO EMPHASIZE: 4-6 specific themes to weave into every answer. Not skills—strategic angles. e.g., "Your experience with migration projects maps directly to their monolith→microservice transition."
9. COMPANY INTEL: Industry, size (employees), HQ, 2-3 sentence summary of what they do and their competitive position, and any recent news/moves you know about.
10. ALL PREP FIELDS MUST BE POPULATED. If you lack specific context, infer aggressively based on the company name, role type, and email signals. Better to be confidently specific than vaguely generic.

OUTPUT (JSON ONLY, no markdown wrapping):
{
  "is_recruiting": boolean,
  "company": "string",
  "role": "string",
  "stage_bucket": "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stage_detail": "string describing the specific stage",
  "predicted_stages": ["Bespoke Stage 1", "Bespoke Stage 2", "..."],
  "action_needed": "string | null",
  "insights": {
    "stageReason": "Why this is the current stage based on email evidence",
    "waitingOn": "you" | "them",
    "nextAction": "Specific next step the candidate should take",
    "urgency": "low" | "med" | "high",
    "responseLikelihood": "low" | "med" | "high",
    "tone": "friendly" | "formal" | "neutral" | "urgent"
  },
  "prep": {
    "stageFocus": "What to optimize for at this specific stage",
    "narrative": "First-person 30-second pitch tailored to this company and role",
    "proof_stories": [{ "title": "Story Name", "detail": "3-4 sentences: context, action, result" }],
    "primitives": [{ "name": "Domain Concept", "description": "2-3 sentences on what this means in their context" }],
    "spicy_opinion": "A bold, defensible take that shows deep domain expertise",
    "questions_they_ask": [{ "category": "Category", "question": "The actual question" }],
    "questions_you_ask": [{ "category": "Category", "question": "The actual question" }],
    "whatToEmphasize": ["Specific theme 1", "Specific theme 2", "..."],
    "companyIntel": {
      "industry": "string",
      "size": "string (e.g., '500-1000 employees')",
      "hqLocation": "string",
      "summary": "2-3 sentences on what they build, their position, and stage",
      "recentNews": ["Recent move or event 1", "Recent move or event 2"]
    }
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
      max_tokens: 4000,
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
        whatToEmphasize: parsed.prep?.whatToEmphasize || parsed.prep?.what_to_emphasize || [],
        companyIntel: {
          industry: parsed.prep?.companyIntel?.industry || "Unknown",
          size: parsed.prep?.companyIntel?.size || "Unknown",
          hqLocation: parsed.prep?.companyIntel?.hqLocation || parsed.prep?.companyIntel?.hq_location || "Unknown",
          summary: parsed.prep?.companyIntel?.summary || "",
          recentNews: parsed.prep?.companyIntel?.recentNews || parsed.prep?.companyIntel?.recent_news || [],
        },
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

      // LLM Analysis
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

      let pipelineId = matchedPipeline?.id

      // Determine clean stage
      const finalStage = getUiStage(analysis.stage_bucket)

      if (!pipelineId) {
        // Create new pipeline
        console.log(`[PIPELINE] Creating for ${analysis.company}`)

        let newPStrag, pErrStrag

        // Attempt 1: Full schema
        const payloadCheck: any = {
          user_email: userEmail,
          company: analysis.company,
          role: analysis.role,
          status: "WAITING",
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
        }

        const { data: newP1, error: pErr1 } = await supabase.from("pipelines").insert(payloadCheck).select("id").single()

        if (pErr1) {
          console.error("[PIPELINE] Creation attempt 1 failed:", pErr1.message)
          // Attempt 2: Self-healing (remove predicted_stages)
          delete payloadCheck.predicted_stages
          const { data: newP2, error: pErr2 } = await supabase.from("pipelines").insert(payloadCheck).select("id").single()

          if (pErr2) {
            console.error("[PIPELINE] Creation attempt 2 failed:", pErr2.message)

            // Attempt 3: SKELETON FALLBACK (Minimal fields only)
            // This ensures we show SOMETHING even if rich data fails.
            console.log("[PIPELINE] Attempting SKELETON INSERT...")
            const skeleton = {
              user_email: userEmail,
              company: analysis.company,
              role: analysis.role,
              status: "WAITING",
              stage: "Applied", // Fallback safe stage
              last_email_at: receivedAt,
              last_email_subject: subject,
              updated_at: new Date().toISOString()
            }
            const { data: newP3, error: pErr3 } = await supabase.from("pipelines").insert(skeleton).select("id").single()

            if (pErr3) {
              console.error("[PIPELINE] Skeleton creation failed:", pErr3.message)

              // Attempt 4: ABSOLUTE MINIMUM (just 2 fields)
              console.log("[PIPELINE] Attempting ABSOLUTE MINIMUM INSERT (user_email + company only)...")
              const absolute = {
                user_email: userEmail,
                company: analysis.company || "Unknown"
              }
              const { data: newP4, error: pErr4 } = await supabase.from("pipelines").insert(absolute).select("id").single()

              if (pErr4) {
                console.error("[PIPELINE] ABSOLUTE MINIMUM failed (Critical DB issue):", pErr4.message)
                // Store the error for API response
                stats.lastError = `Pipeline insert failed: ${pErr4.message} (table may not exist or user_email constraint)`
                stats.errors++
                await logEmailProcessing({
                  user_email: userEmail,
                  gmail_thread_id: threadId,
                  gmail_message_id: msg.id,
                  company_guess: analysis.company,
                  subject: subject.slice(0, 200),
                  detected: true,
                  action_taken: "error_creating_pipeline",
                  rejection_reason: `db_insert_failed_absolute: ${pErr4.message}`
                })
                continue
              }
              newPStrag = newP4
            } else {
              newPStrag = newP3
            }
          } else {
            newPStrag = newP2
          }
        } else {
          newPStrag = newP1
        }

        pipelineId = newPStrag.id
        stats.inserted++
      } else {
        // Update existing pipeline.
        console.log(`[PIPELINE] Updating ${analysis.company} (ID: ${pipelineId}) with NEW PREP DATA...`)

        const updatePayload: any = {
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
        }

        // Attempt 1: Full schema
        const { error: updErr1 } = await supabase.from("pipelines").update(updatePayload).eq("id", pipelineId)

        if (updErr1) {
          console.error(`[PIPELINE] Update attempt 1 FAILED for ${analysis.company}:`, updErr1.message)
          // Attempt 2: Self-healing
          delete updatePayload.predicted_stages
          const { error: updErr2 } = await supabase.from("pipelines").update(updatePayload).eq("id", pipelineId)

          if (updErr2) {
            console.error(`[PIPELINE] Update attempt 2 FAILED for ${analysis.company}:`, updErr2.message)
          } else {
            console.log(`[PIPELINE] Update SUCCESS (Self-healed) for ${analysis.company}`)
          }
        } else {
          console.log(`[PIPELINE] Update SUCCESS for ${analysis.company}`)
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

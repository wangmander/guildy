import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { google } from "googleapis"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import OpenAI from "openai"
import { processEmailSignal } from "@/lib/guildy/gmailProcessor"
import { extractBodyFromPayload, stripHtml, safeJsonParse } from "@/lib/guildy/normalizers"
import type { EmailSignal } from "@/lib/guildy/types"

// Vercel Pro: up to 120s
export const maxDuration = 120

const openaiKey = process.env.OPENAI_API_KEY
const supabase = supabaseAdmin
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null

// Budget: gpt-4o-mini is fast/cheap; gpt-4o (prep) is expensive/slow
const MAX_MINI_CALLS = 15   // classifier calls per sync
const MAX_PREP_CALLS = 3    // prep generation (gpt-4o) calls per sync — fired in parallel after loop
const SYNC_DEADLINE_MS = 70_000 // hard stop at 70s so Vercel never hits 120s

// ============================================================
// INSTRUMENTATION
// ============================================================
async function createSyncRun(userEmail: string): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from("sync_runs")
      .insert({ user_email: userEmail, status: "running" })
      .select("id")
      .single()
    if (error) { console.error("[SYNC] sync_run create failed:", error); return null }
    return data.id
  } catch { return null }
}

async function updateSyncRun(
  syncRunId: string | null,
  stats: Record<string, number>,
  status: "completed" | "failed",
  errorMessage?: string
) {
  if (!syncRunId || !supabase) return
  try {
    await supabase.from("sync_runs").update({
      completed_at: new Date().toISOString(),
      status,
      ...stats,
      error_message: errorMessage,
    }).eq("id", syncRunId)
  } catch { /* non-fatal */ }
}

// ============================================================
// RICH PREP GENERATION — gpt-4o, comprehensive interview intel
// Called only for new pipelines or after significant stage advance.
// ============================================================
async function generateRichPrep(input: {
  subject: string
  snippet: string
  fromEmail: string
  fromName: string
  bodyExcerpt: string
  threadEmails?: Array<{ subject: string; snippet: string; from: string; date: string }>
}) {
  if (!openai) return null

  let threadContext = ""
  if (input.threadEmails?.length) {
    threadContext = "\n\nPREVIOUS EMAILS IN THREAD (oldest first):\n"
    for (const e of input.threadEmails) {
      threadContext += `[${e.date}] ${e.from}: "${e.subject}" — ${e.snippet.slice(0, 100)}\n`
    }
    threadContext += "\nNEW EMAIL TO ANALYZE:\n"
  }

  const systemPrompt = `You are an elite interview research assistant. You provide factual company intelligence, realistic interview questions, and actionable interview strategy. You NEVER fabricate information about the candidate — you don't know who they are. Everything you produce is based on the COMPANY, ROLE, STAGE, and INTERVIEWER.

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
- goalForThisStage: One sentence on what success looks like at this stage.
- whatTheyEvaluate: 2-3 bullet points on what this specific stage assesses.
- howToSucceed: 3-4 specific, actionable tactics. NOT "be yourself" or "show enthusiasm."
- commonMistakes: 3-4 things that get people rejected at this stage.
- answerLength: How long answers should be at this stage.

=== SECTION 3: INTERVIEWER INTEL (interviewerIntel) ===
Based on the sender's name and email, infer what you can:
- name, likelyRole, seniority (junior/mid/senior/executive)
- whatTheyEvaluate, topicsTheyProbe (3-5 topics), howToCalibrateAnswers

=== SECTION 4: STAGE ROADMAP (stageRoadmap) ===
Array of 4-6 stages: [{ "stage": "Name", "status": "completed|current|upcoming", "whatItTests": "..." }]

=== SECTION 5: COMPENSATION INTEL (compensationIntel) ===
Based on company size, stage, location, role:
- salaryRange, equityInfo, negotiationTips (2-3), whenToDiscuss
NOTE: Full detail only for OFFER stage. Earlier stages: brief estimates only.

=== SECTION 6: PREP CHECKLIST (prepChecklist) ===
5-8 concrete, specific tasks to do before the interview. NOT vague. e.g.:
- "Look up [interviewer name] on LinkedIn — note their career path and recent posts"
- "Try [company]'s product for 10 minutes — note one thing you'd improve"
- "Google '[company] interview questions site:glassdoor.com'"

=== QUESTIONS ===
IMPORTANT: Weight questions by category importance for this role/seniority/interviewer.
Most critical categories: 5-7 questions. Moderate: 3-4. Minor: 2-3. Total 20-35.
Include a "priority" field: 1=almost certainly asked, 2=commonly asked, 3=sometimes asked.

- questions_they_ask: 4-8 categories, weighted by what THIS interviewer at THIS stage will actually focus on. Include the hard questions — the ones that trip people up.
- questions_you_ask: 4-8 categories. Questions that signal seniority and genuine curiosity. NOT "What's a typical day?" — instead "What's the biggest technical bet your team is making right now?"

=== KEY TOPICS (primitives) ===
4+ topics in plain language with WHY they matter to this company.

OUTPUT (JSON ONLY, no markdown):
{
  "is_recruiting": boolean,
  "company": "string",
  "role": "string",
  "stage_bucket": "RECRUITER_SCREEN"|"HM_SCREEN"|"ASSESSMENT"|"LOOP"|"OFFER"|"REJECTED",
  "stage_detail": "string",
  "predicted_stages": ["Stage 1", "Stage 2"],
  "action_needed": "string|null",
  "insights": {
    "stageReason": "string",
    "waitingOn": "you"|"them",
    "nextAction": "string",
    "urgency": "low"|"med"|"high",
    "responseLikelihood": "low"|"med"|"high",
    "tone": "friendly"|"formal"|"neutral"|"urgent"
  },
  "prep": {
    "stageFocus": "string",
    "primitives": [{ "name": "Topic", "description": "Why it matters here" }],
    "questions_they_ask": [{ "category": "Category", "question": "Question", "priority": 1 }],
    "questions_you_ask": [{ "category": "Category", "question": "Question", "priority": 1 }],
    "companyIntel": {
      "industry": "string", "size": "string", "hqLocation": "string",
      "summary": "string", "product": "string", "businessModel": "string",
      "competitors": ["string"], "techStack": "string", "culture": "string",
      "recentNews": ["string"]
    },
    "interviewStrategy": {
      "goalForThisStage": "string",
      "whatTheyEvaluate": ["string"],
      "howToSucceed": ["string"],
      "commonMistakes": ["string"],
      "answerLength": "string"
    },
    "interviewerIntel": {
      "name": "string", "likelyRole": "string", "seniority": "string",
      "whatTheyEvaluate": "string", "topicsTheyProbe": ["string"],
      "howToCalibrateAnswers": "string"
    },
    "stageRoadmap": [{ "stage": "string", "status": "string", "whatItTests": "string" }],
    "compensationIntel": {
      "salaryRange": "string", "equityInfo": "string",
      "negotiationTips": ["string"], "whenToDiscuss": "string"
    },
    "prepChecklist": ["string"]
  }
}`

  const userPrompt = `${threadContext}From: ${input.fromName} <${input.fromEmail}>
Subject: ${input.subject}
Snippet: ${input.snippet}

Email body:
${input.bodyExcerpt}

Analyze this email and return rich interview preparation JSON.`

  try {
    console.log(`[PREP] Calling gpt-4o for: "${input.subject.slice(0, 40)}"`)
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
    const parsed = safeJsonParse<any>(content)
    if (!parsed) { console.error("[PREP] JSON parse failed"); return null }

    return {
      is_recruiting: parsed.is_recruiting ?? true,
      company: parsed.company || "Unknown",
      role: parsed.role || "Unknown",
      stage_bucket: parsed.stage_bucket || "RECRUITER_SCREEN",
      stage_detail: parsed.stage_detail || "",
      insights: {
        stageReason: parsed.insights?.stageReason || "",
        waitingOn: parsed.insights?.waitingOn || "you",
        nextAction: parsed.insights?.nextAction || "Review and respond",
        urgency: parsed.insights?.urgency || "med",
        responseLikelihood: parsed.insights?.responseLikelihood || "med",
        tone: parsed.insights?.tone || "neutral",
      },
      prep: {
        stageFocus: parsed.prep?.stageFocus || "",
        primitives: parsed.prep?.primitives || [],
        questionsTheyMightAsk: parsed.prep?.questions_they_ask || [],
        questionsYouShouldAsk: parsed.prep?.questions_you_ask || [],
        companyIntel: {
          industry: parsed.prep?.companyIntel?.industry || "Unknown",
          size: parsed.prep?.companyIntel?.size || "Unknown",
          hqLocation: parsed.prep?.companyIntel?.hqLocation || "Unknown",
          summary: parsed.prep?.companyIntel?.summary || "",
          product: parsed.prep?.companyIntel?.product || "",
          businessModel: parsed.prep?.companyIntel?.businessModel || "",
          competitors: parsed.prep?.companyIntel?.competitors || [],
          techStack: parsed.prep?.companyIntel?.techStack || "",
          culture: parsed.prep?.companyIntel?.culture || "",
          recentNews: parsed.prep?.companyIntel?.recentNews || [],
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
    console.error("[PREP] Error:", err)
    return null
  }
}

// Map prep stage_bucket to UI stage
function getUiStage(bucket: string): string {
  const map: Record<string, string> = {
    RECRUITER_SCREEN: "SCREENING",
    HM_SCREEN: "HIRING_MANAGER",
    ASSESSMENT: "PRESENTATION",
    LOOP: "FULL_LOOP",
    OFFER: "OFFER_DISCUSSION",
    REJECTED: "REJECTED",
  }
  return map[bucket] || "SCREENING"
}

// Regression-safe stage merge
const STAGE_ORDER: Record<string, number> = {
  SCREENING: 0, HIRING_MANAGER: 1, PRESENTATION: 2, FULL_LOOP: 3, OFFER_DISCUSSION: 4, REJECTED: -1,
}
function resolveStage(newStage: string, existingStage?: string): string {
  if (!existingStage) return newStage
  if (newStage === "REJECTED") return "REJECTED"
  return (STAGE_ORDER[newStage] ?? 0) >= (STAGE_ORDER[existingStage] ?? 0) ? newStage : existingStage
}

// Prep richness score for deciding whether to overwrite
function prepRichness(p: any): number {
  if (!p) return 0
  let s = 0
  if (p.questionsTheyMightAsk?.length) s += 3
  if (p.questionsYouShouldAsk?.length) s += 3
  if (p.primitives?.length) s += 2
  if (p.companyIntel?.summary) s += 2
  if (p.companyIntel?.product) s += 1
  if (p.companyIntel?.competitors?.length) s += 1
  if (p.interviewStrategy?.goalForThisStage) s += 2
  if (p.interviewStrategy?.howToSucceed?.length) s += 2
  if (p.interviewerIntel?.name) s += 1
  if (p.stageRoadmap?.length) s += 1
  if (p.prepChecklist?.length) s += 1
  if (p.compensationIntel?.salaryRange) s += 1
  return s
}

// ============================================================
// MAIN SYNC HANDLER
// ============================================================
export async function POST() {
  console.log("[SYNC] ========== Gmail Sync V2 ==========")

  const stats = {
    scanned: 0, detected: 0, inserted: 0, updated: 0,
    skipped: 0, rejected: 0, errors: 0,
  }
  let syncRunId: string | null = null
  let userEmail = ""
  let miniCallCount = 0
  let prepCallCount = 0

  // Per-email decision log — returned to UI so "show details" can display every
  // email that was fetched and evaluated this sync (dismissed/idempotent skips
  // are excluded since we never fetch their full content).
  const details: Array<{
    messageId: string
    subject: string
    from: string
    outcome: string
    reason: string
    company: string | null
  }> = []

  try {
    if (!supabase || !openai) {
      return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 500 })
    }

    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "NO_SESSION" }, { status: 401 })

    const accessToken = (session as any).accessToken
    userEmail = session.user?.email || ""
    if (!accessToken || !userEmail) {
      return NextResponse.json({ error: "MISSING_TOKEN_OR_EMAIL" }, { status: 401 })
    }

    console.log(`[SYNC] User: ${userEmail}`)
    syncRunId = await createSyncRun(userEmail)

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: "v1", auth })

    // Determine query window (last sync minus 21-day overlap, or 3-month window)
    const { data: lastEmailRows } = await supabase
      .from("emails")
      .select("received_at")
      .eq("user_email", userEmail)
      .order("received_at", { ascending: false })
      .limit(1)

    const lastMs = lastEmailRows?.[0]?.received_at
      ? new Date(lastEmailRows[0].received_at).getTime()
      : null
    const afterUnix = lastMs ? Math.floor((lastMs - 21 * 24 * 60 * 60 * 1000) / 1000) : null
    const q = afterUnix
      ? `after:${afterUnix} -in:trash -in:chats`
      : "newer_than:3m -in:trash -in:chats"

    console.log(`[SYNC] Gmail query: ${q}`)

    let messages: Array<{ id?: string | null; threadId?: string | null }> = []
    let pageToken: string | undefined

    try {
      do {
        const page = await gmail.users.messages.list({
          userId: "me", q, maxResults: 100, pageToken,
        })
        messages = messages.concat(page.data.messages ?? [])
        pageToken = page.data.nextPageToken ?? undefined
      } while (pageToken && messages.length < 100)
    } catch (gmailErr: any) {
      console.error("[SYNC] Gmail API error:", gmailErr?.message)
      stats.errors++
      await updateSyncRun(syncRunId, stats, "failed", `Gmail API: ${gmailErr?.message}`)
      return NextResponse.json({
        error: "GMAIL_API_ERROR",
        message: gmailErr?.message,
        hint: "Gmail access may have expired. Please reconnect.",
        stats,
      }, { status: 401 })
    }

    stats.scanned = messages.length
    console.log(`[SYNC] ${messages.length} messages to process`)

    // ── PHASE A: Pre-load dismissed + idempotency data (2 bulk queries) ──
    const { data: dismissedRows } = await supabase
      .from("dismissed_threads").select("gmail_thread_id").eq("user_email", userEmail)
    const dismissedThreadSet = new Set<string>(
      (dismissedRows ?? []).map((r: any) => r.gmail_thread_id)
    )

    const allMsgIds = messages.map(m => m.id).filter(Boolean) as string[]
    const processedMsgMap = new Map<string, string | null>()
    const pipelinePrepScores = new Map<string, number>()
    if (allMsgIds.length > 0) {
      const { data: processedEmailRows } = await supabase
        .from("emails").select("gmail_message_id, pipeline_id")
        .eq("user_email", userEmail).in("gmail_message_id", allMsgIds)
      for (const e of (processedEmailRows || [])) {
        processedMsgMap.set(e.gmail_message_id, e.pipeline_id ?? null)
      }
      const seenPipelineIds = [...new Set(
        (processedEmailRows || []).map((e: any) => e.pipeline_id).filter(Boolean)
      )] as string[]
      if (seenPipelineIds.length > 0) {
        const { data: prepRows } = await supabase
          .from("pipelines").select("id, prep_json").in("id", seenPipelineIds)
        for (const pl of (prepRows || [])) pipelinePrepScores.set(pl.id, prepRichness(pl.prep_json))
      }
    }
    console.log(`[SYNC] dismissed=${dismissedThreadSet.size} already-processed=${processedMsgMap.size}`)

    // ── PHASE B: Pre-filter — decide which messages actually need fetching ──
    type MsgMeta = { id: string; threadId: string }
    const toFetch: MsgMeta[] = []
    for (const msg of messages) {
      if (!msg.id) continue
      const threadId = msg.threadId || ""
      if (threadId && dismissedThreadSet.has(threadId)) { stats.skipped++; continue }
      if (processedMsgMap.has(msg.id)) {
        const plId = processedMsgMap.get(msg.id) ?? null
        const richness = plId ? (pipelinePrepScores.get(plId) ?? 0) : 999
        if (richness >= 3) { stats.skipped++; continue }
        console.log(`[SYNC] Will re-process ${msg.id} — empty prep`)
      }
      toFetch.push({ id: msg.id, threadId })
    }
    console.log(`[SYNC] ${toFetch.length} messages need full fetch (${stats.skipped} skipped)`)

    // ── PHASE C: Parallel Gmail fetch (10 at a time) ──────────────────────
    // Sequential fetches cost ~0.4s × N. Parallel batches collapse that to
    // ~0.4s × ceil(N/10). For 50 messages: 20s → 2s.
    const FETCH_BATCH = 10
    const fetched = new Map<string, any>() // msgId -> full message data
    for (let i = 0; i < toFetch.length; i += FETCH_BATCH) {
      const batch = toFetch.slice(i, i + FETCH_BATCH)
      await Promise.all(batch.map(async ({ id }) => {
        try {
          const f = await gmail.users.messages.get({ userId: "me", id, format: "full" })
          fetched.set(id, f.data)
        } catch (err: any) {
          console.error(`[SYNC] Fetch failed for ${id}:`, err?.message)
          stats.errors++
        }
      }))
    }
    console.log(`[SYNC] Fetched ${fetched.size} full message(s)`)

    // ── PHASE D: Sequential LLM classification (deadline-guarded) ─────────
    // Builds a human-readable reason string from every available signal.
    function buildReason(result: { action: string; llmResult: any; companyName: string | null; errorDetail?: string; routerReason?: string }): string {
      const llm = result.llmResult
      const company = result.companyName || llm?.company_name
      const summary = typeof llm?.summary === "string" ? llm.summary.slice(0, 80) : null
      const msgType = llm?.message_type && llm.message_type !== "non_recruiting" ? llm.message_type : null
      const stage = llm?.stage_delta && llm.stage_delta !== "none" ? llm.stage_delta : null
      const conf = typeof llm?.confidence === "number" ? `${Math.round(llm.confidence * 100)}%` : null

      switch (result.action) {
        case "error":
          return `Error — ${result.errorDetail || "pipeline creation failed (check Vercel logs)"}`
        case "new_recruiting": {
          const parts = [company, msgType, stage ? `→${stage}` : null, conf].filter(Boolean)
          return `New pipeline${parts.length ? ` — ${parts.join(", ")}` : ""}`
        }
        case "updated_existing": {
          const parts = [company, msgType, stage ? `→${stage}` : null, conf].filter(Boolean)
          return `Updated pipeline${parts.length ? ` — ${parts.join(", ")}` : ""}`
        }
        case "thread_inheritance": {
          const parts = [company, msgType, stage ? `→${stage}` : null].filter(Boolean)
          return `Known thread${parts.length ? ` — ${parts.join(", ")}` : ""}`
        }
        case "llm_rejected":
          return summary
            ? `Not recruiting — "${summary}"${result.routerReason ? ` (routed via ${result.routerReason})` : ""}`
            : `Not a recruiting email${result.routerReason ? ` (routed via ${result.routerReason})` : ""}`
        case "no_signal":
          return `No recruiting keywords${result.routerReason ? ` (router score: ${result.routerReason})` : ""}`
        case "hard_junk":
          return "Junk/transactional — order, receipt, auth code, or blocked sender"
        case "dismissed":
          return "Thread was previously dismissed by you"
        case "budget_exceeded":
          return `LLM budget (${MAX_MINI_CALLS} calls/sync) exhausted`
        default:
          return result.action
      }
    }

    const HIGH_SIGNAL_TYPES = new Set([
      "scheduling", "interview_invite", "interview_followup", "assessment", "rejection", "offer",
    ])
    type PrepJob = {
      pipelineId: string; subject: string; snippet: string
      fromEmail: string; fromName: string; bodyExcerpt: string; receivedAt: string
    }
    const prepJobs: PrepJob[] = []
    const syncStart = Date.now()

    for (const { id: msgId, threadId } of toFetch) {
      // Hard deadline so Vercel never hits 120s
      if (Date.now() - syncStart > SYNC_DEADLINE_MS) {
        console.log(`[SYNC] ${SYNC_DEADLINE_MS / 1000}s deadline reached, stopping early`)
        break
      }

      const full = fetched.get(msgId)
      if (!full) continue

      const headers = full.payload?.headers ?? []
      const subject = headers.find((h: any) => h.name === "Subject")?.value || "(no subject)"
      const fromHeader = headers.find((h: any) => h.name === "From")?.value || ""
      const dateHeader = headers.find((h: any) => h.name === "Date")?.value || ""
      const snippet = full.snippet || ""

      const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/)
      const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : fromHeader
      const fromEmail = fromMatch ? fromMatch[2].trim() : fromHeader

      const internalMs = full.internalDate ? Number(full.internalDate) : NaN
      const receivedAt = Number.isFinite(internalMs)
        ? new Date(internalMs).toISOString()
        : new Date(dateHeader || Date.now()).toISOString()

      const { text: bodyPlain, html: bodyHtml } = extractBodyFromPayload(full.payload)
      const bodyText = bodyPlain || (bodyHtml ? stripHtml(bodyHtml) : "")

      if (miniCallCount >= MAX_MINI_CALLS) {
        details.push({ messageId: msgId, subject, from: fromHeader, outcome: "budget_exceeded", reason: `LLM budget (${MAX_MINI_CALLS} calls/sync) exhausted`, company: null })
        stats.skipped++
        continue
      }

      const signal: EmailSignal = {
        userEmail, gmailMessageId: msgId, threadId, subject,
        from: fromHeader, fromName, fromEmail, snippet, bodyText, receivedAt,
      }

      miniCallCount++
      let result
      try {
        result = await processEmailSignal(signal, openai)
      } catch (sigErr: any) {
        console.error(`[SYNC] processEmailSignal threw for ${msgId}:`, sigErr?.message)
        details.push({ messageId: msgId, subject, from: fromHeader, outcome: "error", reason: `Unexpected error — ${sigErr?.message || "unknown"}`, company: null })
        stats.errors++
        continue
      }

      details.push({
        messageId: msgId, subject, from: fromHeader,
        outcome: result.action,
        reason: buildReason(result),
        company: result.companyName ?? null,
      })

      if (!result.accepted) { stats.rejected++; continue }

      stats.detected++
      const pipelineId = result.pipelineId!

      const stageAdvanced = result.llmResult?.stage_delta !== "none"
      const isHighSignalReply =
        !result.isNewPipeline && !!result.llmResult?.message_type &&
        HIGH_SIGNAL_TYPES.has(result.llmResult.message_type)

      if (prepCallCount < MAX_PREP_CALLS && (result.isNewPipeline || stageAdvanced || isHighSignalReply)) {
        prepCallCount++
        prepJobs.push({ pipelineId, subject, snippet, fromEmail, fromName, bodyExcerpt: bodyText.slice(0, 4000), receivedAt })
      }

      if (result.isNewPipeline) stats.inserted++
      else stats.updated++
    }

    // ── PHASE E: Parallel prep generation ────────────────────────────────
    // All prep jobs fire concurrently — N jobs cost max(job_latencies) not sum.
    if (prepJobs.length > 0) {
      console.log(`[SYNC] Firing ${prepJobs.length} prep job(s) in parallel`)
      await Promise.all(prepJobs.map(async (job) => {
        try {
          const { data: pEmails } = await supabase
            .from("emails").select("subject, snippet, from_email, received_at")
            .eq("pipeline_id", job.pipelineId).order("received_at", { ascending: true }).limit(5)
          const threadEmails = (pEmails || [])
            .filter((e: any) => e.received_at !== job.receivedAt)
            .map((e: any) => ({ subject: e.subject || "", snippet: e.snippet || "", from: e.from_email || "", date: e.received_at || "" }))

          const prep = await generateRichPrep({
            subject: job.subject, snippet: job.snippet,
            fromEmail: job.fromEmail, fromName: job.fromName,
            bodyExcerpt: job.bodyExcerpt,
            threadEmails: threadEmails.length > 0 ? threadEmails : undefined,
          })
          if (!prep) return

          const { data: cur } = await supabase
            .from("pipelines").select("stage, prep_json, company, role").eq("id", job.pipelineId).maybeSingle()

          const resolvedStage = resolveStage(getUiStage(prep.stage_bucket), cur?.stage)
          const useNewPrep = prepRichness(prep.prep) >= prepRichness(cur?.prep_json)
          console.log(`[PREP] ${cur?.stage}→${resolvedStage} richness=${prepRichness(prep.prep)} (${useNewPrep ? "update" : "keep"})`)

          const upd: any = {
            stage: resolvedStage, stage_detail: prep.stage_detail,
            last_email_at: job.receivedAt, last_email_subject: job.subject,
            last_email_snippet: job.snippet, last_email_from_name: job.fromName,
            last_email_from_email: job.fromEmail, insights_json: prep.insights,
            updated_at: new Date().toISOString(),
          }
          if ((!cur?.company || cur.company === "Unknown") && prep.company !== "Unknown") upd.company = prep.company
          if ((!cur?.role || cur.role === "Unknown") && prep.role !== "Unknown") upd.role = prep.role
          if (useNewPrep) { upd.prep_json = prep.prep; upd.company_intel_json = prep.prep.companyIntel }

          await supabase.from("pipelines").update(upd).eq("id", job.pipelineId)
          if (prep.predicted_stages?.length > 0) {
            supabase.from("pipelines").update({ predicted_stages: prep.predicted_stages })
              .eq("id", job.pipelineId).then(() => {}, () => {})
          }
        } catch (prepErr: any) {
          console.error("[PREP] Job failed:", prepErr?.message)
        }
      }))
    }

    console.log(`[SYNC] Done. Stats:`, stats)
    console.log(`[SYNC] LLM calls: mini=${miniCallCount} prep=${prepCallCount}`)

    await updateSyncRun(syncRunId, stats, "completed")
    return NextResponse.json({ success: true, stats, details })

  } catch (err: any) {
    console.error("[SYNC] Fatal:", err)
    await updateSyncRun(syncRunId, stats, "failed", err?.message)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: err?.message }, { status: 500 })
  }
}

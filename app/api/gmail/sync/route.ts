import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { google } from "googleapis"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import OpenAI from "openai"
import { processEmailSignal, buildSyncMaps, prepRichnessScore } from "@/lib/guildy/gmailProcessor"
import { extractBodyFromPayload, stripHtml, safeJsonParse } from "@/lib/guildy/normalizers"
import type { EmailSignal, ProcessResult, SyncMaps } from "@/lib/guildy/types"

// Vercel Pro: up to 120s
export const maxDuration = 120

const openaiKey = process.env.OPENAI_API_KEY
const supabase = supabaseAdmin
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null

// Budget: gpt-4o-mini is fast/cheap; gpt-4o (prep) is expensive/slow
const MAX_MINI_CALLS = 60          // classifier calls per sync (was 15)
const MAX_PREP_CALLS = 5           // prep generation calls per sync (was 3)
const SYNC_DEADLINE_MS = 70_000    // hard stop at 70s

// ============================================================
// PREP JOB TYPE
// ============================================================
type PrepJob = {
  pipelineId: string
  signal: EmailSignal
}

// ============================================================
// PREP QUEUE LOGIC
// ============================================================
const HIGH_SIGNAL_TYPES = new Set([
  "scheduling", "interview_invite", "interview_followup", "assessment", "rejection", "offer",
])

function shouldQueuePrep(result: ProcessResult, maps: SyncMaps): boolean {
  if (!result.pipelineId) return false

  const isHighSignal =
    result.isNewPipeline ||
    result.stageAdvanced ||
    HIGH_SIGNAL_TYPES.has(result.llmResult?.message_type || "")

  if (!isHighSignal) return false

  const richness = maps.pipelineRichness.get(result.pipelineId) ?? 0
  return richness < 8  // raised from 3
}

// ============================================================
// RICH PREP GENERATION — gpt-4o, comprehensive interview intel
// IMPORTANT: Prep never writes pipeline stage — only prep_json,
// company_intel_json, insights_json, stage_detail, last_email_*,
// and conditionally company/role if current values are null/Unknown.
// ============================================================
async function generateRichPrep(
  job: PrepJob,
  ctx: { openai: OpenAI; supabase: any }
) {
  const { signal, pipelineId } = job
  const { openai: ai, supabase: db } = ctx

  let threadContext = ""
  try {
    const { data: pEmails } = await db
      .from("emails")
      .select("subject, snippet, from_email, received_at")
      .eq("pipeline_id", pipelineId)
      .order("received_at", { ascending: true })
      .limit(5)

    const threadEmails = (pEmails || [])
      .filter((e: any) => e.received_at !== signal.receivedAt)
      .map((e: any) => ({
        subject: e.subject || "",
        snippet: e.snippet || "",
        from: e.from_email || "",
        date: e.received_at || "",
      }))

    if (threadEmails.length > 0) {
      threadContext = "\n\nPREVIOUS EMAILS IN THREAD (oldest first):\n"
      for (const e of threadEmails) {
        threadContext += `[${e.date}] ${e.from}: "${e.subject}" — ${e.snippet.slice(0, 100)}\n`
      }
      threadContext += "\nNEW EMAIL TO ANALYZE:\n"
    }
  } catch (err: any) {
    console.error("[PREP] Thread email fetch failed:", err.message)
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

  const userPrompt = `${threadContext}From: ${signal.fromName} <${signal.fromEmail}>
Subject: ${signal.subject}
Snippet: ${signal.snippet}

Email body:
${signal.bodyText.slice(0, 4000)}

Analyze this email and return rich interview preparation JSON.`

  try {
    console.log(`[PREP] Calling gpt-4o for: "${signal.subject.slice(0, 40)}"`)
    const res = await ai.chat.completions.create({
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
    if (!parsed) { console.error("[PREP] JSON parse failed"); return }

    const prepData = {
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
    }

    const insightsData = {
      stageReason: parsed.insights?.stageReason || "",
      waitingOn: parsed.insights?.waitingOn || "you",
      nextAction: parsed.insights?.nextAction || "Review and respond",
      urgency: parsed.insights?.urgency || "med",
      responseLikelihood: parsed.insights?.responseLikelihood || "med",
      tone: parsed.insights?.tone || "neutral",
    }

    const { data: cur } = await db
      .from("pipelines")
      .select("stage, prep_json, company, role")
      .eq("id", pipelineId)
      .maybeSingle()

    const newRichness = prepRichnessScore(prepData)
    const curRichness = prepRichnessScore(cur?.prep_json)
    const useNewPrep = newRichness >= curRichness
    console.log(`[PREP] richness=${newRichness} (${useNewPrep ? "update" : "keep"})`)

    // IMPORTANT: Prep NEVER writes pipeline stage.
    // Stage is owned exclusively by the classifier (gmailProcessor.ts).
    const upd: any = {
      stage_detail: parsed.stage_detail || "",
      last_email_at: signal.receivedAt,
      last_email_subject: signal.subject,
      last_email_snippet: signal.snippet,
      last_email_from_name: signal.fromName,
      last_email_from_email: signal.fromEmail,
      insights_json: insightsData,
      updated_at: new Date().toISOString(),
    }

    // Only upgrade company/role if current values are null/Unknown
    if ((!cur?.company || cur.company === "Unknown") && parsed.company && parsed.company !== "Unknown") {
      upd.company = parsed.company
    }
    if ((!cur?.role || cur.role === "Unknown") && parsed.role && parsed.role !== "Unknown") {
      upd.role = parsed.role
    }

    if (useNewPrep) {
      upd.prep_json = prepData
      upd.company_intel_json = prepData.companyIntel
    }

    await db.from("pipelines").update(upd).eq("id", pipelineId)

    if (parsed.predicted_stages?.length > 0) {
      db.from("pipelines")
        .update({ predicted_stages: parsed.predicted_stages })
        .eq("id", pipelineId)
        .then(() => {}, () => {})
    }
  } catch (err: any) {
    console.error("[PREP] Job failed:", err.message)
  }
}

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
  errorMessage?: string,
  extraFields?: Record<string, number>
) {
  if (!syncRunId || !supabase) return
  try {
    await supabase.from("sync_runs").update({
      completed_at: new Date().toISOString(),
      status,
      ...stats,
      ...(extraFields || {}),
      error_message: errorMessage,
    }).eq("id", syncRunId)
  } catch { /* non-fatal */ }
}

// ============================================================
// BUILD REASON — human-readable outcome for UI details panel
// ============================================================
function buildReason(result: ProcessResult): string {
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
    case "already_processed":
      return "Already processed in a previous sync"
    case "previously_rejected":
      return "Previously classified as non-recruiting"
    case "low_confidence_company":
      return `Recruiting email — company name unclear${company ? ` (extracted: "${company}")` : ""}, saved for retroactive linking`
    default:
      return result.action
  }
}

// ============================================================
// MAIN SYNC HANDLER
// ============================================================
export async function POST() {
  console.log("[SYNC] ========== Gmail Sync V3 ==========")

  const stats = {
    scanned: 0, detected: 0, inserted: 0, updated: 0,
    skipped: 0, rejected: 0, errors: 0,
  }
  let syncRunId: string | null = null
  let userEmail = ""
  let miniCallsMade = 0
  let prepCallsMade = 0

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

    // ── Phase A: Preload all maps (single DB round-trip per table) ────────
    const maps = await buildSyncMaps(userEmail, supabase)
    console.log(`[SYNC] Maps loaded: dismissed=${maps.dismissedThreads.size} processed=${maps.processedMessages.size} ghosted=${maps.ghostedMessages.size} threads=${maps.pipelineThreads.size} pipelines=${maps.pipelinesById.size}`)

    // ── Phase B: Determine query window ──────────────────────────────────
    const isFirstSync = maps.processedMessages.size === 0 && maps.ghostedMessages.size === 0
    const MESSAGE_CAP = isFirstSync ? 500 : Infinity

    let afterUnix: number | null = null
    if (!isFirstSync) {
      const { data: lastEmailRows } = await supabase
        .from("emails")
        .select("received_at")
        .eq("user_email", userEmail)
        .order("received_at", { ascending: false })
        .limit(1)
      const lastMs = lastEmailRows?.[0]?.received_at
        ? new Date(lastEmailRows[0].received_at).getTime()
        : null
      afterUnix = lastMs ? Math.floor((lastMs - 21 * 24 * 60 * 60 * 1000) / 1000) : null
    }

    const query = isFirstSync
      ? "newer_than:6m -in:trash -in:chats"
      : afterUnix
      ? `after:${afterUnix} -in:trash -in:chats`
      : "newer_than:6m -in:trash -in:chats"

    console.log(`[SYNC] Gmail query: ${query} (firstSync=${isFirstSync}, cap=${MESSAGE_CAP})`)

    // ── Phase C: Fetch Gmail message list ─────────────────────────────────
    type MsgRef = { id: string; threadId: string }
    let allMessages: MsgRef[] = []
    let pageToken: string | undefined

    try {
      do {
        const page = await gmail.users.messages.list({
          userId: "me", q: query, maxResults: 100, pageToken,
        })
        for (const m of (page.data.messages || [])) {
          if (m.id) allMessages.push({ id: m.id, threadId: m.threadId || "" })
        }
        pageToken = page.data.nextPageToken ?? undefined
      } while (pageToken && allMessages.length < MESSAGE_CAP)
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

    stats.scanned = allMessages.length
    console.log(`[SYNC] ${allMessages.length} messages from Gmail`)

    // ── Phase D: Pre-filter — skip already-known messages ─────────────────
    const toFetch: MsgRef[] = []
    for (const msg of allMessages) {
      if (maps.dismissedThreads.has(msg.threadId)) { stats.skipped++; continue }
      if (maps.processedMessages.has(msg.id)) { stats.skipped++; continue }
      if (maps.ghostedMessages.has(msg.id)) { stats.skipped++; continue }
      toFetch.push(msg)
    }
    console.log(`[SYNC] ${toFetch.length} messages need full fetch (${stats.skipped} pre-filtered)`)

    // ── Phase E: Parallel Gmail body fetch (10 at a time) ─────────────────
    const FETCH_BATCH = 10
    const fetched = new Map<string, any>()
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
    console.log(`[SYNC] Fetched ${fetched.size} full messages`)

    // ── Phase F: Sequential processing (deadline-guarded) ─────────────────
    const prepQueue: PrepJob[] = []
    const syncStart = Date.now()

    for (const { id: msgId, threadId } of toFetch) {
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

      const signal: EmailSignal = {
        userEmail, gmailMessageId: msgId, threadId, subject,
        from: fromHeader, fromName, fromEmail, snippet, bodyText, receivedAt,
      }

      let result: ProcessResult
      try {
        result = await processEmailSignal(signal, {
          miniCallsRemaining: MAX_MINI_CALLS - miniCallsMade,
          maps,
          openai,
          supabase,
        })
      } catch (sigErr: any) {
        console.error(`[SYNC] processEmailSignal threw for ${msgId}:`, sigErr?.message)
        details.push({
          messageId: msgId, subject, from: fromHeader,
          outcome: "error", reason: `Unexpected error — ${sigErr?.message || "unknown"}`, company: null,
        })
        stats.errors++
        continue
      }

      miniCallsMade += result.miniCallsUsed

      details.push({
        messageId: msgId, subject, from: fromHeader,
        outcome: result.action,
        reason: buildReason(result),
        company: result.companyName ?? null,
      })

      if (!result.accepted) {
        stats.rejected++
        continue
      }

      stats.detected++
      if (result.isNewPipeline) stats.inserted++
      else stats.updated++

      // Prep queue — only for high-signal accepted messages
      if (prepCallsMade < MAX_PREP_CALLS && shouldQueuePrep(result, maps)) {
        prepQueue.push({ pipelineId: result.pipelineId!, signal })
        prepCallsMade++
      }
    }

    // ── Phase G: Parallel prep generation ────────────────────────────────
    // Prep NEVER writes pipeline stage — see generateRichPrep for contract
    if (prepQueue.length > 0) {
      console.log(`[SYNC] Firing ${prepQueue.length} prep job(s) in parallel`)
      await Promise.allSettled(
        prepQueue.map((job) => generateRichPrep(job, { openai, supabase }))
      )
    }

    console.log(`[SYNC] Done. Stats:`, stats)
    console.log(`[SYNC] LLM calls: mini=${miniCallsMade} prep=${prepCallsMade}`)

    await updateSyncRun(syncRunId, stats, "completed", undefined, {
      mini_calls_made: miniCallsMade,
      prep_calls_made: prepCallsMade,
    })

    return NextResponse.json({ success: true, stats, details })

  } catch (err: any) {
    console.error("[SYNC] Fatal:", err)
    await updateSyncRun(syncRunId, stats, "failed", err?.message)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: err?.message }, { status: 500 })
  }
}

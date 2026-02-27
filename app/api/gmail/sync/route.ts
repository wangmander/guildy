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
const MAX_MINI_CALLS = 80   // classifier calls per sync
const MAX_PREP_CALLS = 12   // prep generation (gpt-4o) calls per sync

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
      } while (pageToken && messages.length < 200)
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

    // Load all dismissed thread IDs for this user once, check in-memory.
    // This prevents re-creating pipelines the user explicitly deleted,
    // even after the cascade-delete wiped the email records.
    const { data: dismissedRows } = await supabase
      .from("dismissed_threads")
      .select("gmail_thread_id")
      .eq("user_email", userEmail)
    const dismissedThreadSet = new Set<string>(
      (dismissedRows ?? []).map((r: any) => r.gmail_thread_id)
    )
    console.log(`[SYNC] ${dismissedThreadSet.size} dismissed thread(s) loaded`)

    for (const msg of messages) {
      if (!msg.id) continue

      const threadId = msg.threadId || ""

      // ── DISMISSED THREAD CHECK ────────────────────────────
      // Must run before idempotency check — emails are cascade-deleted
      // when a pipeline is removed, so the emails table can't be relied
      // on to block re-creation of dismissed pipelines.
      if (threadId && dismissedThreadSet.has(threadId)) {
        stats.skipped++
        continue
      }

      // ── IDEMPOTENCY CHECK ─────────────────────────────────
      // Skip if already processed AND pipeline has rich prep
      const { data: existingEmail } = await supabase
        .from("emails")
        .select("id, pipeline_id")
        .eq("user_email", userEmail)
        .eq("gmail_message_id", msg.id)
        .maybeSingle()

      if (existingEmail) {
        let needsRefresh = false
        if (existingEmail.pipeline_id) {
          const { data: pl } = await supabase
            .from("pipelines")
            .select("prep_json, stage")
            .eq("id", existingEmail.pipeline_id)
            .maybeSingle()
          // Re-process only if prep is completely missing
          if (!pl?.prep_json || prepRichness(pl.prep_json) < 3) {
            needsRefresh = true
            console.log(`[SYNC] Re-processing ${msg.id} — empty prep`)
          }
        }
        if (!needsRefresh) {
          stats.skipped++
          continue
        }
      }

      // ── FETCH FULL MESSAGE ────────────────────────────────
      let full: any
      try {
        full = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" })
      } catch (err: any) {
        console.error(`[SYNC] Fetch failed for ${msg.id}:`, err?.message)
        stats.errors++
        continue
      }

      const headers = full.data.payload?.headers ?? []
      const subject = headers.find((h: any) => h.name === "Subject")?.value || "(no subject)"
      const fromHeader = headers.find((h: any) => h.name === "From")?.value || ""
      const dateHeader = headers.find((h: any) => h.name === "Date")?.value || ""
      const snippet = full.data.snippet || ""

      const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/)
      const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : fromHeader
      const fromEmail = fromMatch ? fromMatch[2].trim() : fromHeader

      const internalMs = full.data.internalDate ? Number(full.data.internalDate) : NaN
      const receivedAt = Number.isFinite(internalMs)
        ? new Date(internalMs).toISOString()
        : new Date(dateHeader || Date.now()).toISOString()

      const { text: bodyPlain, html: bodyHtml } = extractBodyFromPayload(full.data.payload)
      const bodyText = bodyPlain || (bodyHtml ? stripHtml(bodyHtml) : "")

      // Mini call budget check
      if (miniCallCount >= MAX_MINI_CALLS) {
        console.log(`[SYNC] Mini budget exhausted (${MAX_MINI_CALLS}), skipping`)
        details.push({ messageId: msg.id, subject, from: fromHeader, outcome: "budget_exceeded", reason: "LLM budget exhausted for this sync", company: null })
        stats.skipped++
        continue
      }

      // ── BUILD SIGNAL + PROCESS ────────────────────────────
      const signal: EmailSignal = {
        userEmail,
        gmailMessageId: msg.id,
        threadId,
        subject,
        from: fromHeader,
        fromName,
        fromEmail,
        snippet,
        bodyText,
        receivedAt,
      }

      miniCallCount++
      const result = await processEmailSignal(signal, openai)

      // Record per-email decision for the "show details" panel
      const OUTCOME_LABELS: Record<string, string> = {
        thread_inheritance: "Match — known thread",
        new_recruiting: "Match — new pipeline",
        updated_existing: "Match — pipeline updated",
        hard_junk: "Reject — junk filter",
        no_signal: "Reject — no recruiting signal",
        llm_rejected: "Reject — not a recruiting email",
        dismissed: "Skip — previously dismissed",
        error: "Error",
        budget_exceeded: "Skip — budget exhausted",
      }
      details.push({
        messageId: msg.id,
        subject,
        from: fromHeader,
        outcome: result.action,
        reason: OUTCOME_LABELS[result.action] || result.action,
        company: result.companyName ?? null,
      })

      if (!result.accepted) {
        stats.rejected++
        continue
      }

      stats.detected++
      const pipelineId = result.pipelineId!

      // ── PREP GENERATION DECISION ──────────────────────────
      // Generate rich prep (gpt-4o) when:
      //   • New pipeline (needs initial prep)
      //   • Stage advanced (mini classifier detected explicit delta)
      //   • High-signal reply on existing thread: mini may return stage_delta="none"
      //     for scheduling/invite/assessment emails even when the stage IS advancing.
      //     gpt-4o is more accurate — always let it run for these types so the
      //     pipeline stage doesn't get stuck.
      const stageAdvanced = result.llmResult?.stage_delta !== "none"
      const HIGH_SIGNAL_TYPES = new Set([
        "scheduling", "interview_invite", "interview_followup",
        "assessment", "rejection", "offer",
      ])
      const isHighSignalReply =
        !result.isNewPipeline &&
        !!result.llmResult?.message_type &&
        HIGH_SIGNAL_TYPES.has(result.llmResult.message_type)

      const shouldGeneratePrep =
        prepCallCount < MAX_PREP_CALLS &&
        (result.isNewPipeline || stageAdvanced || isHighSignalReply)

      if (shouldGeneratePrep) {
        // Get thread context from existing pipeline emails
        let threadEmails: Array<{ subject: string; snippet: string; from: string; date: string }> = []
        const { data: pEmails } = await supabase
          .from("emails")
          .select("subject, snippet, from_email, received_at")
          .eq("pipeline_id", pipelineId)
          .order("received_at", { ascending: true })
          .limit(5)

        threadEmails = (pEmails || [])
          .filter((e: any) => e.received_at !== receivedAt) // exclude current
          .map((e: any) => ({
            subject: e.subject || "",
            snippet: e.snippet || "",
            from: e.from_email || "",
            date: e.received_at || "",
          }))

        prepCallCount++
        const prep = await generateRichPrep({
          subject,
          snippet,
          fromEmail,
          fromName,
          bodyExcerpt: bodyText.slice(0, 4000),
          threadEmails: threadEmails.length > 0 ? threadEmails : undefined,
        })

        if (prep) {
          // Get current pipeline for regression check
          const { data: currentPipeline } = await supabase
            .from("pipelines")
            .select("stage, prep_json, company, role")
            .eq("id", pipelineId)
            .maybeSingle()

          const existingStage = currentPipeline?.stage
          const prepStage = getUiStage(prep.stage_bucket)
          const resolvedStage = resolveStage(prepStage, existingStage)

          const existingPrepScore = prepRichness(currentPipeline?.prep_json)
          const newPrepScore = prepRichness(prep.prep)
          const useNewPrep = newPrepScore >= existingPrepScore

          console.log(`[PREP] stage=${existingStage}→${resolvedStage}, richness ${existingPrepScore}→${newPrepScore} (${useNewPrep ? "update" : "keep"})`)

          const updatePayload: any = {
            stage: resolvedStage,
            stage_detail: prep.stage_detail,
            last_email_at: receivedAt,
            last_email_subject: subject,
            last_email_snippet: snippet,
            last_email_from_name: fromName,
            last_email_from_email: fromEmail,
            insights_json: prep.insights,
            updated_at: new Date().toISOString(),
          }

          // Update company/role from prep only if currently "Unknown"
          if ((!currentPipeline?.company || currentPipeline.company === "Unknown") && prep.company !== "Unknown") {
            updatePayload.company = prep.company
          }
          if ((!currentPipeline?.role || currentPipeline.role === "Unknown") && prep.role !== "Unknown") {
            updatePayload.role = prep.role
          }

          if (useNewPrep) {
            updatePayload.prep_json = prep.prep
            updatePayload.company_intel_json = prep.prep.companyIntel
          }

          await supabase.from("pipelines").update(updatePayload).eq("id", pipelineId)

          // Set predicted_stages separately (column may or may not exist)
          if (prep.predicted_stages?.length > 0) {
            supabase.from("pipelines")
              .update({ predicted_stages: prep.predicted_stages })
              .eq("id", pipelineId)
              .then(() => { /* non-blocking */ }, () => { /* column may not exist */ })
          }
        }
      }

      if (result.isNewPipeline) {
        stats.inserted++
      } else {
        stats.updated++
      }
    } // end for messages

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

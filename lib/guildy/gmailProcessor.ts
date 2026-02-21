// ============================================================
// Guildy Gmail Detection V2 — Core Signal Processor
// Thread-first, LLM-classified, append-only, idempotent
// ============================================================

import type {
  EmailSignal,
  RecruitingAnalysisResult,
  ProcessResult,
} from "./types"
import { isHardJunk, getRouterDecision } from "./router"
import { analyzeRecruitingEmailWithLLM } from "./recruitingClassifier"
import { normalize } from "./normalizers"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import OpenAI from "openai"

const supabase = supabaseAdmin

// UI stage mapping from GuildyStage/StageDelta values
const STAGE_DELTA_TO_UI: Record<string, string> = {
  applied: "SCREENING",
  screen: "SCREENING",
  technical: "PRESENTATION",
  onsite: "FULL_LOOP",
  offer: "OFFER_DISCUSSION",
  rejected: "REJECTED",
  withdrawn: "SCREENING",
  other: "SCREENING",
}

// Stage order for regression prevention (higher = more advanced)
const STAGE_ORDER: Record<string, number> = {
  SCREENING: 0,
  HIRING_MANAGER: 1,
  PRESENTATION: 2,
  FULL_LOOP: 3,
  OFFER_DISCUSSION: 4,
  REJECTED: -1,
}

// ============================================================
// GHOST LOG — internal debug only, never shown to users
// ============================================================
async function createGhostLog(params: {
  userEmail: string
  gmailMessageId: string
  threadId?: string
  reason: "hard_junk_reject" | "router_no_match" | "llm_non_recruiting" | "dismissed_thread"
  payload: any
}) {
  if (!supabase) return
  try {
    await supabase.from("ghost_logs").insert({
      user_email: params.userEmail,
      gmail_message_id: params.gmailMessageId,
      thread_id: params.threadId ?? null,
      reason: params.reason,
      payload: params.payload,
    })
  } catch (err) {
    console.error("[GHOST_LOG] Insert failed:", err)
  }
}

// ============================================================
// DETECTION LOG — observable audit trail
// ============================================================
async function createDetectionLog(params: {
  userEmail: string
  gmailMessageId: string
  threadId: string
  gate: "THREAD_INHERITANCE" | "LLM_CLASSIFIED"
  outcome: string
  routerReason?: string | null
  routerScore?: number | null
  llmConfidence?: number | null
  llmModel?: string
  llmResponse?: any
}) {
  if (!supabase) return
  try {
    await supabase.from("email_processing_log").insert({
      user_email: params.userEmail,
      gmail_thread_id: params.threadId,
      gmail_message_id: params.gmailMessageId,
      gate: params.gate,
      outcome: params.outcome,
      router_reason: params.routerReason ?? null,
      router_score: params.routerScore ?? null,
      llm_called: true,
      llm_confidence: params.llmConfidence ?? null,
      llm_model: params.llmModel ?? null,
      llm_response: params.llmResponse ?? null,
      detected: params.outcome.startsWith("accepted"),
      action_taken: params.outcome,
      rejection_reason: params.outcome.startsWith("rejected") ? params.outcome : null,
    })
  } catch (err) {
    console.error("[DETECTION_LOG] Insert failed:", err)
  }
}

// ============================================================
// APPEND MESSAGE TO PIPELINE (idempotent via upsert)
// ============================================================
export async function appendPipelineMessage(
  pipelineId: string,
  signal: EmailSignal,
  llm: RecruitingAnalysisResult
) {
  if (!supabase) return
  await supabase
    .from("emails")
    .upsert(
      {
        user_email: signal.userEmail,
        pipeline_id: pipelineId,
        gmail_id: signal.gmailMessageId,
        gmail_thread_id: signal.threadId,
        gmail_message_id: signal.gmailMessageId,
        subject: signal.subject,
        snippet: signal.snippet,
        from_name: signal.fromName,
        from_email: signal.fromEmail,
        body_text: signal.bodyText,
        received_at: signal.receivedAt,
        is_recruiting: true,
        message_type: llm.message_type,
        llm_confidence: llm.confidence,
        llm_summary: llm.summary,
      },
      { onConflict: "gmail_message_id" }
    )
    .then(({ error }) => {
      if (error) console.error("[APPEND_MSG] Failed:", error.message)
    })
}

// ============================================================
// APPLY STAGE DELTA — regression-safe stage advancement
// ============================================================
export async function applyStageDelta(
  pipelineId: string,
  userEmail: string,
  llm: RecruitingAnalysisResult,
  gmailMessageId: string
) {
  if (!supabase || llm.stage_delta === "none") return

  const newUiStage = STAGE_DELTA_TO_UI[llm.stage_delta]
  if (!newUiStage) return

  // Fetch current stage to check for regression
  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("stage")
    .eq("id", pipelineId)
    .single()

  const currentStage = (pipeline?.stage as string) || "SCREENING"
  const currentOrder = STAGE_ORDER[currentStage] ?? 0
  const newOrder = STAGE_ORDER[newUiStage] ?? 0

  // Only REJECTED can override any stage; otherwise block regression
  if (newUiStage !== "REJECTED" && newOrder < currentOrder) {
    console.log(`[STAGE] Regression blocked: ${currentStage} → ${newUiStage}`)
    return
  }

  if (newUiStage === currentStage) {
    console.log(`[STAGE] No change: already at ${currentStage}`)
    return
  }

  console.log(`[STAGE] ${currentStage} → ${newUiStage} for pipeline ${pipelineId}`)

  await supabase
    .from("pipelines")
    .update({
      stage: newUiStage,
      stage_detail: llm.summary || "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", pipelineId)

  // Append stage history row
  await supabase
    .from("stage_history")
    .insert({
      user_email: userEmail,
      pipeline_id: pipelineId,
      from_stage: currentStage,
      to_stage: newUiStage,
      reason: `LLM inferred from message ${gmailMessageId}`,
      gmail_message_id: gmailMessageId,
      llm_confidence: llm.confidence,
    })
    .then(({ error }) => {
      if (error) console.error("[STAGE_HISTORY] Failed:", error.message)
    })
}

// ============================================================
// FIND OR CREATE PIPELINE
// Priority: thread ID → company name exact → company name fuzzy → create new
// ============================================================
export async function findOrCreatePipeline(
  signal: EmailSignal,
  llm: RecruitingAnalysisResult
): Promise<{ id: string; isNew: boolean } | null> {
  if (!supabase) return null

  const companyName = llm.company_name || "Unknown"
  const companyNorm = normalize(companyName)

  // Load all user pipelines once for matching
  const { data: allPipelines } = await supabase
    .from("pipelines")
    .select("id, company, gmail_thread_id")
    .eq("user_email", signal.userEmail)

  // 1) Exact thread ID match
  if (signal.threadId) {
    const byThread = (allPipelines || []).find(
      (p: any) => p.gmail_thread_id === signal.threadId
    )
    if (byThread) return { id: byThread.id, isNew: false }
  }

  // 2) Exact company name match
  if (companyNorm && companyNorm !== "unknown") {
    const exact = (allPipelines || []).find(
      (p: any) => normalize(p.company) === companyNorm
    )
    if (exact) {
      // Attach thread ID if this pipeline doesn't have one yet
      if (!exact.gmail_thread_id && signal.threadId) {
        await supabase
          .from("pipelines")
          .update({ gmail_thread_id: signal.threadId, updated_at: new Date().toISOString() })
          .eq("id", exact.id)
      }
      return { id: exact.id, isNew: false }
    }

    // 3) Fuzzy substring company match
    const fuzzy = (allPipelines || []).find((p: any) => {
      const pn = normalize(p.company || "")
      return pn.length >= 3 && (pn.includes(companyNorm) || companyNorm.includes(pn))
    })
    if (fuzzy) {
      if (!fuzzy.gmail_thread_id && signal.threadId) {
        await supabase
          .from("pipelines")
          .update({ gmail_thread_id: signal.threadId, updated_at: new Date().toISOString() })
          .eq("id", fuzzy.id)
      }
      console.log(`[PIPELINE] Fuzzy match: "${companyName}" ≈ "${fuzzy.company}"`)
      return { id: fuzzy.id, isNew: false }
    }
  }

  // 4) Create new pipeline
  const uiStage =
    llm.stage_delta !== "none"
      ? STAGE_DELTA_TO_UI[llm.stage_delta] ?? "SCREENING"
      : STAGE_DELTA_TO_UI[llm.current_stage] ?? "SCREENING"

  const { data: newP, error } = await supabase
    .from("pipelines")
    .insert({
      user_email: signal.userEmail,
      company: companyName,
      role: llm.job_title ?? "Unknown",
      stage: uiStage,
      stage_detail: llm.summary || "",
      status: "WAITING",
      gmail_thread_id: signal.threadId || null,
      last_email_at: signal.receivedAt,
      last_email_subject: signal.subject,
      last_email_snippet: signal.snippet,
      last_email_from_email: signal.fromEmail,
      last_email_from_name: signal.fromName,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error || !newP) {
    console.error("[PIPELINE] Create failed:", error?.message)
    return null
  }

  console.log(`[PIPELINE] Created: "${companyName}" (${uiStage}) id=${newP.id}`)
  return { id: newP.id, isNew: true }
}

// ============================================================
// UPDATE PIPELINE LAST-EMAIL METADATA
// ============================================================
async function touchPipelineLastEmail(pipelineId: string, signal: EmailSignal) {
  if (!supabase) return
  await supabase
    .from("pipelines")
    .update({
      last_email_at: signal.receivedAt,
      last_email_subject: signal.subject,
      last_email_snippet: signal.snippet,
      last_email_from_email: signal.fromEmail,
      last_email_from_name: signal.fromName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pipelineId)
}

// ============================================================
// MAIN SIGNAL PROCESSOR
// Returns ProcessResult telling the caller whether to run
// expensive prep generation (gpt-4o).
// ============================================================
export async function processEmailSignal(
  signal: EmailSignal,
  openai: OpenAI
): Promise<ProcessResult> {
  const rejected = (
    action: ProcessResult["action"],
    llmResult: RecruitingAnalysisResult | null = null
  ): ProcessResult => ({
    accepted: false,
    pipelineId: null,
    isNewPipeline: false,
    action,
    llmResult,
    companyName: null,
    jobTitle: null,
  })

  if (!supabase) return rejected("error")

  // ─── PRE-CHECK: DISMISSED THREAD ───────────────────────────
  // If the user explicitly deleted this pipeline conversation,
  // never re-process it. A NEW thread from the same company has a
  // different threadId and will pass through normally.
  if (signal.threadId) {
    const { data: dismissed } = await supabase
      .from("dismissed_threads")
      .select("id")
      .eq("user_email", signal.userEmail)
      .eq("gmail_thread_id", signal.threadId)
      .maybeSingle()

    if (dismissed) {
      await createGhostLog({
        userEmail: signal.userEmail,
        gmailMessageId: signal.gmailMessageId,
        threadId: signal.threadId,
        reason: "dismissed_thread",
        payload: { subject: signal.subject, from: signal.from },
      })
      return rejected("dismissed")
    }
  }

  // ─── 0) THREAD INHERITANCE ──────────────────────────────────
  // Golden rule: once a thread is known recruiting, never stop listening.
  if (signal.threadId) {
    const { data: existingPipeline } = await supabase
      .from("pipelines")
      .select("id, company, role, stage, gmail_thread_id")
      .eq("user_email", signal.userEmail)
      .eq("gmail_thread_id", signal.threadId)
      .maybeSingle()

    if (existingPipeline) {
      console.log(`[INHERIT] thread=${signal.threadId} → pipeline=${existingPipeline.id}`)

      const llm = await analyzeRecruitingEmailWithLLM(
        signal,
        {
          knownThread: true,
          existingCompanyName: existingPipeline.company,
          existingJobTitle: existingPipeline.role,
        },
        openai
      )

      if (llm) {
        // Always append — never stop listening
        await appendPipelineMessage(existingPipeline.id, signal, llm)

        if (llm.is_recruiting_thread_related && llm.stage_delta !== "none") {
          await applyStageDelta(existingPipeline.id, signal.userEmail, llm, signal.gmailMessageId)
        }
      }

      await touchPipelineLastEmail(existingPipeline.id, signal)

      await createDetectionLog({
        userEmail: signal.userEmail,
        gmailMessageId: signal.gmailMessageId,
        threadId: signal.threadId,
        gate: "THREAD_INHERITANCE",
        outcome: "accepted_known_thread",
        llmConfidence: llm?.confidence ?? null,
        llmModel: "gpt-4o-mini",
        llmResponse: llm,
      })

      return {
        accepted: true,
        pipelineId: existingPipeline.id,
        isNewPipeline: false,
        action: "thread_inheritance",
        llmResult: llm,
        companyName: existingPipeline.company,
        jobTitle: existingPipeline.role,
      }
    }
  }

  // ─── 1) HARD JUNK SIEVE ────────────────────────────────────
  if (isHardJunk(signal)) {
    console.log(`[JUNK] "${signal.subject.slice(0, 50)}"`)
    await createGhostLog({
      userEmail: signal.userEmail,
      gmailMessageId: signal.gmailMessageId,
      threadId: signal.threadId,
      reason: "hard_junk_reject",
      payload: { subject: signal.subject, from: signal.from, snippet: signal.snippet },
    })
    return rejected("hard_junk")
  }

  // ─── 2) WARM-LEAD ROUTER ───────────────────────────────────
  const router = getRouterDecision(signal)

  if (!router.routeToLLM) {
    console.log(`[ROUTER] No signal (score=${router.score}): "${signal.subject.slice(0, 50)}"`)
    await createGhostLog({
      userEmail: signal.userEmail,
      gmailMessageId: signal.gmailMessageId,
      threadId: signal.threadId,
      reason: "router_no_match",
      payload: { subject: signal.subject, from: signal.from, router },
    })
    return rejected("no_signal")
  }

  console.log(`[ROUTER] LLM ← reason=${router.reason} score=${router.score}: "${signal.subject.slice(0, 50)}"`)

  // ─── 3) LLM CLASSIFICATION ─────────────────────────────────
  const llm = await analyzeRecruitingEmailWithLLM(
    signal,
    { knownThread: false },
    openai
  )

  if (!llm || !llm.is_recruiting_thread_related) {
    console.log(`[LLM] Non-recruiting: "${signal.subject.slice(0, 50)}"`)
    await createGhostLog({
      userEmail: signal.userEmail,
      gmailMessageId: signal.gmailMessageId,
      threadId: signal.threadId,
      reason: "llm_non_recruiting",
      payload: { subject: signal.subject, from: signal.from, router, llm },
    })
    await createDetectionLog({
      userEmail: signal.userEmail,
      gmailMessageId: signal.gmailMessageId,
      threadId: signal.threadId || "",
      gate: "LLM_CLASSIFIED",
      outcome: "rejected_non_recruiting",
      routerReason: router.reason,
      routerScore: router.score,
      llmConfidence: llm?.confidence ?? null,
      llmModel: "gpt-4o-mini",
      llmResponse: llm,
    })
    return rejected("llm_rejected", llm)
  }

  // ─── 4) RECRUITING — CREATE/ATTACH PIPELINE ────────────────
  // No advances_pipeline gate. is_recruiting_thread_related=true is enough.
  console.log(`[LLM] Recruiting! company="${llm.company_name}" stage=${llm.current_stage} delta=${llm.stage_delta}`)

  const pipelineResult = await findOrCreatePipeline(signal, llm)

  if (!pipelineResult) {
    console.error("[PIPELINE] Could not create/find pipeline")
    return rejected("error", llm)
  }

  await appendPipelineMessage(pipelineResult.id, signal, llm)

  if (llm.stage_delta !== "none") {
    await applyStageDelta(pipelineResult.id, signal.userEmail, llm, signal.gmailMessageId)
  }

  await touchPipelineLastEmail(pipelineResult.id, signal)

  await createDetectionLog({
    userEmail: signal.userEmail,
    gmailMessageId: signal.gmailMessageId,
    threadId: signal.threadId || "",
    gate: "LLM_CLASSIFIED",
    outcome: "accepted_new_or_attached",
    routerReason: router.reason,
    routerScore: router.score,
    llmConfidence: llm.confidence,
    llmModel: "gpt-4o-mini",
    llmResponse: llm,
  })

  return {
    accepted: true,
    pipelineId: pipelineResult.id,
    isNewPipeline: pipelineResult.isNew,
    action: pipelineResult.isNew ? "new_recruiting" : "updated_existing",
    llmResult: llm,
    companyName: llm.company_name,
    jobTitle: llm.job_title,
  }
}

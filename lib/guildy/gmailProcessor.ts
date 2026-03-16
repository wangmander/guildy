// ============================================================
// Guildy Gmail Detection V3 — Core Signal Processor
// Thread-first, LLM-classified, append-only, idempotent
// Uses preloaded SyncMaps — no per-message DB lookups for thread/company matching
// ============================================================

import type {
  EmailSignal,
  RecruitingAnalysisResult,
  ProcessResult,
  SyncMaps,
  PipelineRef,
} from "./types"
import { getRouterDecision, isHardJunk, isBlockedSender } from "./router"
import { analyzeRecruitingEmailWithLLM } from "./recruitingClassifier"
import { companiesMatch, normalizeCompany, containsWholePhrase, normalize } from "./normalizers"
import OpenAI from "openai"

// ============================================================
// STAGE MAPPING — single source of truth (V3)
// Delete duplicates from sync/route.ts
// ============================================================
export const STAGE_DELTA_TO_UI: Record<string, string> = {
  applied:   "SCREENING",
  screen:    "SCREENING",
  hm_screen: "HIRING_MANAGER",
  technical: "PRESENTATION",
  onsite:    "FULL_LOOP",
  offer:     "OFFER_DISCUSSION",
  rejected:  "REJECTED",
  withdrawn: "SCREENING",
  other:     "SCREENING",
}

export const STAGE_ORDER: Record<string, number> = {
  SCREENING: 0,
  HIRING_MANAGER: 1,
  PRESENTATION: 2,
  FULL_LOOP: 3,
  OFFER_DISCUSSION: 4,
  REJECTED: -1,
}

// ============================================================
// PREP RICHNESS SCORE
// Used in buildSyncMaps and in sync route for useNewPrep decision
// ============================================================
export function prepRichnessScore(p: any): number {
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
// BUILD SYNC MAPS — called once per sync in Phase A
// ============================================================
export async function buildSyncMaps(userEmail: string, supabase: any): Promise<SyncMaps> {
  // 1. Dismissed threads
  const { data: dismissed } = await supabase
    .from("dismissed_threads")
    .select("gmail_thread_id")
    .eq("user_email", userEmail)
  const dismissedThreads = new Set<string>((dismissed || []).map((d: any) => d.gmail_thread_id as string))

  // 2. Processed messages (positive decisions — email row exists)
  const { data: emails } = await supabase
    .from("emails")
    .select("gmail_message_id, pipeline_id")
    .eq("user_email", userEmail)
  const processedMessages = new Map<string, string | null>(
    (emails || []).map((e: any) => [e.gmail_message_id as string, (e.pipeline_id ?? null) as string | null])
  )

  // 3. Ghosted messages (negative decisions — ghost_log row exists)
  const { data: ghosts } = await supabase
    .from("ghost_logs")
    .select("gmail_message_id")
    .eq("user_email", userEmail)
  const ghostedMessages = new Set<string>((ghosts || []).map((g: any) => g.gmail_message_id as string))

  // 4. Pipeline threads
  const { data: threads } = await supabase
    .from("pipeline_threads")
    .select("gmail_thread_id, pipeline_id")
    .eq("user_email", userEmail)
  const pipelineThreads = new Map<string, string>(
    (threads || []).map((t: any) => [t.gmail_thread_id as string, t.pipeline_id as string])
  )

  // 5. All pipelines
  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("id, company, role, stage, prep_json")
    .eq("user_email", userEmail)

  const pipelinesById = new Map<string, PipelineRef>()
  const pipelinesByCompany = new Map<string, PipelineRef[]>()
  const pipelineRichness = new Map<string, number>()

  for (const p of (pipelines || [])) {
    const ref: PipelineRef = { id: p.id, company: p.company, role: p.role, stage: p.stage }
    pipelinesById.set(p.id, ref)

    if (p.company) {
      const norm = normalizeCompany(p.company)
      if (norm && norm !== "unknown") {
        const list = pipelinesByCompany.get(norm) || []
        list.push(ref)
        pipelinesByCompany.set(norm, list)
      }
    }

    if (p.prep_json) {
      pipelineRichness.set(p.id, prepRichnessScore(p.prep_json))
    }
  }

  return {
    dismissedThreads,
    processedMessages,
    ghostedMessages,
    pipelineThreads,
    pipelinesByCompany,
    pipelinesById,
    pipelineRichness,
  }
}

// ============================================================
// GHOST LOG — internal debug only, never shown to users
// ============================================================
async function ghostLog(
  signal: EmailSignal,
  reason: string,
  supabase: any,
  payload?: any
) {
  try {
    await supabase.from("ghost_logs").insert({
      user_email: signal.userEmail,
      gmail_message_id: signal.gmailMessageId,
      thread_id: signal.threadId ?? null,
      reason,
      payload: payload ?? { subject: signal.subject, from: signal.from },
    })
  } catch (err) {
    console.error("[GHOST_LOG] Insert failed:", err)
  }
}

// ============================================================
// APPEND PIPELINE MESSAGE — idempotent via upsert
// NOTE: Does NOT write gmail_id — legacy column, deprecated
// ============================================================
async function appendPipelineMessage(
  signal: EmailSignal,
  pipelineId: string,
  supabase: any,
  llmResult?: RecruitingAnalysisResult
) {
  const { error } = await supabase
    .from("emails")
    .upsert(
      {
        pipeline_id: pipelineId,
        user_email: signal.userEmail,
        gmail_message_id: signal.gmailMessageId,
        gmail_thread_id: signal.threadId,
        subject: signal.subject,
        snippet: signal.snippet,
        from_name: signal.fromName,
        from_email: signal.fromEmail,
        body_text: signal.bodyText,
        received_at: signal.receivedAt,
        is_recruiting: true,
        message_type: llmResult?.message_type ?? null,
        llm_confidence: llmResult?.confidence ?? null,
        llm_summary: llmResult?.summary ?? null,
      },
      { onConflict: "gmail_message_id" }
    )
  if (error) console.error("[APPEND_MSG] Failed:", error.message)
}

// ============================================================
// APPEND ORPHAN EMAIL — persists recruiting email with pipeline_id=null
// Enables retroactive linking when a future email on the same thread
// provides a real company name
// ============================================================
async function appendOrphanEmail(
  signal: EmailSignal,
  supabase: any,
  llmResult: RecruitingAnalysisResult
) {
  const { error } = await supabase
    .from("emails")
    .upsert(
      {
        pipeline_id: null,
        user_email: signal.userEmail,
        gmail_message_id: signal.gmailMessageId,
        gmail_thread_id: signal.threadId,
        subject: signal.subject,
        snippet: signal.snippet,
        from_name: signal.fromName,
        from_email: signal.fromEmail,
        body_text: signal.bodyText,
        received_at: signal.receivedAt,
        is_recruiting: true,
        message_type: llmResult.message_type,
        llm_confidence: llmResult.confidence,
        llm_summary: llmResult.summary,
      },
      { onConflict: "gmail_message_id" }
    )
  if (error) console.error("[ORPHAN_EMAIL] Failed:", error.message)
}

// ============================================================
// LINK THREAD — associate Gmail thread with pipeline in pipeline_threads
// ============================================================
async function linkThread(
  userEmail: string,
  threadId: string,
  pipelineId: string,
  supabase: any
) {
  const { error } = await supabase
    .from("pipeline_threads")
    .upsert(
      { user_email: userEmail, gmail_thread_id: threadId, pipeline_id: pipelineId },
      { onConflict: "user_email,gmail_thread_id" }
    )
  if (error) console.error("[LINK_THREAD] Failed:", error.message)
}

// ============================================================
// TOUCH PIPELINE LAST-EMAIL METADATA
// ============================================================
async function touchPipelineLastEmail(pipelineId: string, signal: EmailSignal, supabase: any) {
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
// APPLY STAGE DELTA — regression-safe, returns whether stage advanced
// ============================================================
async function applyStageDelta(
  pipelineId: string,
  stageDelta: string,
  summary: string,
  supabase: any
): Promise<boolean> {
  const newUiStage = STAGE_DELTA_TO_UI[stageDelta]
  if (!newUiStage) return false

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("stage")
    .eq("id", pipelineId)
    .single()

  const currentStage = (pipeline?.stage as string) || "SCREENING"
  const currentOrder = STAGE_ORDER[currentStage] ?? 0
  const newOrder = STAGE_ORDER[newUiStage] ?? 0

  // Block regression unless moving to REJECTED
  if (newUiStage !== "REJECTED" && newOrder < currentOrder) {
    console.log(`[STAGE] Regression blocked: ${currentStage} → ${newUiStage}`)
    return false
  }

  if (newUiStage === currentStage) return false

  console.log(`[STAGE] ${currentStage} → ${newUiStage} for pipeline ${pipelineId}`)

  await supabase
    .from("pipelines")
    .update({
      stage: newUiStage,
      stage_detail: summary || "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", pipelineId)

  await supabase
    .from("stage_history")
    .insert({
      pipeline_id: pipelineId,
      from_stage: currentStage,
      to_stage: newUiStage,
      reason: summary || "Stage advanced by V3 processor",
    })
    .then(({ error }: any) => {
      if (error) console.error("[STAGE_HISTORY] Failed:", error.message)
    })

  return true
}

// ============================================================
// INHERITED THREAD STAGE HEURISTIC
// For emails on known threads — no LLM call.
// Critical: checks sender direction — user's own replies never advance stage.
// ============================================================
function containsAny(text: string, phrases: string[]): boolean {
  return phrases.some((p) => containsWholePhrase(text, p))
}

function inferStageFromSubject(
  signal: Pick<EmailSignal, "subject" | "snippet" | "fromEmail" | "userEmail">
): string {
  // User's own emails never advance stage
  if (signal.fromEmail.toLowerCase() === signal.userEmail.toLowerCase()) return "none"

  const text = normalize(`${signal.subject || ""} ${signal.snippet || ""}`)

  if (containsAny(text, [
    "offer letter", "verbal offer", "compensation package",
    "equity package", "congratulations", "pleased to offer",
  ])) return "offer"

  if (containsAny(text, [
    "unfortunately", "not moving forward",
    "decided to move forward with other",
    "regret to inform", "not selected", "position has been filled",
  ])) return "rejected"

  if (containsAny(text, [
    "onsite", "panel interview", "final round",
    "virtual onsite", "full loop", "super day",
  ])) return "onsite"

  if (containsAny(text, [
    "hiring manager", "meet with the manager",
    "manager interview", "meet the team lead",
  ])) return "hm_screen"

  if (containsAny(text, [
    "take home", "technical assessment", "coding challenge",
    "assignment", "technical interview", "system design",
  ])) return "technical"

  if (containsAny(text, [
    "phone screen", "recruiter screen", "screening call",
    "initial call", "intro call",
  ])) return "screen"

  return "none"
}

// ============================================================
// COMPANY QUALITY GUARD
// ============================================================
const GARBAGE_COMPANY_NAMES = new Set([
  "unknown", "n/a", "na", "none", "tbd",
  "hr", "hr team", "hr department",
  "talent", "talent team", "talent acquisition",
  "recruiting", "recruiting team",
  "hiring", "hiring team",
  "people", "people team", "people ops",
  "greenhouse", "lever", "ashby", "workday",
  "goodtime", "hirevue", "icims", "smartrecruiters",
  "jobvite", "taleo",
])

function isGarbageCompany(name: string | null | undefined): boolean {
  if (!name) return true
  const normalized = normalizeCompany(name)
  if (normalized.length < 3) return true
  return GARBAGE_COMPANY_NAMES.has(normalized)
}

// ============================================================
// UPDATE IN-MEMORY MAPS AFTER PIPELINE ATTACH
// Handles new pipelines, existing attaches, AND company upgrades.
// Without handling upgrades, null→"Stripe" stays stale and causes batch duplicates.
// ============================================================
function updateMapsAfterPipelineAttach(
  pipeline: PipelineRef,
  signal: EmailSignal,
  maps: SyncMaps,
  previousCompany?: string | null
) {
  maps.pipelinesById.set(pipeline.id, pipeline)
  maps.pipelineThreads.set(signal.threadId, pipeline.id)
  maps.processedMessages.set(signal.gmailMessageId, pipeline.id)

  const prev = normalizeCompany(previousCompany || "")
  const next = normalizeCompany(pipeline.company || "")

  // Remove from old company bucket if company changed
  if (prev && prev !== "unknown" && prev !== next) {
    const prevList = maps.pipelinesByCompany.get(prev) || []
    maps.pipelinesByCompany.set(prev, prevList.filter((p) => p.id !== pipeline.id))
  }

  // Add to new company bucket
  if (next && next !== "unknown") {
    const nextList = maps.pipelinesByCompany.get(next) || []
    if (!nextList.some((p) => p.id === pipeline.id)) {
      maps.pipelinesByCompany.set(next, [...nextList, pipeline])
    }
  }
}

// ============================================================
// FIND OR CREATE PIPELINE — using preloaded maps (no full-table scan)
// ============================================================
async function findOrCreatePipeline(
  signal: EmailSignal,
  llmResult: RecruitingAnalysisResult,
  opts: { maps: SyncMaps; supabase: any }
): Promise<{ pipeline: PipelineRef; isNew: boolean }> {
  // 1. Thread match via maps
  const threadPipelineId = opts.maps.pipelineThreads.get(signal.threadId)
  if (threadPipelineId) {
    const existing = opts.maps.pipelinesById.get(threadPipelineId)
    if (existing) return { pipeline: existing, isNew: false }
  }

  // 2. Company match via maps (fuzzy companiesMatch)
  if (llmResult.company_name && !isGarbageCompany(llmResult.company_name)) {
    for (const [, pipelineRefs] of opts.maps.pipelinesByCompany) {
      if (pipelineRefs.length > 0 && companiesMatch(llmResult.company_name, pipelineRefs[0].company || "")) {
        return { pipeline: pipelineRefs[0], isNew: false }
      }
    }
  }

  // 3. Create new pipeline
  const stage =
    STAGE_DELTA_TO_UI[llmResult.stage_delta] ??
    STAGE_DELTA_TO_UI[llmResult.current_stage] ??
    "SCREENING"

  const { data, error } = await opts.supabase
    .from("pipelines")
    .insert({
      user_email: signal.userEmail,
      company: llmResult.company_name,
      role: llmResult.job_title,
      stage,
      stage_detail: llmResult.summary,
      last_email_at: signal.receivedAt,
      last_email_subject: signal.subject,
      last_email_snippet: signal.snippet,
      last_email_from_email: signal.fromEmail,
      last_email_from_name: signal.fromName,
    })
    .select("id, company, role, stage")
    .single()

  // Race condition recovery
  if (error?.code === "23505") {
    const { data: existing } = await opts.supabase
      .from("pipelines")
      .select("id, company, role, stage")
      .eq("user_email", signal.userEmail)
      .eq("company", llmResult.company_name)
      .single()
    if (existing) return { pipeline: existing as PipelineRef, isNew: false }
  }

  if (error) throw new Error(error.message)
  console.log(`[PIPELINE] Created: "${llmResult.company_name}" (${stage}) id=${data.id}`)
  return { pipeline: data as PipelineRef, isNew: true }
}

// ============================================================
// MAIN SIGNAL PROCESSOR — V3 six-layer flow
// ============================================================
export async function processEmailSignal(
  signal: EmailSignal,
  opts: {
    miniCallsRemaining: number
    maps: SyncMaps
    openai: OpenAI
    supabase: any
  }
): Promise<ProcessResult> {
  const defaults: ProcessResult = {
    accepted: false,
    pipelineId: null,
    isNewPipeline: false,
    llmResult: null,
    llmCalled: false,
    miniCallsUsed: 0,
    stageAdvanced: false,
    companyName: null,
    jobTitle: null,
    action: "error",
  }

  // ═══════════════════════════════════════════
  // Layer A: Hard Reject (deterministic, no DB writes except ghost_log)
  // ═══════════════════════════════════════════

  // A1: Dismissed thread
  if (opts.maps.dismissedThreads.has(signal.threadId)) {
    await ghostLog(signal, "dismissed_thread", opts.supabase)
    return { ...defaults, action: "dismissed" }
  }

  // A2: Already processed (positive decision — email row already in DB)
  if (opts.maps.processedMessages.has(signal.gmailMessageId)) {
    return {
      ...defaults,
      action: "already_processed",
      pipelineId: opts.maps.processedMessages.get(signal.gmailMessageId) || null,
    }
  }

  // A3: Previously rejected (negative decision — ghost_log exists)
  if (opts.maps.ghostedMessages.has(signal.gmailMessageId)) {
    return { ...defaults, action: "previously_rejected" }
  }

  // A4: Blocked sender
  if (isBlockedSender(signal.from)) {
    await ghostLog(signal, "hard_junk_reject", opts.supabase)
    opts.maps.ghostedMessages.add(signal.gmailMessageId)
    return { ...defaults, action: "hard_junk" }
  }

  // A5: Hard junk phrases (subject + snippet only — never body)
  if (isHardJunk(signal.subject, signal.snippet)) {
    await ghostLog(signal, "hard_junk_reject", opts.supabase)
    opts.maps.ghostedMessages.add(signal.gmailMessageId)
    return { ...defaults, action: "hard_junk" }
  }

  // ═══════════════════════════════════════════
  // Layer B: Thread Inheritance (maps lookup, no LLM)
  // ═══════════════════════════════════════════

  const inheritedPipelineId = opts.maps.pipelineThreads.get(signal.threadId)
  if (inheritedPipelineId) {
    const pipeline = opts.maps.pipelinesById.get(inheritedPipelineId)
    if (pipeline) {
      console.log(`[INHERIT] thread=${signal.threadId} → pipeline=${inheritedPipelineId}`)

      await appendPipelineMessage(signal, inheritedPipelineId, opts.supabase)

      // Lightweight stage heuristic — checks sender direction
      const stageDelta = inferStageFromSubject(signal)
      let stageAdvanced = false
      if (stageDelta !== "none") {
        stageAdvanced = await applyStageDelta(inheritedPipelineId, stageDelta, "", opts.supabase)
      }

      await touchPipelineLastEmail(inheritedPipelineId, signal, opts.supabase)
      opts.maps.processedMessages.set(signal.gmailMessageId, inheritedPipelineId)

      return {
        ...defaults,
        accepted: true,
        action: "thread_inheritance",
        pipelineId: inheritedPipelineId,
        stageAdvanced,
        companyName: pipeline.company,
        jobTitle: pipeline.role,
      }
    }
  }

  // ═══════════════════════════════════════════
  // Layer C: Router (deterministic, subject+snippet only)
  // ═══════════════════════════════════════════

  const routerDecision = getRouterDecision({
    subject: signal.subject,
    snippet: signal.snippet,
    fromEmail: signal.fromEmail,
  })

  if (!routerDecision.routeToLLM) {
    await ghostLog(signal, "router_no_match", opts.supabase, { router: routerDecision })
    opts.maps.ghostedMessages.add(signal.gmailMessageId)
    return { ...defaults, action: "no_signal", routerReason: routerDecision.reason }
  }

  // ═══════════════════════════════════════════
  // Layer D: Classifier (GPT-4o-mini, budget-gated)
  // Budget enforcement lives here — not in the sync outer loop
  // ═══════════════════════════════════════════

  if (opts.miniCallsRemaining <= 0) {
    return { ...defaults, action: "budget_exceeded" }
  }

  let llmResult: RecruitingAnalysisResult
  try {
    llmResult = await analyzeRecruitingEmailWithLLM(signal, { knownThread: false }, opts.openai)
  } catch (err: any) {
    console.error("[CLASSIFIER] Error:", err.message)
    await ghostLog(signal, "classifier_error", opts.supabase, { error: err.message })
    return { ...defaults, action: "error", llmCalled: true, miniCallsUsed: 1, errorDetail: err.message }
  }

  if (!llmResult.is_recruiting_thread_related) {
    console.log(`[LLM] Non-recruiting: "${signal.subject.slice(0, 50)}"`)
    await ghostLog(signal, "llm_non_recruiting", opts.supabase, { llm: llmResult })
    opts.maps.ghostedMessages.add(signal.gmailMessageId)
    return { ...defaults, action: "llm_rejected", llmCalled: true, miniCallsUsed: 1, llmResult }
  }

  console.log(`[LLM] Recruiting! company="${llmResult.company_name}" stage=${llmResult.current_stage} delta=${llmResult.stage_delta}`)

  // ═══════════════════════════════════════════
  // Layer E: Pipeline Attach/Create
  // ═══════════════════════════════════════════

  // E1: Company quality guard
  if (isGarbageCompany(llmResult.company_name)) {
    // Check if thread is already linked in maps (no per-message DB call)
    const existingPipelineId = opts.maps.pipelineThreads.get(signal.threadId)
    if (existingPipelineId) {
      // Thread linked to pipeline but missed Layer B — handle gracefully
      const existingPipeline = opts.maps.pipelinesById.get(existingPipelineId)
      await appendPipelineMessage(signal, existingPipelineId, opts.supabase, llmResult)
      await touchPipelineLastEmail(existingPipelineId, signal, opts.supabase)
      opts.maps.processedMessages.set(signal.gmailMessageId, existingPipelineId)
      return {
        ...defaults,
        accepted: true,
        action: "updated_existing",
        llmCalled: true,
        miniCallsUsed: 1,
        pipelineId: existingPipelineId,
        companyName: existingPipeline?.company ?? null,
        jobTitle: llmResult.job_title,
        llmResult,
        isNewPipeline: false,
      }
    }

    // No pipeline match + garbage company → persist orphan email for retroactive linking
    await appendOrphanEmail(signal, opts.supabase, llmResult)
    await ghostLog(signal, "low_confidence_company", opts.supabase, { llm: llmResult })
    opts.maps.processedMessages.set(signal.gmailMessageId, null)
    return { ...defaults, action: "low_confidence_company", llmCalled: true, miniCallsUsed: 1, llmResult }
  }

  // E2: Find or create pipeline (using preloaded maps, NOT full-table scan)
  let pipeline: PipelineRef
  let isNew: boolean
  try {
    const result = await findOrCreatePipeline(signal, llmResult, opts)
    pipeline = result.pipeline
    isNew = result.isNew
  } catch (err: any) {
    console.error("[PIPELINE] Create/find failed:", err.message)
    return { ...defaults, action: "error", llmCalled: true, miniCallsUsed: 1, errorDetail: err.message }
  }

  // E3: Link thread → pipeline_threads
  await linkThread(signal.userEmail, signal.threadId, pipeline.id, opts.supabase)

  // E4: Mutate in-memory maps immediately (prevents batch duplicates)
  const previousCompany = isNew ? null : opts.maps.pipelinesById.get(pipeline.id)?.company
  updateMapsAfterPipelineAttach(pipeline, signal, opts.maps, previousCompany)

  // ═══ Post-attach operations ═══

  await appendPipelineMessage(signal, pipeline.id, opts.supabase, llmResult)

  let stageAdvanced = false
  if (llmResult.stage_delta !== "none") {
    stageAdvanced = await applyStageDelta(pipeline.id, llmResult.stage_delta, llmResult.summary, opts.supabase)
  }

  await touchPipelineLastEmail(pipeline.id, signal, opts.supabase)

  // Retroactive orphan linking: attach any prior unlinked emails on this thread
  await opts.supabase
    .from("emails")
    .update({ pipeline_id: pipeline.id })
    .eq("gmail_thread_id", signal.threadId)
    .eq("user_email", signal.userEmail)
    .is("pipeline_id", null)

  return {
    accepted: true,
    action: isNew ? "new_recruiting" : "updated_existing",
    llmCalled: true,
    miniCallsUsed: 1,
    pipelineId: pipeline.id,
    isNewPipeline: isNew,
    stageAdvanced,
    companyName: llmResult.company_name,
    jobTitle: llmResult.job_title,
    llmResult,
  }
}

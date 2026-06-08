"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import Anthropic from "@anthropic-ai/sdk"

import {
  trackFirstPrepGenerated,
  trackNegotiationCtaClicked,
  trackNegotiationGenerated,
} from "@/lib/analytics"
import { generatePrep } from "@/lib/ai/generate-prep"
import {
  buildNegotiationContextHash,
  fetchNegotiationContext,
  generateNegotiation,
} from "@/lib/ai/generate-negotiation"
import type {
  NegotiationOfferNormalized,
  NegotiationOutput,
} from "@/lib/ai/negotiation-types"
import {
  DEEP_PREP_MODEL,
  NEGOTIATION_PREP_MODEL,
  QUICK_PREP_MODEL,
} from "@/lib/ai/models"
import { normalizeComp } from "@/lib/compMatrix/normalize"
import { SCORED_KEYS, SOFT_KEYS } from "@/lib/compMatrix/dimensions"
import {
  parseFullLoopRounds,
  type ParserOutput,
} from "@/lib/ai/parse-full-loop-rounds"
import {
  PREP_SESSION_ROLES,
  fullLoopSessionConfigSchema,
  prepTierSchema,
  stageKeyToPrepStage,
  type FullLoopSessionConfig,
  type PrepOutput,
  type PrepStage,
  type PrepTier,
  type PrepSessionRole,
} from "@/lib/ai/prep-types"
import { buildContextHash } from "@/lib/ai/context-hash"
import { checkRateLimit } from "@/lib/ai/rate-limit"
import { generateBoardMap } from "@/lib/jobSourceAdvisor/aiFallback"
import type { BoardRating } from "@/lib/jobSourceAdvisor/boardRatings"
import type { StageKey } from "@/lib/stages"
import { getStripe } from "@/lib/stripe"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}

// Prompt 12 post-checkout verification. Reads the Checkout Session
// directly from Stripe, verifies the current user owns it, and upserts
// user_profiles from that read. This is the primary first-paid-experience
// path — it bypasses the webhook entirely, so a slow webhook can no
// longer block the auto-resume flow on /app. The webhook still handles
// ongoing lifecycle events (cancel, payment failure) and is the source
// of truth for those. Idempotent: safe to call after the webhook has
// already synced.
export type VerifyCheckoutResult =
  | { status: "active"; current_period_end: string | null }
  | { status: "pending" }
  | { status: "unauthorized" }
  | { status: "error"; error: string }

export async function verifyCheckoutAndSyncAction(
  sessionId: string
): Promise<VerifyCheckoutResult> {
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return { status: "error", error: "Missing session_id" }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: "unauthorized" }

  let session
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    })
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Stripe lookup failed",
    }
  }

  // Ownership check. Session-level metadata is the primary signal; we also
  // accept the expanded customer's metadata.supabase_user_id as a fallback
  // for sessions created before the session-metadata change.
  const sessionOwner =
    (session.metadata?.supabase_user_id as string | undefined) ?? null
  const customer =
    session.customer && typeof session.customer !== "string"
      ? session.customer
      : null
  const customerOwner =
    customer && !("deleted" in customer && customer.deleted)
      ? ((customer.metadata?.supabase_user_id as string | undefined) ?? null)
      : null
  if (sessionOwner !== user.id && customerOwner !== user.id) {
    return { status: "unauthorized" }
  }

  const subscription =
    session.subscription && typeof session.subscription !== "string"
      ? session.subscription
      : null
  const isPaid = session.payment_status === "paid"
  const isActiveStatus =
    !!subscription &&
    (subscription.status === "active" || subscription.status === "trialing")
  if (!isPaid || !isActiveStatus) {
    return { status: "pending" }
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null)

  // Stripe SDK 22 narrowed current_period_end out of the Subscription root
  // type (lives on subscription_item now). With apiVersion pinned to
  // 2024-12-18.acacia the runtime response still keeps it at the
  // subscription level — same cast pattern as the webhook handler.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodEndUnix = (subscription as any).current_period_end as
    | number
    | undefined
  const periodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : null

  const update: {
    subscription_status: "active"
    current_period_end: string | null
    stripe_customer_id?: string
  } = {
    subscription_status: "active",
    current_period_end: periodEnd,
  }
  if (customerId) update.stripe_customer_id = customerId

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update(update)
    .eq("id", user.id)
  if (updateError) {
    return { status: "error", error: updateError.message }
  }

  return { status: "active", current_period_end: periodEnd }
}

// Prompt 15: returns the most recently generated prep round per tier
// for a job. PrepOverlay uses this on mount to default selectedRole to
// the round with the latest activity (Deep first for paid users, then
// Quick fallback). A returned entry of `null` means no prep_versions
// row exists for that tier yet; `{ role: null }` means a row exists but
// it's a non-Full-Loop single prep where role doesn't apply.
export async function getLatestPrepRoundsAction(jobId: string): Promise<
  | {
      ok: true
      deep: { role: PrepSessionRole | null } | null
      quick: { role: PrepSessionRole | null } | null
    }
  | { ok: false; error: string }
> {
  if (typeof jobId !== "string" || jobId.length === 0) {
    return { ok: false, error: "Missing jobId" }
  }
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  // Cheap ownership check; RLS would catch unauthorized reads too.
  const { data: jobRow, error: jobError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (jobError) return { ok: false, error: jobError.message }
  if (!jobRow) return { ok: false, error: "Job not found" }

  const [{ data: deepRow }, { data: quickRow }] = await Promise.all([
    supabase
      .from("prep_versions")
      .select("output")
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .eq("tier", "deep")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("prep_versions")
      .select("output")
      .eq("job_id", jobId)
      .eq("user_id", user.id)
      .eq("tier", "quick")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const roleFrom = (
    row: { output: unknown } | null
  ): { role: PrepSessionRole | null } | null => {
    if (!row) return null
    const output = row.output as PrepOutput | null
    const raw = output?.session_role ?? null
    return {
      role:
        raw &&
        (PREP_SESSION_ROLES as readonly string[]).includes(raw as string)
          ? (raw as PrepSessionRole)
          : null,
    }
  }
  return {
    ok: true,
    deep: roleFrom(deepRow),
    quick: roleFrom(quickRow),
  }
}

// Prompt 9 post-checkout resume: re-reads subscription status fresh from
// the DB so the /app client can gate auto-fire on the webhook having
// landed. Used by the backward-compat path for in-flight checkout
// sessions created before verifyCheckoutAndSyncAction shipped (those
// success_urls used subscribed=1 with no session_id).
export async function getSubscriptionStatusAction(): Promise<
  | {
      ok: true
      subscription_status: string
      current_period_end: string | null
    }
  | { ok: false; error: string }
> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }
  const { data, error } = await supabase
    .from("user_profiles")
    .select("subscription_status, current_period_end")
    .eq("id", user.id)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  return {
    ok: true,
    subscription_status:
      (data?.subscription_status as string | null) ?? "free",
    current_period_end:
      (data?.current_period_end as string | null) ?? null,
  }
}

const createJobSchema = z.object({
  company_name: z.string().trim().min(1, "Company is required").max(200),
  role_title: z.string().trim().min(1, "Role title is required").max(200),
  tc: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  source_url: z
    .string()
    .trim()
    .url()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
  jd_text: z
    .string()
    .trim()
    .max(20000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  // Phase 4e prompt 2: optional stage override from per-column +Add Job
  // affordance. When absent, default = "applied" (passive), preserving the
  // pre-Phase-4e behavior.
  stage: z
    .enum(["applied", "screen", "hiring_manager", "final", "offer"])
    .optional(),
})

export type CreateJobInput = z.input<typeof createJobSchema>
export type CreateJobResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function createJobAction(
  input: CreateJobInput
): Promise<CreateJobResult> {
  const parsed = createJobSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Not signed in" }
  }

  // Stage absent or "applied" → passive. Anything else → active and stamp
  // activated_at. Mirrors the demote/promote logic in moveJobStageAction.
  const stage = parsed.data.stage ?? "applied"
  const isPassive = stage === "applied"
  const insertRow: {
    user_id: string
    company_name: string
    role_title: string
    tc: string | null
    source_url: string | null
    jd_text: string | null
    state: "passive" | "active"
    stage: typeof stage
    prep_status: "none"
    activated_at?: string
  } = {
    user_id: user.id,
    company_name: parsed.data.company_name,
    role_title: parsed.data.role_title,
    tc: parsed.data.tc,
    source_url: parsed.data.source_url,
    jd_text: parsed.data.jd_text,
    state: isPassive ? "passive" : "active",
    stage,
    prep_status: "none",
  }
  if (!isPassive) {
    insertRow.activated_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert(insertRow)
    .select("id")
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create job" }
  }

  revalidatePath("/app")
  return { ok: true, id: data.id }
}

const moveJobStageSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  to_stage: z.enum([
    "applied",
    "screen",
    "hiring_manager",
    "final",
    "offer",
  ]),
  source: z.enum(["arrow", "drag"]),
})

export type MoveJobStageInput = z.input<typeof moveJobStageSchema>
export type MoveJobStageResult =
  | { ok: true }
  | { ok: false; error: string }

// Phase 4e: drag/arrow accept any pair of UI columns including drag-into-
// Applied (active → passive demote) and drag-from-Applied (passive → active,
// bypassing the They-Responded activation modal). State flips with stage:
// to_stage="applied" forces state=passive; any other to_stage forces
// state=active and stamps activated_at when the job was previously passive.
export async function moveJobStageAction(
  input: MoveJobStageInput
): Promise<MoveJobStageResult> {
  const parsed = moveJobStageSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Not signed in" }
  }

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, stage, state")
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)
    .single()
  if (fetchError || !job) {
    return { ok: false, error: "Job not found" }
  }

  const fromStage = job.stage as string
  const toStage = parsed.data.to_stage
  const fromState = job.state as "passive" | "active"
  const isPassiveTarget = toStage === "applied"
  const toState: "passive" | "active" = isPassiveTarget ? "passive" : "active"

  if (fromStage === toStage && fromState === toState) {
    return { ok: true }
  }

  type JobUpdate = {
    stage: typeof toStage
    state: "passive" | "active"
    activated_at?: string
  }
  const updateData: JobUpdate = {
    stage: toStage,
    state: toState,
  }
  if (!isPassiveTarget && fromState === "passive") {
    updateData.activated_at = new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update(updateData)
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)
  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  await supabase.from("stage_events").insert({
    job_id: parsed.data.job_id,
    user_id: user.id,
    from_stage: fromStage,
    to_stage: toStage,
    note: parsed.data.source,
  })

  revalidatePath("/app")
  return { ok: true }
}

const activateJobSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  latest_message: z
    .string()
    .trim()
    .max(20000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
})

export type ActivateJobInput = z.input<typeof activateJobSchema>
export type ActivateJobResult =
  | { ok: true }
  | { ok: false; error: string }

export async function activateJobAction(
  input: ActivateJobInput
): Promise<ActivateJobResult> {
  const parsed = activateJobSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Not signed in" }
  }

  const update: {
    state: "active"
    stage: "screen"
    activated_at: string
    latest_message?: string
  } = {
    state: "active",
    stage: "screen",
    activated_at: new Date().toISOString(),
  }
  if (parsed.data.latest_message) {
    update.latest_message = parsed.data.latest_message
  }

  const { error } = await supabase
    .from("jobs")
    .update(update)
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/app")
  return { ok: true }
}

// Context capture ----------------------------------------------------------
//
// Helpers for jobs.* and job_context.* mutations driven by the Inputs widget.
// All actions verify ownership via auth.uid() then revalidate /app so the
// server-fetched props (jd snippet, latest message, interviewer, note) refresh.

async function ownedJobOrError(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  jobId: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }
  const { data, error } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: "Job not found" }
  return { ok: true, userId: user.id }
}

const optionalText = z
  .string()
  .trim()
  .max(20000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null))

// Update jobs.jd_text. Pass null to clear.
const updateJobJdSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  jd_text: z.string().max(20000).nullable(),
})

export type UpdateJobJdInput = z.input<typeof updateJobJdSchema>
export type UpdateJobJdResult = { ok: true } | { ok: false; error: string }

export async function updateJobJdAction(
  input: UpdateJobJdInput
): Promise<UpdateJobJdResult> {
  const parsed = updateJobJdSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }
  const next = parsed.data.jd_text?.trim()
  const value = next && next.length > 0 ? next : null

  const supabase = await createSupabaseServerClient()
  const owned = await ownedJobOrError(supabase, parsed.data.job_id)
  if (!owned.ok) return owned

  const { error } = await supabase
    .from("jobs")
    .update({ jd_text: value })
    .eq("id", parsed.data.job_id)
    .eq("user_id", owned.userId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/app")
  return { ok: true }
}

// Update jobs.latest_message. Pass null to clear.
const updateJobLatestMessageSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  latest_message: z.string().max(20000).nullable(),
})

export type UpdateJobLatestMessageInput = z.input<
  typeof updateJobLatestMessageSchema
>
export type UpdateJobLatestMessageResult =
  | { ok: true }
  | { ok: false; error: string }

export async function updateJobLatestMessageAction(
  input: UpdateJobLatestMessageInput
): Promise<UpdateJobLatestMessageResult> {
  const parsed = updateJobLatestMessageSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }
  const next = parsed.data.latest_message?.trim()
  const value = next && next.length > 0 ? next : null

  const supabase = await createSupabaseServerClient()
  const owned = await ownedJobOrError(supabase, parsed.data.job_id)
  if (!owned.ok) return owned

  const { error } = await supabase
    .from("jobs")
    .update({ latest_message: value })
    .eq("id", parsed.data.job_id)
    .eq("user_id", owned.userId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/app")
  return { ok: true }
}

// Upsert single interviewer row per job (delete-then-insert). At least one of
// name/title/link must be non-empty.
const upsertInterviewerSchema = z
  .object({
    job_id: z.string().uuid("Invalid job id"),
    name: optionalText,
    title: optionalText,
    link: optionalText,
  })
  .refine(
    (data) => !!(data.name || data.title || data.link),
    { message: "Provide at least one of name, title, or link" }
  )

export type UpsertInterviewerInput = z.input<typeof upsertInterviewerSchema>
export type UpsertInterviewerResult =
  | { ok: true }
  | { ok: false; error: string }

export async function upsertInterviewerAction(
  input: UpsertInterviewerInput
): Promise<UpsertInterviewerResult> {
  const parsed = upsertInterviewerSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const owned = await ownedJobOrError(supabase, parsed.data.job_id)
  if (!owned.ok) return owned

  // Wipe any existing interviewer rows for this job, then insert one.
  const { error: deleteError } = await supabase
    .from("job_context")
    .delete()
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", owned.userId)
    .eq("type", "interviewer")
  if (deleteError) return { ok: false, error: deleteError.message }

  const display =
    parsed.data.name ?? parsed.data.title ?? parsed.data.link ?? ""

  const { error: insertError } = await supabase.from("job_context").insert({
    job_id: parsed.data.job_id,
    user_id: owned.userId,
    type: "interviewer",
    content: display,
    metadata: {
      name: parsed.data.name,
      title: parsed.data.title,
      link: parsed.data.link,
    },
  })
  if (insertError) return { ok: false, error: insertError.message }

  revalidatePath("/app")
  return { ok: true }
}

const clearInterviewerSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
})

export type ClearInterviewerInput = z.input<typeof clearInterviewerSchema>
export type ClearInterviewerResult =
  | { ok: true }
  | { ok: false; error: string }

export async function clearInterviewerAction(
  input: ClearInterviewerInput
): Promise<ClearInterviewerResult> {
  const parsed = clearInterviewerSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const owned = await ownedJobOrError(supabase, parsed.data.job_id)
  if (!owned.ok) return owned

  const { error } = await supabase
    .from("job_context")
    .delete()
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", owned.userId)
    .eq("type", "interviewer")
  if (error) return { ok: false, error: error.message }

  revalidatePath("/app")
  return { ok: true }
}

// Single freeform note per job (job_context type='note', delete-then-insert).
const upsertNoteSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  content: z.string().trim().min(1, "Note is required").max(20000),
})

export type UpsertNoteInput = z.input<typeof upsertNoteSchema>
export type UpsertNoteResult = { ok: true } | { ok: false; error: string }

export async function upsertNoteAction(
  input: UpsertNoteInput
): Promise<UpsertNoteResult> {
  const parsed = upsertNoteSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const owned = await ownedJobOrError(supabase, parsed.data.job_id)
  if (!owned.ok) return owned

  const { error: deleteError } = await supabase
    .from("job_context")
    .delete()
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", owned.userId)
    .eq("type", "note")
  if (deleteError) return { ok: false, error: deleteError.message }

  const { error: insertError } = await supabase.from("job_context").insert({
    job_id: parsed.data.job_id,
    user_id: owned.userId,
    type: "note",
    content: parsed.data.content,
  })
  if (insertError) return { ok: false, error: insertError.message }

  revalidatePath("/app")
  return { ok: true }
}

const clearNoteSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
})

export type ClearNoteInput = z.input<typeof clearNoteSchema>
export type ClearNoteResult = { ok: true } | { ok: false; error: string }

export async function clearNoteAction(
  input: ClearNoteInput
): Promise<ClearNoteResult> {
  const parsed = clearNoteSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const owned = await ownedJobOrError(supabase, parsed.data.job_id)
  if (!owned.ok) return owned

  const { error } = await supabase
    .from("job_context")
    .delete()
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", owned.userId)
    .eq("type", "note")
  if (error) return { ok: false, error: error.message }

  revalidatePath("/app")
  return { ok: true }
}

// User profile -------------------------------------------------------------

const updateUserResumeSchema = z.object({
  resume_text: z.string().trim().min(1, "Add some text first").max(50000),
})

export type UpdateUserResumeInput = z.input<typeof updateUserResumeSchema>
export type UpdateUserResumeResult =
  | { ok: true }
  | { ok: false; error: string }

// Edits user_profiles.resume_text from the InputsWidget's Background row.
// Onboarding writes resume_text via its own action; this is the in-app
// inline edit path. Changing resume_text invalidates context_hash for every
// future prep generation across all jobs, so the next Generate click runs
// fresh against Anthropic.
export async function updateUserResumeAction(
  input: UpdateUserResumeInput
): Promise<UpdateUserResumeResult> {
  const parsed = updateUserResumeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  const { error } = await supabase
    .from("user_profiles")
    .update({ resume_text: parsed.data.resume_text })
    .eq("id", user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/app")
  return { ok: true }
}

// Prompt 21: buildContextHash moved to lib/ai/context-hash.ts so the
// unauth-handoff consume path hashes with the byte-identical function.
// Imported at the top of this file; call sites below are unchanged.

// Prep ---------------------------------------------------------------------

const cachedPrepSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  tier: prepTierSchema,
  session_role: z.enum(PREP_SESSION_ROLES).optional(),
})

export type GetCachedPrepInput = z.input<typeof cachedPrepSchema>
export type GetCachedPrepResult =
  | { ok: true; prep: PrepOutput | null }
  | { ok: false; error: string }

export async function getCachedPrepAction(
  input: GetCachedPrepInput
): Promise<GetCachedPrepResult> {
  const parsed = cachedPrepSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  // Phase 4d: session-aware lookup filters prep_versions by context_hash so
  // each session in a Full Loop resolves to its own cached row. Non-session
  // path below is byte-identical to the pre-Phase-4d implementation.
  if (parsed.data.session_role) {
    const sessionRole = parsed.data.session_role

    const [{ data: job, error: jobError }, { data: profile }] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id, stage, jd_text, latest_message, full_loop_session_config"
        )
        .eq("id", parsed.data.job_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("resume_text")
        .eq("id", user.id)
        .maybeSingle(),
    ])
    if (jobError) return { ok: false, error: jobError.message }
    if (!job) return { ok: false, error: "Job not found" }

    const [{ data: interviewerRow }, { data: noteRow }] = await Promise.all([
      supabase
        .from("job_context")
        .select("content, metadata")
        .eq("job_id", parsed.data.job_id)
        .eq("user_id", user.id)
        .eq("type", "interviewer")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("job_context")
        .select("content")
        .eq("job_id", parsed.data.job_id)
        .eq("user_id", user.id)
        .eq("type", "note")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const interviewerMeta =
      (interviewerRow?.metadata as
        | { name?: string | null; title?: string | null; link?: string | null }
        | null) ?? null
    const interviewerName =
      interviewerMeta?.name ?? interviewerRow?.content ?? null
    const interviewerTitle = interviewerMeta?.title ?? null
    const interviewerLink = interviewerMeta?.link ?? null
    const noteText = noteRow?.content ?? null

    const sessionConfig =
      (job.full_loop_session_config as FullLoopSessionConfig | null) ?? null
    const sessionLabel =
      sessionConfig?.[sessionRole]?.label &&
      sessionConfig[sessionRole].label.length > 0
        ? sessionConfig[sessionRole].label
        : null

    const contextHash = buildContextHash({
      tier: parsed.data.tier,
      stage: stageKeyToPrepStage(job.stage as StageKey),
      resume_text: profile?.resume_text ?? null,
      jd_text: job.jd_text,
      latest_message: job.latest_message,
      interviewer_name: interviewerName,
      interviewer_title: interviewerTitle,
      interviewer_link: interviewerLink,
      note_text: noteText,
      session_role: sessionRole,
      session_label: sessionLabel,
    })

    const { data: row, error: prepError } = await supabase
      .from("prep_versions")
      .select("output")
      .eq("job_id", parsed.data.job_id)
      .eq("user_id", user.id)
      .eq("tier", parsed.data.tier)
      .eq("context_hash", contextHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (prepError) return { ok: false, error: prepError.message }

    return { ok: true, prep: (row?.output ?? null) as PrepOutput | null }
  }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (jobError) return { ok: false, error: jobError.message }
  if (!job) return { ok: false, error: "Job not found" }

  const { data: row, error: prepError } = await supabase
    .from("prep_versions")
    .select("output")
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", user.id)
    .eq("tier", parsed.data.tier)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (prepError) return { ok: false, error: prepError.message }

  return { ok: true, prep: (row?.output ?? null) as PrepOutput | null }
}

const generatePrepSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  tier: prepTierSchema,
  session_role: z.enum(PREP_SESSION_ROLES).optional(),
  // Patch 6: explicit cache-bypass flag for the manual Regenerate CTA. The
  // current generatePrepAction path does not short-circuit on cached rows
  // (getPrepStatesAction is the cache reader), so this is a contract for
  // any future pre-check and an audit signal that the call was an explicit
  // user-initiated regenerate. Always-on for StaleBanner and the top-row
  // Regenerate icon; off for first-generate paths (EmptyState, retries).
  force: z.boolean().optional().default(false),
})

export type GeneratePrepInput = z.input<typeof generatePrepSchema>
export type GeneratePrepResult =
  | { ok: true; prep: PrepOutput }
  | { ok: false; error: string; requiresUpgrade?: boolean }

function modelForTier(tier: PrepTier): string {
  return tier === "deep" ? DEEP_PREP_MODEL : QUICK_PREP_MODEL
}

export async function generatePrepAction(
  input: GeneratePrepInput
): Promise<GeneratePrepResult> {
  const parsed = generatePrepSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  // Patch 7: fair-use cap before any data fetch or model call. Cache hits
  // never reach this path — getCachedPrepAction handles those upstream.
  const rateLimit = await checkRateLimit({
    userId: user.id,
    tier: parsed.data.tier,
  })
  if (!rateLimit.allowed) {
    return {
      ok: false,
      error: "You've hit a high-volume threshold, please try again later.",
    }
  }

  // Phase 6b: paywall gate on tier=deep. Quick stays free for everyone.
  // past_due gets a 3-day grace window past current_period_end (Stripe Smart
  // Retries default), then soft-blocks. UI catches `requiresUpgrade` and
  // opens the upgrade modal instead of surfacing the error toast.
  if (parsed.data.tier === "deep") {
    const { data: subProfile } = await supabase
      .from("user_profiles")
      .select("subscription_status, current_period_end")
      .eq("id", user.id)
      .maybeSingle()
    const status = (subProfile?.subscription_status as string | null) ?? "free"
    const periodEnd = subProfile?.current_period_end
      ? new Date(subProfile.current_period_end as string)
      : null
    const inGrace =
      status === "past_due" &&
      periodEnd !== null &&
      periodEnd.getTime() + 3 * 24 * 60 * 60 * 1000 > Date.now()
    const allowed = status === "active" || inGrace
    if (!allowed) {
      return {
        ok: false,
        error: "Upgrade to Deep Prep ($19.99/mo) to generate this.",
        requiresUpgrade: true,
      }
    }
  }

  const [{ data: job, error: jobError }, { data: profile }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, company_name, role_title, stage, jd_text, latest_message, full_loop_session_config"
      )
      .eq("id", parsed.data.job_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("resume_text")
      .eq("id", user.id)
      .maybeSingle(),
  ])
  if (jobError) return { ok: false, error: jobError.message }
  if (!job) return { ok: false, error: "Job not found" }

  const prepStage = stageKeyToPrepStage(job.stage as StageKey)
  const tier = parsed.data.tier

  // Phase 4c-4 patch 4: Deep Prep is no longer gated on jd_text. The UI
  // shows an inline warning when JD is missing and offers "Generate anyway".
  // Resume presence is still the only hard gate (enforced at onboarding).

  const [{ data: interviewerRow }, { data: noteRow }] = await Promise.all([
    supabase
      .from("job_context")
      .select("content, metadata")
      .eq("job_id", parsed.data.job_id)
      .eq("user_id", user.id)
      .eq("type", "interviewer")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("job_context")
      .select("content")
      .eq("job_id", parsed.data.job_id)
      .eq("user_id", user.id)
      .eq("type", "note")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const interviewerMeta =
    (interviewerRow?.metadata as
      | { name?: string | null; title?: string | null; link?: string | null }
      | null) ?? null
  const interviewerName =
    interviewerMeta?.name ?? interviewerRow?.content ?? null
  const interviewerTitle = interviewerMeta?.title ?? null
  const interviewerLink = interviewerMeta?.link ?? null
  const noteText = noteRow?.content ?? null

  // Phase 5: extract the user-edited round label for the active session_role
  // and feed it into both the model prompt and the cache hash. Null when the
  // job has no full_loop_session_config or the role entry is missing.
  const sessionConfig =
    (job.full_loop_session_config as FullLoopSessionConfig | null) ?? null
  const sessionLabel =
    parsed.data.session_role &&
    sessionConfig?.[parsed.data.session_role]?.label &&
    sessionConfig[parsed.data.session_role].label.length > 0
      ? sessionConfig[parsed.data.session_role].label
      : null

  // PHASE 6b: re-add subscription gate here. Free users can call tier="deep"
  // during test mode; production should require active subscription before
  // dispatching the Sonnet call.


  let prep: PrepOutput
  try {
    prep = await generatePrep({
      resume_text: profile?.resume_text ?? null,
      jd_text: job.jd_text,
      latest_message: job.latest_message,
      company_name: job.company_name,
      role_title: job.role_title,
      stage: prepStage,
      interviewer_name: interviewerName,
      interviewer_title: interviewerTitle,
      interviewer_link: interviewerLink,
      note_text: noteText,
      session_role: parsed.data.session_role,
      session_label: sessionLabel,
      tier,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Prep generation failed"
    return { ok: false, error: message }
  }

  // Server-authoritative role tag. The LLM tool schema does not include
  // session_role; we set it here from the action input so it never depends
  // on model behavior. Null for non-Full-Loop calls so JSONB filters can
  // rely on the field's presence.
  const persistedOutput: PrepOutput = {
    ...prep,
    session_role: parsed.data.session_role ?? null,
  }

  const contextHash = buildContextHash({
    tier,
    stage: prepStage,
    resume_text: profile?.resume_text ?? null,
    jd_text: job.jd_text,
    latest_message: job.latest_message,
    interviewer_name: interviewerName,
    interviewer_title: interviewerTitle,
    interviewer_link: interviewerLink,
    note_text: noteText,
    session_role: parsed.data.session_role,
    session_label: sessionLabel,
  })

  const { error: insertError } = await supabase.from("prep_versions").insert({
    job_id: parsed.data.job_id,
    user_id: user.id,
    tier,
    model_used: modelForTier(tier),
    context_hash: contextHash,
    output: persistedOutput,
  })
  if (insertError) return { ok: false, error: insertError.message }

  await supabase
    .from("jobs")
    .update({
      prep_status: tier === "deep" ? "deep_generated" : "quick_generated",
    })
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)

  // Phase 6.5: first_prep_generated fires once per user, the first time a
  // prep_versions row lands. Count check against the row we just inserted
  // — count === 1 means this was the user's very first prep. Failures here
  // are silent inside trackFirstPrepGenerated and never block the response.
  const { count: prepCount } = await supabase
    .from("prep_versions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
  if (prepCount === 1) {
    await trackFirstPrepGenerated(
      user.id,
      parsed.data.job_id,
      tier,
      modelForTier(tier)
    )
  }

  return { ok: true, prep: persistedOutput }
}

// Phase 4d: state inquiry for Full Loop SessionTabs. Returns one entry per
// "session key" (single + the four roles) classifying each as cached / stale
// / empty. UI uses the result to render tab indicators and decide whether
// to read from cache or trigger generation. No rate limit (read-only).
//
// Classification per key:
//   - cached: a row's context_hash matches the hash recomputed from current
//     job inputs + the key's session_role.
//   - stale:  no hash match, but a row exists whose persisted
//     output.session_role matches the key (null for "single", role string
//     otherwise). Returns the most recent such row by created_at.
//   - empty:  neither match.

const getPrepStatesSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  tier: prepTierSchema,
})

export type GetPrepStatesInput = z.input<typeof getPrepStatesSchema>

export type PrepStateEntry = {
  state: "empty" | "cached" | "stale"
  output?: PrepOutput
}

export type PrepStatesMap = {
  single: PrepStateEntry
  hiring_manager: PrepStateEntry
  cross_functional: PrepStateEntry
  skills_portfolio: PrepStateEntry
  bar_raiser: PrepStateEntry
}

export type GetPrepStatesResult =
  | { ok: true; states: PrepStatesMap }
  | { ok: false; error: string }

type StateKey = keyof PrepStatesMap

export async function getPrepStatesAction(
  input: GetPrepStatesInput
): Promise<GetPrepStatesResult> {
  const parsed = getPrepStatesSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  const [{ data: job, error: jobError }, { data: profile }] = await Promise.all(
    [
      supabase
        .from("jobs")
        .select("id, stage, jd_text, latest_message")
        .eq("id", parsed.data.job_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("resume_text")
        .eq("id", user.id)
        .maybeSingle(),
    ]
  )
  if (jobError) return { ok: false, error: jobError.message }
  if (!job) return { ok: false, error: "Job not found" }

  const [{ data: interviewerRow }, { data: noteRow }] = await Promise.all([
    supabase
      .from("job_context")
      .select("content, metadata")
      .eq("job_id", parsed.data.job_id)
      .eq("user_id", user.id)
      .eq("type", "interviewer")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("job_context")
      .select("content")
      .eq("job_id", parsed.data.job_id)
      .eq("user_id", user.id)
      .eq("type", "note")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const interviewerMeta =
    (interviewerRow?.metadata as
      | { name?: string | null; title?: string | null; link?: string | null }
      | null) ?? null
  const interviewerName =
    interviewerMeta?.name ?? interviewerRow?.content ?? null
  const interviewerTitle = interviewerMeta?.title ?? null
  const interviewerLink = interviewerMeta?.link ?? null
  const noteText = noteRow?.content ?? null
  const prepStage = stageKeyToPrepStage(job.stage as StageKey)

  const baseHashInput = {
    tier: parsed.data.tier,
    stage: prepStage,
    resume_text: profile?.resume_text ?? null,
    jd_text: job.jd_text,
    latest_message: job.latest_message,
    interviewer_name: interviewerName,
    interviewer_title: interviewerTitle,
    interviewer_link: interviewerLink,
    note_text: noteText,
  } as const

  const expectedHashes: Record<StateKey, string> = {
    single: buildContextHash(baseHashInput),
    hiring_manager: buildContextHash({
      ...baseHashInput,
      session_role: "hiring_manager",
    }),
    cross_functional: buildContextHash({
      ...baseHashInput,
      session_role: "cross_functional",
    }),
    skills_portfolio: buildContextHash({
      ...baseHashInput,
      session_role: "skills_portfolio",
    }),
    bar_raiser: buildContextHash({
      ...baseHashInput,
      session_role: "bar_raiser",
    }),
  }

  const { data: rows, error: rowsError } = await supabase
    .from("prep_versions")
    .select("output, context_hash, created_at")
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", user.id)
    .eq("tier", parsed.data.tier)
    .order("created_at", { ascending: false })
  if (rowsError) return { ok: false, error: rowsError.message }

  // Pre-extract the session_role coerced to null|string for each row so the
  // stale-fallback comparison handles old rows that lack the field.
  type Row = {
    output: PrepOutput
    context_hash: string | null
    role: PrepSessionRole | null
  }
  const fetched: Row[] = (rows ?? []).map((r) => {
    const output = r.output as PrepOutput
    const role = (output.session_role ?? null) as PrepSessionRole | null
    return {
      output,
      context_hash: r.context_hash as string | null,
      role,
    }
  })

  function classify(key: StateKey): PrepStateEntry {
    const expected = expectedHashes[key]
    const cachedRow = fetched.find((r) => r.context_hash === expected)
    if (cachedRow) return { state: "cached", output: cachedRow.output }

    const targetRole: PrepSessionRole | null =
      key === "single" ? null : key
    const staleRow = fetched.find((r) => r.role === targetRole)
    if (staleRow) return { state: "stale", output: staleRow.output }

    return { state: "empty" }
  }

  return {
    ok: true,
    states: {
      single: classify("single"),
      hiring_manager: classify("hiring_manager"),
      cross_functional: classify("cross_functional"),
      skills_portfolio: classify("skills_portfolio"),
      bar_raiser: classify("bar_raiser"),
    },
  }
}

// Phase 4f: parse the recruiter context for a job and persist the resulting
// FullLoopSessionConfig. One Haiku call per invocation; the action layer
// owns the auth + ownership check and the early-exit on empty inputs. No
// rate limit (cheap and infrequent). Trigger wiring (when this fires
// automatically) lands in prompt 3.

const parseFullLoopRoundsSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
})

export type ParseFullLoopRoundsActionInput = z.input<
  typeof parseFullLoopRoundsSchema
>

export type ParseFullLoopRoundsActionResult =
  | { ok: true; config: FullLoopSessionConfig; raw: ParserOutput }
  | { ok: false; error: string }

export async function parseFullLoopRoundsAction(
  input: ParseFullLoopRoundsActionInput
): Promise<ParseFullLoopRoundsActionResult> {
  const parsed = parseFullLoopRoundsSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  const [{ data: job, error: jobError }, { data: interviewerRow }] =
    await Promise.all([
      supabase
        .from("jobs")
        .select("id, latest_message, jd_text")
        .eq("id", parsed.data.job_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("job_context")
        .select("content, metadata")
        .eq("job_id", parsed.data.job_id)
        .eq("user_id", user.id)
        .eq("type", "interviewer")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
  if (jobError) return { ok: false, error: jobError.message }
  if (!job) return { ok: false, error: "Job not found" }

  const interviewerMeta =
    (interviewerRow?.metadata as
      | { name?: string | null; title?: string | null; link?: string | null }
      | null) ?? null
  const interviewerName =
    interviewerMeta?.name ?? interviewerRow?.content ?? null

  if (!job.latest_message && !job.jd_text && !interviewerName) {
    return {
      ok: false,
      error: "No context to parse. Add a recruiter message or JD first.",
    }
  }

  let result: { config: FullLoopSessionConfig; raw: ParserOutput }
  try {
    result = await parseFullLoopRounds({
      latest_message: job.latest_message,
      jd_text: job.jd_text,
      interviewer_name: interviewerName,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse failed"
    return { ok: false, error: message }
  }

  // eslint-disable-next-line no-console
  console.log("[parseFullLoopRoundsAction]", {
    jobId: parsed.data.job_id,
    overall_confidence: result.raw.overall_confidence,
    detected_rounds: result.raw.detected_rounds.length,
    missing_roles: result.raw.missing_roles.length,
    extra_rounds: result.raw.extra_rounds.length,
  })

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ full_loop_session_config: result.config })
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)
  if (updateError) return { ok: false, error: updateError.message }

  revalidatePath("/app")
  return { ok: true, config: result.config, raw: result.raw }
}

// Phase 4f: persist a user-edited full_loop_session_config from the
// Customize Rounds modal. fullLoopSessionConfigSchema enforces the strict
// 4-role shape so malformed payloads can't slip through. Source-tag merge
// (user vs preserved-prior) is computed client-side in the modal before
// this action is called.

const updateFullLoopSessionConfigSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  config: fullLoopSessionConfigSchema,
})

export type UpdateFullLoopSessionConfigInput = z.input<
  typeof updateFullLoopSessionConfigSchema
>

export type UpdateFullLoopSessionConfigResult =
  | { ok: true }
  | { ok: false; error: string }

export async function updateFullLoopSessionConfigAction(
  input: UpdateFullLoopSessionConfigInput
): Promise<UpdateFullLoopSessionConfigResult> {
  const parsed = updateFullLoopSessionConfigSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (fetchError) return { ok: false, error: fetchError.message }
  if (!job) return { ok: false, error: "Job not found" }

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ full_loop_session_config: parsed.data.config })
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)
  if (updateError) return { ok: false, error: updateError.message }

  revalidatePath("/app")
  return { ok: true }
}

// Job Source Advisor AI fallback. Called client-side from the command rail
// only when a role title does not match a curated seed. Auth-gated so the
// Anthropic call cannot be triggered anonymously. Returns boards or a flag
// to fall back to the generic blend; never throws.
const advisorRoleSchema = z.string().trim().min(1).max(120)

export async function getJobSourceAdvisorAction(
  roleTitle: string
): Promise<{ ok: true; boards: BoardRating[] } | { ok: false }> {
  const parsed = advisorRoleSchema.safeParse(roleTitle)
  if (!parsed.success) return { ok: false }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const boards = await generateBoardMap(parsed.data)
  if (!boards) return { ok: false }
  return { ok: true, boards }
}

// Feature 3: upsert one job_compensation row per job for the TC matrix.
// Free feature, no subscription gate. Auth + ownership checked.
const jobCompSchema = z.object({
  job_id: z.string().uuid(),
  base: z.number().nonnegative().nullable().optional(),
  signing_bonus: z.number().nonnegative().nullable().optional(),
  annual_bonus_pct: z.number().min(0).max(1000).nullable().optional(),
  equity_grant_total: z.number().nonnegative().nullable().optional(),
  vesting_years: z.number().min(0).max(20).nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  benefits_notes: z.string().max(2000).nullable().optional(),
  // Matrix rebuild: per-offer soft ratings { soft_dim_key: 1-10 }. Omitted =
  // leave existing ratings untouched.
  ratings: z.record(z.string(), z.number().int().min(1).max(10)).optional(),
})

export async function upsertJobCompAction(
  input: z.infer<typeof jobCompSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = jobCompSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (fetchError) return { ok: false, error: fetchError.message }
  if (!job) return { ok: false, error: "Job not found" }

  const d = parsed.data
  const payload: Record<string, unknown> = {
    job_id: d.job_id,
    user_id: user.id,
    base: d.base ?? null,
    signing_bonus: d.signing_bonus ?? null,
    annual_bonus_pct: d.annual_bonus_pct ?? null,
    equity_grant_total: d.equity_grant_total ?? null,
    vesting_years: d.vesting_years ?? null,
    location: d.location ?? null,
    benefits_notes: d.benefits_notes ?? null,
  }
  // Only write ratings when provided. Keys validated against the soft-dim
  // registry; the caller merges existing values so disabled dims persist.
  if (d.ratings !== undefined) {
    const clean: Record<string, number> = {}
    for (const [k, v] of Object.entries(d.ratings)) {
      if (SOFT_KEYS.includes(k)) clean[k] = v
    }
    payload.ratings = clean
  }
  const { error: upsertError } = await supabase
    .from("job_compensation")
    .upsert(payload, { onConflict: "job_id" })
  if (upsertError) return { ok: false, error: upsertError.message }

  revalidatePath("/app")
  return { ok: true }
}

// Matrix rebuild: per-user comparison priorities (which soft dims are enabled
// and per-dimension weights). Owner-scoped. Partial updates merge onto the
// existing value.
const compPrioritiesSchema = z.object({
  enabled_soft: z.array(z.string()).optional(),
  weights: z.record(z.string(), z.number().min(0).max(100)).optional(),
})

export async function updateCompPrioritiesAction(
  input: z.infer<typeof compPrioritiesSchema>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = compPrioritiesSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("comp_priorities")
    .eq("id", user.id)
    .maybeSingle()
  const existing =
    (profile?.comp_priorities as {
      enabled_soft?: string[]
      weights?: Record<string, number>
    } | null) ?? null

  const enabledSoft = parsed.data.enabled_soft
    ? parsed.data.enabled_soft.filter((k) => SOFT_KEYS.includes(k))
    : existing?.enabled_soft ?? []

  let weights = existing?.weights ?? {}
  if (parsed.data.weights) {
    const clean: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed.data.weights)) {
      if (SCORED_KEYS.includes(k)) clean[k] = v
    }
    weights = clean
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ comp_priorities: { enabled_soft: enabledSoft, weights } })
    .eq("id", user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/app")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Feature 4: Negotiation Prep
// ---------------------------------------------------------------------------

export type NegotiationRow = {
  id: string
  job_id: string
  model_used: string
  context_hash: string
  inputs: {
    target: string
    leverage: string | null
    offer_raw: unknown
    offer_normalized: NegotiationOfferNormalized
  }
  output: NegotiationOutput & {
    grounded: boolean
    offer_normalized: NegotiationOfferNormalized
  }
  created_at: string
}

type CompRow = {
  base: number | null
  signing_bonus: number | null
  annual_bonus_pct: number | null
  equity_grant_total: number | null
  vesting_years: number | null
  location: string | null
  updated_at?: string | null
}

function compHasData(comp: CompRow | null): boolean {
  if (!comp) return false
  return (
    (comp.base ?? 0) > 0 ||
    (comp.signing_bonus ?? 0) > 0 ||
    (comp.annual_bonus_pct ?? 0) > 0 ||
    (comp.equity_grant_total ?? 0) > 0
  )
}

function snapshotNormalized(comp: CompRow): NegotiationOfferNormalized {
  const n = normalizeComp({
    base: comp.base,
    signing_bonus: comp.signing_bonus,
    annual_bonus_pct: comp.annual_bonus_pct,
    equity_grant_total: comp.equity_grant_total,
    vesting_years: comp.vesting_years,
    location: comp.location,
  })
  return {
    year1_total: n.year1_total,
    steady_state_total: n.steady_state_total,
    col_adjusted_steady: n.col_adjusted_steady,
  }
}

// Shared $19.99 subscription gate, identical rule to the Phase 6b Deep
// paywall (active OR past_due within a 3-day grace window). Returns null when
// allowed, or the requiresUpgrade result when blocked.
// Future Ultra-tier ($49.99) gate would slot in alongside this check; not
// built. Negotiation Prep ships on the existing single $19.99 tier.
async function negotiationSubGate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<{ ok: false; error: string; requiresUpgrade: true } | null> {
  const { data: subProfile } = await supabase
    .from("user_profiles")
    .select("subscription_status, current_period_end")
    .eq("id", userId)
    .maybeSingle()
  const status = (subProfile?.subscription_status as string | null) ?? "free"
  const periodEnd = subProfile?.current_period_end
    ? new Date(subProfile.current_period_end as string)
    : null
  const inGrace =
    status === "past_due" &&
    periodEnd !== null &&
    periodEnd.getTime() + 3 * 24 * 60 * 60 * 1000 > Date.now()
  if (status === "active" || inGrace) return null
  return {
    ok: false,
    error: "Upgrade to Negotiation Prep ($19.99/mo) to generate this.",
    requiresUpgrade: true,
  }
}

const cachedNegotiationSchema = z.object({ job_id: z.string().uuid() })

export type CachedNegotiationResult =
  | { ok: true; row: NegotiationRow | null; stale: boolean }
  | { ok: false; error: string; requiresUpgrade?: boolean }

export async function getCachedNegotiationAction(
  input: z.infer<typeof cachedNegotiationSchema>
): Promise<CachedNegotiationResult> {
  const parsed = cachedNegotiationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input" }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (jobError) return { ok: false, error: jobError.message }
  if (!job) return { ok: false, error: "Job not found" }

  const gate = await negotiationSubGate(supabase, user.id)
  if (gate) return gate

  // Panel-open analytics. Fires only past the gate (subscriber path).
  await trackNegotiationCtaClicked(user.id, parsed.data.job_id)

  const { data: row } = await supabase
    .from("negotiation_preps")
    .select("id, job_id, model_used, context_hash, inputs, output, created_at")
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) return { ok: true, row: null, stale: false }

  // Best-effort staleness: comp edited after this row was generated.
  const { data: comp } = await supabase
    .from("job_compensation")
    .select("updated_at")
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", user.id)
    .maybeSingle()
  const stale =
    !!comp?.updated_at &&
    new Date(comp.updated_at as string).getTime() >
      new Date(row.created_at as string).getTime()

  return { ok: true, row: row as unknown as NegotiationRow, stale }
}

const generateNegotiationSchema = z.object({
  job_id: z.string().uuid(),
  target: z.string().trim().min(1).max(4000),
  leverage: z.string().trim().max(4000).nullable().optional(),
})

export type GenerateNegotiationResult =
  | { ok: true; row: NegotiationRow }
  | { ok: false; error: string; requiresUpgrade?: boolean }

export async function generateNegotiationAction(
  input: z.infer<typeof generateNegotiationSchema>
): Promise<GenerateNegotiationResult> {
  const parsed = generateNegotiationSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in" }

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id, company_name, role_title, stage")
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (jobError) return { ok: false, error: jobError.message }
  if (!job) return { ok: false, error: "Job not found" }

  const gate = await negotiationSubGate(supabase, user.id)
  if (gate) return gate

  if (job.stage !== "offer") {
    return {
      ok: false,
      error: "Negotiation Prep is available once a job reaches the Offer stage.",
    }
  }

  const { data: comp } = await supabase
    .from("job_compensation")
    .select(
      "base, signing_bonus, annual_bonus_pct, equity_grant_total, vesting_years, location, updated_at"
    )
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!compHasData(comp as CompRow | null)) {
    return { ok: false, error: "Add the offer's compensation first." }
  }
  const compRow = comp as CompRow

  const target = parsed.data.target
  const leverage = parsed.data.leverage?.trim() ? parsed.data.leverage.trim() : null

  const contextHash = buildNegotiationContextHash({
    comp: {
      base: compRow.base,
      signing_bonus: compRow.signing_bonus,
      annual_bonus_pct: compRow.annual_bonus_pct,
      equity_grant_total: compRow.equity_grant_total,
      vesting_years: compRow.vesting_years,
      location: compRow.location,
    },
    target,
    leverage,
  })

  // Idempotency: identical inputs return the existing row, no model call.
  const { data: existing } = await supabase
    .from("negotiation_preps")
    .select("id, job_id, model_used, context_hash, inputs, output, created_at")
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", user.id)
    .eq("context_hash", contextHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existing) return { ok: true, row: existing as unknown as NegotiationRow }

  const offerNormalized = snapshotNormalized(compRow)

  let output: NegotiationOutput
  let grounded = false
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    let companyContext: string | null = null
    if (apiKey) {
      const client = new Anthropic({ apiKey })
      companyContext = await fetchNegotiationContext(client, {
        company: job.company_name,
        role: job.role_title,
      })
    }
    grounded = companyContext !== null
    output = await generateNegotiation({
      company: job.company_name,
      role: job.role_title,
      target,
      leverage,
      offer_normalized: offerNormalized,
      companyContext,
    })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Generation failed",
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("negotiation_preps")
    .insert({
      job_id: parsed.data.job_id,
      user_id: user.id,
      model_used: NEGOTIATION_PREP_MODEL,
      context_hash: contextHash,
      inputs: {
        target,
        leverage,
        offer_raw: compRow,
        offer_normalized: offerNormalized,
      },
      output: { ...output, grounded, offer_normalized: offerNormalized },
    })
    .select("id, job_id, model_used, context_hash, inputs, output, created_at")
    .single()
  if (insertError) return { ok: false, error: insertError.message }

  await trackNegotiationGenerated(user.id, parsed.data.job_id)
  revalidatePath("/app")
  return { ok: true, row: inserted as unknown as NegotiationRow }
}

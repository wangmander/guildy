"use server"

import { createHash } from "node:crypto"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { generatePrep } from "@/lib/ai/generate-prep"
import { DEEP_PREP_MODEL, QUICK_PREP_MODEL } from "@/lib/ai/models"
import {
  prepTierSchema,
  stageKeyToPrepStage,
  type PrepOutput,
  type PrepTier,
} from "@/lib/ai/prep-types"
import type { StageKey } from "@/lib/stages"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function signOutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
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

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      company_name: parsed.data.company_name,
      role_title: parsed.data.role_title,
      tc: parsed.data.tc,
      source_url: parsed.data.source_url,
      jd_text: parsed.data.jd_text,
      state: "passive",
      stage: "applied",
      prep_status: "none",
    })
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
  to_stage: z.enum(["screen", "hiring_manager", "final", "offer"]),
  source: z.enum(["arrow", "drag"]),
})

export type MoveJobStageInput = z.input<typeof moveJobStageSchema>
export type MoveJobStageResult =
  | { ok: true }
  | { ok: false; error: string }

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

  if (job.state !== "active") {
    return { ok: false, error: "Job is not active" }
  }

  const fromStage = job.stage as string
  const toStage = parsed.data.to_stage
  if (fromStage === toStage) {
    return { ok: true }
  }

  const { error: updateError } = await supabase
    .from("jobs")
    .update({ stage: toStage })
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

// Prep ---------------------------------------------------------------------

const cachedPrepSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  tier: prepTierSchema,
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
})

export type GeneratePrepInput = z.input<typeof generatePrepSchema>
export type GeneratePrepResult =
  | { ok: true; prep: PrepOutput }
  | { ok: false; error: string }

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

  const [{ data: job, error: jobError }, { data: profile }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, company_name, role_title, stage, jd_text, latest_message")
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
  if (!prepStage) {
    return {
      ok: false,
      error: "Prep is only available once the job is active.",
    }
  }

  const tier = parsed.data.tier

  // Defense in depth: UI disables the Generate Deep button when JD is empty.
  // This guard catches direct action calls (browser devtools, mistaken
  // client code, etc) so Sonnet is never dispatched without JD context.
  if (tier === "deep" && (!job.jd_text || job.jd_text.trim().length === 0)) {
    return { ok: false, error: "Paste the JD to generate Deep Prep" }
  }

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
      tier,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Prep generation failed"
    return { ok: false, error: message }
  }

  // Hash includes every input the model sees so any change invalidates cache
  // naturally on the next generate. Resume in full (truncation only happens
  // in prompt assembly).
  const contextHash = createHash("sha256")
    .update(
      JSON.stringify({
        tier,
        stage: prepStage,
        resume: profile?.resume_text ?? "",
        jd: job.jd_text ?? "",
        msg: job.latest_message ?? "",
        interviewer_name: interviewerName ?? "",
        interviewer_title: interviewerTitle ?? "",
        interviewer_link: interviewerLink ?? "",
        note: noteText ?? "",
      })
    )
    .digest("hex")

  const { error: insertError } = await supabase.from("prep_versions").insert({
    job_id: parsed.data.job_id,
    user_id: user.id,
    tier,
    model_used: modelForTier(tier),
    context_hash: contextHash,
    output: prep,
  })
  if (insertError) return { ok: false, error: insertError.message }

  await supabase
    .from("jobs")
    .update({
      prep_status: tier === "deep" ? "deep_generated" : "quick_generated",
    })
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)

  return { ok: true, prep }
}

"use server"

import { createHash } from "node:crypto"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { generatePrep, QUICK_PREP_MODEL } from "@/lib/ai/generate-prep"
import { stageKeyToPrepStage, type PrepOutput } from "@/lib/ai/prep-types"
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

const setLatestMessageSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  latest_message: z.string().trim().min(1, "Message is required").max(20000),
})

export type SetLatestMessageInput = z.input<typeof setLatestMessageSchema>
export type SetLatestMessageResult =
  | { ok: true }
  | { ok: false; error: string }

export async function setLatestMessageAction(
  input: SetLatestMessageInput
): Promise<SetLatestMessageResult> {
  const parsed = setLatestMessageSchema.safeParse(input)
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
    .from("jobs")
    .update({ latest_message: parsed.data.latest_message })
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/app")
  return { ok: true }
}

const setInterviewerSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
  name: z.string().trim().min(1, "Name is required").max(200),
})

export type SetInterviewerInput = z.input<typeof setInterviewerSchema>
export type SetInterviewerResult =
  | { ok: true }
  | { ok: false; error: string }

export async function setInterviewerAction(
  input: SetInterviewerInput
): Promise<SetInterviewerResult> {
  const parsed = setInterviewerSchema.safeParse(input)
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

  // Verify ownership before mutating.
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (jobError) return { ok: false, error: jobError.message }
  if (!job) return { ok: false, error: "Job not found" }

  // No unique constraint on (user_id, job_id, type) — emulate upsert by
  // wiping any existing interviewer rows for this job, then inserting one.
  const { error: deleteError } = await supabase
    .from("job_context")
    .delete()
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", user.id)
    .eq("type", "interviewer")
  if (deleteError) return { ok: false, error: deleteError.message }

  const { error: insertError } = await supabase.from("job_context").insert({
    job_id: parsed.data.job_id,
    user_id: user.id,
    type: "interviewer",
    content: parsed.data.name,
    metadata: { name: parsed.data.name },
  })
  if (insertError) return { ok: false, error: insertError.message }

  revalidatePath("/app")
  return { ok: true }
}

// Prep ---------------------------------------------------------------------

const jobIdSchema = z.object({
  job_id: z.string().uuid("Invalid job id"),
})

export type GetCachedPrepResult =
  | { ok: true; prep: PrepOutput | null }
  | { ok: false; error: string }

export async function getCachedPrepAction(
  input: z.input<typeof jobIdSchema>
): Promise<GetCachedPrepResult> {
  const parsed = jobIdSchema.safeParse(input)
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
    .eq("tier", "quick")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (prepError) return { ok: false, error: prepError.message }

  return { ok: true, prep: (row?.output ?? null) as PrepOutput | null }
}

export type GeneratePrepResult =
  | { ok: true; prep: PrepOutput }
  | { ok: false; error: string }

export async function generatePrepAction(
  input: z.input<typeof jobIdSchema>
): Promise<GeneratePrepResult> {
  const parsed = jobIdSchema.safeParse(input)
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

  const { data: interviewerRow } = await supabase
    .from("job_context")
    .select("content, metadata")
    .eq("job_id", parsed.data.job_id)
    .eq("user_id", user.id)
    .eq("type", "interviewer")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const interviewerName =
    (interviewerRow?.metadata as { name?: string | null } | null)?.name ??
    interviewerRow?.content ??
    null

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
      tier: "quick",
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Prep generation failed"
    return { ok: false, error: message }
  }

  const contextHash = createHash("sha256")
    .update(
      JSON.stringify({
        stage: prepStage,
        jd: job.jd_text ?? "",
        msg: job.latest_message ?? "",
        interviewer: interviewerName ?? "",
      })
    )
    .digest("hex")

  const { error: insertError } = await supabase.from("prep_versions").insert({
    job_id: parsed.data.job_id,
    user_id: user.id,
    tier: "quick",
    model_used: QUICK_PREP_MODEL,
    context_hash: contextHash,
    output: prep,
  })
  if (insertError) return { ok: false, error: insertError.message }

  await supabase
    .from("jobs")
    .update({ prep_status: "quick_generated" })
    .eq("id", parsed.data.job_id)
    .eq("user_id", user.id)

  return { ok: true, prep }
}

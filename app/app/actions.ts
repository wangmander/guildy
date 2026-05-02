"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

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

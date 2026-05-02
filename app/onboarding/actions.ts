"use server"

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type ActionResult = {
  ok: boolean
  message?: string
  reason?: "auth" | "input" | "db"
}

export async function saveResumeTextAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, reason: "auth", message: "Not signed in." }
  }

  const text = String(formData.get("resume_text") ?? "").trim()
  if (text.length === 0) {
    return { ok: false, reason: "input", message: "Add some text before saving." }
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ resume_text: text })
    .eq("id", user.id)

  if (error) {
    return { ok: false, reason: "db", message: `Save failed: ${error.message}` }
  }

  return { ok: true }
}

export async function completeOnboardingAction() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("resume_text")
    .eq("id", user.id)
    .maybeSingle()

  const hasResume =
    typeof profile?.resume_text === "string" && profile.resume_text.trim().length > 0

  if (!hasResume) {
    return { ok: false as const, message: "Add your resume or background before continuing." }
  }

  redirect("/app")
}

"use server"

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { extractResumeText } from "@/lib/resume/extract"

type ActionResult = {
  ok: boolean
  message?: string
  extractedText?: string
  reason?: "pdf_unreadable" | "auth" | "input" | "storage" | "db"
}

export async function uploadResumeAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, reason: "auth", message: "Not signed in." }
  }

  const file = formData.get("resume")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, reason: "input", message: "No file received." }
  }

  if (file.type !== "application/pdf") {
    return { ok: false, reason: "input", message: "Resume must be a PDF." }
  }

  const buffer = await file.arrayBuffer()
  const extracted = await extractResumeText(buffer)

  if (!extracted.ok) {
    return { ok: false, reason: "pdf_unreadable" }
  }

  const path = `${user.id}/resume-${Date.now()}.pdf`
  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, buffer, { contentType: "application/pdf", upsert: false })

  if (uploadError) {
    return { ok: false, reason: "storage", message: `Upload failed: ${uploadError.message}` }
  }

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({
      resume_url: path,
      resume_text: extracted.text,
    })
    .eq("id", user.id)

  if (updateError) {
    return { ok: false, reason: "db", message: `Save failed: ${updateError.message}` }
  }

  return { ok: true, extractedText: extracted.text }
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

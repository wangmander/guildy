"use server"

import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { extractResumeText } from "@/lib/resume/extract"

const MIN_RESUME_CHARS = 200

type ActionResult = {
  ok: boolean
  message?: string
  extractedText?: string
}

export async function uploadResumeAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: "Not signed in." }
  }

  const file = formData.get("resume")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "No file received." }
  }

  if (file.type !== "application/pdf") {
    return { ok: false, message: "Resume must be a PDF." }
  }

  const buffer = await file.arrayBuffer()
  const extracted = await extractResumeText(buffer)

  if (!extracted.ok) {
    const message =
      extracted.reason === "empty"
        ? "No text found in this PDF. Paste your resume below instead."
        : "We couldn't read this PDF. Paste your resume below instead."
    return { ok: false, message }
  }

  if (extracted.text.length < MIN_RESUME_CHARS) {
    return {
      ok: false,
      extractedText: extracted.text,
      message:
        "Extracted text looks short. Edit or paste a fuller version below before continuing.",
    }
  }

  const path = `${user.id}/resume-${Date.now()}.pdf`
  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(path, buffer, { contentType: "application/pdf", upsert: false })

  if (uploadError) {
    return { ok: false, message: `Upload failed: ${uploadError.message}` }
  }

  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({
      resume_url: path,
      resume_text: extracted.text,
    })
    .eq("id", user.id)

  if (updateError) {
    return { ok: false, message: `Save failed: ${updateError.message}` }
  }

  return { ok: true, extractedText: extracted.text }
}

export async function saveResumeTextAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: "Not signed in." }
  }

  const text = String(formData.get("resume_text") ?? "").trim()
  if (text.length < MIN_RESUME_CHARS) {
    return {
      ok: false,
      message: `Resume needs at least ${MIN_RESUME_CHARS} characters. We use this for every prep generation.`,
    }
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ resume_text: text })
    .eq("id", user.id)

  if (error) {
    return { ok: false, message: `Save failed: ${error.message}` }
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
    typeof profile?.resume_text === "string" && profile.resume_text.trim().length >= MIN_RESUME_CHARS

  if (!hasResume) {
    return { ok: false as const, message: "Add your resume before continuing." }
  }

  redirect("/app")
}

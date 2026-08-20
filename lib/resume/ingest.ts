import type { SupabaseClient } from "@supabase/supabase-js"

import { resumeFailure, type ResumeFailure } from "./errors"
import { normalizeResumeText, parseResumeFile } from "./parse"
import type { ResumeFileExt, ResumeSource } from "@/types"

// The one place a resume becomes a resume.
//
// Four doors lead here: a dropped file, a browsed file, pasted text, and the
// unauth handoff injection. All four end at ingestResume, which means all
// four get the same normalization, the same minimum, the same write, and the
// same rollback. After it returns there is nothing left to tell them apart
// except a `source` string kept for diagnostics.

// 200 characters. Below this it is not a resume, it is a placeholder, and
// generating prep on it produces confident nonsense that the user quite
// reasonably blames on the product rather than on their own two-character
// entry. Three production profiles hold resumes of 1 and 2 characters,
// written by paths that never counted.
export const RESUME_MIN_CHARS = 200

export const RESUME_MAX_CHARS = 50000

export type IngestSuccess = {
  ok: true
  text: string
  charCount: number
}

export type IngestResult = IngestSuccess | ResumeFailure

export function tooShortMessage(charCount: number): string {
  const unit = charCount === 1 ? "character" : "characters"
  return `That is only ${charCount} ${unit}. Guildy needs at least ${RESUME_MIN_CHARS} to write prep worth reading, so add more of your background and try again.`
}

type FileProvenance = {
  fileName: string
  fileExt: ResumeFileExt
  byteSize: number
}

// Writes the resumes row and user_profiles.resume_text together, and leaves
// neither half-written.
//
// resume_text is the read path (every gate, every prep call), so it is
// written last and confirmed with .select(): a zero-row update means the
// profile row is missing or RLS refused the write, and Supabase reports that
// as error: null, which is how a save could previously claim success while
// nothing moved. If that confirmation fails, the resumes row is put back the
// way it was. The user's existing resume survives every failure in here,
// including this one.
async function writeThrough(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  charCount: number,
  source: ResumeSource,
  file: FileProvenance | null
): Promise<IngestResult> {
  const { data: prior } = await supabase
    .from("resumes")
    // user_id included so the rollback upsert below has its conflict key.
    .select(
      "user_id, source, file_name, file_ext, byte_size, parsed_text, char_count"
    )
    .eq("user_id", userId)
    .maybeSingle()

  const { error: upsertError } = await supabase.from("resumes").upsert(
    {
      user_id: userId,
      source,
      file_name: file?.fileName ?? null,
      file_ext: file?.fileExt ?? null,
      byte_size: file?.byteSize ?? null,
      parsed_text: text,
      char_count: charCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )

  if (upsertError) {
    return resumeFailure(
      "write_failed",
      `Could not save your resume: ${upsertError.message}`
    )
  }

  const { data: updated, error: profileError } = await supabase
    .from("user_profiles")
    .update({ resume_text: text })
    .eq("id", userId)
    .select("id")

  if (profileError || !updated || updated.length === 0) {
    if (prior) {
      await supabase.from("resumes").upsert(prior, { onConflict: "user_id" })
    } else {
      await supabase.from("resumes").delete().eq("user_id", userId)
    }
    return resumeFailure(
      "write_failed",
      profileError
        ? `Could not save your resume: ${profileError.message}`
        : "Could not save to your profile. Refresh and try again."
    )
  }

  return { ok: true, text, charCount }
}

// Text in, resume on file. Used by the paste path, the handoff path, and by
// the file paths once parsing has produced text.
export async function ingestResumeText(
  supabase: SupabaseClient,
  userId: string,
  input: {
    text: string
    source: ResumeSource
    file?: FileProvenance | null
  }
): Promise<IngestResult> {
  const text = normalizeResumeText(input.text).slice(0, RESUME_MAX_CHARS)
  const charCount = text.length

  if (charCount < RESUME_MIN_CHARS) {
    return resumeFailure("too_short", tooShortMessage(charCount), charCount)
  }

  return writeThrough(
    supabase,
    userId,
    text,
    charCount,
    input.source,
    input.file ?? null
  )
}

// File in, resume on file. Parse failures return before anything is written,
// so a bad upload never costs the user the resume they already had.
export async function ingestResumeFile(
  supabase: SupabaseClient,
  userId: string,
  file: File,
  source: Extract<ResumeSource, "upload_drop" | "upload_browse">
): Promise<IngestResult> {
  const parsed = await parseResumeFile(file)
  if (!parsed.ok) return parsed

  const result = await ingestResumeText(supabase, userId, {
    text: parsed.text,
    source,
    file: {
      fileName: file.name,
      fileExt: parsed.ext,
      byteSize: parsed.byteSize,
    },
  })

  // Re-word the minimum for the file case: "add more of your background" is
  // the wrong instruction when the user just handed us a document.
  if (!result.ok && result.code === "too_short") {
    const count = result.charCount ?? 0
    const unit = count === 1 ? "character" : "characters"
    return resumeFailure(
      "too_short",
      `Only ${count} ${unit} came out of that file, and Guildy needs at least ${RESUME_MIN_CHARS}. Check it is the right document, or paste the text instead.`,
      count
    )
  }

  return result
}

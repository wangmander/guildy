import type { SupabaseClient } from "@supabase/supabase-js"

import { resumeFailure, type ResumeFailure } from "./errors"
import { RESUME_MAX_CHARS, RESUME_MIN_CHARS, tooShortMessage } from "./limits"
import { normalizeResumeText, parseResumeFile } from "./parse"
import type { ResumeFileExt, ResumeSource } from "@/types"

export { RESUME_MAX_CHARS, RESUME_MIN_CHARS, tooShortMessage }

// The one place a resume becomes a resume.
//
// Four doors lead here: a dropped file, a browsed file, pasted text, and the
// unauth handoff injection. All four end at ingestResume, which means all
// four get the same normalization, the same minimum, the same write, and the
// same rollback. After it returns there is nothing left to tell them apart
// except a `source` string kept for diagnostics.

export type IngestSuccess = {
  ok: true
  text: string
  charCount: number
}

export type IngestResult = IngestSuccess | ResumeFailure

type FileProvenance = {
  fileName: string
  fileExt: ResumeFileExt
  byteSize: number
  // Set once the object has actually landed in the bucket. Null when the
  // upload failed, which is not fatal: the text is what prep needs, and
  // losing the original copy is not worth losing the resume over.
  storagePath: string | null
  mimeType: string | null
}

export const RESUME_BUCKET = "resumes"

// <user_id>/<uuid>.<ext>. The first segment is what the bucket's RLS checks,
// so the prefix is not a convention, it is the boundary.
function storageKey(userId: string, ext: ResumeFileExt): string {
  return `${userId}/${crypto.randomUUID()}.${ext}`
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
      "user_id, source, file_name, file_ext, byte_size, storage_path, mime_type, parsed_text, char_count"
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
      storage_path: file?.storagePath ?? null,
      mime_type: file?.mimeType ?? null,
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

  // The write is confirmed, so the object the old row pointed at is now
  // unreachable: nothing reads a storage_path that no row holds. Deleted
  // best-effort and last, after the point of no return, so a storage hiccup
  // leaves a stray file rather than costing the user the save. A stray file
  // is billable; a lost resume is the incident this whole branch is about.
  const retired = (prior as { storage_path?: string | null } | null)
    ?.storage_path
  if (retired && retired !== file?.storagePath) {
    await supabase.storage.from(RESUME_BUCKET).remove([retired])
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

  // Only now does the bucket see it. A file that will not parse never lands,
  // so the bucket holds documents Guildy could actually read, not a pile of
  // scans and renamed binaries.
  //
  // The upload is allowed to fail. parsed.text is what every prep call
  // consumes; the object is the copy we keep so the original can be handed
  // back and re-parsed later. Refusing the save because the copy did not
  // stick would trade the thing that matters for the thing that does not.
  const key = storageKey(userId, parsed.ext)
  const { error: uploadError } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(key, file, {
      contentType: file.type || undefined,
      upsert: false,
    })
  const storagePath = uploadError ? null : key

  const result = await ingestResumeText(supabase, userId, {
    text: parsed.text,
    source,
    file: {
      fileName: file.name,
      fileExt: parsed.ext,
      byteSize: parsed.byteSize,
      storagePath,
      mimeType: file.type || null,
    },
  })

  // The row did not take, so nothing points at the object we just uploaded.
  // Remove it rather than leave it to be paid for forever. This covers the
  // too_short case below as well: a 40 character PDF gets rejected and its
  // upload gets swept in the same breath.
  if (!result.ok && storagePath) {
    await supabase.storage.from(RESUME_BUCKET).remove([storagePath])
  }

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

// The undo for all four doors.
//
// Removal is a real operation, not a convenience. resume_text is the hard
// gate on every prep call, so nulling it puts the user back in front of the
// onboarding wall they cleared on their way in. That is the point: the
// alternative to a Remove button is a user whose only way to get a wrong
// resume out of the product is to paste 200 characters of something else
// over it, and the product then quietly treats that as their background.
//
// Order matters and is the reverse of the write. resume_text goes first and
// is confirmed, because that is the read path and the only one that changes
// what the product does. The row and the object follow. If the object delete
// fails the user is still, correctly, resume-less.
export async function removeResume(
  supabase: SupabaseClient,
  userId: string
): Promise<{ ok: true } | ResumeFailure> {
  const { data: prior } = await supabase
    .from("resumes")
    .select("storage_path")
    .eq("user_id", userId)
    .maybeSingle()

  const { data: updated, error: profileError } = await supabase
    .from("user_profiles")
    .update({ resume_text: null })
    .eq("id", userId)
    .select("id")

  if (profileError || !updated || updated.length === 0) {
    return resumeFailure(
      "write_failed",
      profileError
        ? `Could not remove your resume: ${profileError.message}`
        : "Could not remove your resume. Refresh and try again."
    )
  }

  await supabase.from("resumes").delete().eq("user_id", userId)

  const path = (prior as { storage_path?: string | null } | null)?.storage_path
  if (path) {
    await supabase.storage.from(RESUME_BUCKET).remove([path])
  }

  return { ok: true }
}

// Every way a resume can fail to become usable text, and the sentence the
// user sees for it.
//
// These are deliberately seven distinct codes rather than one "upload
// failed". A scanned PDF, a password-protected PDF and a corrupt PDF all
// look identical from the outside, and the fix for each is different: one
// needs an OCR pass or a copy-paste, one needs the password removed, one
// needs re-exporting. Collapsing them into a single message leaves the user
// retrying the same file.

export type ResumeErrorCode =
  | "wrong_extension"
  | "too_large"
  | "password_protected"
  | "no_text_layer"
  | "corrupt"
  | "empty_parse"
  | "too_short"
  | "not_signed_in"
  | "write_failed"

export type ResumeFailure = {
  ok: false
  code: ResumeErrorCode
  message: string
  // Populated for too_short only: what we actually counted, so the message
  // can name it and the caller can show the user what is on file.
  charCount?: number
}

export function resumeFailure(
  code: ResumeErrorCode,
  message: string,
  charCount?: number
): ResumeFailure {
  return charCount === undefined
    ? { ok: false, code, message }
    : { ok: false, code, message, charCount }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

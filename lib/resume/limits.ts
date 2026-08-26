import type { ResumeFileExt } from "@/types"

// Leaf module: the numbers and the strings, no parsers.
//
// It exists as its own file because of who imports it. The gate runs inside
// middleware, which is the Edge runtime, and the file picker runs in the
// browser. Neither can pull in unpdf or mammoth, and a single import of
// lib/resume/parse.ts drags both in even behind a dynamic import, because
// webpack still resolves the module. So the constants live here and the
// parsers stay downstream of everything that only needs to know the rules.

// 200 characters. Below this it is not a resume, it is a placeholder, and
// generating prep on it produces confident nonsense that the user quite
// reasonably blames on the product rather than on their own two-character
// entry. Three production profiles hold resumes of 1 and 2 characters,
// written by paths that never counted.
export const RESUME_MIN_CHARS = 200

export const RESUME_MAX_CHARS = 50000

export const RESUME_MAX_BYTES = 10 * 1024 * 1024

export const RESUME_ACCEPTED_EXTS: ReadonlyArray<ResumeFileExt> = [
  "pdf",
  "docx",
  "txt",
]

// The accept attribute for the file input. Kept beside the size and extension
// rules so the picker and the parser cannot drift on what is allowed.
export const RESUME_ACCEPT_ATTR =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"

export function tooShortMessage(charCount: number): string {
  const unit = charCount === 1 ? "character" : "characters"
  return `That is only ${charCount} ${unit}. Guildy needs at least ${RESUME_MIN_CHARS} to write prep worth reading, so add more of your background and try again.`
}

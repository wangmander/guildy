import { formatBytes, resumeFailure, type ResumeFailure } from "./errors"
import { RESUME_ACCEPTED_EXTS, RESUME_MAX_BYTES } from "./limits"
import type { ResumeFileExt } from "@/types"

// Server-side file to text. PDF via unpdf, DOCX via mammoth, TXT decoded
// directly. RTF is deliberately absent: it is a markup format that needs its
// own parser to avoid handing the model a wall of control words, and paste
// already covers it.

export type ParseSuccess = {
  ok: true
  text: string
  ext: ResumeFileExt
  byteSize: number
}

export type ParseResult = ParseSuccess | ResumeFailure

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  if (dot < 0 || dot === fileName.length - 1) return ""
  return fileName.slice(dot + 1).toLowerCase()
}

function isAcceptedExt(ext: string): ext is ResumeFileExt {
  return (RESUME_ACCEPTED_EXTS as ReadonlyArray<string>).includes(ext)
}

const NBSP = " "
const REPLACEMENT_CHAR = "�"

// Normalizes whatever the parsers hand back into the shape the prompt
// builders expect: unix newlines, no runs of blank lines, no trailing
// whitespace per line. Done here rather than per-parser so a PDF and a paste
// of the same resume produce the same string, and therefore the same context
// hash, instead of looking like an input change that staled every prep.
export function normalizeResumeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split(NBSP)
    .join(" ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// pdfjs (under unpdf) throws a PasswordException for an encrypted document.
// mammoth's unzip fails on one with a message that varies by how the file was
// encrypted, so both parsers funnel through the same sniff.
function looksPasswordProtected(err: unknown): boolean {
  const name = err instanceof Error ? err.name : ""
  const message = err instanceof Error ? err.message : String(err)
  const haystack = `${name} ${message}`.toLowerCase()
  return haystack.includes("password") || haystack.includes("encrypted")
}

async function parsePdf(bytes: Uint8Array): Promise<string | ResumeFailure> {
  let totalPages = 0
  let text = ""
  try {
    const { extractText } = await import("unpdf")
    const result = await extractText(bytes, { mergePages: true })
    totalPages = result.totalPages
    text = result.text
  } catch (err) {
    if (looksPasswordProtected(err)) {
      return resumeFailure(
        "password_protected",
        "That PDF is password protected. Remove the password and try again, or paste the text instead."
      )
    }
    return resumeFailure(
      "corrupt",
      "That file could not be read. It may be damaged, or not really a PDF. Try re-exporting it, or paste the text instead."
    )
  }

  const normalized = normalizeResumeText(text)
  if (normalized.length === 0) {
    // The document opened and reported pages, so the file itself is fine. It
    // just has no text layer: a scan, a photo, or an image-only export.
    if (totalPages > 0) {
      return resumeFailure(
        "no_text_layer",
        "That PDF has no text in it. It looks like a scan or an image export, so there is nothing to read. Save it as a text PDF, or paste the text instead."
      )
    }
    return resumeFailure(
      "empty_parse",
      "That PDF came back empty. There was nothing readable in it."
    )
  }
  return normalized
}

// A password-protected .docx is not a zip at all: Office rewraps it as an OLE
// compound file with the real document hidden in an EncryptedPackage stream.
// mammoth only sees a broken zip and reports "can't find end of central
// directory", which would land the user on the corrupt-file message and send
// them off to re-export a file that is perfectly intact. So sniff the
// container before handing it over.
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

function isOleContainer(bytes: Uint8Array): boolean {
  if (bytes.length < OLE_MAGIC.length) return false
  return OLE_MAGIC.every((byte, i) => bytes[i] === byte)
}

// "Encrypt" in the UTF-16LE stream names of an OLE directory entry. Present
// in an encrypted OOXML wrapper, absent in a plain legacy .doc.
function hasEncryptedPackageStream(bytes: Uint8Array): boolean {
  const needle = [0x45, 0x00, 0x6e, 0x00, 0x63, 0x00, 0x72, 0x00, 0x79, 0x00]
  const limit = Math.min(bytes.length, 16 * 1024)
  outer: for (let i = 0; i + needle.length <= limit; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer
    }
    return true
  }
  return false
}

async function parseDocx(bytes: Uint8Array): Promise<string | ResumeFailure> {
  if (isOleContainer(bytes) && hasEncryptedPackageStream(bytes)) {
    return resumeFailure(
      "password_protected",
      "That document is password protected. Remove the password and try again, or paste the text instead."
    )
  }

  let raw = ""
  try {
    const mammoth = (await import("mammoth")).default
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    raw = result.value ?? ""
  } catch (err) {
    if (looksPasswordProtected(err)) {
      return resumeFailure(
        "password_protected",
        "That document is password protected. Remove the password and try again, or paste the text instead."
      )
    }
    return resumeFailure(
      "corrupt",
      "That file could not be read. It may be damaged, or saved as .doc rather than .docx. Try re-exporting it, or paste the text instead."
    )
  }

  const normalized = normalizeResumeText(raw)
  if (normalized.length === 0) {
    return resumeFailure(
      "empty_parse",
      "That document came back empty. There was no text in it to read."
    )
  }
  return normalized
}

function parseTxt(bytes: Uint8Array): string | ResumeFailure {
  let decoded = ""
  try {
    decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes)
  } catch {
    return resumeFailure(
      "corrupt",
      "That file could not be read as text. Try re-saving it as UTF-8, or paste the text instead."
    )
  }

  // A binary file renamed to .txt decodes to replacement characters. If more
  // than a fiftieth of it is unreadable, it is not a text file.
  const replacements = decoded.split(REPLACEMENT_CHAR).length - 1
  if (decoded.length > 0 && replacements / decoded.length > 0.02) {
    return resumeFailure(
      "corrupt",
      "That file is not readable text. It may be a renamed binary file. Try re-saving it as UTF-8, or paste the text instead."
    )
  }

  const normalized = normalizeResumeText(decoded)
  if (normalized.length === 0) {
    return resumeFailure(
      "empty_parse",
      "That file is empty. There was no text in it to read."
    )
  }
  return normalized
}

// Parse only. The 200 character minimum is NOT applied here: it belongs to
// ingest, which enforces the same floor on pasted text that never touches
// this file. One place, so "every path, same rule" is true rather than
// aspirational.
export async function parseResumeFile(file: File): Promise<ParseResult> {
  const fileName = file.name ?? ""
  const ext = extensionOf(fileName)

  if (!isAcceptedExt(ext)) {
    const named = ext.length > 0 ? `a .${ext} file` : "that file type"
    return resumeFailure(
      "wrong_extension",
      `Guildy reads PDF, DOCX and TXT. That is ${named}. Paste the text instead if you cannot convert it.`
    )
  }

  const byteSize = file.size
  if (byteSize > RESUME_MAX_BYTES) {
    return resumeFailure(
      "too_large",
      `That file is ${formatBytes(byteSize)} and the limit is 10MB. Most resumes are well under 1MB, so this one is probably carrying images.`
    )
  }
  if (byteSize === 0) {
    return resumeFailure(
      "empty_parse",
      "That file is empty. There was no text in it to read."
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  let parsed: string | ResumeFailure
  if (ext === "pdf") {
    parsed = await parsePdf(bytes)
  } else if (ext === "docx") {
    parsed = await parseDocx(bytes)
  } else {
    parsed = parseTxt(bytes)
  }

  if (typeof parsed !== "string") return parsed

  return { ok: true, text: parsed, ext, byteSize }
}

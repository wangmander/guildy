import { extractText, getDocumentProxy } from "unpdf"

export type ResumeExtractResult =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "extract_failed"; message?: string }

export async function extractResumeText(buffer: ArrayBuffer): Promise<ResumeExtractResult> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    const cleaned = (Array.isArray(text) ? text.join("\n") : text).trim()

    if (!cleaned) {
      return { ok: false, reason: "empty" }
    }

    return { ok: true, text: cleaned }
  } catch (error) {
    return {
      ok: false,
      reason: "extract_failed",
      message: error instanceof Error ? error.message : "Unknown extraction error",
    }
  }
}

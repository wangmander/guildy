// ============================================================
// Guildy Gmail Detection V2 — Text Normalizers & Body Parsing
// ============================================================

export function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

export function containsWholePhrase(haystack: string, phrase: string): boolean {
  const hay = ` ${normalize(haystack)} `
  const needle = ` ${normalize(phrase)} `
  return hay.includes(needle)
}

export function decodeBase64Url(data: string): string {
  const n = data.replace(/-/g, "+").replace(/_/g, "/")
  const pad = n.length % 4
  return Buffer.from(pad ? n + "=".repeat(4 - pad) : n, "base64").toString("utf-8")
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Recursively walk Gmail payload parts and extract plain text + HTML.
 * Prefers text/plain; falls back to text/html stripped to text.
 */
export function extractBodyFromPayload(payload: any): { text: string; html: string } {
  let text = ""
  let html = ""

  function walk(part: any) {
    if (!part) return
    const mime = (part.mimeType || "").toLowerCase()
    const bodyData = part.body?.data
    if (bodyData) {
      try {
        const decoded = decodeBase64Url(bodyData)
        if (mime === "text/plain") text += "\n" + decoded
        else if (mime === "text/html") html += "\n" + decoded
      } catch {
        // ignore decode errors
      }
    }
    if (Array.isArray(part.parts)) part.parts.forEach(walk)
  }

  walk(payload)
  return { text: text.trim(), html: html.trim() }
}

export function safeJsonParse<T>(s: any): T | null {
  try {
    if (!s) return null
    let cleaned = typeof s === "string" ? s.trim() : s
    if (typeof cleaned === "string") {
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7)
      else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3)
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3)
      cleaned = cleaned.trim()
    }
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}

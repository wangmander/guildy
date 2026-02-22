// ============================================================
// Guildy Gmail Detection V2 — Text Normalizers & Body Parsing
// ============================================================

export function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

// Domain TLD extensions commonly used as company branding (e.g. "Perplexity.ai")
// Strip before anything else so "Company.ai" → "Company" early.
const DOMAIN_TLD_RE = /\.(ai|io|co|com|net|org|app|tech|dev|xyz|so|gg|me|is)\b/gi

// Corporate suffixes + startup branding words that don't distinguish companies.
// Word-boundary matched: "Coda" ≠ "co", "OpenAI" ≠ "ai" (no boundary before 'a' in "openai").
// "ai" and "io" here catch standalone branding like "Runway AI", "Retool IO", etc.
const CORP_SUFFIX_RE =
  /\b(inc|llc|ltd|corp|co|company|incorporated|limited|plc|gmbh|ag|sa|bv|pvt|technologies|technology|tech|solutions|services|group|holdings|international|global|ai|io)\b\.?/gi

/** Normalize a company name for deduplication matching.
 *  Strips domain TLDs first, then corporate/branding suffixes,
 *  then collapses everything to plain lowercase alphanumeric tokens. */
export function normalizeCompany(raw: string): string {
  return (raw || "")
    .replace(DOMAIN_TLD_RE, " ")   // "Perplexity.ai" → "Perplexity "
    .replace(CORP_SUFFIX_RE, " ")  // "Google Inc" → "Google ", "Runway AI" → "Runway "
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const row = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = i
    for (let j = 1; j <= n; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : 1 + Math.min(row[j - 1], row[j], prev)
      row[j - 1] = prev
      prev = val
    }
    row[n] = prev
  }
  return row[n]
}

/** Returns true if two company name strings refer to the same company.
 *  Three tiers — all comparisons happen on normalizeCompany() output so suffixes,
 *  TLDs, and branding words ("AI", "IO", "Inc", etc.) are already stripped.
 *
 *  1. Exact match  — "Google" == "Google Inc" == "Google Technologies"
 *  2. Whole-word substring — shorter token must be ≥ 4 chars and must appear as a
 *     whole word in the longer string (prevents "net" ⊂ "netflix")
 *  3. Levenshtein ≤ 1 — "OpenAI" vs "Open AI", single-char typos */
export function companiesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  const na = normalizeCompany(a)
  const nb = normalizeCompany(b)
  if (!na || !nb || na === "unknown" || nb === "unknown") return false

  // 1. Exact
  if (na === nb) return true

  // 2. Whole-word substring — pad with spaces for boundary check
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na]
  if (shorter.length >= 4 && (` ${longer} `).includes(` ${shorter} `)) return true

  // 3. Levenshtein ≤ 1 for names ≥ 4 chars (handles spacing variants, minor typos)
  if (Math.min(na.length, nb.length) >= 4 && levenshtein(na, nb) <= 1) return true

  return false
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

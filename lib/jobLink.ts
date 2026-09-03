// Job-posting link import: host allowlist and landing-page validation.
//
// Every rule here traces to ~/spikes/job-link-parse/results.md, whose verdicts
// are binding. The short version of that spike: link import works for the four
// ATS platforms and nothing else, and of those four only Greenhouse and Lever
// return the posting on a plain server fetch. Ashby and Workday return a JS
// shell or a zero-character SPA shell and need a headless browser, which this
// path deliberately does not have, so they are not on the allowlist.
//
// The spike's second shipping requirement was "validate the landing page, not
// the status code". Three distinct failures in that run returned HTTP 200 with
// no posting on them: Stripe's Greenhouse URL 302ing to a 593-role listing
// page, Ashby's 58-character JS shell, and Workday's zero-character SPA shell.
// A status check and a title check both pass on all three. isPostingText below
// is the gate that rejects them.
//
// This file is pure and imports nothing so it runs directly under
// `node --experimental-strip-types` (see scripts/test-job-link.mjs).

// Hosts we will fetch. Greenhouse's legacy host is included because live URLs
// still point at it; it redirects, which is why the final URL is re-checked.
export const ALLOWED_HOSTS = [
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "jobs.lever.co",
] as const

// Lever's robots.txt gives `User-agent: *` an Allow: / but names ClaudeBot and
// GPTBot with Disallow: /. We are neither, and identifying as either would be
// both untrue and against that instruction, so the fetch declares itself as
// Guildy acting for a signed-in user who pasted the link.
export const IMPORT_USER_AGENT =
  "GuildyImportBot/1.0 (+https://guildy.ai; user-initiated job import)"

export const FETCH_TIMEOUT_MS = 12_000

// Method D in the spike capped visible text at 12,000 characters and nothing
// in 33 URLs came close, so no requirements were cut at this size.
export const MAX_POSTING_CHARS = 12_000

export function hostOf(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  return url.hostname.toLowerCase().replace(/^www\./, "")
}

export function isAllowedHost(raw: string): boolean {
  const host = hostOf(raw)
  if (!host) return false
  return (ALLOWED_HOSTS as readonly string[]).includes(host)
}

// Looks like a URL the user meant as a link rather than pasted posting text.
// Deliberately loose: anything starting with a scheme or a bare domain on its
// own line. Real posting text is thousands of characters, so a short single
// token that parses as a host is a link.
export function looksLikeUrl(raw: string): boolean {
  const s = raw.trim()
  if (s.length === 0 || /\s/.test(s)) return false
  if (/^https?:\/\//i.test(s)) return true
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s)
}

export function normalizeUrl(raw: string): string {
  const s = raw.trim()
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

// The spike scored "content present" as >=800 chars plus >=2 markers. The
// length floor carries over unchanged. The marker floor is 1 here, not 2,
// because 2 rejected a real posting: Palantir's Lever listing is a complete
// 4,764-character posting written in prose, with no "Responsibilities" or
// "Qualifications" headings, and it tripped only one marker. Lever was the
// most reliable board in the entire spike, so a gate that drops its postings
// is measuring the wrong thing.
//
// Dropping to 1 is safe because this gate is no longer the only thing standing
// between a listing page and an import. Two other checks bracket it: the final
// URL's host must still be on the allowlist (which is what catches Stripe's
// 302 to its own 593-role board), and the parse has to come back with both a
// company and a role title, with the model told explicitly to return nulls for
// both when it is looking at a list of many jobs rather than one posting.
const MIN_POSTING_CHARS = 800
const MIN_MARKERS = 1

const JD_MARKERS = [
  "responsibilities",
  "qualifications",
  "requirements",
  "what you'll do",
  "what you will do",
  "about the role",
  "about this role",
  "about the job",
  "who you are",
  "we're looking for",
  "we are looking for",
  "your experience",
  "years of experience",
  "benefits",
  "compensation",
  "equal opportunity",
  "apply for this job",
  "full-time",
  "part-time",
  "the role",
  "you will",
  "our team",
] as const

export function countJdMarkers(text: string): number {
  const lower = text.toLowerCase()
  let n = 0
  for (const marker of JD_MARKERS) {
    if (lower.includes(marker)) n += 1
  }
  return n
}

// Does this text look like one job posting body? Rejects all three of the
// spike's empty-200 shapes: a listing page has the length but not the marker
// density of a single posting, and both shell shapes fail on length.
export function isPostingText(text: string): boolean {
  if (text.length < MIN_POSTING_CHARS) return false
  return countJdMarkers(text) >= MIN_MARKERS
}

export type FetchOutcome =
  | { ok: true; text: string; finalHost: string }
  | { ok: false; reason: "blocked_host" | "no_posting"; host: string | null }

// Fetches a posting from an allowlisted host. Plain server fetch, redirects
// followed, no browser. The final URL's host is re-checked because Greenhouse
// tenants 302 off Greenhouse entirely: Stripe's job URL lands on a listing
// page for all its open roles and still returns 200. Landing somewhere we do
// not vouch for is treated the same as landing on no posting at all.
export async function fetchPostingText(rawUrl: string): Promise<FetchOutcome> {
  const host = hostOf(rawUrl)
  if (!host || !isAllowedHost(rawUrl)) {
    return { ok: false, reason: "blocked_host", host }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(normalizeUrl(rawUrl), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": IMPORT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    })
  } catch {
    return { ok: false, reason: "no_posting", host }
  } finally {
    clearTimeout(timer)
  }

  const finalHost = hostOf(res.url) ?? host
  if (!res.ok || !(ALLOWED_HOSTS as readonly string[]).includes(finalHost)) {
    return { ok: false, reason: "no_posting", host: finalHost }
  }

  const text = htmlToText(await res.text()).slice(0, MAX_POSTING_CHARS)
  if (!isPostingText(text)) {
    return { ok: false, reason: "no_posting", host: finalHost }
  }

  return { ok: true, text, finalHost }
}

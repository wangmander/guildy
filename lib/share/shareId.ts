import { customAlphabet } from "nanoid"

// Public share ids for /p/[id]. Lowercase alphanumerics only, 10 chars, so
// the URL reads as a clean trustworthy slug (Loom/Calendly style) rather than
// a tracking-link UUID. 36^10 keyspace is non-guessable for this volume.
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"
const nano = customAlphabet(ALPHABET, 10)

export function newShareId(): string {
  return nano()
}

const SHARE_ID_RE = /^[0-9a-z]{10}$/

// Guard before any DB lookup or referral write so a malformed id is a clean
// miss, never a query with attacker-controlled shape.
export function isShareId(value: unknown): value is string {
  return typeof value === "string" && SHARE_ID_RE.test(value)
}

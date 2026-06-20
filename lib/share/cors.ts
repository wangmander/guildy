// Marketing origin (guildy.ai hero funnel) is a separate Vercel app. The
// public GET /api/share/[id] is fetched directly from that origin's browser
// for viewer pre-fill, so it needs CORS. Defaults to the production marketing
// host; override via env in preview/staging.
export function marketingBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://www.guildy.ai"
  return raw.replace(/\/+$/, "")
}

export function shareCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": marketingBaseUrl(),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  }
}

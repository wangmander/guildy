// The 5-day streak email drip (S-20260811-01). Drafted and shown to
// Michael before any send; content here is byte-identical to what he
// reviewed as text, now rendered as real HTML. No em dashes, matching the
// house voice guildy-site's HANDOFF.md establishes and this repo's own
// em-dash gate enforces.

export interface StreakEmail {
  day: 1 | 2 | 3 | 4 | 5
  subject: string
  html: string
}

const ACCENT = "#6c47ff"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.guildy.ai"

export interface TrackingContext {
  /** Opaque id for the recipient: a real userId in production, or a fixed
   * literal ("preview") for the one-off send-to-Michael path, which has no
   * user row and must never be confused for a real user's open/click. */
  uid: string
  day: number
}

function trackingBase(ctx?: TrackingContext): string {
  return ctx ? `${APP_URL}/api/email` : ""
}

/** Exported so the send path can put the same URL in the List-Unsubscribe
 * header. Gmail and Outlook show their own unsubscribe button off that header,
 * and a recipient who uses it instead of the body link must land in the same
 * place. */
export function unsubscribeUrl(uid: string): string {
  return `${APP_URL}/api/email/unsubscribe?uid=${encodeURIComponent(uid)}`
}

function wrap(
  headline: string,
  body: string,
  ctaLabel: string,
  ctaHref: string,
  ctx?: TrackingContext
): string {
  const base = trackingBase(ctx)
  const trackedHref = ctx
    ? `${base}/click?uid=${encodeURIComponent(ctx.uid)}&day=${ctx.day}&to=${encodeURIComponent(ctaHref)}`
    : ctaHref
  // Every commercial email needs a working way out, in the body and not only
  // in a header. Without ctx there is no recipient to unsubscribe (the preview
  // path), so it degrades to plain text rather than a link that would 404.
  const unsubLink = ctx
    ? `<a href="${unsubscribeUrl(ctx.uid)}" style="color:#a39cc0;text-decoration:underline;">Unsubscribe from these emails</a>`
    : "Unsubscribe link appears here in a real send."
  const pixel = ctx
    ? `<img src="${base}/open?uid=${encodeURIComponent(ctx.uid)}&day=${ctx.day}" width="1" height="1" alt="" style="display:block;border:0;" />`
    : ""
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f6f4fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4fb;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 0;">
          <div style="font-weight:800;font-size:18px;color:#1a1033;letter-spacing:-0.02em;">Guildy</div>
        </td></tr>
        <tr><td style="padding:20px 32px 8px;">
          <h1 style="margin:0;font-size:20px;line-height:1.3;color:#1a1033;">${headline}</h1>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0;font-size:15px;line-height:1.55;color:#4a4460;">${body}</p>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <a href="${trackedHref}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:8px;">${ctaLabel}</a>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #f0ecf8;">
          <p style="margin:0;font-size:12px;color:#a39cc0;">Guildy, the job-hunt command center.</p>
          <p style="margin:8px 0 0;font-size:12px;color:#a39cc0;">${unsubLink}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  ${pixel}
</body>
</html>`
}

const CONTENT: Record<1 | 2 | 3 | 4 | 5, { subject: string; headline: string; body: string; ctaLabel: string }> = {
  1: {
    subject: "Day 1 done. Get your first job in.",
    headline: "Day 1 done. Get your first job in.",
    body:
      "Your 5-day streak started when you signed up. Day 1 is already checked off.<br><br>" +
      "Add your first job and Guildy starts building what you need: company research, tailored prep, the works. Two minutes, and tomorrow's email has something real to react to.",
    ctaLabel: "Add your first job",
  },
  2: {
    subject: "Day 2. Run your first prep.",
    headline: "Day 2. Run your first prep.",
    body:
      "One job in. Now make it count.<br><br>" +
      "Open it and run prep: the questions they'll actually ask, what to say back, and what to know about the room before you're in it. This is the part most candidates skip.",
    ctaLabel: "Run prep",
  },
  3: {
    subject: "Day 3. One job isn't a pipeline.",
    headline: "Day 3. One job isn't a pipeline.",
    body:
      "A single application is a bet. A pipeline is a plan.<br><br>" +
      "Add two more jobs today. Every one gets the same treatment: research, tailored prep, ready before you need it.",
    ctaLabel: "Add another job",
  },
  4: {
    subject: "Day 4. Keep the pipeline moving.",
    headline: "Day 4. Keep the pipeline moving.",
    body:
      "Four days in. This is where most people coast; don't.<br><br>" +
      "Check your board, prep whatever's next in the queue, apply to one more. Small, repeatable, the whole point of a streak.",
    ctaLabel: "Open your board",
  },
  5: {
    subject: "Day 5. Streak complete. Here's what it built.",
    headline: "Day 5. Streak complete. Here's what it built.",
    body:
      "Five days, done. You've got jobs tracked, prep ready, and research behind every one of them, instead of walking in blind.<br><br>" +
      "The habit's the product. Keep adding jobs, keep prepping before every interview, and let Guildy carry the research load.",
    ctaLabel: "Keep going",
  },
}

/** Builds one day's email. Pass ctx to wire open/click tracking (a real
 * send); omit it for a bare preview render with plain, untracked links. */
export function buildStreakEmail(day: 1 | 2 | 3 | 4 | 5, ctx?: TrackingContext): StreakEmail {
  const c = CONTENT[day]
  return {
    day,
    subject: c.subject,
    html: wrap(c.headline, c.body, c.ctaLabel, `${APP_URL}/app`, ctx),
  }
}

export const streakEmails: StreakEmail[] = ([1, 2, 3, 4, 5] as const).map((d) => buildStreakEmail(d))

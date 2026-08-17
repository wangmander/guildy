import "server-only"

// Thin wrapper, one place that knows about Resend. sendEmail throws on a
// missing key rather than silently no-oping, on purpose: silent email
// failure is a support ticket six weeks from now with no trace of why.
// Callers that need "don't crash the request if email fails" wrap this
// themselves (see app/api/cron/streak-emails/route.ts).

import { Resend } from "resend"

const FROM = "Guildy <streak@guildy.ai>"

export interface SendEmailInput {
  to: string
  subject: string
  html: string
  /** One-click unsubscribe target (RFC 8058). Supplied for any bulk or
   * lifecycle send. Gmail and Outlook render their own unsubscribe control off
   * these headers, and a send without them is far likelier to be marked as
   * spam by the recipient, which damages the sending domain for every other
   * email Guildy sends, transactional ones included. */
  unsubscribeUrl?: string
}

export async function sendEmail({ to, subject, html, unsubscribeUrl }: SendEmailInput): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. No email was sent. See GROUND_RECEIPT/ship receipt for how to add it."
    )
  }
  const resend = new Resend(apiKey)
  const headers = unsubscribeUrl
    ? {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : undefined
  const { data, error } = await resend.emails.send({ from: FROM, to, subject, html, headers })
  if (error || !data) {
    throw new Error(`Resend send failed: ${error?.message ?? "unknown error"}`)
  }
  return { id: data.id }
}

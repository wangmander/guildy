import Link from "next/link"
import Script from "next/script"
import { ArrowLeft } from "lucide-react"

// Phase 6.5: Termly-hosted Privacy Policy embed. Paste the real policy ID
// into NEXT_PUBLIC_TERMLY_PRIVACY_ID after generating the document on
// termly.io. Until then the embed renders empty (Termly's script silently
// no-ops on unknown IDs).

const PRIVACY_ID =
  process.env.NEXT_PUBLIC_TERMLY_PRIVACY_ID ?? "TODO_TERMLY_PRIVACY_ID"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="rounded-lg bg-white p-8 shadow-sm">
          <div data-id={PRIVACY_ID} data-type="iframe" />
          <Script
            src="https://app.termly.io/embed-policy.min.js"
            strategy="afterInteractive"
          />
        </div>
      </div>
    </div>
  )
}

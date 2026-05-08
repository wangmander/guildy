"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Phase 6b: paywall modal. Subscribe button POSTs to /api/stripe/checkout
// and redirects the browser to the Stripe-hosted Checkout page. Manage
// Subscription is shown only when the user already has a Stripe customer
// (status past_due or canceled) so they can update payment info or
// reactivate without going through Checkout again.

const BENEFITS = [
  "Full positioning frames with rich grounding",
  "Risk counters anchored in your resume",
  "Per-category answer plans",
  "Resume-to-JD fit",
  "Interviewer prep",
] as const

type Props = {
  open: boolean
  onClose: () => void
  showManageLink?: boolean
}

export function UpgradeModal({
  open,
  onClose,
  showManageLink = false,
}: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subscribe = async () => {
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Checkout failed")
      }
      if (data.url) {
        window.location.href = data.url as string
        return
      }
      throw new Error("No checkout URL returned")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscribe failed")
      setPending(false)
    }
  }

  const managePortal = async () => {
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Portal failed")
      }
      if (data.url) {
        window.location.href = data.url as string
        return
      }
      throw new Error("No portal URL returned")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed")
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Unlock Deep Prep</DialogTitle>
          <DialogDescription>$19.99/mo. Cancel anytime.</DialogDescription>
        </DialogHeader>

        <ul className="mt-2 space-y-2">
          {BENEFITS.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2.5 text-sm text-gray-700"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#4E3BDD]" />
              {b}
            </li>
          ))}
        </ul>

        {error ? (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        ) : null}

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={subscribe}
            disabled={pending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#4E3BDD] text-sm font-medium text-white transition-colors hover:bg-[#4332C2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Subscribe
          </button>
          {showManageLink ? (
            <button
              type="button"
              onClick={managePortal}
              disabled={pending}
              className="inline-flex h-9 w-full items-center justify-center text-xs font-medium text-[#4E3BDD] transition-colors hover:underline disabled:opacity-50"
            >
              Manage subscription
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

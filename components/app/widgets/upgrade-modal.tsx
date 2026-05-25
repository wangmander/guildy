"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import posthog from "posthog-js"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { PrepSessionRole } from "@/lib/ai/prep-types"

// Phase 6b: paywall modal. Subscribe button POSTs to /api/stripe/checkout
// and redirects the browser to the Stripe-hosted Checkout page. Manage
// Subscription was previously rendered here for past_due/canceled users;
// that link now lives in the global Settings menu, so this modal is
// subscribe-only.
//
// Prompt 9: when the modal fires from inside a job's PrepCanvas, pass
// jobId + sessionRole so Checkout's success_url can carry them back and
// /app can auto-fire Deep generation for the originally blocked round.

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
  jobId?: string | null
  sessionRole?: PrepSessionRole | null
}

export function UpgradeModal({
  open,
  onClose,
  jobId = null,
  sessionRole = null,
}: Props) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    posthog.capture("upgrade_modal_viewed", {
      job_id: jobId,
      session_role: sessionRole ?? "_single",
    })
  }, [open, jobId, sessionRole])

  const subscribe = async () => {
    posthog.capture("upgrade_modal_subscribe_clicked", {
      job_id: jobId,
      session_role: sessionRole ?? "_single",
    })
    setPending(true)
    setError(null)
    try {
      const body: { resume_job?: string; resume_role?: string } = {}
      if (jobId) body.resume_job = jobId
      // Send "_single" for non-Full-Loop stages so the /app handler can
      // disambiguate the single-prep case from a missing role param.
      body.resume_role = sessionRole ?? "_single"
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
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

        <div className="mt-4">
          <button
            type="button"
            onClick={subscribe}
            disabled={pending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#4E3BDD] text-sm font-medium text-white transition-colors hover:bg-[#4332C2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Subscribe
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

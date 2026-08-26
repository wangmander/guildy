"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

// The one generate button. Quick, Deep, each Full Loop session, and
// Negotiation Prep all render this, so a click means the same thing in all
// four places.
//
// Three rules, and each one exists because of how these calls actually
// behave:
//
//   1. The caller flips `loading` synchronously in its click handler, before
//      any await, and this disables on that flip. A Deep generation runs for
//      the better part of a minute; a button that stays live for even one
//      render is a button someone clicks twice, and the second click is a
//      second Sonnet call.
//   2. Past eight seconds the label changes. Not a bar, not a percentage:
//      there is no progress to report, because the model returns in one
//      piece. A bar that fills on a timer is a guess drawn as a measurement,
//      and when it sits at 95% for forty seconds it reads as a hang.
//   3. Failure re-enables. `loading` goes false, the label returns, and the
//      caller renders the real error next to it. No spinner is left running
//      on a request that is already over.
const SLOW_AFTER_MS = 8000

type Props = {
  loading: boolean
  onClick: () => void
  label: string
  loadingLabel?: string
  // Shown once the call passes eight seconds. Says the work is still moving,
  // and nothing more than that.
  slowLabel?: string
  disabled?: boolean
  icon?: ReactNode
  title?: string
  className?: string
}

export function GenerateButton({
  loading,
  onClick,
  label,
  loadingLabel = "Generating...",
  slowLabel = "Still working...",
  disabled,
  icon,
  title,
  className,
}: Props) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!loading) {
      setSlow(false)
      return
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [loading])

  const text = loading ? (slow ? slowLabel : loadingLabel) : label

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      aria-busy={loading}
      aria-live="polite"
      title={title}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        className
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {text}
    </button>
  )
}

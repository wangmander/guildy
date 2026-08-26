"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

import type { PrepTier } from "@/lib/ai/prep-types"

type Props = {
  tier: PrepTier
}

// The skeleton and the rotating stage labels that sit under the generate
// button while a call is in flight.
//
// The timer-driven progress bar that used to head this component is gone. It
// filled to 95% on a fixed schedule with no connection to the request, so on
// a slow Deep call it parked at 95% and read as a hang, and on a fast one it
// was still crawling when the prep arrived. A bar that is a guess drawn as a
// measurement is worse than no bar. The button reports the elapsed state now
// (see generate-button.tsx); this reports what stage the work is at.
//
// The labels stay honest by being generic: they describe the shape of the
// work, not a position in it. Real streaming, where modules land as Sonnet
// emits them, is still the thing that would replace both.

const QUICK_LABELS: ReadonlyArray<string> = [
  "Reviewing your background…",
  "Drafting prep…",
  "Finalizing",
]

const DEEP_LABELS: ReadonlyArray<string> = [
  "Reviewing your resume and the job description…",
  "Analyzing what this round is testing…",
  "Drafting positioning frames…",
  "Mapping risks and counters…",
  "Building question categories with answer plans…",
  "Weaving resume-to-JD fit…",
  "Finalizing",
]

const QUICK_LABEL_DURATION_SEC = 4
const DEEP_LABEL_DURATION_SEC = 13

export function ProgressLoader({ tier }: Props) {
  const isDeep = tier === "deep"
  const labels = isDeep ? DEEP_LABELS : QUICK_LABELS
  const labelDurationSec = isDeep
    ? DEEP_LABEL_DURATION_SEC
    : QUICK_LABEL_DURATION_SEC

  const [elapsedSec, setElapsedSec] = useState(0)

  // 1Hz tick to advance the stage label.
  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const labelIdx = Math.min(
    labels.length - 1,
    Math.floor(elapsedSec / labelDurationSec)
  )
  const label = labels[labelIdx]

  return (
    <div
      className="mt-8 space-y-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2">
        <TierBadge tier={tier} />
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
      </div>

      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-[14px] border border-[var(--border-card)] bg-[var(--surface)] p-5 shadow-[var(--shadow-e1)]"
          >
            <div className="space-y-2">
              <div className="h-2 w-3/4 rounded-full bg-[var(--divider)]" />
              <div className="h-2 w-2/3 rounded-full bg-[var(--divider)]" />
              <div className="h-2 w-1/2 rounded-full bg-[var(--divider)]" />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">Generating prep…</span>
    </div>
  )
}

function TierBadge({ tier }: { tier: PrepTier }) {
  if (tier === "deep") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-[var(--accent-chip-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-deep)]">
        <Sparkles className="size-2.5" />
        Sonnet 4.6 · Deep
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded bg-[var(--salary-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
      Haiku 4.5 · Quick
    </span>
  )
}

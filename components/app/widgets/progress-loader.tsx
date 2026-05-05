"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

import type { PrepTier } from "@/lib/ai/prep-types"

type Props = {
  tier: PrepTier
}

// Phase 4c-4 patch 5 ships the visual half: timer-based progress + rotating
// tier-aware stage labels. Real streaming (modules arrive progressively, bar
// fills with actual content) is deferred — see HANDOFF roadmap.

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

// Target durations track typical wall-clock generation times. Bar fills to
// 95% over the target (never 100% until the actual response lands and the
// parent unmounts this component).
const QUICK_TARGET_SEC = 12
const DEEP_TARGET_SEC = 90
const QUICK_LABEL_DURATION_SEC = 4
const DEEP_LABEL_DURATION_SEC = 13

export function ProgressLoader({ tier }: Props) {
  const isDeep = tier === "deep"
  const labels = isDeep ? DEEP_LABELS : QUICK_LABELS
  const targetSec = isDeep ? DEEP_TARGET_SEC : QUICK_TARGET_SEC
  const labelDurationSec = isDeep
    ? DEEP_LABEL_DURATION_SEC
    : QUICK_LABEL_DURATION_SEC

  const [width, setWidth] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)

  // Kick off the bar fill on the next frame so the CSS transition runs from
  // 0 → 95 instead of jumping straight to 95.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(95))
    return () => cancelAnimationFrame(raf)
  }, [])

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
        <p className="text-xs text-gray-500">{label}</p>
      </div>

      <div
        className="h-1 w-full overflow-hidden rounded-full bg-gray-100"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-[#4E3BDD]"
          style={{
            width: `${width}%`,
            transition: `width ${targetSec}s ease-out`,
          }}
        />
      </div>

      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-black/5 bg-white p-5 shadow-sm"
          >
            <div className="space-y-2">
              <div className="h-2 w-3/4 rounded-full bg-gray-100" />
              <div className="h-2 w-2/3 rounded-full bg-gray-100" />
              <div className="h-2 w-1/2 rounded-full bg-gray-100" />
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
      <span className="inline-flex items-center gap-1 rounded bg-[#EDE9FE] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#4E3BDD]">
        <Sparkles className="size-2.5" />
        Sonnet 4.6 · Deep
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded bg-gray-200/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-700">
      Haiku 4.5 · Quick
    </span>
  )
}

"use client"

import { useState } from "react"
import { Check } from "lucide-react"

import { CompareTiersDrawer } from "./compare-tiers-drawer"

const BULLETS = [
  "Complete questions by category",
  "Answer plans by interview type",
  "Resume-to-JD fit",
  "Interviewer prep",
] as const

type Props = {
  onUpgrade: () => void
}

export function UpgradeWidget({ onUpgrade }: Props) {
  const [compareOpen, setCompareOpen] = useState(false)
  return (
    <>
      <div
        className="rounded-[16px] border border-[var(--accent-tint-border)] p-4 shadow-[var(--shadow-e1)]"
        style={{
          background:
            "linear-gradient(135deg, var(--accent-tint-bg), var(--milestone-to))",
        }}
      >
        <h3 className="type-comp-h2 text-[var(--accent-deep)]">Deep Prep</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-body)]">
          Quick Prep gets you ready. Deep Prep gives you the plan.
        </p>

        <ul className="mt-3 space-y-1.5">
          {BULLETS.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-xs leading-snug text-[var(--text-primary)]"
            >
              <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
              {b}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onUpgrade}
          className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-[10px] bg-[var(--accent)] text-sm font-semibold text-white shadow-[var(--shadow-accent-cta)] transition-colors hover:bg-[var(--accent-deep)]"
        >
          Upgrade to Deep Prep
        </button>
        <button
          type="button"
          onClick={() => setCompareOpen(true)}
          className="mt-2 inline-flex h-7 w-full items-center justify-center text-[11px] font-semibold text-[var(--accent-deep)] hover:underline"
        >
          Compare Quick vs Deep
        </button>
      </div>
      <CompareTiersDrawer
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
      />
    </>
  )
}

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
      <div className="rounded-2xl border border-[#482C4C]/20 bg-gradient-to-b from-[#482C4C]/8 to-white p-4 shadow-sm">
        <h3 className="font-serif text-xl font-semibold tracking-tight text-[#482C4C]">
          Deep Prep
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-600">
          Quick Prep gets you ready. Deep Prep gives you the plan.
        </p>

        <ul className="mt-3 space-y-1.5">
          {BULLETS.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-xs leading-snug text-[#1C1E21]"
            >
              <Check className="mt-0.5 size-3.5 shrink-0 text-[#482C4C]" />
              {b}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onUpgrade}
          className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md bg-[#482C4C] text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Upgrade to Deep Prep
        </button>
        <button
          type="button"
          onClick={() => setCompareOpen(true)}
          className="mt-2 inline-flex h-7 w-full items-center justify-center text-[11px] font-medium text-[#482C4C] hover:underline"
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

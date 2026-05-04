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
        className="rounded-2xl border border-[#4E3BDD]/15 p-4 shadow-sm"
        style={{
          background:
            "linear-gradient(135deg, #E4BCED 0%, #FFFFF1 60%)",
        }}
      >
        <h3 className="font-serif text-xl font-semibold tracking-tight text-[#4E3BDD]">
          Deep Prep
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-700">
          Quick Prep gets you ready. Deep Prep gives you the plan.
        </p>

        <ul className="mt-3 space-y-1.5">
          {BULLETS.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2 text-xs leading-snug text-[#1C1E21]"
            >
              <Check className="mt-0.5 size-3.5 shrink-0 text-[#4E3BDD]" />
              {b}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onUpgrade}
          className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md bg-[#4E3BDD] text-sm font-medium text-white transition-colors hover:bg-[#4332C2]"
        >
          Upgrade to Deep Prep
        </button>
        <button
          type="button"
          onClick={() => setCompareOpen(true)}
          className="mt-2 inline-flex h-7 w-full items-center justify-center text-[11px] font-medium text-[#4E3BDD] hover:underline"
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

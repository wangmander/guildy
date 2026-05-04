"use client"

import { Lock, Sparkles } from "lucide-react"

type Props = {
  title: string
  teaser: string
  onUpgrade: () => void
}

export function LockedPreviewModule({ title, teaser, onUpgrade }: Props) {
  return (
    <section className="rounded-xl border border-dashed border-[#4E3BDD]/25 bg-gradient-to-b from-[#4E3BDD]/5 to-white p-5 scroll-mt-6">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-[#4E3BDD]" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[#1C1E21]">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">{teaser}</p>
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-md bg-[#4E3BDD] px-2.5 text-xs font-medium text-white transition-colors hover:bg-[#4332C2]"
          >
            <Sparkles className="size-3" />
            Upgrade to Deep Prep
          </button>
        </div>
      </div>
    </section>
  )
}

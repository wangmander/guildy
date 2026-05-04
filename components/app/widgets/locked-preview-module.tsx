"use client"

import { Lock, Sparkles } from "lucide-react"

type Props = {
  title: string
  teaser: string
  onUpgrade: () => void
}

// Standalone card. Used when a locked preview has no Quick parent module
// to attach to (currently: ResumeJdFit only).
export function LockedPreviewModule({ title, teaser, onUpgrade }: Props) {
  return (
    <section className="rounded-xl border border-dashed border-[#4E3BDD]/25 bg-gradient-to-b from-[#4E3BDD]/5 to-white p-5 scroll-mt-6">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-[#4E3BDD]" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-medium text-[#1C1E21]">
            {title}
          </h2>
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

// Inline footer pattern. Sits inside a parent module's card, separated by a
// subtle divider and very light blurple wash. Used when a locked preview
// extends a Quick-tier section (Positioning, Risks, QuestionsTheyAsk).
export function LockedPreviewFooter({ title, teaser, onUpgrade }: Props) {
  return (
    <div className="-mx-5 -mb-5 mt-5 rounded-b-xl border-t border-black/5 bg-[#4E3BDD]/[0.04] px-5 py-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-[#4E3BDD]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-700">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-600">
            {teaser}
          </p>
        </div>
        <button
          type="button"
          onClick={onUpgrade}
          className="ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-[#4E3BDD] px-2.5 text-xs font-medium text-white transition-colors hover:bg-[#4332C2]"
        >
          <Sparkles className="size-3" />
          Upgrade
        </button>
      </div>
    </div>
  )
}

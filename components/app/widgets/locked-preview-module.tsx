"use client"

import { Lock, Sparkles } from "lucide-react"

type Props = {
  title: string
  teaser: string
  onUpgrade: () => void
}

// Edge-to-edge lavender band (item 7). Used when a locked preview has no
// Quick parent section to attach to (currently: ResumeJdFit only).
export function LockedPreviewModule({ title, teaser, onUpgrade }: Props) {
  return (
    <section className="scroll-mt-6 border-b border-[var(--divider)] bg-[var(--accent-tint-bg)] px-6 py-6 md:px-7">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
        <div className="min-w-0 flex-1">
          <h2 className="font-bricolage text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-body)]">
            {teaser}
          </p>
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--accent-deep)] transition-colors hover:bg-[var(--surface-sunken)]"
          >
            <Sparkles className="size-3" />
            Upgrade to Deep Prep
          </button>
        </div>
      </div>
    </section>
  )
}

// Edge-to-edge lavender band at the bottom of a flat prep section (item 7).
// Negative margins bleed it to the module edges (sections use px-6 md:px-7
// py-6); -mb-6 pulls it flush to the section's bottom divider.
export function LockedPreviewFooter({ title, teaser, onUpgrade }: Props) {
  return (
    <div className="-mx-6 -mb-6 mt-6 border-t border-[var(--border-card)] bg-[var(--accent-tint-bg2)] px-6 py-4 md:-mx-7 md:px-7">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-body)]">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--text-body)]">
            {teaser}
          </p>
        </div>
        <button
          type="button"
          onClick={onUpgrade}
          className="ml-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--accent-deep)] transition-colors hover:bg-[var(--surface-sunken)]"
        >
          <Sparkles className="size-3" />
          Upgrade
        </button>
      </div>
    </div>
  )
}

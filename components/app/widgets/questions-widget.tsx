"use client"

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"

import type {
  PrepQuestionThey,
  PrepQuestionYou,
  PrepTier,
} from "@/lib/ai/prep-types"

// Two named modules for center inline rendering. Phase 4c-4 moved Questions
// out of the right column so they live alongside Purpose / Positioning /
// Risks as full-width prep modules.

type TheyAskProps = {
  items: PrepQuestionThey[]
  tier: PrepTier
  footer?: React.ReactNode
}

export function QuestionsTheyAsk({ items, tier, footer }: TheyAskProps) {
  // Quick view hides category labels per spec ("common questions, no
  // categories"). Deep view groups by the model-supplied category.
  const grouped = useMemo(() => groupByCategory(items), [items])
  return (
    <section
      id="questions-they-ask"
      className="scroll-mt-6 rounded-[14px] border border-[var(--border-card)] bg-[var(--surface)] p-5 shadow-[var(--shadow-e1)]"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="type-section-h2 text-[var(--text-primary)]">
            Questions they&rsquo;ll ask you
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {tier === "deep"
              ? "Plausible questions for the round, grouped by category."
              : "A handful of likely questions for the round."}
          </p>
        </div>
        <span className="text-xs tabular-nums text-[var(--text-faint)]">
          {items.length}
        </span>
      </div>

      <ul className="mt-4 space-y-4">
        {tier === "deep"
          ? grouped.map(([category, group]) => (
              <li key={category ?? "_uncategorized"}>
                {category ? (
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--accent-deep)]">
                    {category}
                  </p>
                ) : null}
                <ul className="mt-1.5 space-y-1.5">
                  {group.map((q) => (
                    <TheyAskItem key={q.question} q={q} tier={tier} />
                  ))}
                </ul>
              </li>
            ))
          : items.map((q) => (
              <li key={q.question}>
                <TheyAskItem q={q} tier={tier} />
              </li>
            ))}
      </ul>
      {footer}
    </section>
  )
}

type YouAskProps = {
  items: PrepQuestionYou[]
}

export function QuestionsYouAsk({ items }: YouAskProps) {
  const grouped = useMemo(() => groupByCategory(items), [items])
  return (
    <section
      id="questions-you-ask"
      className="scroll-mt-6 rounded-[14px] border border-[var(--border-card)] bg-[var(--surface)] p-5 shadow-[var(--shadow-e1)]"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="type-section-h2 text-[var(--text-primary)]">
            Questions to ask them
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            Sharper questions surface fit and seriousness.
          </p>
        </div>
        <span className="text-xs tabular-nums text-[var(--text-faint)]">
          {items.length}
        </span>
      </div>
      <ul className="mt-4 space-y-4">
        {grouped.map(([category, group]) => (
          <li key={category ?? "_uncategorized"}>
            {category ? (
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--accent-deep)]">
                {category}
              </p>
            ) : null}
            <ul className="mt-1.5 space-y-1.5">
              {group.map((q) => (
                <li
                  key={q.question}
                  className="text-sm leading-relaxed text-[var(--text-body)]"
                >
                  {q.question}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}

function TheyAskItem({
  q,
  tier,
}: {
  q: PrepQuestionThey
  tier: PrepTier
}) {
  const [open, setOpen] = useState(false)
  const hasPlan = tier === "deep" && !!q.answer_plan && q.answer_plan.length > 0

  if (!hasPlan) {
    return (
      <span className="block text-sm leading-relaxed text-[var(--text-body)]">
        {q.question}
      </span>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-start gap-1.5 text-left text-sm leading-relaxed text-[var(--text-body)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ChevronDown
          className={
            open
              ? "mt-1 size-3.5 shrink-0 text-[var(--accent)] transition-transform"
              : "mt-1 size-3.5 shrink-0 -rotate-90 text-[var(--text-faint)] transition-transform group-hover:text-[var(--accent)]"
          }
          aria-hidden
        />
        <span>{q.question}</span>
      </button>
      {open ? (
        <p className="ml-5 mt-2 rounded-[10px] bg-[var(--surface-sunken)] p-3 text-xs leading-relaxed text-[var(--text-body)]">
          {q.answer_plan}
        </p>
      ) : null}
    </div>
  )
}

// Group questions by their model-supplied category. Quick tier returns null
// categories per spec; the renderer skips the category header in that case
// (single null group → all items render in one block, header omitted).
function groupByCategory<T extends { category: string | null }>(
  items: T[]
): [string | null, T[]][] {
  const order: (string | null)[] = []
  const map = new Map<string | null, T[]>()
  for (const item of items) {
    if (!map.has(item.category)) {
      order.push(item.category)
      map.set(item.category, [])
    }
    map.get(item.category)!.push(item)
  }
  return order.map((cat) => [cat, map.get(cat)!])
}

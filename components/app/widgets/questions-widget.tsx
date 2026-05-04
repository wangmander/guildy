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
      className="rounded-xl border border-black/5 bg-white p-5 shadow-sm scroll-mt-6"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-lg font-medium text-[#1C1E21]">
            Questions they&rsquo;ll ask you
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {tier === "deep"
              ? "Plausible questions for the round, grouped by category."
              : "A handful of likely questions for the round."}
          </p>
        </div>
        <span className="text-xs tabular-nums text-gray-400">
          {items.length}
        </span>
      </div>

      <ul className="mt-4 space-y-4">
        {tier === "deep"
          ? grouped.map(([category, group]) => (
              <li key={category}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#482C4C]">
                  {category}
                </p>
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
      className="rounded-xl border border-black/5 bg-white p-5 shadow-sm scroll-mt-6"
    >
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-lg font-medium text-[#1C1E21]">
            Questions to ask them
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Sharper questions surface fit and seriousness.
          </p>
        </div>
        <span className="text-xs tabular-nums text-gray-400">
          {items.length}
        </span>
      </div>
      <ul className="mt-4 space-y-4">
        {grouped.map(([category, group]) => (
          <li key={category}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#482C4C]">
              {category}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {group.map((q) => (
                <li
                  key={q.question}
                  className="text-sm leading-relaxed text-gray-700"
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
      <span className="block text-sm leading-relaxed text-gray-700">
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
        className="group flex w-full items-start gap-1.5 text-left text-sm leading-relaxed text-gray-700 transition-colors hover:text-[#1C1E21]"
      >
        <ChevronDown
          className={
            open
              ? "mt-1 size-3.5 shrink-0 text-[#482C4C] transition-transform"
              : "mt-1 size-3.5 shrink-0 -rotate-90 text-gray-400 transition-transform group-hover:text-[#482C4C]"
          }
          aria-hidden
        />
        <span>{q.question}</span>
      </button>
      {open ? (
        <p className="ml-5 mt-2 rounded-md bg-[#F8F9FA] p-3 text-xs leading-relaxed text-gray-600">
          {q.answer_plan}
        </p>
      ) : null}
    </div>
  )
}

function groupByCategory<T extends { category: string }>(
  items: T[]
): [string, T[]][] {
  const order: string[] = []
  const map = new Map<string, T[]>()
  for (const item of items) {
    if (!map.has(item.category)) {
      order.push(item.category)
      map.set(item.category, [])
    }
    map.get(item.category)!.push(item)
  }
  return order.map((cat) => [cat, map.get(cat)!])
}

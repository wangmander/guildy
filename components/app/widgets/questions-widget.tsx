"use client"

import { useMemo, useState } from "react"

import type { PrepState } from "@/components/app/prep-overlay"
import type {
  PrepQuestionThey,
  PrepQuestionYou,
} from "@/lib/ai/prep-types"

type Tab = "ask_you" | "you_ask"

type Props = {
  prepState: PrepState
}

export function QuestionsWidget({ prepState }: Props) {
  const [tab, setTab] = useState<Tab>("ask_you")

  const prep = prepState.status === "ready" ? prepState.prep : null
  const isLoading =
    prepState.status === "loading-cache" || prepState.status === "generating"

  const askYouCount = prep?.questions_they_ask.length ?? 0
  const youAskCount = prep?.questions_you_ask.length ?? 0

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Questions
        </h3>
        {prep && (
          <span className="text-xs text-gray-400">
            {tab === "ask_you" ? askYouCount : youAskCount}
          </span>
        )}
      </div>

      <div className="mt-2 inline-flex rounded-md border border-black/10 p-0.5">
        <button
          type="button"
          onClick={() => setTab("ask_you")}
          className={
            tab === "ask_you"
              ? "rounded-sm bg-[#482C4C] px-2.5 py-1 text-xs font-medium text-white"
              : "rounded-sm px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-[#1C1E21]"
          }
        >
          They&rsquo;ll ask you
        </button>
        <button
          type="button"
          onClick={() => setTab("you_ask")}
          className={
            tab === "you_ask"
              ? "rounded-sm bg-[#482C4C] px-2.5 py-1 text-xs font-medium text-white"
              : "rounded-sm px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-[#1C1E21]"
          }
        >
          You ask them
        </button>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <Skeleton />
        ) : !prep ? (
          <p className="text-xs leading-relaxed text-gray-500">
            Generate Quick Prep to see questions tailored to this round.
          </p>
        ) : tab === "ask_you" ? (
          <TheyAsk items={prep.questions_they_ask} />
        ) : (
          <YouAsk items={prep.questions_you_ask} />
        )}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <ul className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li key={i} className="space-y-1.5">
          <div className="h-2 w-1/3 rounded-full bg-gray-100" />
          <div className="h-2 w-full rounded-full bg-gray-100" />
        </li>
      ))}
    </ul>
  )
}

function TheyAsk({ items }: { items: PrepQuestionThey[] }) {
  const grouped = useMemo(() => groupByCategory(items), [items])
  return (
    <ul className="space-y-4">
      {grouped.map(([category, group]) => (
        <li key={category}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#482C4C]">
            {category}
          </p>
          <ul className="mt-1.5 space-y-2">
            {group.map((q) => (
              <li key={q.question} className="text-xs leading-relaxed text-gray-700">
                {q.question}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function YouAsk({ items }: { items: PrepQuestionYou[] }) {
  const grouped = useMemo(() => groupByCategory(items), [items])
  return (
    <ul className="space-y-4">
      {grouped.map(([category, group]) => (
        <li key={category}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#482C4C]">
            {category}
          </p>
          <ul className="mt-1.5 space-y-2">
            {group.map((q) => (
              <li key={q.question} className="text-xs leading-relaxed text-gray-700">
                {q.question}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function groupByCategory<T extends { category: string }>(items: T[]): [string, T[]][] {
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

"use client"

import { useState } from "react"

type Tab = "ask_you" | "you_ask"

export function QuestionsWidget() {
  const [tab, setTab] = useState<Tab>("ask_you")

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        Questions
      </h3>

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

      <p className="mt-4 text-xs leading-relaxed text-gray-500">
        Generated questions will appear after Quick Prep.
      </p>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Lock } from "lucide-react"

type Props = {
  initialName?: string | null
}

export function InterviewerWidget({ initialName }: Props) {
  const [name, setName] = useState(initialName ?? "")

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        Interviewer
      </h3>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Add interviewer name"
        className="mt-2 h-9 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/15"
      />

      <div className="mt-3 rounded-lg border border-dashed border-black/10 bg-gray-50/60 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
          <Lock className="size-3" />
          Insights
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
          Insights unlock with Deep Prep.
        </p>
      </div>
    </div>
  )
}

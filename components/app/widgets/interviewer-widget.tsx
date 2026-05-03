"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Lock } from "lucide-react"

import { setInterviewerAction } from "@/app/app/actions"

type Props = {
  jobId: string
  initialName?: string | null
}

export function InterviewerWidget({ jobId, initialName }: Props) {
  const router = useRouter()
  const [name, setName] = useState(initialName ?? "")
  const [savedName, setSavedName] = useState(initialName ?? "")
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const onBlur = () => {
    const next = name.trim()
    if (next === savedName.trim()) return
    if (next.length === 0) return // empty input doesn't save (no delete UX yet)
    setError(null)
    startTransition(async () => {
      const res = await setInterviewerAction({ job_id: jobId, name: next })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSavedName(next)
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        Interviewer
      </h3>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={onBlur}
        placeholder="Add interviewer name"
        className="mt-2 h-9 w-full rounded-md border border-black/10 bg-white px-3 text-sm text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/15"
      />
      {error ? (
        <p className="mt-1.5 text-[11px] text-red-600">{error}</p>
      ) : null}

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

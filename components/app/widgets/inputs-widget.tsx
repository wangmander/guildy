"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Minus, Plus, X } from "lucide-react"

import {
  setInterviewerAction,
  setLatestMessageAction,
} from "@/app/app/actions"

type Props = {
  jobId: string
  hasResume: boolean
  hasJd: boolean
  hasLatestMessage: boolean
  hasInterviewer: boolean
}

type Item = { label: string; present: boolean }

export function InputsWidget({
  jobId,
  hasResume,
  hasJd,
  hasLatestMessage,
  hasInterviewer,
}: Props) {
  // Optimistic local state — flips to true immediately on save, then router
  // refresh re-syncs the server-fetched booleans.
  const [latestMessageSaved, setLatestMessageSaved] = useState(hasLatestMessage)
  const [interviewerSaved, setInterviewerSaved] = useState(hasInterviewer)

  // Re-sync optimistic state if the server props change (e.g. router.refresh
  // returns updated booleans).
  useEffect(() => {
    setLatestMessageSaved(hasLatestMessage)
  }, [hasLatestMessage])
  useEffect(() => {
    setInterviewerSaved(hasInterviewer)
  }, [hasInterviewer])

  const items: Item[] = [
    { label: "Background", present: hasResume },
    { label: "Job description", present: hasJd },
    { label: "Latest Message", present: latestMessageSaved },
    { label: "Interviewer", present: interviewerSaved },
  ]
  const filled = items.filter((i) => i.present).length

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Inputs
        </h3>
        <span className="text-xs tabular-nums text-gray-500">
          {filled}/{items.length}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2 text-sm text-[#1C1E21]"
          >
            <span
              className={
                item.present
                  ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-[#482C4C]/10 text-[#482C4C]"
                  : "flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400"
              }
            >
              {item.present ? (
                <Check className="size-3" />
              ) : (
                <Minus className="size-3" />
              )}
            </span>
            <span className={item.present ? "" : "text-gray-500"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      <AddContextPopover
        jobId={jobId}
        onLatestMessageSaved={() => setLatestMessageSaved(true)}
        onInterviewerSaved={() => setInterviewerSaved(true)}
      />

      <p className="mt-3 text-[11px] leading-snug text-gray-400">
        More context makes prep sharper.
      </p>
    </div>
  )
}

function AddContextPopover({
  jobId,
  onLatestMessageSaved,
  onInterviewerSaved,
}: {
  jobId: string
  onLatestMessageSaved: () => void
  onInterviewerSaved: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const onSavedAndRefresh = (which: "message" | "interviewer") => {
    if (which === "message") onLatestMessageSaved()
    else onInterviewerSaved()
    router.refresh()
  }

  return (
    <div ref={containerRef} className="relative mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-8 items-center gap-1 text-xs font-medium text-[#482C4C] hover:underline"
      >
        <Plus className="size-3.5" />
        Add context
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Add context"
          className="absolute left-0 top-full z-20 mt-2 w-[280px] rounded-xl border border-black/10 bg-white p-3 shadow-lg"
        >
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Add context
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded p-1 text-gray-400 hover:text-[#1C1E21]"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <LatestMessageForm
            jobId={jobId}
            onSaved={() => {
              onSavedAndRefresh("message")
              setOpen(false)
            }}
          />

          <div className="my-3 h-px bg-black/5" />

          <InterviewerForm
            jobId={jobId}
            onSaved={() => {
              onSavedAndRefresh("interviewer")
              setOpen(false)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function LatestMessageForm({
  jobId,
  onSaved,
}: {
  jobId: string
  onSaved: () => void
}) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onSave = () => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setError("Paste a message first")
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await setLatestMessageAction({
        job_id: jobId,
        latest_message: trimmed,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setValue("")
      onSaved()
    })
  }

  return (
    <div>
      <label className="mt-2 block text-xs font-medium text-[#1C1E21]">
        Latest message
      </label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste the latest recruiter message…"
        rows={4}
        className="mt-1.5 w-full resize-y rounded-md border border-black/10 bg-white px-2.5 py-2 text-xs leading-relaxed text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/15"
      />
      {error ? (
        <p className="mt-1 text-[11px] text-red-600">{error}</p>
      ) : null}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#482C4C] px-2.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : null}
          Save
        </button>
      </div>
    </div>
  )
}

function InterviewerForm({
  jobId,
  onSaved,
}: {
  jobId: string
  onSaved: () => void
}) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onSave = () => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setError("Enter a name")
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await setInterviewerAction({ job_id: jobId, name: trimmed })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setValue("")
      onSaved()
    })
  }

  return (
    <div>
      <label className="block text-xs font-medium text-[#1C1E21]">
        Interviewer name
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Maya Chen"
        className="mt-1.5 h-8 w-full rounded-md border border-black/10 bg-white px-2.5 text-xs text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/15"
      />
      {error ? (
        <p className="mt-1 text-[11px] text-red-600">{error}</p>
      ) : null}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#482C4C] px-2.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : null}
          Save
        </button>
      </div>
    </div>
  )
}

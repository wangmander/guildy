"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { X } from "lucide-react"

import {
  generatePrepAction,
  getCachedPrepAction,
} from "@/app/app/actions"
import type { PrepOutput } from "@/lib/ai/prep-types"
import type { StageKey } from "@/lib/stages"

import { InputsWidget } from "./widgets/inputs-widget"
import { InterviewerWidget } from "./widgets/interviewer-widget"
import { JobContextWidget } from "./widgets/job-context-widget"
import { PrepCanvas } from "./widgets/prep-canvas"
import { QuestionsWidget } from "./widgets/questions-widget"
import { UpgradeWidget } from "./widgets/upgrade-widget"

export type PrepJob = {
  id: string
  company_name: string
  role_title: string
  tc: string | null
  source_url: string | null
  jd_text: string | null
  latest_message: string | null
  stage: StageKey
}

type Props = {
  job: PrepJob | null
  hasResume: boolean
  hasInterviewer: boolean
  interviewerName: string | null
  onClose: () => void
}

type PrepState =
  | { status: "loading-cache" }
  | { status: "empty" }
  | { status: "generating" }
  | { status: "ready"; prep: PrepOutput }
  | { status: "error"; message: string }

export function PrepOverlay({
  job,
  hasResume,
  hasInterviewer,
  interviewerName,
  onClose,
}: Props) {
  const [prepState, setPrepState] = useState<PrepState>({
    status: "loading-cache",
  })
  const [, startTransition] = useTransition()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Fetch cached prep when the overlay opens for a job. Re-run when the job id
  // changes (different card opened).
  useEffect(() => {
    if (!job) return
    let cancelled = false
    setPrepState({ status: "loading-cache" })
    getCachedPrepAction({ job_id: job.id }).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setPrepState({ status: "error", message: res.error })
        return
      }
      if (res.prep) {
        setPrepState({ status: "ready", prep: res.prep })
      } else {
        setPrepState({ status: "empty" })
      }
    })
    return () => {
      cancelled = true
    }
  }, [job])

  const onGenerate = useCallback(() => {
    if (!job) return
    setPrepState({ status: "generating" })
    startTransition(async () => {
      const res = await generatePrepAction({ job_id: job.id })
      if (!res.ok) {
        setPrepState({ status: "error", message: res.error })
        return
      }
      setPrepState({ status: "ready", prep: res.prep })
    })
  }, [job])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={job ? `Prep for ${job.company_name}` : "Prep overlay"}
      className="fixed inset-0 z-50"
    >
      <button
        type="button"
        aria-label="Close prep overlay"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#1C1E21]/40 backdrop-blur-md"
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 inline-flex size-10 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-md backdrop-blur transition-colors hover:bg-white hover:text-[#1C1E21] md:right-6 md:top-6"
      >
        <X className="size-5" />
      </button>

      <div className="pointer-events-none absolute inset-0 overflow-y-auto md:overflow-hidden">
        <div className="pointer-events-none mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-4 px-4 py-16 md:grid md:grid-cols-[280px_minmax(0,1fr)_320px] md:gap-6 md:px-6 md:py-6 lg:gap-8 lg:px-8">
          {!job ? (
            <ErrorCard onClose={onClose} />
          ) : (
            <>
              <aside className="pointer-events-auto flex flex-col gap-4 md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto md:pr-1">
                <JobContextWidget
                  company={job.company_name}
                  role={job.role_title}
                  tc={job.tc}
                  sourceUrl={job.source_url}
                  jdSnippet={job.jd_text}
                />
                <InterviewerWidget initialName={interviewerName} />
                <UpgradeWidget />
              </aside>

              <main className="pointer-events-auto rounded-2xl border border-black/5 bg-[#F8F9FA] shadow-sm md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto">
                <PrepCanvas
                  stage={job.stage}
                  prepState={prepState}
                  hasResume={hasResume}
                  onGenerate={onGenerate}
                />
              </main>

              <aside className="pointer-events-auto flex flex-col gap-4 md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto md:pr-1">
                <InputsWidget
                  hasResume={hasResume}
                  hasJd={!!job.jd_text && job.jd_text.trim().length > 0}
                  hasLatestMessage={
                    !!job.latest_message && job.latest_message.trim().length > 0
                  }
                  hasInterviewer={hasInterviewer}
                />
                <QuestionsWidget prepState={prepState} />
              </aside>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="pointer-events-auto col-span-full mx-auto mt-12 max-w-md rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm">
      <h2 className="text-base font-semibold text-[#1C1E21]">
        That job couldn&rsquo;t be found
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        It may have been deleted, or the link is invalid.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-[#482C4C] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Close
      </button>
    </div>
  )
}

export type { PrepState }

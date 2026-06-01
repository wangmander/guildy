"use client"

import { useEffect, useState } from "react"
import { Compass, Plus } from "lucide-react"

import { getJobSourceAdvisorAction } from "@/app/app/actions"
import {
  GENERIC_BOARDS,
  type Advisor,
  type BoardRating,
} from "@/lib/jobSourceAdvisor/boardRatings"
import { cn } from "@/lib/utils"

import { AddJobModal } from "./add-job-modal"

export type RailStats = {
  jobsTracked: number
  activeInterviews: number
  offers: number
}

type Props = {
  stats: RailStats
  advisor: Advisor
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-4",
        className
      )}
    >
      {children}
    </div>
  )
}

function StatsPanel({ stats }: { stats: RailStats }) {
  const hasJobs = stats.jobsTracked > 0

  if (!hasJobs) {
    return (
      <Panel>
        <h2 className="font-display text-sm font-medium text-[#1C1E21]">
          Command center
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-gray-500">
          Add your first job to activate your command center.
        </p>
      </Panel>
    )
  }

  const rows: Array<{ label: string; value: number }> = [
    { label: "Jobs tracked", value: stats.jobsTracked },
    { label: "Active interviews", value: stats.activeInterviews },
    { label: "Offers", value: stats.offers },
  ]

  return (
    <Panel>
      <h2 className="font-display text-sm font-medium text-[#1C1E21]">
        Pipeline
      </h2>
      <dl className="mt-2 flex flex-col divide-y divide-gray-100">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between py-2"
          >
            <dt className="text-xs text-gray-500">{row.label}</dt>
            <dd className="font-display text-xl font-medium text-[#1C1E21]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

function BoardRow({ board }: { board: BoardRating }) {
  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[#1C1E21]">
          {board.board}
        </span>
        <span className="shrink-0 rounded-md bg-[#EDE9FE] px-1.5 py-0.5 text-xs font-semibold text-[#4E3BDD]">
          {board.score}/10
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-gray-100">
        <div
          className="h-1 rounded-full bg-[#482C4C]"
          style={{ width: `${board.score * 10}%` }}
        />
      </div>
      <span className="text-xs leading-snug text-gray-500">{board.reason}</span>
    </li>
  )
}

function AdvisorPanel({ advisor }: { advisor: Advisor }) {
  const [boards, setBoards] = useState<BoardRating[]>(
    advisor.mode === "ai_needed" ? [] : advisor.boards
  )
  const [loading, setLoading] = useState(advisor.mode === "ai_needed")
  const [note, setNote] = useState<string | null>(
    advisor.mode === "generic" ? "Personalizes once you add a job." : null
  )

  useEffect(() => {
    if (advisor.mode !== "ai_needed" || !advisor.roleTitle) return
    let cancelled = false
    setLoading(true)
    getJobSourceAdvisorAction(advisor.roleTitle).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setBoards(res.boards)
        setNote(null)
      } else {
        setBoards(GENERIC_BOARDS)
        setNote("Showing general boards for now.")
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [advisor.mode, advisor.roleTitle])

  const subhead = advisor.roleLabel
    ? `Best boards for ${advisor.roleLabel}`
    : "Best boards for your search"

  return (
    <Panel>
      <div className="flex items-center gap-1.5">
        <Compass className="size-4 text-[#4E3BDD]" />
        <h2 className="font-display text-sm font-medium text-[#1C1E21]">
          Where to look
        </h2>
      </div>
      <p className="mt-1 text-xs text-gray-500">{subhead}</p>

      {loading ? (
        <div className="mt-3 flex flex-col gap-3" aria-live="polite">
          <p className="text-xs text-gray-400">Finding your board map...</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
              <div className="h-1 w-full animate-pulse rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <ul className="mt-2 flex flex-col divide-y divide-gray-100">
            {boards.map((board) => (
              <BoardRow key={board.board} board={board} />
            ))}
          </ul>
          {note ? (
            <p className="mt-2 text-[11px] leading-snug text-gray-400">{note}</p>
          ) : null}
        </>
      )}
    </Panel>
  )
}

// Contextual actions container. Kept deliberately extensible: Feature 2 adds
// a fuller "Today" panel of task items here. New task types render as
// additional blocks below, so this stays a container, not a single hardcoded
// action.
function ActionsPanel({
  jobsTracked,
  onAddJob,
}: {
  jobsTracked: number
  onAddJob: () => void
}) {
  if (jobsTracked === 0) {
    return (
      <Panel>
        <h2 className="font-display text-sm font-medium text-[#1C1E21]">
          Get started
        </h2>
        <button
          type="button"
          onClick={onAddJob}
          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#482C4C] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Add your first job
        </button>
      </Panel>
    )
  }

  const jobWord = jobsTracked === 1 ? "job" : "jobs"

  return (
    <Panel>
      <h2 className="font-display text-sm font-medium text-[#1C1E21]">Pace</h2>
      <p className="mt-1.5 text-xs leading-snug text-gray-500">
        You&rsquo;ve tracked {jobsTracked} {jobWord}. 15 to 20 applications per
        week consistently lands interviews more reliably than applying in
        bursts.
      </p>
    </Panel>
  )
}

export function CommandRail({ stats, advisor }: Props) {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <aside className="w-full shrink-0 px-4 lg:w-[300px] lg:px-8 lg:pr-0">
      <div className="flex flex-col gap-4">
        <StatsPanel stats={stats} />
        <AdvisorPanel advisor={advisor} />
        <ActionsPanel
          jobsTracked={stats.jobsTracked}
          onAddJob={() => setAddOpen(true)}
        />
      </div>
      <AddJobModal open={addOpen} onOpenChange={setAddOpen} />
    </aside>
  )
}

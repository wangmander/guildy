"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  ChevronDown,
  Compass,
  ExternalLink,
  Plus,
} from "lucide-react"

import { getJobSourceAdvisorAction } from "@/app/app/actions"
import {
  GENERIC_BOARDS,
  type Advisor,
  type BoardRating,
} from "@/lib/jobSourceAdvisor/boardRatings"
import type { ApplyProjection } from "@/lib/jobSourceAdvisor/applyProjections"
import { cn } from "@/lib/utils"

import { AddJobModal } from "./add-job-modal"

// Today panel items, server-built in app/app/page.tsx and passed in as a
// typed array. Discriminated on `kind`. The renderer below maps each kind to
// a row; new task types (e.g. a future Target Company List nudge) extend this
// union and add a branch, keeping the panel an extensible container.
export type TodayItem =
  | { kind: "prep_due"; jobId: string; company: string; stageLabel: string }
  | { kind: "quick_prep_gap"; jobId: string; company: string }
  | { kind: "source_nudge"; board: string; role: string; score: number }

// Apply-goal hero data. Null when the user has no non-closed jobs (the Today
// empty state shows instead). loggedThisWeek counts jobs created in the last
// rolling 7 days; projection is the estimate-labeled, range-based outlook
// derived from the researched base rates.
export type ApplyGoal = {
  loggedThisWeek: number
  projection: ApplyProjection
}

type Props = {
  advisor: Advisor
  today: TodayItem[]
  applyGoal: ApplyGoal | null
}

const APPLY_TARGET = 15

// Board landing URLs for the source-nudge item. boardRatings.ts stays the
// pure ratings source; link targets live here. Boards with no canonical URL
// (e.g. "Company career pages") render as text with no link.
const BOARD_URLS: Record<string, string> = {
  Wellfound: "https://wellfound.com/jobs",
  "Built In": "https://builtin.com/jobs",
  Glassdoor: "https://www.glassdoor.com/Job/index.htm",
  Indeed: "https://www.indeed.com/",
  "YC Work at a Startup": "https://www.workatastartup.com/",
  "HN Who's Hiring": "https://news.ycombinator.com/",
  Otta: "https://app.otta.com/",
  "Otta / Welcome to the Jungle": "https://app.otta.com/",
  "Lenny's Job Board": "https://www.lennysjobs.com/",
  RepVue: "https://www.repvue.com/companies",
  Dribbble: "https://dribbble.com/jobs",
  Behance: "https://www.behance.net/joblist",
  "Designer News": "https://www.designernews.co/",
  "Kaggle Jobs": "https://www.kaggle.com/",
  Hired: "https://hired.com/",
}

// LinkedIn gets a role-keyword search deep link; other known boards link to
// their job root; unknown or URL-less boards return null (text only).
function boardUrl(board: string, role: string): string | null {
  if (board === "LinkedIn") {
    return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role)}`
  }
  const base = BOARD_URLS[board]
  return base ? base : null
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

// Apply-goal hero, top of the rail. Replaces the old Pipeline scoreboard (the
// kanban already shows per-column counts, and the zeros framing was demeaning).
// The weekly pace is the focus; honest, estimate-labeled projections recede as
// supporting context. Reuses the board-rating bar style; no new tokens.
function ApplyGoalHero({ goal }: { goal: ApplyGoal }) {
  const met = goal.loggedThisWeek >= APPLY_TARGET
  const pct = Math.min(100, (goal.loggedThisWeek / APPLY_TARGET) * 100)
  const subline = met
    ? "Pace met. Steady beats bursts, keep it going."
    : "15 to 20 a week is the researched sweet spot, and steady beats bursts."

  return (
    <Panel>
      <h2 className="font-display text-sm font-medium text-[#1C1E21]">
        Apply goal
      </h2>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-medium text-[#1C1E21]">
          {goal.loggedThisWeek}
        </span>
        <span className="text-xs text-gray-500">
          / {APPLY_TARGET} this week
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
        <div
          className="h-1.5 rounded-full bg-[#482C4C]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs leading-snug text-gray-500">{subline}</p>
      <div className="mt-2.5 border-t border-gray-100 pt-2.5">
        <p className="text-[11px] leading-snug text-gray-400">
          {goal.projection.leadIn}
        </p>
        {goal.projection.lines.map((line, i) => (
          <p key={i} className="mt-1 text-[11px] leading-snug text-gray-500">
            {line}
          </p>
        ))}
      </div>
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

// Job Source Advisor. Collapsed by default so it reads as one task among
// others, not a centerpiece block. The AI fallback still resolves on mount
// (independent of expand state) so the collapsed count is ready. Expanding
// reveals the full ranked rated list unchanged.
function AdvisorPanel({ advisor }: { advisor: Advisor }) {
  const [boards, setBoards] = useState<BoardRating[]>(
    advisor.mode === "ai_needed" ? [] : advisor.boards
  )
  const [loading, setLoading] = useState(advisor.mode === "ai_needed")
  const [note, setNote] = useState<string | null>(
    advisor.mode === "generic" ? "Personalizes once you add a job." : null
  )
  const [expanded, setExpanded] = useState(false)

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
  const roleText = advisor.roleLabel ?? "your search"
  const summary = loading
    ? "Finding your board map..."
    : `${boards.length} boards for ${roleText}`

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Compass className="size-4 shrink-0 text-[#4E3BDD]" />
          <span className="font-display text-sm font-medium text-[#1C1E21]">
            Where to look
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-gray-400 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {!expanded ? (
        <p className="mt-1 truncate text-xs text-gray-500">{summary}</p>
      ) : (
        <>
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
                <p className="mt-2 text-[11px] leading-snug text-gray-400">
                  {note}
                </p>
              ) : null}
            </>
          )}
        </>
      )}
    </Panel>
  )
}

// A single internal deep-link row (prep-due, quick-prep gap). Opens the
// job's prep overlay via the Board's ?job= search param.
function ActionRow({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group -mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-50"
      >
        <span className="text-sm leading-snug text-[#1C1E21]">{label}</span>
        <ArrowRight className="size-3.5 shrink-0 text-gray-400 transition-colors group-hover:text-[#4E3BDD]" />
      </Link>
    </li>
  )
}

function TodayItemRow({ item }: { item: TodayItem }) {
  switch (item.kind) {
    case "prep_due":
      return (
        <ActionRow
          href={`/app?job=${item.jobId}`}
          label={`Prep your ${item.company} ${item.stageLabel} round.`}
        />
      )
    case "quick_prep_gap":
      return (
        <ActionRow
          href={`/app?job=${item.jobId}`}
          label={`Run Quick Prep on ${item.company}.`}
        />
      )
    case "source_nudge": {
      const url = boardUrl(item.board, item.role)
      const label = `Check ${item.board} for ${item.role} roles, your strongest source (${item.score}/10).`
      if (!url) {
        return (
          <li className="px-0 py-1.5 text-sm leading-snug text-[#1C1E21]">
            {label}
          </li>
        )
      }
      return (
        <li>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="group -mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-gray-50"
          >
            <span className="text-sm leading-snug text-[#1C1E21]">{label}</span>
            <ExternalLink className="size-3.5 shrink-0 text-gray-400 transition-colors group-hover:text-[#4E3BDD]" />
          </a>
        </li>
      )
    }
  }
}

// Today panel: prioritized "what to move next" items (capped server-side at
// 3). Empty state (no non-closed jobs) shows a single aspirational line plus
// the Add Job CTA, never a list of zeros. When there are jobs but nothing
// actionable, the panel hides (the apply-goal hero carries the rail).
function TodayPanel({
  items,
  hasJobs,
  onAddJob,
}: {
  items: TodayItem[]
  hasJobs: boolean
  onAddJob: () => void
}) {
  if (!hasJobs) {
    return (
      <Panel>
        <h2 className="font-display text-sm font-medium text-[#1C1E21]">
          Today
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-gray-500">
          Add your first job and Today shows you exactly what to move next.
        </p>
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

  if (items.length === 0) return null

  return (
    <Panel>
      <h2 className="font-display text-sm font-medium text-[#1C1E21]">Today</h2>
      <ul className="mt-2 flex flex-col divide-y divide-gray-100">
        {items.map((item, i) => (
          <TodayItemRow key={i} item={item} />
        ))}
      </ul>
    </Panel>
  )
}

export function CommandRail({ advisor, today, applyGoal }: Props) {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <aside className="w-full shrink-0 px-4 lg:w-[300px] lg:px-8 lg:pr-0">
      <div className="flex flex-col gap-4">
        {applyGoal ? <ApplyGoalHero goal={applyGoal} /> : null}
        <AdvisorPanel advisor={advisor} />
        <TodayPanel
          items={today}
          hasJobs={applyGoal !== null}
          onAddJob={() => setAddOpen(true)}
        />
      </div>
      <AddJobModal open={addOpen} onOpenChange={setAddOpen} />
    </aside>
  )
}

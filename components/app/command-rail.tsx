"use client"

import { Fragment, useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  ChevronDown,
  Compass,
  ExternalLink,
  Lightbulb,
  Plus,
  X,
} from "lucide-react"

import { getJobSourceAdvisorAction } from "@/app/app/actions"
import {
  GENERIC_BOARDS,
  type Advisor,
  type BoardRating,
} from "@/lib/jobSourceAdvisor/boardRatings"
import type { ApplyProjection } from "@/lib/jobSourceAdvisor/applyProjections"
import { type Milestone } from "@/lib/quests/quests"
import { cn } from "@/lib/utils"

import { AddJobModal } from "./add-job-modal"
import { GuideGem, type GuidePose } from "./widgets/guide-gem"

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
  milestone: Milestone | null
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

// Quest-voice line for a Today item. Shared by the Today rows and the hero's
// "Next quest" so they always agree.
function todayCoachLine(item: TodayItem): string {
  switch (item.kind) {
    case "prep_due":
      if (item.stageLabel === "Screen") return `Prep your ${item.company} screen`
      if (item.stageLabel === "Hiring Manager")
        return `Read the room before the ${item.company} HM call`
      if (item.stageLabel === "Full Loop")
        return `Prep all rounds at ${item.company}`
      return `Prep your ${item.company} ${item.stageLabel} round`
    case "quick_prep_gap":
      return `Get a first read on ${item.company}`
    case "source_nudge":
      return `Check ${item.board} for ${item.role} roles, your strongest source (${item.score}/10)`
  }
}

// Rail card base (spec: bg surface, border --border, radius 16, shadow E0,
// overflow hidden). Each consumer owns its internal padding.
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
        "overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-e0)]",
        className
      )}
    >
      {children}
    </div>
  )
}

// Apply-goal hero (spec: radius 20, padding 24/24/22, shadow E4, decorative
// radial blob, eyebrow, big numeral row, 15-segment pace meter, copy). The
// estimate projections moved to the Insights card. "Next quest" is preserved
// as the Phase 2A quest-framing line beneath the meter.
function ApplyGoalHero({
  goal,
  nextQuest,
}: {
  goal: ApplyGoal
  nextQuest: string | null
}) {
  const logged = Math.min(goal.loggedThisWeek, APPLY_TARGET)
  const met = goal.loggedThisWeek >= APPLY_TARGET
  const copy = met
    ? "Pace met. Steady beats bursts, keep it going."
    : "15 to 20 a week is the researched sweet spot, and steady beats bursts."

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-6 pb-[22px] pt-6 shadow-[var(--shadow-e4)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-[140px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(79,70,229,0.06), transparent 70%)",
        }}
      />
      <p className="type-eyebrow text-[var(--text-muted)]">Apply goal</p>
      <div className="mt-3.5 flex items-baseline gap-[9px]">
        <span className="type-hero-numeral tabular-nums text-[var(--text-primary)]">
          {goal.loggedThisWeek}
        </span>
        <span className="type-hero-denominator tabular-nums text-[var(--text-fainter)]">
          / {APPLY_TARGET}
        </span>
        <span className="ml-auto self-end pb-[9px] type-rail-label text-[var(--text-faint)]">
          this week
        </span>
      </div>
      <div className="mb-[9px] mt-[18px] flex gap-1">
        {Array.from({ length: APPLY_TARGET }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-[9px] flex-1 rounded-[5px]",
              i < logged
                ? "bg-[var(--accent)]"
                : i === logged && !met
                  ? "animate-[guildyPulse_2.4s_ease-in-out_infinite]"
                  : "bg-[#E2E7EE]"
            )}
          />
        ))}
      </div>
      <p className="text-[12px] font-semibold tabular-nums text-[var(--text-fainter)]">
        {goal.loggedThisWeek} of {APPLY_TARGET} logged
      </p>
      <p className="mt-3.5 text-[13.5px] leading-[1.5] text-[var(--text-body)]">
        {copy}
      </p>
      {nextQuest ? (
        <p className="mt-3.5 border-t border-[var(--divider-kanban)] pt-3.5 text-[13px] leading-[1.45] text-[var(--text-body)]">
          <span className="text-[var(--text-muted)]">Next quest: </span>
          {nextQuest}
        </p>
      ) : null}
    </div>
  )
}

// Insights card (spec). Stat-forward rows derived from the same researched
// ranges as the old hero projection, restructured to {stat, text}.
function InsightsCard({ rows }: { rows: ApplyProjection["rows"] }) {
  if (rows.length === 0) return null
  return (
    <Panel>
      <div className="flex items-center gap-[9px] border-b border-[var(--divider-kanban)] px-4 pb-3 pt-3.5">
        <Lightbulb className="size-[15px] shrink-0 text-[#8A93A3]" />
        <span className="text-[13px] font-bold tracking-[0.02em] text-[var(--text-primary)]">
          Insights
        </span>
        <span className="ml-auto type-model-badge text-[var(--text-fainter)]">
          Live estimate
        </span>
      </div>
      <div className="flex flex-col gap-[13px] px-4 py-[15px]">
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <div className="h-px bg-[var(--divider-kanban)]" /> : null}
            <div className="flex items-start gap-[11px]">
              <span className="type-insights-stat shrink-0 tabular-nums text-[var(--text-primary)]">
                {row.stat}
              </span>
              <span className="text-[12.5px] leading-[1.45] text-[var(--text-muted)]">
                {row.text}
              </span>
            </div>
          </Fragment>
        ))}
      </div>
    </Panel>
  )
}

function BoardRow({ board, isTop }: { board: BoardRating; isTop: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2 py-[9px] [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--divider-kanban)]">
      <span className="min-w-0 truncate text-[13px] font-medium text-[#3A4453]">
        {board.board}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-[7px] px-2 py-0.5 text-[12px] font-semibold tabular-nums",
          isTop
            ? "bg-[var(--indigo-tint-bg)] text-[var(--indigo)]"
            : "bg-[var(--salary-bg)] text-[var(--text-muted)]"
        )}
      >
        {board.score}/10
      </span>
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

  const roleText = advisor.roleLabel ?? "your search"
  const sub = loading
    ? "Finding your board map..."
    : `${boards.length} boards for ${roleText}`
  const maxScore = boards.reduce((m, b) => Math.max(m, b.score), 0)

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-[18px] py-4 text-left transition-colors hover:bg-[#F7F9FB]"
      >
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--indigo-tint-bg)]">
          <Compass className="size-4 text-[var(--indigo)]" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14.5px] font-semibold text-[var(--text-primary)]">
            Where to look
          </span>
          <span className="truncate text-[12.5px] text-[var(--text-faint)]">
            {sub}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--text-fainter)] transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded ? (
        <div className="flex flex-col border-t border-[var(--divider-kanban)] px-[18px] pb-4 pt-0.5">
          {loading ? (
            <div className="flex flex-col gap-3 py-3" aria-live="polite">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-3 w-2/3 animate-pulse rounded bg-[var(--divider)]"
                />
              ))}
            </div>
          ) : (
            <>
              <ul className="flex flex-col">
                {boards.map((board) => (
                  <BoardRow
                    key={board.board}
                    board={board}
                    isTop={board.score === maxScore}
                  />
                ))}
              </ul>
              {note ? (
                <p className="mt-2 text-[11px] leading-snug text-[var(--text-fainter)]">
                  {note}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </Panel>
  )
}

// A single internal deep-link row (prep-due, quick-prep gap). Opens the
// job's prep overlay via the Board's ?job= search param.
function ActionRow({ href, label }: { href: string; label: string }) {
  return (
    <li className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--divider-kanban)]">
      <Link
        href={href}
        className="flex items-start justify-between gap-3 py-[11px] transition-opacity hover:opacity-70"
      >
        <span className="text-[13.5px] leading-[1.45] text-[#3A4453]">
          {label}
        </span>
        <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-[#AEB7C2]" />
      </Link>
    </li>
  )
}

function TodayItemRow({ item }: { item: TodayItem }) {
  switch (item.kind) {
    case "prep_due":
      return (
        <ActionRow href={`/app?job=${item.jobId}`} label={todayCoachLine(item)} />
      )
    case "quick_prep_gap":
      return (
        <ActionRow href={`/app?job=${item.jobId}`} label={todayCoachLine(item)} />
      )
    case "source_nudge": {
      const url = boardUrl(item.board, item.role)
      const label = todayCoachLine(item)
      if (!url) {
        return (
          <li className="py-[11px] text-[13.5px] leading-[1.45] text-[#3A4453] [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--divider-kanban)]">
            {label}
          </li>
        )
      }
      return (
        <li className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--divider-kanban)]">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start justify-between gap-3 py-[11px] transition-opacity hover:opacity-70"
          >
            <span className="text-[13.5px] leading-[1.45] text-[#3A4453]">
              {label}
            </span>
            <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-[#AEB7C2]" />
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
      <Panel className="px-[18px] pb-[18px] pt-[18px]">
        <h2 className="type-today-heading text-[var(--text-primary)]">Today</h2>
        <p className="mt-2.5 text-[13.5px] leading-[1.45] text-[var(--text-muted)]">
          Add your first job and Today shows you exactly what to move next.
        </p>
        <button
          type="button"
          onClick={onAddJob}
          className="mt-3 inline-flex h-[42px] w-full items-center justify-center gap-1.5 rounded-[13px] bg-[var(--ink)] px-3 text-[15px] font-semibold tracking-[0.01em] text-white shadow-[var(--shadow-ink-cta)] transition-colors hover:bg-[var(--ink-hover)]"
        >
          <Plus className="size-4" />
          Add your first job
        </button>
      </Panel>
    )
  }

  if (items.length === 0) return null

  return (
    <Panel className="px-[18px] pb-2 pt-[18px]">
      <h2 className="type-today-heading mb-2.5 text-[var(--text-primary)]">
        Today
      </h2>
      <ul className="flex flex-col">
        {items.map((item, i) => (
          <TodayItemRow key={i} item={item} />
        ))}
      </ul>
    </Panel>
  )
}

export function CommandRail({
  advisor,
  today,
  applyGoal,
  milestone,
}: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Milestone dismissal is session-only (no migration). Read after mount so SSR
  // and first client render match (both treat it as not-yet-dismissed).
  useEffect(() => {
    setMounted(true)
    if (!milestone) return
    try {
      if (sessionStorage.getItem(`guildy_ms_${milestone.key}`) === "1") {
        setDismissed(true)
      }
    } catch {
      // sessionStorage unavailable; milestone simply stays shown.
    }
  }, [milestone?.key])

  const milestoneVisible = mounted && !!milestone && !dismissed

  function dismissMilestone() {
    if (!milestone) return
    try {
      sessionStorage.setItem(`guildy_ms_${milestone.key}`, "1")
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  const nextQuest =
    applyGoal === null
      ? "Add a job to start the quest line"
      : today.length > 0
        ? todayCoachLine(today[0])
        : null

  // Guide gem pose by present context: a live milestone celebrates, a live top
  // quest or tip offers, otherwise it rests.
  const pose: GuidePose = milestoneVisible
    ? "celebrating"
    : nextQuest
      ? "offering"
      : "resting"

  return (
    <aside className="w-full shrink-0 px-4 lg:w-[300px] lg:px-8 lg:pr-0">
      <div className="flex flex-col gap-[18px]">
        <GuideGem pose={pose} />
        {milestoneVisible && milestone ? (
          <div className="flex items-start gap-2 rounded-[var(--radius-12)] border border-[var(--accent-tint-border)] bg-[var(--accent-tint-bg)] px-3 py-2.5">
            <p className="type-card-sublabel flex-1 text-[var(--accent-deep)]">
              {milestone.text}
            </p>
            <button
              type="button"
              onClick={dismissMilestone}
              aria-label="Dismiss"
              className="shrink-0 text-[var(--accent-deep)]/60 transition-colors hover:text-[var(--accent-deep)]"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
        {applyGoal ? (
          <>
            <ApplyGoalHero goal={applyGoal} nextQuest={nextQuest} />
            <InsightsCard rows={applyGoal.projection.rows} />
          </>
        ) : null}
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

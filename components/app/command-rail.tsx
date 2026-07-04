"use client"

import { Fragment, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  ChevronDown,
  Compass,
  ExternalLink,
  Lightbulb,
  X,
} from "lucide-react"

import { getJobSourceAdvisorAction } from "@/app/app/actions"
import { AddJobModal } from "./add-job-modal"
import {
  GENERIC_BOARDS,
  type Advisor,
  type BoardRating,
} from "@/lib/jobSourceAdvisor/boardRatings"
import type { ApplyProjection } from "@/lib/jobSourceAdvisor/applyProjections"
import { type Milestone } from "@/lib/quests/quests"
import { cn } from "@/lib/utils"

import { Gem } from "./widgets/guide-gem"

// Today panel items, server-built in app/app/page.tsx and passed in as a
// typed array. Discriminated on `kind`. The renderer below maps each kind to
// a row; new task types (e.g. a future Target Company List nudge) extend this
// union and add a branch, keeping the panel an extensible container.
export type TodayItem =
  | { kind: "prep_due"; jobId: string; company: string; stageLabel: string }
  | { kind: "quick_prep_gap"; jobId: string; company: string }
  | { kind: "source_nudge"; board: string; role: string; score: number }

// Apply-goal hero data. Null when the user has no non-closed jobs (the
// onboarding card carries the rail instead). loggedThisWeek counts jobs created
// in the last rolling 7 days; projection is the estimate-labeled, range-based
// outlook derived from the researched base rates.
export type ApplyGoal = {
  loggedThisWeek: number
  projection: ApplyProjection
}

// Just-in-time onboarding moment (gem-guide section 6). Server-derived from job
// count + prep state. "New stage reached" is deferred (needs a stage-event
// signal we do not yet have); faking it with a proxy would nag, so it is out.
export type OnboardingMoment =
  | { kind: "empty" }
  | { kind: "first_job"; company: string }

// FTUE setup checklist (G0 growth build). Server-derived in app/app/page.tsx;
// null once the user is activated (page.tsx computes the hide-forever gate),
// so this component never has to decide visibility. activeJobCount drives the
// "X of 3" progress; hasPrep is any prep_versions row; mostRecentJobId targets
// the prep overlay for the Generate step.
export type SetupChecklist = {
  activeJobCount: number
  hasPrep: boolean
  mostRecentJobId: string | null
}

type Props = {
  advisor: Advisor
  today: TodayItem[]
  applyGoal: ApplyGoal | null
  milestone: Milestone | null
  onboarding: OnboardingMoment | null
  setup: SetupChecklist | null
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

// Gem-voice move for a Today item (gem-guide sections 4 + 7). The lead clause
// is bolded; `supporting` is the optional coaching sentence (only stages that
// have one in section 7 carry it, so nothing is fabricated). `verb` is the
// button label; href + external resolve the action.
type GemMove = {
  lead: string
  supporting: string | null
  verb: string
  href: string | null
  external: boolean
}

function gemMove(item: TodayItem): GemMove {
  switch (item.kind) {
    case "prep_due": {
      const href = `/app?job=${item.jobId}`
      if (item.stageLabel === "Screen") {
        return {
          lead: `Prep your ${item.company} screen.`,
          supporting: "Screens reward clear thinking out loud.",
          verb: "Run Deep Prep",
          href,
          external: false,
        }
      }
      if (item.stageLabel === "Hiring Manager") {
        return {
          lead: `Read the room before the ${item.company} HM call.`,
          supporting: null,
          verb: "Run Deep Prep",
          href,
          external: false,
        }
      }
      if (item.stageLabel === "Full Loop") {
        return {
          lead: `Prep all your rounds at ${item.company}.`,
          supporting: null,
          verb: "Run Deep Prep",
          href,
          external: false,
        }
      }
      return {
        lead: `Prep your ${item.company} ${item.stageLabel} round.`,
        supporting: null,
        verb: "Run Deep Prep",
        href,
        external: false,
      }
    }
    case "quick_prep_gap":
      return {
        lead: `Get a first read on ${item.company}.`,
        supporting: null,
        verb: "Run Quick Prep",
        href: `/app?job=${item.jobId}`,
        external: false,
      }
    case "source_nudge":
      return {
        lead: `Check ${item.board} for ${item.role} roles.`,
        supporting: `Your strongest source, ${item.score}/10.`,
        verb: "See where to look",
        href: boardUrl(item.board, item.role),
        external: true,
      }
  }
}

// Gem-voice line: bold lead clause + optional supporting sentence.
function GemLine({ move, className }: { move: GemMove; className?: string }) {
  return (
    <p className={className}>
      <strong className="font-semibold text-[var(--text-primary)]">
        {move.lead}
      </strong>
      {move.supporting ? ` ${move.supporting}` : null}
    </p>
  )
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

// Milestone card (gem-guide section 5): dismissible gradient card, 72px
// celebrating gem (idle bob), Bricolage title + body. Encouragement only, no
// streaks, no loss state. Replaces the Phase 2A milestone chip.
function MilestoneCard({
  milestone,
  onDismiss,
}: {
  milestone: Milestone
  onDismiss: () => void
}) {
  return (
    <div
      className="relative flex items-center gap-4 rounded-[16px] border px-5 py-[18px] shadow-[0_10px_30px_-14px_rgba(91,33,182,0.30)]"
      style={{
        background:
          "linear-gradient(135deg, var(--milestone-from), var(--milestone-to))",
        borderColor: "var(--milestone-border)",
      }}
    >
      <Gem pose="celebrating" size={72} float className="shrink-0" />
      <div className="min-w-0 pr-4">
        <h2 className="font-bricolage text-[18px] font-semibold leading-[1.2] tracking-[-0.01em] text-[var(--text-primary)]">
          {milestone.title}
        </h2>
        <p className="mt-[5px] text-[13.5px] leading-[1.5] text-[var(--text-body)]">
          {milestone.body}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 inline-flex size-6 items-center justify-center rounded-md text-[var(--dismiss)] transition-colors hover:text-[var(--text-body)]"
      >
        <X className="size-[13px]" strokeWidth={2.2} />
      </button>
    </div>
  )
}

// Onboarding card (gem-guide section 6): just-in-time, no forced tour. Moment
// eyebrow + 46px gem + one gem-voice sentence. No button (the Add Job CTA
// lives in the Applied column); this card is the gem's voice only.
function OnboardingCard({ moment }: { moment: OnboardingMoment }) {
  const eyebrow = moment.kind === "empty" ? "Empty board" : "After the first job"
  const pose = moment.kind === "empty" ? "resting" : "offering"
  const line =
    moment.kind === "empty"
      ? "Add your first job and I'll line up your first move."
      : `Got it. Run a Quick Prep on ${moment.company} to see what I can do.`
  return (
    <Panel className="px-[22px] py-[22px]">
      <p className="mb-3.5 text-[10.5px] font-bold uppercase tracking-[0.10em] text-[var(--gem-label)]">
        {eyebrow}
      </p>
      <div className="flex items-start gap-[13px]">
        <Gem pose={pose} size={46} className="shrink-0" />
        <p className="pt-1 text-[14px] leading-[1.55] text-[var(--text-secondary)]">
          {line}
        </p>
      </div>
    </Panel>
  )
}

// Apply-goal hero (gem-guide / dashboard "Image 2": radius 20, padding
// 24/24/22, shadow E4, radial blob, "Apply goal" eyebrow, big numeral row,
// 15-segment pace meter, sweet-spot sub-line). The gem next-move card owns the
// next move now, so the hero carries no quest framing.
function ApplyGoalHero({ goal }: { goal: ApplyGoal }) {
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
  // Boards carry a generic jobs URL on the rating record. When present the name
  // gets a persistent inline-link affordance: the app's --accent-deep link
  // token (same as "Compare Quick vs Deep") + a trailing ExternalLink icon +
  // hover underline, so the row reads clickable at rest, not only on hover. The
  // name truncates while the icon stays (shrink-0) so long names never wrap.
  // Boards with a null url (e.g. "Company career pages") stay plain #3A4453
  // text. Row layout, rating chip, and dividers are unchanged.
  const baseName = "text-[13px] font-medium"
  return (
    <li className="flex items-center justify-between gap-2 py-[9px] [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--divider-kanban)]">
      {board.url ? (
        <a
          href={board.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            baseName,
            "flex min-w-0 items-center gap-1 text-[var(--accent-deep)] hover:underline"
          )}
        >
          <span className="truncate">{board.board}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        <span className={cn(baseName, "min-w-0 truncate text-[#3A4453]")}>
          {board.board}
        </span>
      )}
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

// Today row (tuning pass 2): plain text line with a trailing nav arrow
// (ArrowRight internal / ExternalLink source nudge). No gem, no sub-button.
function TodayRow({ item }: { item: TodayItem }) {
  const move = gemMove(item)
  const inner =
    "flex items-start justify-between gap-3 py-[11px] transition-opacity hover:opacity-70"
  const line = (
    <GemLine
      move={move}
      className="min-w-0 flex-1 text-[13.5px] leading-[1.45] text-[var(--text-secondary)]"
    />
  )
  return (
    <li className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--divider)]">
      {move.href ? (
        move.external ? (
          <a
            href={move.href}
            target="_blank"
            rel="noopener noreferrer"
            className={inner}
          >
            {line}
            <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-[var(--text-faint)]" />
          </a>
        ) : (
          <Link href={move.href} className={inner}>
            {line}
            <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-[var(--text-faint)]" />
          </Link>
        )
      ) : (
        <div className={inner}>{line}</div>
      )}
    </li>
  )
}

// Today panel (tuning pass 2): plain "Today" text header (no gem, no count),
// the gem's short list (max 3) as plain rows. Hidden when there are jobs but
// nothing actionable, and when there are no jobs (onboarding carries the
// empty rail).
function TodayPanel({ items }: { items: TodayItem[] }) {
  if (items.length === 0) return null
  return (
    <Panel className="px-5 pb-2 pt-5">
      <h2 className="mb-1 text-[15px] font-bold text-[var(--text-primary)]">
        Today
      </h2>
      <ul className="flex flex-col">
        {items.map((item, i) => (
          <TodayRow key={i} item={item} />
        ))}
      </ul>
    </Panel>
  )
}

// One checklist step. Done steps are non-interactive (filled check, muted
// label). Incomplete steps that carry an action (href or onClick) render as an
// affordance with a trailing arrow; an incomplete step with no action yet
// (Generate before any job exists) is a plain pending row.
type SetupStep = {
  key: string
  done: boolean
  title: string
  subtitle: string | null
  pulse: boolean
  href: string | null
  onClick: (() => void) | null
}

const SETUP_ROW_INNER = "flex w-full items-start gap-2.5 py-[10px] text-left"

function SetupRow({ step }: { step: SetupStep }) {
  const interactive = !step.done && !!(step.href || step.onClick)

  const marker = step.done ? (
    <span className="mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[var(--accent)]">
      <Check className="size-3 text-white" strokeWidth={3} />
    </span>
  ) : (
    <span className="mt-px inline-flex size-[18px] shrink-0 rounded-full border-2 border-[var(--border-strong)]" />
  )

  const body = (
    <>
      {marker}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[13.5px] leading-[1.4]",
            step.done
              ? "text-[var(--text-faint)]"
              : "font-semibold text-[var(--text-primary)]"
          )}
        >
          {step.title}
        </span>
        {step.subtitle ? (
          <span className="mt-0.5 block text-[12px] tabular-nums text-[var(--text-faint)]">
            {step.subtitle}
          </span>
        ) : null}
      </span>
      {interactive ? (
        <ArrowRight className="mt-px size-3.5 shrink-0 text-[var(--text-faint)]" />
      ) : null}
    </>
  )

  // The one-shot pulse animates the row background (guildyPulse) for two short
  // cycles, then the parent clears the flag. Rounded so the wash reads as a
  // highlight, not a full-bleed band.
  const pulseClass = step.pulse
    ? "animate-[guildyPulse_1.2s_ease-in-out_2] rounded-[8px]"
    : ""

  return (
    <li className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--divider)]">
      {interactive && step.href ? (
        <Link
          href={step.href}
          className={cn(SETUP_ROW_INNER, "transition-opacity hover:opacity-70", pulseClass)}
        >
          {body}
        </Link>
      ) : interactive ? (
        <button
          type="button"
          onClick={step.onClick ?? undefined}
          className={cn(SETUP_ROW_INNER, "transition-opacity hover:opacity-70", pulseClass)}
        >
          {body}
        </button>
      ) : (
        <div className={cn(SETUP_ROW_INNER, pulseClass)}>{body}</div>
      )}
    </li>
  )
}

// Setup checklist card (G0 growth build): the first-session path from 0 jobs to
// activated. Mounts its own Add Job modal so steps 1 and 3 open it with no
// board wiring; step 2 links to the prep overlay on the most recent job. Shown
// only while page.tsx passes a non-null `setup`, so it disappears for good once
// the user activates.
function SetupCard({ setup }: { setup: SetupChecklist }) {
  const [addOpen, setAddOpen] = useState(false)

  const jobsLogged = Math.min(setup.activeJobCount, 3)

  // One-shot pulse on the Generate step when the user logs their first job
  // (active count 0 -> 1) while this card is mounted, regardless of whether the
  // job came from this modal or the Applied column button. prevCountRef seeds
  // from the server value so SSR and the first client render agree (no pulse),
  // and a fresh landing at count 1 never triggers it.
  const [pulseStep2, setPulseStep2] = useState(false)
  const prevCountRef = useRef(setup.activeJobCount)
  useEffect(() => {
    const prev = prevCountRef.current
    prevCountRef.current = setup.activeJobCount
    if (prev === 0 && setup.activeJobCount === 1 && !setup.hasPrep) {
      setPulseStep2(true)
      const t = setTimeout(() => setPulseStep2(false), 2600)
      return () => clearTimeout(t)
    }
  }, [setup.activeJobCount, setup.hasPrep])

  const steps: SetupStep[] = [
    {
      key: "add",
      done: setup.activeJobCount >= 1,
      title: "Add your first job",
      subtitle: null,
      pulse: false,
      href: null,
      onClick: () => setAddOpen(true),
    },
    {
      key: "prep",
      done: setup.hasPrep,
      title: "Generate your first prep",
      subtitle: null,
      pulse: pulseStep2,
      href: setup.mostRecentJobId ? `/app?job=${setup.mostRecentJobId}` : null,
      onClick: null,
    },
    {
      key: "more",
      done: setup.activeJobCount >= 3,
      title: "Add 2 more jobs",
      subtitle: `${jobsLogged} of 3`,
      pulse: false,
      href: null,
      onClick: () => setAddOpen(true),
    },
  ]

  return (
    <Panel className="px-5 pb-2.5 pt-5">
      <h2 className="mb-2 text-[15px] font-bold text-[var(--text-primary)]">
        Get set up
      </h2>
      <ul className="flex flex-col">
        {steps.map((step) => (
          <SetupRow key={step.key} step={step} />
        ))}
      </ul>
      <AddJobModal open={addOpen} onOpenChange={setAddOpen} defaultStage="applied" />
    </Panel>
  )
}

export function CommandRail({
  advisor,
  today,
  applyGoal,
  milestone,
  onboarding,
  setup,
}: Props) {
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

  // Primary gem surface: the onboarding card during early moments only. The
  // steady-state "Your next move" card was removed (it duplicated the Today
  // panel and was a purple source); hero + Today carry the rail. Order:
  // setup -> milestone -> hero -> onboarding (early) -> insights -> where ->
  // Today. The FTUE setup checklist supersedes the onboarding gem card while
  // shown, so a pre-activation user sees one onboarding surface, not two.
  const primary = onboarding && !setup ? <OnboardingCard moment={onboarding} /> : null

  return (
    <aside className="w-full shrink-0 px-4 lg:w-[300px] lg:px-8 lg:pr-0">
      <div className="flex flex-col gap-[18px]">
        {setup ? <SetupCard setup={setup} /> : null}
        {milestoneVisible && milestone ? (
          <MilestoneCard milestone={milestone} onDismiss={dismissMilestone} />
        ) : null}
        {applyGoal ? <ApplyGoalHero goal={applyGoal} /> : null}
        {primary}
        {applyGoal ? <InsightsCard rows={applyGoal.projection.rows} /> : null}
        <AdvisorPanel advisor={advisor} />
        <TodayPanel items={today} />
      </div>
    </aside>
  )
}

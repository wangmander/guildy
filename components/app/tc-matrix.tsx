"use client"

import { useState } from "react"
import { Handshake, Plus, SlidersHorizontal } from "lucide-react"

import {
  COMP_DIMS,
  SOFT_DIMS,
  resolveCompPriorities,
  type CompPrioritiesRaw,
} from "@/lib/compMatrix/dimensions"
import {
  autoRating,
  compMaxes,
  dimValue,
  overallScore,
  softRating,
  winnerIndex,
} from "@/lib/compMatrix/scoring"
import { parseMoneyString } from "@/lib/compMatrix/normalize"
import { cn } from "@/lib/utils"
import type { JobCompensation } from "@/types"

import { AddJobModal } from "./add-job-modal"
import { CompEditModal } from "./widgets/comp-edit-modal"
import { ComparisonSettingsModal } from "./widgets/comparison-settings-modal"
import { NegotiationPanel } from "./widgets/negotiation-panel"
import { UpgradeModal } from "./widgets/upgrade-modal"

export type TcColumn = {
  jobId: string
  company: string
  role: string
  tc: string | null
  comp: JobCompensation | null
}

type Props = {
  columns: TcColumn[]
  subscriptionStatus: string
  currentPeriodEnd: string | null
  compPriorities: CompPrioritiesRaw
}

// Same rule as the server-side Negotiation/Deep gate: active, or past_due
// within a 3-day grace window. (Feature 4 surface, preserved.)
function isSubscribed(status: string, periodEnd: string | null): boolean {
  if (status === "active") return true
  if (status === "past_due" && periodEnd) {
    return new Date(periodEnd).getTime() + 3 * 24 * 60 * 60 * 1000 > Date.now()
  }
  return false
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`
}

function hasAnyComp(comp: JobCompensation | null): boolean {
  if (!comp) return false
  return (
    (comp.base ?? 0) > 0 ||
    (comp.signing_bonus ?? 0) > 0 ||
    (comp.annual_bonus_pct ?? 0) > 0 ||
    (comp.equity_grant_total ?? 0) > 0
  )
}

// Auto-carry the comp the user already entered on the card (jobs.tc) into the
// matrix so a known offer never renders an empty "Add compensation" column.
// A clean single value ("180k", "$190,000") seeds Base (and thus Year-1) and
// rates normally. A tc that can't parse to one number (ranges like
// "$170k-$205k", or "210k + 200k equity") returns the original comp, so the
// column instead shows the raw tc string as its headline (see ViewColumn.tcOnly)
// rather than an Add prompt. Existing structured comp always wins; any soft
// ratings already on the row are preserved.
function effectiveComp(c: TcColumn): JobCompensation | null {
  if (hasAnyComp(c.comp)) return c.comp
  const base = parseMoneyString(c.tc)
  if (base === null) return c.comp
  const baseRow: JobCompensation = c.comp ?? {
    id: `seed-${c.jobId}`,
    job_id: c.jobId,
    user_id: "",
    base: null,
    signing_bonus: null,
    annual_bonus_pct: null,
    equity_grant_total: null,
    vesting_years: null,
    location: null,
    benefits_notes: null,
    ratings: {},
    created_at: "",
    updated_at: "",
  }
  return { ...baseRow, base }
}

// A column with its effective comp resolved. tcOnly = the job has comp text
// but it couldn't be parsed into a number, so the column is "present" (no Add
// prompt) and renders tcText as the Year-1 headline with no numeric breakdown.
type ViewColumn = TcColumn & { tcOnly: boolean; tcText: string | null }

const LABEL_COL = "sticky left-0 z-10 w-[210px] whitespace-nowrap bg-[var(--surface)]"
const VALUE_COL = "w-[220px]"
// BEST-column wash tints (comp-sheet-only, literal per spec).
const BEST_CELL_BG = "bg-[#FAF8FE]"

const Dash = () => <span className="text-[var(--text-fainter)]">-</span>

// A value row. scoredCount === 0 (no offer has this dimension) grays the whole
// row, excluded from the overall (the scoring math already excludes it). When
// at least one offer has it, the row is active: offers missing the value get a
// needs-input warn cell that opens that offer's comp modal.
function MatrixRow({
  label,
  columns,
  winIdx,
  present,
  renderValue,
  onAdd,
  topBorder = false,
  labelClassName,
}: {
  label: string
  columns: ViewColumn[]
  winIdx: number
  present: (c: ViewColumn) => boolean
  renderValue: (c: ViewColumn) => React.ReactNode
  onAdd: (c: ViewColumn) => void
  topBorder?: boolean
  labelClassName?: string
}) {
  const gray = columns.filter(present).length === 0
  // Year-1 anchor gets a heavier top rule; the BEST cell uses a tinted one.
  const topBase = topBorder ? "border-t-[1.5px] border-t-[var(--border)]" : ""
  const topBest = topBorder ? "border-t-[1.5px] border-t-[#E4D3F8]" : ""
  return (
    <tr className="border-b border-[var(--divider-faint)]">
      <td
        className={cn(
          LABEL_COL,
          "py-[13px] pr-4 text-left text-[13.5px]",
          topBase,
          gray ? "text-[var(--text-fainter)]" : "text-[var(--text-body)]",
          labelClassName
        )}
      >
        {label}
      </td>
      {columns.map((c, i) => {
        const isBest = i === winIdx
        const cellTop = isBest ? topBest : topBase
        if (gray) {
          return (
            <td
              key={c.jobId}
              className={cn(
                VALUE_COL,
                "px-[18px] py-[13px] text-right",
                cellTop,
                isBest && BEST_CELL_BG
              )}
            >
              <Dash />
            </td>
          )
        }
        if (present(c)) {
          return (
            <td
              key={c.jobId}
              className={cn(
                VALUE_COL,
                "px-[18px] py-[13px] text-right",
                cellTop,
                isBest && BEST_CELL_BG
              )}
            >
              {renderValue(c)}
            </td>
          )
        }
        return (
          <td
            key={c.jobId}
            className={cn(
              VALUE_COL,
              "border border-[var(--warn-border)] bg-[var(--warn-bg)] px-[18px] py-[13px] text-right",
              cellTop
            )}
          >
            <button
              type="button"
              onClick={() => onAdd(c)}
              className="text-xs font-semibold text-[var(--warn-text)] hover:underline"
            >
              Add
            </button>
          </td>
        )
      })}
    </tr>
  )
}

export function TcMatrix({
  columns,
  subscriptionStatus,
  currentPeriodEnd,
  compPriorities,
}: Props) {
  const [editingJob, setEditingJob] = useState<TcColumn | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [negotiateJob, setNegotiateJob] = useState<TcColumn | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const subscribed = isSubscribed(subscriptionStatus, currentPeriodEnd)

  function onNegotiate(c: TcColumn) {
    if (subscribed) setNegotiateJob(c)
    else setUpgradeOpen(true)
  }

  if (columns.length === 0) return null

  const multi = columns.length >= 2
  const lastIdx = columns.length - 1
  const { enabledSoft, weights } = resolveCompPriorities(compPriorities)
  const enabledSoftDims = SOFT_DIMS.filter((d) => enabledSoft.includes(d.key))

  // Resolve each column's effective comp once (seeds from jobs.tc when there's
  // no structured row). Everything below reads `eff`, not `columns`: the cells,
  // the scoring, the header CTA, the Negotiate enable, and the modals.
  const eff: ViewColumn[] = columns.map((c) => {
    const ec = effectiveComp(c)
    const tcText = c.tc?.trim() ? c.tc.trim() : null
    return { ...c, comp: ec, tcOnly: !hasAnyComp(ec) && !!tcText, tcText }
  })

  const comps = eff.map((c) => c.comp)
  const compMax = compMaxes(comps)
  const overalls = eff.map((c) =>
    overallScore(c.comp, { compMax, enabledSoft, weights })
  )
  const winIdx = multi ? winnerIndex(overalls) : -1

  return (
    <section>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border)] px-[13px] text-[13px] font-semibold text-[#46505F] transition-colors hover:bg-[var(--surface-sunken)]"
        >
          <SlidersHorizontal className="size-4" />
          Priorities
        </button>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] bg-[var(--ink)] px-[13px] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--ink-hover)]"
        >
          <Plus className="size-4" />
          Add offer
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-auto border-collapse text-sm">
          <thead>
            <tr>
              <th className={cn(LABEL_COL, "py-2 pr-4 text-left align-bottom")} />
              {eff.map((c, i) => {
                const isBest = multi && i === winIdx
                // Known = numeric comp (incl. tc-seeded base) or unparseable tc
                // text on the job. Either way it's "Edit comp", never "Add".
                const known = hasAnyComp(c.comp) || c.tcOnly
                return (
                  <th
                    key={c.jobId}
                    className={cn(
                      VALUE_COL,
                      "px-[18px] py-[15px] text-left align-bottom",
                      i === 0 && "rounded-tl-[14px]",
                      i === lastIdx && "rounded-tr-[14px]",
                      isBest
                        ? "border-t-2 border-t-[var(--accent)] bg-[#F3EFFB]"
                        : "bg-[#F7F8FB]"
                    )}
                  >
                    {isBest ? (
                      <span className="mb-1 inline-flex items-center rounded-[6px] bg-[var(--accent-chip-bg2)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--accent-deep)]">
                        BEST
                      </span>
                    ) : null}
                    <span className="block truncate font-bricolage text-[18px] font-semibold text-[var(--text-primary)]">
                      {c.company}
                    </span>
                    <span className="block truncate text-[12px] font-medium text-[var(--text-faint)]">
                      {c.role}
                    </span>
                    <div className="mt-1.5 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingJob(c)}
                        className={cn(
                          "text-[12px] transition-colors hover:text-[var(--accent)]",
                          known
                            ? "text-[var(--text-faint)]"
                            : "inline-flex items-center gap-1 font-medium text-[var(--accent-deep)] hover:underline"
                        )}
                      >
                        {known ? (
                          "Edit comp"
                        ) : (
                          <>
                            <Plus className="size-3" />
                            Add compensation
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onNegotiate(c)}
                        disabled={!hasAnyComp(c.comp)}
                        title={
                          !hasAnyComp(c.comp)
                            ? c.tcOnly
                              ? "Add a single comp figure to negotiate"
                              : "Add the offer's compensation first"
                            : undefined
                        }
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent-deep)] transition-opacity hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
                      >
                        <Handshake className="size-3 shrink-0" />
                        Negotiate
                      </button>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {/* Comp dims: dollar value plus an auto 1-10 (multi-offer). An
                offer is "present" at the offer level (has a comp row), so a $0
                sub-field renders normally; only no-comp offers highlight. */}
            {COMP_DIMS.map((d) => (
              <MatrixRow
                key={d.key}
                label={d.label}
                columns={eff}
                winIdx={winIdx}
                present={(c) => hasAnyComp(c.comp) || c.tcOnly}
                renderValue={(c) => {
                  // tcOnly columns have no numeric breakdown; the figure shows
                  // on the Year-1 row instead.
                  if (!hasAnyComp(c.comp)) return <Dash />
                  const rating = autoRating(d.key, c.comp, compMax[d.key] ?? 0)
                  return (
                    <span className="inline-flex items-baseline gap-2">
                      <span className="font-bricolage text-[14.5px] font-semibold tracking-[-0.01em] tabular-nums text-[var(--ink)]">
                        {usd(dimValue(d.key, c.comp))}
                      </span>
                      {multi && rating !== null ? (
                        <span className="rounded-[6px] bg-[var(--salary-bg)] px-1.5 py-px text-[11px] font-semibold tabular-nums text-[var(--text-body)]">
                          {rating}/10
                        </span>
                      ) : null}
                    </span>
                  )
                }}
                onAdd={setEditingJob}
              />
            ))}

            {/* Anchor: year-1 total, dollar only, no rating. Heavier top rule. */}
            <MatrixRow
              label="Year-1 total"
              columns={eff}
              winIdx={winIdx}
              topBorder
              labelClassName="font-semibold text-[var(--text-secondary)]"
              present={(c) => hasAnyComp(c.comp) || c.tcOnly}
              renderValue={(c) =>
                hasAnyComp(c.comp) ? (
                  <span className="font-bricolage text-[16px] font-semibold tabular-nums text-[var(--ink)]">
                    {usd(dimValue("year1_total", c.comp))}
                  </span>
                ) : (
                  // Unparseable tc: show the raw stored comp string as the
                  // headline so the known offer carries without re-entry.
                  <span
                    title={c.tcText ?? undefined}
                    className="block truncate font-bricolage text-[14px] font-medium text-[var(--text-secondary)]"
                  >
                    {c.tcText}
                  </span>
                )
              }
              onAdd={setEditingJob}
            />

            {/* Enabled soft dims: the user's 1-10 per offer, present per cell. */}
            {enabledSoftDims.map((d) => (
              <MatrixRow
                key={d.key}
                label={d.label}
                columns={eff}
                winIdx={winIdx}
                present={(c) => softRating(d.key, c.comp) !== null}
                renderValue={(c) => (
                  <span className="text-[13.5px] font-semibold tabular-nums text-[var(--text-secondary)]">
                    {softRating(d.key, c.comp)}/10
                  </span>
                )}
                onAdd={setEditingJob}
              />
            ))}

            {/* Overall: multi-offer only, winner highlighted with the full
                BEST wash + badge. */}
            {multi ? (
              <tr>
                <td
                  className={cn(
                    LABEL_COL,
                    "rounded-bl-[14px] bg-[#F4F0FC] py-[13px] pr-4 text-left text-[14px] font-bold text-[var(--ink)]"
                  )}
                >
                  Overall
                </td>
                {eff.map((c, i) => {
                  const isBest = i === winIdx
                  return (
                    <td
                      key={c.jobId}
                      className={cn(
                        VALUE_COL,
                        "px-[18px] py-[13px] text-right",
                        i === lastIdx && "rounded-br-[14px]",
                        isBest ? "bg-[#ECE3FB]" : "bg-[#F4F0FC]"
                      )}
                    >
                      {overalls[i] !== null ? (
                        <span className="inline-flex items-baseline gap-2">
                          {isBest ? (
                            <span className="rounded-[6px] bg-[var(--accent)] px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-white">
                              BEST
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              "font-bricolage tabular-nums",
                              isBest
                                ? "text-[19px] font-bold text-[var(--accent-deep)]"
                                : "text-[17px] font-semibold text-[var(--text-secondary)]"
                            )}
                          >
                            {overalls[i]!.toFixed(1)}
                          </span>
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </td>
                  )
                })}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="ml-1 mt-4 max-w-[620px] text-[12px] leading-[1.5] text-[var(--text-fainter)]">
        Weighted by your priorities. Adjust priorities to see the overall shift.
      </p>

      <CompEditModal
        job={editingJob}
        enabledSoft={enabledSoft}
        onOpenChange={(open) => {
          if (!open) setEditingJob(null)
        }}
      />
      <ComparisonSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        compPriorities={compPriorities}
      />
      <AddJobModal
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultStage="offer"
      />
      <NegotiationPanel
        job={negotiateJob}
        onOpenChange={(open) => {
          if (!open) setNegotiateJob(null)
        }}
      />
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </section>
  )
}

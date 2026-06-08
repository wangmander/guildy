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

const LABEL_COL = "sticky left-0 z-10 w-[210px] whitespace-nowrap bg-white"
const VALUE_COL = "w-[220px] border-x border-gray-200"
const HEADLINE_BG = "bg-[#EDE9FE]"

const Dash = () => <span className="text-gray-300">-</span>

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
  const { enabledSoft, weights } = resolveCompPriorities(compPriorities)
  const enabledSoftDims = SOFT_DIMS.filter((d) => enabledSoft.includes(d.key))

  const comps = columns.map((c) => c.comp)
  const compMax = compMaxes(comps)
  const overalls = columns.map((c) =>
    overallScore(c.comp, { compMax, enabledSoft, weights })
  )
  const winIdx = multi ? winnerIndex(overalls) : -1

  const unratedExists =
    multi &&
    enabledSoftDims.some((d) =>
      columns.some((c) => softRating(d.key, c.comp) === null)
    )

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] leading-snug text-gray-400">
          Comp rates relative to these offers, soft scores are yours. The overall
          is a weighted decision aid, not exact science.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-200 px-2.5 text-sm font-medium text-[#1C1E21] transition-colors hover:bg-gray-50"
          >
            <SlidersHorizontal className="size-4" />
            Priorities
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-gray-200 px-2.5 text-sm font-medium text-[#1C1E21] transition-colors hover:bg-gray-50"
          >
            <Plus className="size-4" />
            Add offer
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-auto border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className={cn(LABEL_COL, "py-2 pr-3 text-left")} />
              {columns.map((c) => (
                <th
                  key={c.jobId}
                  className={cn(
                    VALUE_COL,
                    "border-b border-gray-200 bg-[#F8F9FA] px-3 py-2 text-right align-top"
                  )}
                >
                  <span className="block truncate font-medium text-[#1C1E21]">
                    {c.company}
                  </span>
                  <span className="block truncate text-xs font-normal text-gray-500">
                    {c.role}
                  </span>
                  {hasAnyComp(c.comp) ? (
                    <button
                      type="button"
                      onClick={() => setEditingJob(c)}
                      className="mt-1 text-xs font-normal text-gray-500 transition-colors hover:text-[#4E3BDD]"
                    >
                      Edit comp
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingJob(c)}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#4E3BDD] hover:underline"
                    >
                      <Plus className="size-3" />
                      Add compensation
                    </button>
                  )}
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => onNegotiate(c)}
                      disabled={!hasAnyComp(c.comp)}
                      title={
                        !hasAnyComp(c.comp)
                          ? "Add the offer's compensation first"
                          : undefined
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#4E3BDD] transition-opacity hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
                    >
                      <Handshake className="size-3 shrink-0" />
                      Negotiate
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Comp dims: dollar value plus an auto 1-10 (multi-offer). */}
            {COMP_DIMS.map((d) => (
              <tr key={d.key} className="border-b border-gray-50">
                <td
                  className={cn(
                    LABEL_COL,
                    "py-2 pr-3 text-left text-xs text-gray-500"
                  )}
                >
                  {d.label}
                </td>
                {columns.map((c) => {
                  const has = hasAnyComp(c.comp)
                  const rating = autoRating(d.key, c.comp, compMax[d.key] ?? 0)
                  return (
                    <td
                      key={c.jobId}
                      className={cn(
                        VALUE_COL,
                        "px-3 py-2 text-right text-[#1C1E21]"
                      )}
                    >
                      {has ? (
                        <span className="inline-flex items-baseline gap-1.5">
                          <span className="tabular-nums">
                            {usd(dimValue(d.key, c.comp))}
                          </span>
                          {multi && rating !== null ? (
                            <span className="rounded bg-gray-100 px-1 text-xs font-medium text-gray-600">
                              {rating}/10
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}

            {/* Anchor: year-1 total, dollar only, no rating. */}
            <tr className="border-b border-gray-50">
              <td
                className={cn(
                  LABEL_COL,
                  "py-2 pr-3 text-left text-xs text-gray-500"
                )}
              >
                Year-1 total
              </td>
              {columns.map((c) => (
                <td
                  key={c.jobId}
                  className={cn(
                    VALUE_COL,
                    "px-3 py-2 text-right tabular-nums text-[#1C1E21]"
                  )}
                >
                  {hasAnyComp(c.comp) ? usd(dimValue("year1_total", c.comp)) : <Dash />}
                </td>
              ))}
            </tr>

            {/* Enabled soft dims: the user's 1-10 per offer. */}
            {enabledSoftDims.map((d) => (
              <tr key={d.key} className="border-b border-gray-50">
                <td
                  className={cn(
                    LABEL_COL,
                    "py-2 pr-3 text-left text-xs text-gray-500"
                  )}
                >
                  {d.label}
                </td>
                {columns.map((c) => {
                  const r = softRating(d.key, c.comp)
                  return (
                    <td
                      key={c.jobId}
                      className={cn(
                        VALUE_COL,
                        "px-3 py-2 text-right tabular-nums text-[#1C1E21]"
                      )}
                    >
                      {r !== null ? `${r}/10` : <Dash />}
                    </td>
                  )
                })}
              </tr>
            ))}

            {/* Overall: multi-offer only, winner highlighted. */}
            {multi ? (
              <tr className="border-t border-gray-200">
                <td
                  className={cn(
                    LABEL_COL,
                    HEADLINE_BG,
                    "py-2.5 pr-3 text-left text-xs font-semibold text-[#1C1E21]"
                  )}
                >
                  Overall
                </td>
                {columns.map((c, i) => (
                  <td
                    key={c.jobId}
                    className={cn(
                      VALUE_COL,
                      HEADLINE_BG,
                      "px-3 py-2.5 text-right tabular-nums text-[#1C1E21]",
                      i === winIdx && "font-semibold"
                    )}
                  >
                    {overalls[i] !== null ? (
                      <span className="inline-flex items-baseline gap-1.5">
                        <span>{overalls[i]!.toFixed(1)}</span>
                        {i === winIdx ? (
                          <span className="rounded bg-[#4E3BDD] px-1 text-xs font-medium text-white">
                            Best
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <Dash />
                    )}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {unratedExists ? (
        <p className="mt-3 text-[11px] leading-snug text-gray-400">
          Rate every offer on each dimension for a complete comparison. Unrated
          dimensions are left out of that offer&rsquo;s overall.
        </p>
      ) : null}

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

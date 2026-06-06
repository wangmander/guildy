"use client"

import { useState } from "react"
import { ChevronDown, Plus } from "lucide-react"

import { DEFAULT_COL_LABEL } from "@/lib/compMatrix/colSeed"
import {
  normalizeComp,
  type CompInput,
  type NormalizedComp,
} from "@/lib/compMatrix/normalize"
import { cn } from "@/lib/utils"
import type { JobCompensation } from "@/types"

import { AddJobModal } from "./add-job-modal"
import { CompEditModal } from "./widgets/comp-edit-modal"

export type TcColumn = {
  jobId: string
  company: string
  role: string
  tc: string | null
  comp: JobCompensation | null
}

type Props = {
  columns: TcColumn[]
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`
}

function toCompInput(comp: JobCompensation): CompInput {
  return {
    base: comp.base,
    signing_bonus: comp.signing_bonus,
    annual_bonus_pct: comp.annual_bonus_pct,
    equity_grant_total: comp.equity_grant_total,
    vesting_years: comp.vesting_years,
    location: comp.location,
  }
}

// A column has comparable data when any dollar/percent input is positive.
// Location alone does not count, so empty columns show an add affordance.
function hasAnyComp(comp: JobCompensation | null): boolean {
  if (!comp) return false
  return (
    (comp.base ?? 0) > 0 ||
    (comp.signing_bonus ?? 0) > 0 ||
    (comp.annual_bonus_pct ?? 0) > 0 ||
    (comp.equity_grant_total ?? 0) > 0
  )
}

type Computed = TcColumn & { n: NormalizedComp | null }

const VALUE_ROWS: Array<{ key: keyof NormalizedComp; label: string }> = [
  { key: "base", label: "Base" },
  { key: "signing_bonus", label: "Signing bonus" },
  { key: "bonus_amount", label: "Annual bonus" },
  { key: "annualized_equity", label: "Annualized equity" },
  { key: "year1_total", label: "Year-1 total" },
  { key: "steady_state_total", label: "Steady-state total" },
]

// Min column widths keep the grid readable; once the total exceeds the panel
// width the wrapper scrolls horizontally with the label column pinned.
const LABEL_COL = "sticky left-0 z-10 min-w-[150px] bg-white"
const VALUE_COL = "min-w-[150px]"

export function TcMatrix({ columns }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [editingJob, setEditingJob] = useState<TcColumn | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  if (columns.length === 0) return null

  const computed: Computed[] = columns.map((c) => ({
    ...c,
    n: hasAnyComp(c.comp)
      ? normalizeComp(toCompInput(c.comp as JobCompensation))
      : null,
  }))

  function maxOf(key: keyof NormalizedComp): number {
    let max = 0
    for (const c of computed) if (c.n) max = Math.max(max, c.n[key])
    return max
  }
  const maxYear1 = maxOf("year1_total")
  const maxSteady = maxOf("steady_state_total")
  const maxColAdj = maxOf("col_adjusted_steady")

  function isMax(key: keyof NormalizedComp, value: number): boolean {
    if (value <= 0) return false
    if (key === "year1_total") return value === maxYear1
    if (key === "steady_state_total") return value === maxSteady
    if (key === "col_adjusted_steady") return value === maxColAdj
    return false
  }

  function ValueCell({
    c,
    rowKey,
    headline,
  }: {
    c: Computed
    rowKey: keyof NormalizedComp
    headline?: boolean
  }) {
    const bold = c.n ? isMax(rowKey, c.n[rowKey]) : false
    return (
      <td
        className={cn(
          "px-3 py-2 text-right tabular-nums text-[#1C1E21]",
          VALUE_COL,
          headline && "bg-[#EDE9FE]/40",
          bold && "font-semibold"
        )}
      >
        {c.n ? usd(c.n[rowKey]) : <span className="text-gray-300">-</span>}
      </td>
    )
  }

  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 items-center gap-1.5 text-left"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-gray-400 transition-transform",
              expanded && "rotate-180"
            )}
          />
          <span className="font-display text-sm font-medium text-[#1C1E21]">
            Compensation comparison
            <span className="ml-1.5 text-xs font-normal text-gray-400">
              · {columns.length}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-gray-200 px-2.5 text-sm font-medium text-[#1C1E21] transition-colors hover:bg-gray-50"
        >
          <Plus className="size-4" />
          Add offer
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className={cn(LABEL_COL, "py-2 pr-3 text-left")} />
                  {computed.map((c) => (
                    <th
                      key={c.jobId}
                      className={cn(VALUE_COL, "px-3 py-2 text-right align-top")}
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
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VALUE_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-gray-50">
                    <td
                      className={cn(
                        LABEL_COL,
                        "py-2 pr-3 text-left text-xs text-gray-500"
                      )}
                    >
                      {row.label}
                    </td>
                    {computed.map((c) => (
                      <ValueCell key={c.jobId} c={c} rowKey={row.key} />
                    ))}
                  </tr>
                ))}
                <tr className="border-b border-gray-50">
                  <td
                    className={cn(
                      LABEL_COL,
                      "py-2 pr-3 text-left text-xs text-gray-500"
                    )}
                  >
                    Location (COL x)
                  </td>
                  {computed.map((c) => (
                    <td
                      key={c.jobId}
                      className={cn(
                        VALUE_COL,
                        "px-3 py-2 text-right text-xs text-gray-500"
                      )}
                    >
                      {c.n ? (
                        `${c.comp?.location ?? DEFAULT_COL_LABEL} (${c.n.col_multiplier}x)`
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-200">
                  <td
                    className={cn(
                      LABEL_COL,
                      "bg-[#EDE9FE]/40 py-2.5 pr-3 text-left text-xs font-semibold text-[#1C1E21]"
                    )}
                  >
                    COL-adjusted steady-state
                  </td>
                  {computed.map((c) => (
                    <ValueCell
                      key={c.jobId}
                      c={c}
                      rowKey="col_adjusted_steady"
                      headline
                    />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {columns.length === 1 ? (
            <p className="text-xs text-gray-500">
              Add another offer to compare them side by side.
            </p>
          ) : null}

          <p className="text-[11px] leading-snug text-gray-400">
            Cost of living is approximate, US national average = 1.0.
          </p>
        </div>
      ) : null}

      <CompEditModal
        job={editingJob}
        onOpenChange={(open) => {
          if (!open) setEditingJob(null)
        }}
      />
      <AddJobModal
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultStage="offer"
      />
    </section>
  )
}

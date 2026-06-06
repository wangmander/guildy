"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { upsertJobCompAction } from "@/app/app/actions"
import { COL_SEED, DEFAULT_COL_LABEL } from "@/lib/compMatrix/colSeed"
import {
  normalizeComp,
  parseMoneyString,
  type CompInput,
  type NormalizedComp,
} from "@/lib/compMatrix/normalize"
import { cn } from "@/lib/utils"
import type { JobCompensation } from "@/types"

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

const inputClass =
  "w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-[#1C1E21] outline-none focus:border-[#4E3BDD]"

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`
}

// Lenient parse for form money fields (allows 0). Strips $, commas, k/K.
function parseMoney(s: string): number | null {
  const c = s.replace(/[$,\s]/g, "")
  if (c === "") return null
  const k = /k$/i.test(c)
  const core = k ? c.slice(0, -1) : c
  const n = Number(core)
  if (!Number.isFinite(n)) return null
  return k ? n * 1000 : n
}

function parsePlain(s: string): number | null {
  const c = s.replace(/[%,\s]/g, "")
  if (c === "") return null
  const n = Number(c)
  return Number.isFinite(n) ? n : null
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

// A column has comparable data when any dollar/percent input is a positive
// number. Location alone does not count, so empty columns show "-" not zeros.
function hasAnyComp(comp: JobCompensation | null): boolean {
  if (!comp) return false
  return (
    (comp.base ?? 0) > 0 ||
    (comp.signing_bonus ?? 0) > 0 ||
    (comp.annual_bonus_pct ?? 0) > 0 ||
    (comp.equity_grant_total ?? 0) > 0
  )
}

function CompColumnForm({ column }: { column: TcColumn }) {
  const existing = column.comp
  const tcPrefill = !existing ? parseMoneyString(column.tc) : null

  const [base, setBase] = useState(
    existing?.base != null
      ? String(existing.base)
      : tcPrefill != null
        ? String(tcPrefill)
        : ""
  )
  const [signing, setSigning] = useState(
    existing?.signing_bonus != null ? String(existing.signing_bonus) : ""
  )
  const [bonusPct, setBonusPct] = useState(
    existing?.annual_bonus_pct != null ? String(existing.annual_bonus_pct) : ""
  )
  const [equity, setEquity] = useState(
    existing?.equity_grant_total != null
      ? String(existing.equity_grant_total)
      : ""
  )
  const [vesting, setVesting] = useState(
    existing?.vesting_years != null ? String(existing.vesting_years) : "4"
  )
  const [location, setLocation] = useState(
    existing?.location ?? DEFAULT_COL_LABEL
  )
  const [notes, setNotes] = useState(existing?.benefits_notes ?? "")

  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setPending(true)
    setSaved(false)
    setError(null)
    const res = await upsertJobCompAction({
      job_id: column.jobId,
      base: parseMoney(base),
      signing_bonus: parseMoney(signing),
      annual_bonus_pct: parsePlain(bonusPct),
      equity_grant_total: parseMoney(equity),
      vesting_years: parsePlain(vesting),
      location,
      benefits_notes: notes.trim() ? notes.trim() : null,
    })
    setPending(false)
    if (res.ok) {
      setSaved(true)
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 p-3">
      <div className="mb-2 min-w-0">
        <p className="truncate text-sm font-medium text-[#1C1E21]">
          {column.company}
        </p>
        <p className="truncate text-xs text-gray-500">{column.role}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Field label="Base (USD)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="180,000"
          />
        </Field>
        <Field label="Signing bonus (USD)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={signing}
            onChange={(e) => setSigning(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Annual bonus (%)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={bonusPct}
            onChange={(e) => setBonusPct(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Equity grant total (USD)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={equity}
            onChange={(e) => setEquity(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Vesting (years)">
          <input
            className={inputClass}
            inputMode="numeric"
            value={vesting}
            onChange={(e) => setVesting(e.target.value)}
            placeholder="4"
          />
        </Field>
        <Field label="Location">
          <select
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            {COL_SEED.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Benefits notes">
          <textarea
            className={cn(inputClass, "resize-none")}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="401k match, health, PTO"
          />
        </Field>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-8 items-center justify-center rounded-md bg-[#482C4C] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        {saved && !pending ? (
          <span className="text-xs text-gray-500">Saved</span>
        ) : null}
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </label>
  )
}

type Computed = TcColumn & { n: NormalizedComp | null }

const VALUE_ROWS: Array<{ key: keyof NormalizedComp; label: string; total: boolean }> = [
  { key: "base", label: "Base", total: false },
  { key: "signing_bonus", label: "Signing bonus", total: false },
  { key: "bonus_amount", label: "Annual bonus", total: false },
  { key: "annualized_equity", label: "Annualized equity", total: false },
  { key: "year1_total", label: "Year-1 total", total: true },
  { key: "steady_state_total", label: "Steady-state total", total: true },
]

export function TcMatrix({ columns }: Props) {
  const [expanded, setExpanded] = useState(true)

  if (columns.length === 0) return null

  const computed: Computed[] = columns.map((c) => ({
    ...c,
    n: hasAnyComp(c.comp) ? normalizeComp(toCompInput(c.comp as JobCompensation)) : null,
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

  function cell(c: Computed, key: keyof NormalizedComp, total: boolean): string {
    if (!c.n) return "-"
    return usd(c.n[key])
  }

  function locCell(c: Computed): string {
    if (!c.n) return "-"
    const loc = c.comp?.location ?? DEFAULT_COL_LABEL
    return `${loc} (${c.n.col_multiplier}x)`
  }

  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-display text-sm font-medium text-[#1C1E21]">
          Compensation comparison
          <span className="ml-1.5 text-xs font-normal text-gray-400">
            · {columns.length}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-gray-400 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded ? (
        <div className="mt-3 flex flex-col gap-4">
          {/* Entry forms, one per late-stage job. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {columns.map((c) => (
              <CompColumnForm key={c.jobId} column={c} />
            ))}
          </div>

          {columns.length === 1 ? (
            <p className="text-xs text-gray-500">
              Move another offer into Full Loop or Offer to compare them side by
              side.
            </p>
          ) : null}

          {/* Comparison, lg+ table. */}
          <div className="hidden overflow-hidden lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 pr-3 text-left text-xs font-normal text-gray-500" />
                  {computed.map((c) => (
                    <th key={c.jobId} className="px-3 py-2 text-right">
                      <span className="block truncate font-medium text-[#1C1E21]">
                        {c.company}
                      </span>
                      <span className="block truncate text-xs font-normal text-gray-500">
                        {c.role}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VALUE_ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-gray-50">
                    <td className="py-1.5 pr-3 text-left text-xs text-gray-500">
                      {row.label}
                    </td>
                    {computed.map((c) => {
                      const bold = c.n ? isMax(row.key, c.n[row.key]) : false
                      return (
                        <td
                          key={c.jobId}
                          className={cn(
                            "px-3 py-1.5 text-right tabular-nums text-[#1C1E21]",
                            bold && "font-semibold"
                          )}
                        >
                          {cell(c, row.key, row.total)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="border-b border-gray-50">
                  <td className="py-1.5 pr-3 text-left text-xs text-gray-500">
                    Location (COL x)
                  </td>
                  {computed.map((c) => (
                    <td
                      key={c.jobId}
                      className="px-3 py-1.5 text-right text-xs text-gray-500"
                    >
                      {locCell(c)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-2 pr-3 text-left text-xs font-medium text-[#1C1E21]">
                    COL-adjusted steady-state
                  </td>
                  {computed.map((c) => {
                    const bold = c.n
                      ? isMax("col_adjusted_steady", c.n.col_adjusted_steady)
                      : false
                    return (
                      <td
                        key={c.jobId}
                        className={cn(
                          "px-3 py-2 text-right tabular-nums text-[#1C1E21]",
                          bold && "font-semibold"
                        )}
                      >
                        {cell(c, "col_adjusted_steady", true)}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Comparison, stacked below lg. */}
          <div className="flex flex-col gap-3 lg:hidden">
            {computed.map((c) => (
              <div
                key={c.jobId}
                className="rounded-lg border border-gray-200 p-3"
              >
                <p className="truncate text-sm font-medium text-[#1C1E21]">
                  {c.company}
                </p>
                <p className="mb-2 truncate text-xs text-gray-500">{c.role}</p>
                <dl className="flex flex-col divide-y divide-gray-50">
                  {VALUE_ROWS.map((row) => {
                    const bold = c.n ? isMax(row.key, c.n[row.key]) : false
                    return (
                      <div
                        key={row.key}
                        className="flex items-baseline justify-between py-1"
                      >
                        <dt className="text-xs text-gray-500">{row.label}</dt>
                        <dd
                          className={cn(
                            "tabular-nums text-sm text-[#1C1E21]",
                            bold && "font-semibold"
                          )}
                        >
                          {cell(c, row.key, row.total)}
                        </dd>
                      </div>
                    )
                  })}
                  <div className="flex items-baseline justify-between py-1">
                    <dt className="text-xs text-gray-500">Location (COL x)</dt>
                    <dd className="text-xs text-gray-500">{locCell(c)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-gray-200 py-1.5">
                    <dt className="text-xs font-medium text-[#1C1E21]">
                      COL-adjusted steady-state
                    </dt>
                    <dd
                      className={cn(
                        "tabular-nums text-sm text-[#1C1E21]",
                        c.n &&
                          isMax("col_adjusted_steady", c.n.col_adjusted_steady) &&
                          "font-semibold"
                      )}
                    >
                      {cell(c, "col_adjusted_steady", true)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          <p className="text-[11px] leading-snug text-gray-400">
            Cost of living is approximate, US national average = 1.0.
          </p>
        </div>
      ) : null}
    </section>
  )
}

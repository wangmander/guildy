"use client"

import { useState } from "react"

import { upsertJobCompAction } from "@/app/app/actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { COL_SEED, DEFAULT_COL_LABEL } from "@/lib/compMatrix/colSeed"
import { parseMoneyString } from "@/lib/compMatrix/normalize"
import { cn } from "@/lib/utils"
import type { JobCompensation } from "@/types"

// Structurally matches TcColumn from tc-matrix.tsx; defined locally to avoid a
// circular import. One job per modal open.
export type CompEditJob = {
  jobId: string
  company: string
  role: string
  tc: string | null
  comp: JobCompensation | null
}

const inputClass =
  "w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-[#1C1E21] outline-none focus:border-[#4E3BDD]"

// Lenient parse for money fields (allows 0). Strips $, commas, k/K.
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

function CompForm({
  job,
  onSaved,
  onCancel,
}: {
  job: CompEditJob
  onSaved: () => void
  onCancel: () => void
}) {
  const existing = job.comp
  // Display-only pre-fill of base from a clean tc string, empty columns only.
  const tcPrefill = !existing ? parseMoneyString(job.tc) : null

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
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setPending(true)
    setError(null)
    const res = await upsertJobCompAction({
      job_id: job.jobId,
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
      onSaved()
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>

      <Field label="Benefits notes">
        <textarea
          className={cn(inputClass, "resize-none")}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="401k match, health, PTO"
        />
      </Field>

      {error ? <p className="text-xs text-red-700">{error}</p> : null}

      <div className="mt-1 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 px-3 text-sm font-medium text-[#1C1E21] transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-md bg-[#482C4C] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  )
}

export function CompEditModal({
  job,
  onOpenChange,
}: {
  job: CompEditJob | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!job} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {job ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Compensation</DialogTitle>
              <DialogDescription>
                {job.company} · {job.role}
              </DialogDescription>
            </DialogHeader>
            <CompForm
              key={job.jobId}
              job={job}
              onSaved={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

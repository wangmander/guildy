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
import { PRESET_SOFT_KEYS, SOFT_DIMS } from "@/lib/compMatrix/dimensions"
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
  "w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"

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
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  )
}

function CompForm({
  job,
  enabledSoft,
  onSaved,
  onCancel,
}: {
  job: CompEditJob
  enabledSoft: string[]
  onSaved: () => void
  onCancel: () => void
}) {
  const existing = job.comp
  // Display-only pre-fill of base from a clean tc string, empty columns only.
  const tcPrefill = !existing ? parseMoneyString(job.tc) : null

  const enabledSoftDims = SOFT_DIMS.filter((d) => enabledSoft.includes(d.key))
  const [ratings, setRatings] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const d of enabledSoftDims) {
      const v = existing?.ratings?.[d.key]
      init[d.key] = typeof v === "number" ? String(v) : ""
    }
    return init
  })

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
    // Merge onto existing ratings so disabled dims (not shown here) persist.
    const mergedRatings: Record<string, number> = {
      ...(existing?.ratings ?? {}),
    }
    for (const d of enabledSoftDims) {
      const raw = ratings[d.key]
      if (raw && raw !== "") {
        mergedRatings[d.key] = Number(raw)
      } else {
        delete mergedRatings[d.key]
      }
    }
    const res = await upsertJobCompAction({
      job_id: job.jobId,
      base: parseMoney(base),
      signing_bonus: parseMoney(signing),
      annual_bonus_pct: parsePlain(bonusPct),
      equity_grant_total: parseMoney(equity),
      vesting_years: parsePlain(vesting),
      location,
      benefits_notes: notes.trim() ? notes.trim() : null,
      ratings: mergedRatings,
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

      {enabledSoftDims.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Your ratings (1-10)
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {enabledSoftDims.map((d) => (
              <Field key={d.key} label={d.label}>
                <select
                  className={inputClass}
                  value={ratings[d.key] ?? ""}
                  onChange={(e) =>
                    setRatings((r) => ({ ...r, [d.key]: e.target.value }))
                  }
                >
                  <option value="">Not rated</option>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}

      <div className="mt-1 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-sunken)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-[10px] bg-[var(--accent)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-deep)] disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  )
}

export function CompEditModal({
  job,
  enabledSoft,
  onOpenChange,
}: {
  job: CompEditJob | null
  // Optional so the paused F4 negotiation panel can mount this unchanged;
  // defaults to the preset soft set.
  enabledSoft?: string[]
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!job} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        {job ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-bricolage">Compensation</DialogTitle>
              <DialogDescription>
                {job.company} · {job.role}
              </DialogDescription>
            </DialogHeader>
            <CompForm
              key={job.jobId}
              job={job}
              enabledSoft={enabledSoft ?? PRESET_SOFT_KEYS}
              onSaved={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

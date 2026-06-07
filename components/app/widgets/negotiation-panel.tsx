"use client"

import { useEffect, useState } from "react"
import { Check, Copy, Pencil } from "lucide-react"

import {
  generateNegotiationAction,
  getCachedNegotiationAction,
  type NegotiationRow,
} from "@/app/app/actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { normalizeComp } from "@/lib/compMatrix/normalize"
import { cn } from "@/lib/utils"
import type { JobCompensation } from "@/types"

import { CompEditModal } from "./comp-edit-modal"
import { ProgressLoader } from "./progress-loader"

// Structurally a TcColumn; defined locally to avoid a circular import.
export type NegotiationJob = {
  jobId: string
  company: string
  role: string
  tc: string | null
  comp: JobCompensation | null
}

type Props = {
  job: NegotiationJob | null
  onOpenChange: (open: boolean) => void
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`
}

function liveNormalized(comp: JobCompensation | null) {
  if (!comp) return null
  return normalizeComp({
    base: comp.base,
    signing_bonus: comp.signing_bonus,
    annual_bonus_pct: comp.annual_bonus_pct,
    equity_grant_total: comp.equity_grant_total,
    vesting_years: comp.vesting_years,
    location: comp.location,
  })
}

const inputClass =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-[#1C1E21] outline-none focus:border-[#4E3BDD]"

function FigureRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="tabular-nums text-sm font-medium text-[#1C1E21]">
        {usd(value)}
      </span>
    </div>
  )
}

function ModuleHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-sm font-medium text-[#1C1E21]">
      {children}
    </h3>
  )
}

function ScriptBlock({
  scenario,
  script,
}: {
  scenario: string
  script: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#1C1E21]">{scenario}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(script)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-[#4E3BDD]"
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-snug text-gray-700">
        {script}
      </p>
    </div>
  )
}

function Modules({
  row,
  company,
}: {
  row: NegotiationRow
  company: string
}) {
  const o = row.output
  const snap = o.offer_normalized
  return (
    <div className="mt-4 flex flex-col gap-4">
      <section className="flex flex-col gap-1.5">
        <ModuleHeading>
          {o.grounded ? `Patterns for ${company}` : "General negotiation patterns"}
        </ModuleHeading>
        <p className="whitespace-pre-wrap text-sm leading-snug text-gray-700">
          {o.company_patterns}
        </p>
      </section>

      <section className="flex flex-col gap-1.5">
        <ModuleHeading>Your leverage</ModuleHeading>
        <p className="whitespace-pre-wrap text-sm leading-snug text-gray-700">
          {o.leverage_analysis}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <ModuleHeading>Scripts</ModuleHeading>
        {o.scripts.map((s, i) => (
          <ScriptBlock key={i} scenario={s.scenario} script={s.script} />
        ))}
      </section>

      <section className="flex flex-col gap-1.5">
        <ModuleHeading>Walk-away</ModuleHeading>
        <div className="rounded-md border border-gray-200 p-3">
          <FigureRow label="Year-1 total" value={snap.year1_total} />
          <FigureRow label="Steady-state total" value={snap.steady_state_total} />
          <FigureRow
            label="COL-adjusted steady-state"
            value={snap.col_adjusted_steady}
          />
        </div>
        <p className="whitespace-pre-wrap text-sm leading-snug text-gray-700">
          {o.walk_away_guidance}
        </p>
      </section>
    </div>
  )
}

export function NegotiationPanel({ job, onOpenChange }: Props) {
  const [loadingCache, setLoadingCache] = useState(false)
  const [row, setRow] = useState<NegotiationRow | null>(null)
  const [stale, setStale] = useState(false)
  const [target, setTarget] = useState("")
  const [leverage, setLeverage] = useState("")
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editComp, setEditComp] = useState(false)

  const jobId = job?.jobId ?? null

  useEffect(() => {
    if (!jobId) return
    let cancelled = false
    setLoadingCache(true)
    setError(null)
    setRow(null)
    setStale(false)
    getCachedNegotiationAction({ job_id: jobId }).then((res) => {
      if (cancelled) return
      if (res.ok) {
        if (res.row) {
          setRow(res.row)
          setTarget(res.row.inputs.target ?? "")
          setLeverage(res.row.inputs.leverage ?? "")
          setStale(res.stale)
        } else {
          setTarget("")
          setLeverage("")
        }
      } else {
        setError(res.error)
      }
      setLoadingCache(false)
    })
    return () => {
      cancelled = true
    }
  }, [jobId])

  async function generate() {
    if (!job || target.trim().length === 0) return
    setGenerating(true)
    setError(null)
    const res = await generateNegotiationAction({
      job_id: job.jobId,
      target,
      leverage: leverage.trim() ? leverage.trim() : null,
    })
    setGenerating(false)
    if (res.ok) {
      setRow(res.row)
      setStale(false)
    } else {
      setError(res.error)
    }
  }

  const normalized = liveNormalized(job?.comp ?? null)

  return (
    <Dialog open={!!job} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {job ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Negotiation Prep</DialogTitle>
              <DialogDescription>
                {job.company} · {job.role}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#1C1E21]">
                  Offer summary
                </span>
                <button
                  type="button"
                  onClick={() => setEditComp(true)}
                  className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-[#4E3BDD]"
                >
                  <Pencil className="size-3.5" />
                  Edit offer
                </button>
              </div>
              {normalized ? (
                <div className="mt-1.5">
                  <FigureRow label="Year-1 total" value={normalized.year1_total} />
                  <FigureRow
                    label="Steady-state total"
                    value={normalized.steady_state_total}
                  />
                  <FigureRow
                    label="COL-adjusted steady-state"
                    value={normalized.col_adjusted_steady}
                  />
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-gray-500">
                  Add the offer&rsquo;s compensation to anchor your prep.
                </p>
              )}
            </div>

            {stale ? (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Your compensation changed since this was generated. Regenerate
                for an updated playbook.
              </p>
            ) : null}

            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">
                  Target (what you want, in your words)
                </span>
                <textarea
                  className={cn(inputClass, "resize-none")}
                  rows={2}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="A higher base, or more equity, or a signing bonus to bridge the gap"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">
                  Leverage (optional: competing offers, scarce skills, timing)
                </span>
                <textarea
                  className={cn(inputClass, "resize-none")}
                  rows={2}
                  value={leverage}
                  onChange={(e) => setLeverage(e.target.value)}
                  placeholder="Another offer in hand, a skill they are short on, a deadline"
                />
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generate}
                  disabled={generating || target.trim().length === 0}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-[#4E3BDD] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {row ? "Regenerate" : "Generate negotiation prep"}
                </button>
                {loadingCache ? (
                  <span className="text-xs text-gray-400">Loading...</span>
                ) : null}
              </div>
              {error ? (
                <p className="text-xs text-red-700">{error}</p>
              ) : null}
            </div>

            {generating ? (
              <div className="mt-4">
                <ProgressLoader tier="deep" />
              </div>
            ) : row ? (
              <Modules row={row} company={job.company} />
            ) : null}
          </>
        ) : null}

        <CompEditModal
          job={editComp ? job : null}
          onOpenChange={(open) => {
            if (!open) setEditComp(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

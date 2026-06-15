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
  "w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"

// Year-1 anchor + its components. No COL, no steady-state (F4 guardrail).
// Structural subset of NormalizedComp, so both the live normalize output and
// the snapshotted offer_normalized satisfy it.
type Year1Figures = {
  year1_total: number
  base: number
  signing_bonus: number
  bonus_amount: number
  annualized_equity: number
}

function FigureRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="tabular-nums text-[13px] text-[var(--text-body)]">
        {usd(value)}
      </span>
    </div>
  )
}

// Year-1 total headline + compact component breakdown, all from normalize.ts.
// Components are coerced with ?? 0 so a legacy-shaped snapshot (pre neg-v2,
// dev-only) renders cleanly instead of $NaN; a regenerate refreshes it.
function OfferFigures({ f }: { f: Year1Figures }) {
  const base = f.base ?? 0
  const signing = f.signing_bonus ?? 0
  const bonus = f.bonus_amount ?? 0
  const equity = f.annualized_equity ?? 0
  return (
    <div className="mt-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-[var(--text-muted)]">
          Year-1 total
        </span>
        <span className="font-bricolage text-[16px] font-semibold tabular-nums text-[var(--ink)]">
          {usd(f.year1_total ?? 0)}
        </span>
      </div>
      <div className="mt-1.5 flex flex-col gap-1 border-t border-[var(--divider)] pt-1.5">
        <FigureRow label="Base" value={base} />
        {signing > 0 ? (
          <FigureRow label="Signing bonus" value={signing} />
        ) : null}
        <FigureRow label="Annual bonus" value={bonus} />
        <FigureRow label="Annualized equity" value={equity} />
      </div>
    </div>
  )
}

function ModuleHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-bricolage text-sm font-semibold text-[var(--text-primary)]">
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
    <div className="rounded-[10px] border border-[var(--border-card)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--text-primary)]">
          {scenario}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(script)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
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
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-snug text-[var(--text-body)]">
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
        {o.grounded ? null : (
          <p className="text-xs text-[var(--text-faint)]">
            Couldn&rsquo;t find {company}-specific signals, this is general
            guidance.
          </p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-snug text-[var(--text-body)]">
          {o.company_patterns}
        </p>
      </section>

      <section className="flex flex-col gap-1.5">
        <ModuleHeading>Your leverage</ModuleHeading>
        <p className="whitespace-pre-wrap text-sm leading-snug text-[var(--text-body)]">
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
        <div className="rounded-[10px] border border-[var(--border-card)] p-3">
          <OfferFigures f={snap} />
        </div>
        <p className="whitespace-pre-wrap text-sm leading-snug text-[var(--text-body)]">
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
              <DialogTitle className="font-bricolage">
                Negotiation Prep
              </DialogTitle>
              <DialogDescription>
                {job.company} · {job.role}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-[10px] border border-[var(--border)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Offer summary
                </span>
                <button
                  type="button"
                  onClick={() => setEditComp(true)}
                  className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                >
                  <Pencil className="size-3.5" />
                  Edit offer
                </button>
              </div>
              {normalized ? (
                <OfferFigures f={normalized} />
              ) : (
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                  Add the offer&rsquo;s compensation to anchor your prep.
                </p>
              )}
            </div>

            {stale ? (
              <p className="mt-2 rounded-[8px] bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn-text)]">
                Your compensation changed since this was generated. Regenerate
                for an updated playbook.
              </p>
            ) : null}

            <div className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--text-muted)]">
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
                <span className="text-xs text-[var(--text-muted)]">
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
                  className="inline-flex h-9 items-center justify-center rounded-[10px] bg-[var(--accent)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-deep)] disabled:opacity-60"
                >
                  {row ? "Regenerate" : "Generate negotiation prep"}
                </button>
                {loadingCache ? (
                  <span className="text-xs text-[var(--text-faint)]">
                    Loading...
                  </span>
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

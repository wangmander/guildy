"use client"

import { Lock, RefreshCw, Sparkles, Shield } from "lucide-react"

import type { PrepState } from "@/components/app/prep-overlay"
import type { PrepOutput } from "@/lib/ai/prep-types"
import type { StageKey } from "@/lib/stages"

type Props = {
  stage: StageKey
  prepState: PrepState
  hasResume: boolean
  onGenerate: () => void
}

function stageHeading(stage: StageKey): string {
  switch (stage) {
    case "screen":
      return "Screening round"
    case "hiring_manager":
      return "Hiring Manager round"
    case "interview_loop":
    case "final":
      return "Interview loop"
    case "offer":
      return "Offer stage"
    case "applied":
      return "Applied round"
    case "closed":
      return "Closed round"
  }
}

export function PrepCanvas({ stage, prepState, hasResume, onGenerate }: Props) {
  return (
    <div className="px-4 pb-12 pt-6 md:px-8">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        Prep
      </div>
      <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-[#1C1E21]">
        {stageHeading(stage)}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#482C4C] px-3 py-1 text-xs font-medium text-white">
          GPT 5.4 Nano · Quick Prep
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#482C4C]/20 bg-white px-3 py-1 text-xs font-medium text-[#482C4C]">
          Sonnet 4.6 · Deep Prep · Upgrade
        </span>
      </div>

      <CanvasBody
        prepState={prepState}
        hasResume={hasResume}
        onGenerate={onGenerate}
      />
    </div>
  )
}

function CanvasBody({
  prepState,
  hasResume,
  onGenerate,
}: {
  prepState: PrepState
  hasResume: boolean
  onGenerate: () => void
}) {
  if (prepState.status === "loading-cache") {
    return <LoadingSkeleton hint="Checking for saved prep…" />
  }
  if (prepState.status === "generating") {
    return <LoadingSkeleton hint="Generating Quick Prep…" />
  }
  if (prepState.status === "error") {
    return <ErrorState message={prepState.message} onRetry={onGenerate} />
  }
  if (prepState.status === "idle") {
    return <EmptyState hasResume={hasResume} onGenerate={onGenerate} />
  }
  return <PrepView prep={prepState.prep} onRegenerate={onGenerate} />
}

function EmptyState({
  hasResume,
  onGenerate,
}: {
  hasResume: boolean
  onGenerate: () => void
}) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-black/10 bg-white p-8 text-center">
      <Sparkles className="mx-auto size-6 text-[#482C4C]" />
      <h2 className="mt-3 text-lg font-semibold text-[#1C1E21]">
        Generate Quick Prep
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
        {hasResume
          ? "Pulls in your resume, the JD, and any context you've added. Takes about a second."
          : "Add your resume in onboarding before running prep."}
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={!hasResume}
        className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#482C4C] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="size-4" />
        Generate Quick Prep
      </button>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <h2 className="text-base font-semibold text-red-900">
        Couldn&rsquo;t load prep
      </h2>
      <p className="mt-2 text-sm text-red-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-red-900 px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        <RefreshCw className="size-3.5" />
        Try again
      </button>
    </div>
  )
}

function LoadingSkeleton({ hint }: { hint: string }) {
  return (
    <div className="mt-8 space-y-6">
      <p className="text-xs uppercase tracking-wide text-gray-400">{hint}</p>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-black/5 bg-white p-5 shadow-sm"
        >
          <div className="h-4 w-1/3 rounded bg-gray-100" />
          <div className="mt-4 space-y-2">
            <div className="h-2 w-3/4 rounded-full bg-gray-100" />
            <div className="h-2 w-2/3 rounded-full bg-gray-100" />
            <div className="h-2 w-1/2 rounded-full bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

function PrepView({
  prep,
  onRegenerate,
}: {
  prep: PrepOutput
  onRegenerate: () => void
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onRegenerate}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-black/10 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:border-black/20 hover:text-[#1C1E21]"
        >
          <RefreshCw className="size-3.5" />
          Regenerate
        </button>
      </div>

      <PurposeSection purpose={prep.purpose} />
      <PositioningSection positioning={prep.positioning} />
      <RisksSection risks={prep.risks} />
      <ChecklistSection checklist={prep.prep_checklist} />
    </div>
  )
}

function SectionShell({
  id,
  title,
  subtitle,
  children,
}: {
  id: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="rounded-xl border border-black/5 bg-white p-5 shadow-sm scroll-mt-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1C1E21]">{title}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function PurposeSection({ purpose }: { purpose: PrepOutput["purpose"] }) {
  return (
    <SectionShell id="purpose" title="Purpose" subtitle={purpose.headline}>
      <p className="text-sm leading-relaxed text-gray-700">{purpose.summary}</p>
      <ul className="mt-5 space-y-3">
        {purpose.criteria.map((c) => (
          <li key={c.name}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#1C1E21]">{c.name}</span>
              <span className="text-xs text-gray-500">{c.weight}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#482C4C]"
                style={{ width: `${Math.min(100, Math.max(0, c.weight))}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">{c.description}</p>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

function PositioningSection({
  positioning,
}: {
  positioning: PrepOutput["positioning"]
}) {
  return (
    <SectionShell
      id="positioning"
      title="Positioning"
      subtitle={positioning.headline}
    >
      <p className="text-sm leading-relaxed text-gray-700">{positioning.summary}</p>
      <ol className="mt-5 space-y-4">
        {positioning.frames.map((f, i) => (
          <li key={f.title} className="flex gap-3">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[#482C4C]/10 text-xs font-semibold text-[#482C4C]">
              {i + 1}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-[#1C1E21]">{f.title}</h3>
              <p className="mt-0.5 text-sm leading-relaxed text-gray-600">
                {f.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </SectionShell>
  )
}

function RisksSection({ risks }: { risks: PrepOutput["risks"] }) {
  return (
    <SectionShell id="risks" title="Risks & Probes" subtitle={risks.headline}>
      <p className="text-sm leading-relaxed text-gray-700">{risks.summary}</p>
      <ul className="mt-5 space-y-3">
        {risks.items.map((item) => (
          <li
            key={item.risk}
            className="rounded-lg border border-black/5 bg-[#F8F9FA] p-4"
          >
            <p className="text-sm font-medium text-[#1C1E21]">{item.risk}</p>
            {item.counter ? (
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {item.counter}
              </p>
            ) : (
              <DeepLockedRow label="Counter unlocks with Deep Prep" />
            )}
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

function ChecklistSection({
  checklist,
}: {
  checklist: PrepOutput["prep_checklist"]
}) {
  return (
    <SectionShell
      id="checklist"
      title="Prep Checklist"
      subtitle="Run through this before the round."
    >
      <ul className="space-y-2">
        {checklist.map((c) => (
          <li key={c.item} className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border border-gray-300 bg-white" />
            <span className="text-sm text-gray-700">{c.item}</span>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

function DeepLockedRow({ label }: { label: string }) {
  return (
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#482C4C]/20 bg-white px-2 py-1 text-[11px] font-medium text-[#482C4C]">
      <Shield className="size-3" />
      {label}
      <Lock className="size-3 opacity-60" />
    </div>
  )
}

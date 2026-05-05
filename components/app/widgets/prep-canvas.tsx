"use client"

import { RefreshCw, Sparkles } from "lucide-react" // RefreshCw used in ErrorState

import type { PrepState } from "@/components/app/prep-overlay"
import type { PrepOutput, PrepTier } from "@/lib/ai/prep-types"
import type { StageKey } from "@/lib/stages"

import {
  LockedPreviewFooter,
  LockedPreviewModule,
} from "./locked-preview-module"
import { ProgressLoader } from "./progress-loader"
import { QuestionsTheyAsk, QuestionsYouAsk } from "./questions-widget"

type Props = {
  stage: StageKey
  prepState: PrepState
  hasResume: boolean
  hasJd: boolean
  tier: PrepTier
  onTierChange: (tier: PrepTier) => void
  onGenerate: () => void
  onUpgrade: () => void
  onAddJd: () => void
}

const QUICK_POSITIONING_VISIBLE_FRAMES = 2

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

export function PrepCanvas({
  stage,
  prepState,
  hasResume,
  hasJd,
  tier,
  onTierChange,
  onGenerate,
  onUpgrade,
  onAddJd,
}: Props) {
  return (
    <div className="px-4 pb-12 pt-6 md:px-7">
      {/* Compact top row: title (left) + tier toggle (right). Regenerate
          removed — context_hash invalidates cache automatically when any
          input edit happens, so manual regenerate is unnecessary. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#1C1E21] md:text-[1.625rem]">
          {stageHeading(stage)}
        </h1>
        <TierSelector
          tier={tier}
          onTierChange={onTierChange}
          onUpgrade={onUpgrade}
        />
      </div>

      <CanvasBody
        prepState={prepState}
        hasResume={hasResume}
        hasJd={hasJd}
        tier={tier}
        onGenerate={onGenerate}
        onUpgrade={onUpgrade}
        onAddJd={onAddJd}
      />
    </div>
  )
}

function TierSelector({
  tier,
  onTierChange,
  onUpgrade,
}: {
  tier: PrepTier
  onTierChange: (tier: PrepTier) => void
  onUpgrade: () => void
}) {
  const compartmentBase =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors"
  const compartmentSelected =
    "bg-white text-[#1C1E21] shadow-sm"
  const compartmentUnselected =
    "text-gray-500 hover:text-[#1C1E21]"

  return (
    <div
      role="tablist"
      aria-label="Prep tier"
      className="inline-flex flex-nowrap items-center gap-0.5 rounded-full border border-black/10 bg-gray-50 p-0.5 whitespace-nowrap"
    >
      <button
        type="button"
        role="tab"
        aria-selected={tier === "quick"}
        onClick={() => onTierChange("quick")}
        className={
          compartmentBase +
          " " +
          (tier === "quick" ? compartmentSelected : compartmentUnselected)
        }
      >
        <span className="inline-flex items-center rounded bg-gray-200/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-700">
          Haiku 4.5
        </span>
        <span className="font-medium">Quick Prep</span>
      </button>

      {/* Deep compartment: div with role=tab so a real <button> Upgrade chip
          can nest inside without invalid button-in-button HTML. Enter/Space
          mirrors native button behavior for tier toggle. The chip's onClick
          stops propagation so chip clicks don't double as compartment clicks. */}
      <div
        role="tab"
        aria-selected={tier === "deep"}
        tabIndex={0}
        onClick={() => onTierChange("deep")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onTierChange("deep")
          }
        }}
        className={
          compartmentBase +
          " cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4E3BDD]/40 " +
          (tier === "deep" ? compartmentSelected : compartmentUnselected)
        }
      >
        <span className="inline-flex items-center rounded bg-[#EDE9FE] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[#4E3BDD]">
          Sonnet 4.6
        </span>
        {tier === "quick" ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onUpgrade()
            }}
            className="rounded-sm bg-[#4E3BDD] px-1.5 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-[#4332C2]"
          >
            Upgrade
          </button>
        ) : null}
        <span className="font-medium">Deep Prep</span>
      </div>
    </div>
  )
}

function CanvasBody({
  prepState,
  hasResume,
  hasJd,
  tier,
  onGenerate,
  onUpgrade,
  onAddJd,
}: {
  prepState: PrepState
  hasResume: boolean
  hasJd: boolean
  tier: PrepTier
  onGenerate: () => void
  onUpgrade: () => void
  onAddJd: () => void
}) {
  if (prepState.status === "loading-cache") {
    return <LoadingSkeleton />
  }
  if (prepState.status === "generating") {
    return <ProgressLoader tier={tier} />
  }
  if (prepState.status === "error") {
    return <ErrorState message={prepState.message} onRetry={onGenerate} />
  }
  if (prepState.status === "empty") {
    return (
      <EmptyState
        hasResume={hasResume}
        hasJd={hasJd}
        tier={tier}
        onGenerate={onGenerate}
        onAddJd={onAddJd}
      />
    )
  }
  return (
    <PrepView
      prep={prepState.prep}
      tier={tier}
      onUpgrade={onUpgrade}
    />
  )
}

function EmptyState({
  hasResume,
  hasJd,
  tier,
  onGenerate,
  onAddJd,
}: {
  hasResume: boolean
  hasJd: boolean
  tier: PrepTier
  onGenerate: () => void
  onAddJd: () => void
}) {
  const tierLabel = tier === "deep" ? "Deep Prep" : "Quick Prep"
  const subhead =
    tier === "deep"
      ? "Sonnet 4.6 with research-grade depth. Takes a few seconds."
      : "Pulls in your resume, the JD, and any context you've added. Takes about a second."
  const showJdWarning = tier === "deep" && hasJd === false && hasResume

  return (
    <div className="mt-8 space-y-4">
      {showJdWarning ? (
        <JdMissingWarning onAddJd={onAddJd} onGenerateAnyway={onGenerate} />
      ) : null}
      <div className="rounded-xl border border-dashed border-black/10 bg-white p-8 text-center">
        <Sparkles className="mx-auto size-6 text-[#482C4C]" />
        <h2 className="mt-3 text-lg font-semibold text-[#1C1E21]">
          Generate {tierLabel}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
          {!hasResume
            ? "Add your resume in onboarding before running prep."
            : subhead}
        </p>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!hasResume}
          title={
            !hasResume
              ? "Add your resume in onboarding before running prep."
              : undefined
          }
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#482C4C] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="size-4" />
          Generate {tierLabel}
        </button>
      </div>
    </div>
  )
}

function JdMissingWarning({
  onAddJd,
  onGenerateAnyway,
}: {
  onAddJd: () => void
  onGenerateAnyway: () => void
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm leading-relaxed text-amber-900">
        Deep Prep is much sharper with the job description. Add it for a
        stronger result, or generate anyway.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAddJd}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#4E3BDD] px-3 text-xs font-medium text-white transition-colors hover:bg-[#4332C2]"
        >
          Add JD
        </button>
        <button
          type="button"
          onClick={onGenerateAnyway}
          className="inline-flex h-8 items-center rounded-md border border-amber-300 bg-white px-3 text-xs font-medium text-amber-900 transition-colors hover:border-amber-400 hover:bg-amber-50"
        >
          Generate anyway
        </button>
      </div>
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

function LoadingSkeleton({ hint }: { hint?: string }) {
  return (
    <div className="mt-8 space-y-6" aria-busy="true" aria-live="polite">
      {hint ? (
        <p className="text-xs uppercase tracking-wide text-gray-400">{hint}</p>
      ) : (
        <span className="sr-only">Loading prep…</span>
      )}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-black/5 bg-white p-5 shadow-sm"
        >
          <div className="space-y-2">
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
  tier,
  onUpgrade,
}: {
  prep: PrepOutput
  tier: PrepTier
  onUpgrade: () => void
}) {
  const isQuick = tier === "quick"
  return (
    <div className="mt-6 space-y-5">
      <PurposeSection purpose={prep.purpose} />

      <PositioningSection
        positioning={prep.positioning}
        truncated={isQuick}
        footer={
          isQuick ? (
            <LockedPreviewFooter
              title="Full positioning plan"
              teaser="Deep Prep adds 2 more framing points with rich, resume-grounded context and per-interviewer angles."
              onUpgrade={onUpgrade}
            />
          ) : null
        }
      />

      <RisksSection
        risks={prep.risks}
        tier={tier}
        footer={
          isQuick ? (
            <LockedPreviewFooter
              title="Risks with prepared counters"
              teaser="Deep Prep returns each likely concern with a specific counter anchored in your resume."
              onUpgrade={onUpgrade}
            />
          ) : null
        }
      />

      <QuestionsTheyAsk
        items={prep.questions_they_ask}
        tier={tier}
        footer={
          isQuick ? (
            <LockedPreviewFooter
              title="Per-category answer plans"
              teaser="Deep Prep groups questions across 8 interview categories and gives a structured answer plan for each."
              onUpgrade={onUpgrade}
            />
          ) : null
        }
      />

      <QuestionsYouAsk items={prep.questions_you_ask} />

      {isQuick ? (
        <LockedPreviewModule
          title="Resume-to-JD fit"
          teaser="Deep Prep weaves your resume into the JD: strong matches, visible gaps, what to emphasize."
          onUpgrade={onUpgrade}
        />
      ) : null}

      <ChecklistSection checklist={prep.prep_checklist} />
    </div>
  )
}

function SectionShell({
  id,
  title,
  subtitle,
  footer,
  children,
}: {
  id: string
  title: string
  subtitle: string
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="rounded-xl border border-black/5 bg-white p-5 shadow-sm scroll-mt-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-[#1C1E21]">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
      {footer}
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
  truncated,
  footer,
}: {
  positioning: PrepOutput["positioning"]
  truncated: boolean
  footer?: React.ReactNode
}) {
  const frames = truncated
    ? positioning.frames.slice(0, QUICK_POSITIONING_VISIBLE_FRAMES)
    : positioning.frames
  return (
    <SectionShell
      id="positioning"
      title="Positioning"
      subtitle={positioning.headline}
      footer={footer}
    >
      <p className="text-sm leading-relaxed text-gray-700">
        {positioning.summary}
      </p>
      <ol className="mt-5 space-y-4">
        {frames.map((f, i) => (
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

function RisksSection({
  risks,
  tier,
  footer,
}: {
  risks: PrepOutput["risks"]
  tier: PrepTier
  footer?: React.ReactNode
}) {
  return (
    <SectionShell
      id="risks"
      title="Risks & Probes"
      subtitle={risks.headline}
      footer={footer}
    >
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
            ) : tier === "deep" ? (
              <p className="mt-2 text-xs italic text-gray-400">
                No prepared counter for this risk.
              </p>
            ) : null}
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

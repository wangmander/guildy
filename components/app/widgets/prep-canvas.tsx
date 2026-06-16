"use client"

import { useEffect, useState } from "react"
import { Pencil, RefreshCw, Sparkles, X } from "lucide-react"

import type { PrepStatesMap, PrepStateEntry } from "@/app/app/actions"
import {
  PREP_SESSION_ROLES,
  type FullLoopSessionConfig,
  type PrepOutput,
  type PrepSessionRole,
  type PrepTier,
} from "@/lib/ai/prep-types"
import type { StageKey } from "@/lib/stages"
import { cn } from "@/lib/utils"

import { CustomizeRoundsModal } from "./customize-rounds-modal"
import { UpgradeModal } from "./upgrade-modal"
import {
  LockedPreviewFooter,
  LockedPreviewModule,
} from "./locked-preview-module"
import { ProgressLoader } from "./progress-loader"
import { QuestionsTheyAsk, QuestionsYouAsk } from "./questions-widget"
import {
  SessionTabs,
  type SessionTabEntry,
  type SessionTabState,
} from "./session-tabs"

const SINGLE_GENERATING_KEY = "_single"
const QUICK_POSITIONING_VISIBLE_FRAMES = 2

// Shared section-card chrome (spec: white --surface card, radius 14,
// --border-card, shadow E1) used by every prep module.
const SECTION_CARD =
  "rounded-[14px] border border-[var(--border-card)] bg-[var(--surface)] p-5 shadow-[var(--shadow-e1)] scroll-mt-6"

type Props = {
  jobId: string
  stage: StageKey
  sessionConfig: FullLoopSessionConfig
  subscriptionStatus: string
  currentPeriodEnd: string | null
  statesMap: PrepStatesMap | null
  // Prompt 17b: true once the latest-rounds picker has settled. While
  // false, CanvasBody renders LoadingSkeleton so the EmptyState doesn't
  // flash before selectedRole swaps to the cached round.
  latestRoundsResolved: boolean
  generatingRoles: Set<string>
  selectedRole: PrepSessionRole
  onSelectRole: (role: PrepSessionRole) => void
  error: string | null
  hasResume: boolean
  hasJd: boolean
  tier: PrepTier
  onTierChange: (tier: PrepTier) => void
  onGenerate: (
    role: PrepSessionRole | null,
    opts?: { force?: boolean }
  ) => void
  onUpgrade: () => void
  onAddJd: () => void
}

function isFullLoopStage(stage: StageKey): boolean {
  return stage === "interview_loop" || stage === "final"
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

export function PrepCanvas({
  jobId,
  stage,
  sessionConfig,
  subscriptionStatus,
  currentPeriodEnd,
  statesMap,
  latestRoundsResolved,
  generatingRoles,
  selectedRole,
  onSelectRole,
  error,
  hasResume,
  hasJd,
  tier,
  onTierChange,
  onGenerate,
  onUpgrade,
  onAddJd,
}: Props) {
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const fullLoop = isFullLoopStage(stage)

  // Phase 6b: Deep tier paywall gate. active = always allowed; past_due gets
  // a 3-day grace window past current_period_end (mirrors the server-side
  // gate in generatePrepAction); everything else triggers UpgradeModal in
  // place of the generation call.
  const isSubscribedDeep = (() => {
    if (subscriptionStatus === "active") return true
    if (subscriptionStatus === "past_due" && currentPeriodEnd) {
      const grace =
        new Date(currentPeriodEnd).getTime() + 3 * 24 * 60 * 60 * 1000
      return grace > Date.now()
    }
    return false
  })()
  // Prompt 15: paid view hides the Quick compartment entirely. Both
  // active and past_due (regardless of grace specifics) suppress it —
  // a past-grace past_due user still doesn't get the "downgrade to
  // Quick" tab because that's a product choice, not a billing fallback.
  const hideQuickTier =
    subscriptionStatus === "active" || subscriptionStatus === "past_due"
  const currentKey: keyof PrepStatesMap = fullLoop ? selectedRole : "single"
  const generatingKey = fullLoop ? selectedRole : SINGLE_GENERATING_KEY
  const isGenerating = generatingRoles.has(generatingKey)
  const currentEntry: PrepStateEntry | undefined = statesMap?.[currentKey]
  const currentOutput = currentEntry?.output ?? null

  // Heading: prefer the session-specific title (Full Loop sessions populate
  // it via the prompt); fall back to the stage heading otherwise.
  const sessionTitle = currentOutput?.session_title?.trim()
  const heading = sessionTitle && sessionTitle.length > 0
    ? sessionTitle
    : stageHeading(stage)

  const sessions: SessionTabEntry[] = PREP_SESSION_ROLES.map((role) => {
    const state: SessionTabState = generatingRoles.has(role)
      ? "generating"
      : statesMap?.[role].state ?? "empty"
    return { role, state }
  })

  const noneEnabled =
    fullLoop && !PREP_SESSION_ROLES.some((r) => sessionConfig[r].enabled)

  // Patch 5.1: any in-flight generation locks the SessionTabs strip; the
  // current-role gen locks the TierSelector. Both prevent the stuck-loading
  // state caused by switching tier or session mid-call.
  const isAnyGenerating = generatingRoles.size > 0

  const triggerGenerate = (opts?: { force?: boolean }) => {
    // Phase 6b: paywall intercept. UI-side guard mirrors the server-side
    // check in generatePrepAction; either path opens the same modal.
    if (tier === "deep" && !isSubscribedDeep) {
      setUpgradeOpen(true)
      return
    }
    onGenerate(fullLoop ? selectedRole : null, opts)
  }

  // Patch 6: manual Regenerate CTA on the cached-prep top row. EmptyState
  // owns the first-generate path and StaleBanner owns the post-edit
  // regenerate, so this surfaces only when the current role is cached —
  // covering the typo-fix-to-same-string and "want a fresh take" cases.
  const showRegenerate = currentEntry?.state === "cached"

  return (
    <div className="px-4 pb-12 pt-6 md:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-prep-h1 text-[var(--text-primary)]">{heading}</h1>
        <div className="flex items-center gap-2">
          <TierSelector
            tier={tier}
            onTierChange={onTierChange}
            onUpgrade={onUpgrade}
            disabled={isGenerating}
            hideQuick={hideQuickTier}
          />
          {showRegenerate ? (
            <button
              type="button"
              onClick={() => triggerGenerate({ force: true })}
              disabled={isAnyGenerating}
              aria-label="Regenerate prep"
              title="Regenerate prep"
              className="inline-flex size-8 items-center justify-center rounded-[8px] text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {noneEnabled ? (
        <div className="mt-6 rounded-[14px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-sunken)] p-6 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No rounds configured. Customize rounds to set up your loop.
          </p>
          <button
            type="button"
            onClick={() => setCustomizeOpen(true)}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-sunken)]"
          >
            <Pencil className="size-3.5" />
            Customize rounds
          </button>
        </div>
      ) : (
        <>
          {fullLoop ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <SessionTabs
                sessions={sessions}
                sessionConfig={sessionConfig}
                selectedRole={selectedRole}
                onSelect={onSelectRole}
                disabled={isAnyGenerating}
              />
              <button
                type="button"
                onClick={() => setCustomizeOpen(true)}
                className="inline-flex h-7 items-center gap-1 rounded-[8px] px-2 text-xs font-semibold text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
              >
                <Pencil className="size-3" />
                Customize
              </button>
            </div>
          ) : null}

          <CanvasBody
            statesMap={statesMap}
            latestRoundsResolved={latestRoundsResolved}
            currentEntry={currentEntry}
            currentOutput={currentOutput}
            isGenerating={isGenerating}
            error={error}
            hasResume={hasResume}
            hasJd={hasJd}
            tier={tier}
            onGenerate={() => triggerGenerate()}
            onRegenerate={() => triggerGenerate({ force: true })}
            onUpgrade={onUpgrade}
            onAddJd={onAddJd}
          />
        </>
      )}

      {fullLoop ? (
        <CustomizeRoundsModal
          open={customizeOpen}
          onClose={() => setCustomizeOpen(false)}
          jobId={jobId}
          sessionConfig={sessionConfig}
        />
      ) : null}

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        jobId={jobId}
        sessionRole={fullLoop ? selectedRole : null}
      />
    </div>
  )
}

function TierSelector({
  tier,
  onTierChange,
  onUpgrade,
  disabled = false,
  hideQuick = false,
}: {
  tier: PrepTier
  onTierChange: (tier: PrepTier) => void
  onUpgrade: () => void
  disabled?: boolean
  // Prompt 15: paid users see only the Deep compartment.
  hideQuick?: boolean
}) {
  const compartmentBase =
    "inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-1 text-xs transition-colors"
  const compartmentUnselected =
    "text-[var(--text-faint)] hover:text-[var(--text-primary)]"
  const lockedSuffix = disabled ? " cursor-not-allowed opacity-60" : ""

  return (
    <div
      role="tablist"
      aria-label="Prep tier"
      className="inline-flex flex-nowrap items-center gap-0.5 whitespace-nowrap rounded-[11px] border border-[var(--border)] bg-[var(--tab-track)] p-0.5"
    >
      {hideQuick ? null : (
        <button
          type="button"
          role="tab"
          aria-selected={tier === "quick"}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onClick={() => {
            if (disabled) return
            onTierChange("quick")
          }}
          className={
            compartmentBase +
            " " +
            (tier === "quick"
              ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-[var(--shadow-e1)]"
              : compartmentUnselected) +
            lockedSuffix
          }
        >
          <span className="inline-flex items-center rounded bg-[var(--salary-bg)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Haiku 4.5
          </span>
          <span className="font-semibold">Quick Prep</span>
        </button>
      )}

      {/* Deep compartment: div with role=tab so a real <button> Upgrade chip
          can nest inside without invalid button-in-button HTML. Enter/Space
          mirrors native button behavior for tier toggle. The chip's onClick
          stops propagation so chip clicks don't double as compartment clicks. */}
      <div
        role="tab"
        aria-selected={tier === "deep"}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (disabled) return
          onTierChange("deep")
        }}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onTierChange("deep")
          }
        }}
        className={
          compartmentBase +
          " focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 " +
          (tier === "deep"
            ? "bg-[image:var(--accent-grad)] text-white shadow-[var(--shadow-e1)]"
            : compartmentUnselected) +
          (disabled ? " cursor-not-allowed opacity-60" : " cursor-pointer")
        }
      >
        {tier === "quick" ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              // Patch 5.3: chip flips tier to deep alongside the existing
              // onUpgrade analytics call. Pre-paywall the chip would
              // otherwise be a dead button. When Phase 6b ships the paywall,
              // onUpgrade becomes the gate; for now both fire.
              onTierChange("deep")
              onUpgrade()
            }}
            className="inline-flex items-center rounded bg-[var(--accent-chip-bg)] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[var(--accent-deep)] transition-colors hover:bg-[var(--accent-chip-bg2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
          >
            <span className="font-semibold">Sonnet 4.6</span>
            <span aria-hidden="true" className="px-1 opacity-60">·</span>
            <span className="font-bold">Upgrade</span>
          </button>
        ) : (
          <span className="inline-flex items-center rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
            Sonnet 4.6
          </span>
        )}
        <span className="font-semibold">Deep Prep</span>
      </div>
    </div>
  )
}

function CanvasBody({
  statesMap,
  latestRoundsResolved,
  currentEntry,
  currentOutput,
  isGenerating,
  error,
  hasResume,
  hasJd,
  tier,
  onGenerate,
  onRegenerate,
  onUpgrade,
  onAddJd,
}: {
  statesMap: PrepStatesMap | null
  // Prompt 17b: gate the skeleton on the latest-rounds picker. False
  // while in-flight; true after the action settles or when the picker
  // is skipped (autoResume path). Combined with statesMap === null so
  // either query in-flight keeps the skeleton up.
  latestRoundsResolved: boolean
  currentEntry: PrepStateEntry | undefined
  currentOutput: PrepOutput | null
  isGenerating: boolean
  error: string | null
  hasResume: boolean
  hasJd: boolean
  tier: PrepTier
  onGenerate: () => void
  onRegenerate: () => void
  onUpgrade: () => void
  onAddJd: () => void
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onGenerate} />
  }
  if (isGenerating) {
    return <ProgressLoader tier={tier} />
  }
  if (statesMap === null || !latestRoundsResolved) {
    return <LoadingSkeleton />
  }
  if (!currentEntry || currentEntry.state === "empty" || !currentOutput) {
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
      prep={currentOutput}
      tier={tier}
      onUpgrade={onUpgrade}
      stale={currentEntry.state === "stale"}
      onRegenerate={onRegenerate}
    />
  )
}

// Inputs-changed indicator (B3): a floating bottom-center toast over the
// overlay, not a top banner. Fixed-positioned so it sits at the viewport
// bottom regardless of scroll; pointer-events-auto on the toast only, and it
// lives inside the center module's stopPropagation subtree so toast clicks
// never close the overlay (B4 preserved).
function StaleToast({
  tier,
  onRegenerate,
  onDismiss,
}: {
  tier: PrepTier
  onRegenerate: () => void
  onDismiss: () => void
}) {
  return (
    <div className="pointer-events-auto fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-[12px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-4 py-2.5 shadow-[var(--shadow-e4)]">
      <p className="text-sm leading-snug text-[var(--warn-text)]">
        Inputs changed since this prep was generated.
      </p>
      <button
        type="button"
        onClick={onRegenerate}
        className="inline-flex h-8 shrink-0 items-center rounded-[10px] bg-[var(--accent)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-deep)]"
      >
        Regenerate {tier === "deep" ? "Deep" : "Quick"}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--warn-text-soft)] transition-colors hover:bg-black/5"
      >
        <X className="size-4" />
      </button>
    </div>
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
      <div className="rounded-[14px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] p-8 text-center">
        <Sparkles className="mx-auto size-6 text-[var(--accent)]" />
        <h2 className="mt-3 font-bricolage text-lg font-semibold text-[var(--text-primary)]">
          Generate {tierLabel}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-muted)]">
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
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-[11px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-accent-cta)] transition-colors hover:bg-[var(--accent-deep)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
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
    <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm leading-relaxed text-amber-900">
        Deep Prep is much sharper with the job description. Add it for a
        stronger result, or generate anyway.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAddJd}
          className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[var(--accent)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-deep)]"
        >
          Add JD
        </button>
        <button
          type="button"
          onClick={onGenerateAnyway}
          className="inline-flex h-8 items-center rounded-[10px] border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 transition-colors hover:border-amber-400 hover:bg-amber-50"
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
    <div className="mt-8 rounded-[14px] border border-red-200 bg-red-50 p-6 text-center">
      <h2 className="font-bricolage text-base font-semibold text-red-900">
        Couldn&rsquo;t load prep
      </h2>
      <p className="mt-2 text-sm text-red-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-[10px] bg-red-900 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
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
        <p className="text-xs uppercase tracking-wide text-[var(--text-faint)]">
          {hint}
        </p>
      ) : (
        <span className="sr-only">Loading prep…</span>
      )}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(SECTION_CARD, "animate-pulse")}
        >
          <div className="space-y-2">
            <div className="h-2 w-3/4 rounded-full bg-[var(--divider)]" />
            <div className="h-2 w-2/3 rounded-full bg-[var(--divider)]" />
            <div className="h-2 w-1/2 rounded-full bg-[var(--divider)]" />
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
  stale,
  onRegenerate,
}: {
  prep: PrepOutput
  tier: PrepTier
  onUpgrade: () => void
  stale?: boolean
  onRegenerate?: () => void
}) {
  const isQuick = tier === "quick"
  // Toast dismissal resets whenever staleness re-arms so a later edit toasts
  // again after a prior dismiss.
  const [toastDismissed, setToastDismissed] = useState(false)
  useEffect(() => {
    if (stale) setToastDismissed(false)
  }, [stale])
  return (
    <div className="mt-6 space-y-5">
      {stale && onRegenerate && !toastDismissed ? (
        <StaleToast
          tier={tier}
          onRegenerate={onRegenerate}
          onDismiss={() => setToastDismissed(true)}
        />
      ) : null}
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
    <section id={id} className={SECTION_CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="type-section-h2 text-[var(--text-primary)]">{title}</h2>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">{subtitle}</p>
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
      <p className="type-prep-body text-[var(--text-body)]">{purpose.summary}</p>
      <ul className="mt-5 space-y-3">
        {purpose.criteria.map((c) => (
          <li key={c.name}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-[var(--text-primary)]">
                {c.name}
              </span>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                {c.weight}%
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--divider)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${Math.min(100, Math.max(0, c.weight))}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              {c.description}
            </p>
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
      <p className="type-prep-body text-[var(--text-body)]">
        {positioning.summary}
      </p>
      <ol className="mt-5 space-y-4">
        {frames.map((f, i) => (
          <li key={f.title} className="flex gap-3">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-tint-bg)] text-xs font-bold text-[var(--accent-deep)]">
              {i + 1}
            </span>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {f.title}
              </h3>
              <p className="mt-0.5 text-sm leading-relaxed text-[var(--text-body)]">
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
      <p className="type-prep-body text-[var(--text-body)]">{risks.summary}</p>
      <ul className="mt-5 space-y-3">
        {risks.items.map((item) => (
          <li
            key={item.risk}
            className="rounded-[10px] border border-[var(--border-card)] bg-[var(--surface-sunken)] p-4"
          >
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {item.risk}
            </p>
            {item.counter ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-body)]">
                {item.counter}
              </p>
            ) : tier === "deep" ? (
              <p className="mt-2 text-xs italic text-[var(--text-faint)]">
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
            <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded border border-[var(--border-strong)] bg-[var(--surface)]" />
            <span className="text-sm text-[var(--text-body)]">{c.item}</span>
          </li>
        ))}
      </ul>
    </SectionShell>
  )
}

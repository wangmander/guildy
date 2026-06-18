"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { X } from "lucide-react"
import posthog from "posthog-js"

import {
  generatePrepAction,
  getLatestPrepRoundsAction,
  getPrepStatesAction,
  type PrepStatesMap,
} from "@/app/app/actions"
import {
  PREP_SESSION_ROLES,
  resolveFullLoopSessionConfig,
  type FullLoopSessionConfig,
  type PrepOutput,
  type PrepSessionRole,
  type PrepTier,
} from "@/lib/ai/prep-types"
import type { StageKey } from "@/lib/stages"

import { InputsWidget } from "./widgets/inputs-widget"
import { InterviewerWidget } from "./widgets/interviewer-widget"
import { JobContextWidget } from "./widgets/job-context-widget"
import { PrepCanvas } from "./widgets/prep-canvas"
import { UpgradeWidget } from "./widgets/upgrade-widget"

export type PrepJob = {
  id: string
  company_name: string
  role_title: string
  tc: string | null
  source_url: string | null
  jd_text: string | null
  latest_message: string | null
  stage: StageKey
  full_loop_session_config: FullLoopSessionConfig | null
}

// Prompt 9 post-checkout resume: Board hydrates this when /app loads with
// subscribed=1 + resume_job + resume_role and the fresh subscription
// status is active. role===null is the single-prep case (any stage that
// isn't a Full Loop). consumed via internal ref so the autoresume only
// fires once per (job, role) pair.
export type PrepAutoResume = {
  role: PrepSessionRole | null
}

type Props = {
  job: PrepJob | null
  hasResume: boolean
  resumeText: string | null
  subscriptionStatus: string
  currentPeriodEnd: string | null
  hasInterviewer: boolean
  hasNote: boolean
  interviewerName: string | null
  interviewerTitle: string | null
  interviewerLink: string | null
  noteText: string | null
  autoResume?: PrepAutoResume | null
  // Prompt 14: fires after the autoresume effect completes (success OR
  // failure). Board uses it to clear its autoResume state so closing and
  // reopening the same job doesn't re-fire the Deep regen on remount.
  onAutoResumeHandled?: () => void
  onClose: () => void
}

// Phase 4d: orchestration switched from per-tier latest-row reads
// (getCachedPrepAction) to a 5-key states map. The map drives both the
// SessionTabs strip on Full Loop and the single-prep view on every other
// stage. PrepCanvas receives the map + selected role + in-flight set and
// derives display state internally.

const SINGLE_GENERATING_KEY = "_single"

// Full Loop multi-session stages. Both interview_loop and final map to the
// same PrepStage (interview_loop) per stageKeyToPrepStage, so both surface
// the SessionTabs strip and the per-session generate flow.
function isFullLoopStage(stage: StageKey | undefined): boolean {
  return stage === "interview_loop" || stage === "final"
}

// Prompt 15: paid view = active subscriber OR past_due grace. Both
// statuses mean the user has paid for Deep and should never see the
// Quick tab; Deep is the only tier they interact with. Canceled and
// free both fall back to the original Quick-default flow.
function isPaidStatus(status: string): boolean {
  return status === "active" || status === "past_due"
}

// First role marked enabled in the resolved config. Falls back to
// "hiring_manager" when zero roles are enabled (defensive — UI also handles
// the zero-enabled case via the empty-state branch in PrepCanvas).
function firstEnabledRole(
  config: FullLoopSessionConfig
): PrepSessionRole {
  for (const role of PREP_SESSION_ROLES) {
    if (config[role].enabled) return role
  }
  return "hiring_manager"
}

export type InputsExpansionSection =
  | "background"
  | "jd"
  | "message"
  | "interviewer"
  | "note"

type InputsExpansionState = {
  // Which section of the InputsWidget is currently expanded inline.
  // `null` means the widget is collapsed (no section open).
  section: InputsExpansionSection | null
  // Increments whenever an external trigger (e.g. InterviewerWidget click)
  // requests opening — used by InputsWidget to pulse its border so the
  // user's eye follows the action across columns.
  pulseToken: number
}

export function PrepOverlay({
  job,
  hasResume,
  resumeText,
  subscriptionStatus,
  currentPeriodEnd,
  hasInterviewer,
  hasNote,
  interviewerName,
  interviewerTitle,
  interviewerLink,
  noteText,
  autoResume = null,
  onAutoResumeHandled,
  onClose,
}: Props) {
  const [statesMap, setStatesMap] = useState<PrepStatesMap | null>(null)
  const [generatingRoles, setGeneratingRoles] = useState<Set<string>>(
    () => new Set()
  )
  const [selectedRole, setSelectedRole] =
    useState<PrepSessionRole>("hiring_manager")
  const [error, setError] = useState<string | null>(null)
  // Prompt 15: paid users default to Deep on every overlay open. Free
  // and canceled users keep the legacy Quick default.
  const [tier, setTier] = useState<PrepTier>(() =>
    isPaidStatus(subscriptionStatus) ? "deep" : "quick"
  )
  const [inputsExpansion, setInputsExpansion] = useState<InputsExpansionState>({
    section: null,
    pulseToken: 0,
  })
  const [, startTransition] = useTransition()

  const expandInputsSection = useCallback(
    (
      section: InputsExpansionSection | null,
      options?: { pulse?: boolean }
    ) => {
      setInputsExpansion((prev) => ({
        section,
        pulseToken: options?.pulse ? prev.pulseToken + 1 : prev.pulseToken,
      }))
    },
    []
  )

  const onUpgradeClick = useCallback(() => {
    // Open the UpgradeModal (owned by PrepCanvas) from any upgrade CTA. The
    // rail UpgradeWidget lives outside PrepCanvas, so this crosses the
    // boundary via a CustomEvent that PrepCanvas listens for (same pattern as
    // guildy:open-comp). The Stripe checkout itself lives in UpgradeModal.
    window.dispatchEvent(new CustomEvent("guildy:open-upgrade"))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Fires once per overlay open and again only when a different job is
  // swapped into the same instance. Stage is captured but not in deps so
  // a mid-overlay stage drag doesn't refire the event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!job) return
    posthog.capture("prep_overlay_opened", {
      job_id: job.id,
      stage: job.stage,
    })
  }, [job?.id])

  // After the overlay unmounts the browser restores focus to the trigger
  // (a card with role=button), which paints a keyboard focus ring. Blur
  // the next frame so the ring doesn't linger. Empty deps so this fires
  // only on unmount, not whenever onClose's reference changes.
  useEffect(() => {
    return () => {
      requestAnimationFrame(() => {
        const active = document.activeElement
        if (active instanceof HTMLElement && active !== document.body) {
          active.blur()
        }
      })
    }
  }, [])

  // Phase 4f: resolve the per-job session config once per render. null +
  // partial DB rows are filled with DEFAULT_FULL_LOOP_SESSION_CONFIG, so
  // every consumer can treat sessionConfig as authoritative.
  const sessionConfig = useMemo(
    () => resolveFullLoopSessionConfig(job?.full_loop_session_config ?? null),
    [job?.full_loop_session_config]
  )

  // Prompt 9 autoresume: when the post-checkout flow drives a tier flip to
  // 'deep' alongside a generation kickoff, the reset effect below would
  // otherwise clear the just-set generatingRoles on the tier-dep retrigger.
  // The pending ref is set true while the autoresume kickoff is in flight,
  // and cleared by the action's transition callback.
  const autoResumePendingRef = useRef(false)

  // Reset session state whenever a different job opens or tier flips. Cleared
  // map produces a clean LoadingSkeleton on first paint of the new context.
  useEffect(() => {
    setStatesMap(null)
    setError(null)
    if (!autoResumePendingRef.current) {
      setGeneratingRoles(new Set())
    }
  }, [job?.id, tier])

  // Prompt 14: split from a combined [job?.id, sessionConfig] effect. The
  // previous shape reset tier whenever the Full Loop parser updated
  // job.full_loop_session_config mid-session, which silently reverted
  // Deep → Quick after the autoresume kicked off. tier/inputs only reset
  // on actual job change now; selectedRole defaults are re-evaluated by
  // the defense effect below when the active role goes disabled.
  //
  // Prompt 15: tier reset honors subscription status. Paid users land
  // on Deep on every job open; the latest-round picker effect below
  // refines selectedRole based on prep history.
  useEffect(() => {
    setTier(isPaidStatus(subscriptionStatus) ? "deep" : "quick")
    setSelectedRole(firstEnabledRole(sessionConfig))
    setInputsExpansion({ section: null, pulseToken: 0 })
    // sessionConfig + subscriptionStatus intentionally excluded — see
    // comment above. Effect only fires on actual job switches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id])

  // If the currently selected role becomes disabled (config edit), shift to
  // the first enabled role. setState bails on identical values so this is
  // safe to fire on every config change.
  useEffect(() => {
    if (!sessionConfig[selectedRole].enabled) {
      setSelectedRole(firstEnabledRole(sessionConfig))
    }
  }, [sessionConfig, selectedRole])

  // Fetch the 5-key states map. Re-fires on job/tier change (loading flash)
  // and silently in the background when input props change (resume, JD, etc.)
  // so stale rows surface as "stale" without blanking the prep view.
  useEffect(() => {
    if (!job) return
    let cancelled = false
    getPrepStatesAction({ job_id: job.id, tier }).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        setError(res.error)
        return
      }
      setStatesMap(res.states)
      setError(null)
    })
    return () => {
      cancelled = true
    }
    // Input-related deps (jd_text, latest_message, resume, interviewer, note)
    // intentionally included so input edits trigger a state refresh and the
    // current view reclassifies as stale or cached. eslint warns about the
    // job object dep stability but we read primitives off it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    job?.id,
    tier,
    job?.jd_text,
    job?.latest_message,
    resumeText,
    interviewerName,
    interviewerTitle,
    interviewerLink,
    noteText,
  ])

  const onGenerate = useCallback(
    (role: PrepSessionRole | null, opts?: { force?: boolean }) => {
      if (!job) return
      const generatingKey = role ?? SINGLE_GENERATING_KEY
      setGeneratingRoles((prev) => {
        const next = new Set(prev)
        next.add(generatingKey)
        return next
      })
      setError(null)
      startTransition(async () => {
        const res = await generatePrepAction({
          job_id: job.id,
          tier,
          session_role: role ?? undefined,
          force: opts?.force ?? false,
        })
        setGeneratingRoles((prev) => {
          const next = new Set(prev)
          next.delete(generatingKey)
          return next
        })
        if (!res.ok) {
          setError(res.error)
          return
        }
        if (tier === "quick") {
          posthog.capture("quick_prep_generated", {
            job_id: job.id,
            session_role: role ?? "_single",
          })
        }
        // Optimistic local update so the just-finished session flips from
        // generating → cached without waiting for the next states refetch.
        const mapKey: keyof PrepStatesMap = role ?? "single"
        setStatesMap((prev) =>
          prev
            ? { ...prev, [mapKey]: { state: "cached", output: res.prep } }
            : prev
        )
      })
    },
    [job, tier]
  )

  // Prompt 14 autoresume effect: hardened to fire AT MOST once per
  // overlay mount. The boolean ref replaces the prior (job,role) keyed
  // ref so subsequent prop changes on the same mount are also a no-op.
  // Board clears its autoResume state via onAutoResumeHandled after the
  // action completes (success OR failure) so a close+reopen of the same
  // job lands on the cached Deep prep instead of regenerating. On
  // failure, tier stays on Deep and the error surfaces via the standard
  // ErrorState (retryable Generate Deep button) — no silent revert.
  const autoResumeHandledRef = useRef(false)
  useEffect(() => {
    if (!autoResume || !job) return
    if (autoResumeHandledRef.current) return
    autoResumeHandledRef.current = true
    autoResumePendingRef.current = true

    const role = autoResume.role
    setTier("deep")
    if (role) setSelectedRole(role)

    const generatingKey = role ?? SINGLE_GENERATING_KEY
    setGeneratingRoles((prev) => {
      const next = new Set(prev)
      next.add(generatingKey)
      return next
    })
    setError(null)

    startTransition(async () => {
      const res = await generatePrepAction({
        job_id: job.id,
        tier: "deep",
        session_role: role ?? undefined,
        force: true,
      })
      autoResumePendingRef.current = false
      setGeneratingRoles((prev) => {
        const next = new Set(prev)
        next.delete(generatingKey)
        return next
      })
      if (!res.ok) {
        // Surface a retryable error; do NOT setTier("quick"). The user
        // is on the Deep tab and ErrorState's Try again button calls
        // onGenerate which keeps the current tier closure.
        setError(res.error)
      } else {
        const mapKey: keyof PrepStatesMap = role ?? "single"
        setStatesMap((prev) =>
          prev
            ? { ...prev, [mapKey]: { state: "cached", output: res.prep } }
            : prev
        )
      }
      onAutoResumeHandled?.()
    })
  }, [autoResume, job, onAutoResumeHandled])

  // Prompt 15 default-round picker. On overlay open, query the most
  // recent prep round per tier for this job and pre-select it. Paid
  // users prefer Deep; Quick is the fallback for both paid (no Deep yet)
  // and free users. autoResume wins when active: if it was set on
  // initial mount, this picker skips entirely so we never stomp the
  // round Stripe redirected us to. Single-prep stages return role=null
  // from the action, which leaves selectedRole at its firstEnabledRole
  // default (harmless since the UI uses the "single" key there).
  //
  // Prompt 17b: latestRoundsResolved gates the PrepCanvas skeleton.
  // Initial false; flips true when the action settles (success OR
  // failure) or when the picker is skipped (autoResume / already-picked
  // paths). Replaces the 500ms timer heuristic in PrepCanvas with a
  // signal driven by the actual query lifecycle.
  const initialAutoResumeRef = useRef(autoResume !== null)
  const defaultRoundPickedRef = useRef(false)
  const [latestRoundsResolved, setLatestRoundsResolved] = useState(false)
  useEffect(() => {
    if (!job) return
    if (initialAutoResumeRef.current) {
      // autoResume drives selectedRole authoritatively; picker is a
      // no-op so PrepCanvas can proceed past the skeleton gate.
      setLatestRoundsResolved(true)
      return
    }
    if (defaultRoundPickedRef.current) {
      // Defensive: a job?.id change without overlay unmount would
      // skip the action; mark resolved so the skeleton doesn't lock.
      setLatestRoundsResolved(true)
      return
    }
    defaultRoundPickedRef.current = true
    setLatestRoundsResolved(false)
    let cancelled = false
    getLatestPrepRoundsAction(job.id)
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          const paid = isPaidStatus(subscriptionStatus)
          const latest = paid ? (res.deep ?? res.quick) : res.quick
          const targetRole = latest?.role ?? null
          if (targetRole) setSelectedRole(targetRole)
        }
        // No-cached-prep is a legitimate resolved state. EmptyState
        // surfaces normally once we flip the gate.
        setLatestRoundsResolved(true)
      })
      .catch(() => {
        if (cancelled) return
        setLatestRoundsResolved(true)
      })
    return () => {
      cancelled = true
    }
    // job?.id is the only meaningful retrigger; subscriptionStatus
    // intentionally excluded so a mid-session status flip (rare) does
    // not re-run the picker and clobber the user's current selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id])

  // Output backing the Interviewer widget's insights field. Single view uses
  // the "single" entry; Full Loop uses the selected session's output.
  const currentOutput: PrepOutput | null = (() => {
    if (!statesMap) return null
    const key: keyof PrepStatesMap = isFullLoopStage(job?.stage)
      ? selectedRole
      : "single"
    return statesMap[key].output ?? null
  })()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={job ? `Prep for ${job.company_name}` : "Prep overlay"}
      className="fixed inset-0 z-50"
    >
      {/* Phase 4e p1.6: dedicated backdrop sibling. Owns the click-to-close
          handler. Sits at the bottom of the stack; content + X button
          render on top. Clicks that don't hit a column's pointer-events-auto
          surface (gaps, outer scrim) hit this element directly. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[var(--overlay-bg)]"
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close"
        className="absolute right-4 top-4 z-20 inline-flex size-10 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-body)] shadow-[var(--shadow-e2)] transition-colors hover:text-[var(--text-primary)] md:right-6 md:top-6"
      >
        <X className="size-5" />
      </button>

      {/* Content layer: pointer-events-none on the wrappers so inter-column
          gaps and outer overflow area pass clicks through to the backdrop.
          Each column is pointer-events-auto + stopPropagation so widget
          clicks stay inside the overlay. */}
      {/* Unified vertical scroll: the whole overlay scrolls as one unit at
          every breakpoint. The side rails are NOT sticky; they scroll away
          with the center (B2). */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-y-auto">
        <div className="pointer-events-none mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-4 px-4 py-16 md:grid md:grid-cols-[280px_minmax(0,1fr)_360px] md:items-start md:gap-12 md:px-6 md:py-6 lg:px-8">
          {!job ? (
            <ErrorCard onClose={onClose} />
          ) : (
            <>
              {/* Left rail: one muted --surface-rail box with de-carded
                  sections inside (B1). The Deep Prep upsell stays its own
                  lavender card below the gray box. Asides are
                  pointer-events-none; the rail box + upsell are
                  pointer-events-auto + stopPropagation so gaps still close
                  the overlay (B4). */}
              <aside className="pointer-events-none flex flex-col gap-4">
                <div
                  className="pointer-events-auto flex flex-col rounded-[16px] bg-[var(--surface-rail)] p-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <JobContextWidget
                    company={job.company_name}
                    role={job.role_title}
                    tc={job.tc}
                    sourceUrl={job.source_url}
                    jdSnippet={job.jd_text}
                  />
                  <div className="my-3 h-px bg-[var(--border)]" />
                  <InterviewerWidget
                    name={interviewerName}
                    title={interviewerTitle}
                    link={interviewerLink}
                    tier={tier}
                    insights={currentOutput?.interviewer_insights ?? null}
                    onEdit={() =>
                      expandInputsSection("interviewer", { pulse: true })
                    }
                  />
                </div>
                {tier === "quick" ? (
                  <div
                    className="pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <UpgradeWidget onUpgrade={onUpgradeClick} />
                  </div>
                ) : null}
              </aside>

              <main className="pointer-events-none">
                <div
                  className="pointer-events-auto rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-e3)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PrepCanvas
                    jobId={job.id}
                    stage={job.stage}
                    sessionConfig={sessionConfig}
                    subscriptionStatus={subscriptionStatus}
                    currentPeriodEnd={currentPeriodEnd}
                    statesMap={statesMap}
                    latestRoundsResolved={latestRoundsResolved}
                    generatingRoles={generatingRoles}
                    selectedRole={selectedRole}
                    onSelectRole={setSelectedRole}
                    error={error}
                    hasResume={hasResume}
                    hasJd={!!job.jd_text && job.jd_text.trim().length > 0}
                    tier={tier}
                    onTierChange={setTier}
                    onGenerate={onGenerate}
                    onUpgrade={onUpgradeClick}
                    onAddJd={() => expandInputsSection("jd", { pulse: true })}
                  />
                </div>
              </main>

              <aside className="pointer-events-none flex flex-col gap-4">
                <div
                  className="pointer-events-auto rounded-[16px] bg-[var(--surface-rail)] p-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <InputsWidget
                    jobId={job.id}
                    hasResume={hasResume}
                    resumeText={resumeText}
                    jdText={job.jd_text}
                    latestMessage={job.latest_message}
                    interviewerName={interviewerName}
                    interviewerTitle={interviewerTitle}
                    interviewerLink={interviewerLink}
                    noteText={noteText}
                    hasInterviewer={hasInterviewer}
                    hasNote={hasNote}
                    expansion={inputsExpansion}
                    onExpand={expandInputsSection}
                  />
                </div>
              </aside>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorCard({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto col-span-full mx-auto mt-12 max-w-md rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-[var(--shadow-e3)]"
    >
      <h2 className="font-bricolage text-base font-semibold text-[var(--text-primary)]">
        That job couldn&rsquo;t be found
      </h2>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        It may have been deleted, or the link is invalid.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-[10px] bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-deep)]"
      >
        Close
      </button>
    </div>
  )
}


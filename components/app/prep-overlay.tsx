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

import {
  generatePrepAction,
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
  onClose,
}: Props) {
  const [statesMap, setStatesMap] = useState<PrepStatesMap | null>(null)
  const [generatingRoles, setGeneratingRoles] = useState<Set<string>>(
    () => new Set()
  )
  const [selectedRole, setSelectedRole] =
    useState<PrepSessionRole>("hiring_manager")
  const [error, setError] = useState<string | null>(null)
  const [tier, setTier] = useState<PrepTier>("quick")
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
    // PHASE 6b: wire to Stripe checkout. Logging only in test mode.
    // eslint-disable-next-line no-console
    console.log("upgrade clicked, paywall ships in 6b")
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

  // Reset tier and inputs widget on job change. selectedRole defaults to
  // the first enabled role in this job's config so jobs with custom loops
  // open on a sensible tab.
  useEffect(() => {
    setTier("quick")
    setSelectedRole(firstEnabledRole(sessionConfig))
    setInputsExpansion({ section: null, pulseToken: 0 })
    // sessionConfig depends on job.full_loop_session_config, which can
    // refresh in place when prompt 5's Customize Rounds saves. Keying on
    // job?.id only would miss that — also include sessionConfig so an
    // in-place config edit re-evaluates the default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, sessionConfig])

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

  // Prompt 9 autoresume effect: when /app loads with subscribed=1 plus a
  // job+role and the fresh subscription is active, Board passes
  // autoResume here. We flip tier to deep, select the round, mark
  // generatingRoles, and fire generatePrepAction inline (can't use
  // onGenerate — its closure captured tier='quick'). The ref ensures one
  // shot per (job, role).
  const autoResumeFiredKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!autoResume || !job) return
    const role = autoResume.role
    const fireKey = `${job.id}:${role ?? "_single"}`
    if (autoResumeFiredKeyRef.current === fireKey) return
    autoResumeFiredKeyRef.current = fireKey
    autoResumePendingRef.current = true

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
        setError(res.error)
        return
      }
      const mapKey: keyof PrepStatesMap = role ?? "single"
      setStatesMap((prev) =>
        prev
          ? { ...prev, [mapKey]: { state: "cached", output: res.prep } }
          : prev
      )
    })
  }, [autoResume, job])

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
        className="absolute inset-0 bg-[#1C1E21]/40 backdrop-blur-md"
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close"
        className="absolute right-4 top-4 z-20 inline-flex size-10 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow-md backdrop-blur transition-colors hover:bg-white hover:text-[#1C1E21] md:right-6 md:top-6"
      >
        <X className="size-5" />
      </button>

      {/* Content layer: pointer-events-none on the wrappers so inter-column
          gaps and outer overflow area pass clicks through to the backdrop.
          Each column is pointer-events-auto + stopPropagation so widget
          clicks stay inside the overlay. */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-y-auto md:overflow-hidden">
        <div className="pointer-events-none mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-4 px-4 py-16 md:grid md:grid-cols-[280px_minmax(0,1fr)_360px] md:gap-6 md:px-6 md:py-6 lg:gap-8 lg:px-8">
          {!job ? (
            <ErrorCard onClose={onClose} />
          ) : (
            <>
              {/* Phase 4e p1.7: pointer-events-auto + stopPropagation moved
                  from the aside/main wrappers down to per-widget shells.
                  Aside is now pointer-events-none (purely structural for
                  the flex layout), so its empty space below the last
                  widget passes clicks through to the backdrop. */}
              <aside className="pointer-events-none flex flex-col gap-4 md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto md:pr-1">
                <div
                  className="pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <JobContextWidget
                    company={job.company_name}
                    role={job.role_title}
                    tc={job.tc}
                    sourceUrl={job.source_url}
                    jdSnippet={job.jd_text}
                  />
                </div>
                <div
                  className="pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
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

              <main className="pointer-events-none md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto">
                <div
                  className="pointer-events-auto rounded-2xl border border-black/5 bg-[#F8F9FA] shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PrepCanvas
                    jobId={job.id}
                    stage={job.stage}
                    sessionConfig={sessionConfig}
                    subscriptionStatus={subscriptionStatus}
                    currentPeriodEnd={currentPeriodEnd}
                    statesMap={statesMap}
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

              <aside className="pointer-events-none flex flex-col gap-4 md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto md:pr-1">
                <div
                  className="pointer-events-auto"
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
      className="pointer-events-auto col-span-full mx-auto mt-12 max-w-md rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm"
    >
      <h2 className="text-base font-semibold text-[#1C1E21]">
        That job couldn&rsquo;t be found
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        It may have been deleted, or the link is invalid.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-[#482C4C] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Close
      </button>
    </div>
  )
}


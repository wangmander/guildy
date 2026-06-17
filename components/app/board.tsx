"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"

import {
  getSubscriptionStatusAction,
  moveJobStageAction,
  parseFullLoopRoundsAction,
  verifyCheckoutAndSyncAction,
} from "@/app/app/actions"
import {
  PREP_SESSION_ROLES,
  type FullLoopSessionConfig,
  type PrepSessionRole,
} from "@/lib/ai/prep-types"
import {
  columnToWriteStage,
  leftOfColumn,
  rightOfColumn,
  stageToColumn,
  UI_COLUMNS,
  type StageKey,
  type UiColumnKey,
} from "@/lib/stages"
import type { JobQuest } from "@/lib/quests/quests"

import { AppliedColumn } from "./applied-column"
import { BoardColumn } from "./board-column"
import { PrepOverlay, type PrepJob } from "./prep-overlay"

export type JobRow = {
  id: string
  company_name: string
  role_title: string
  tc: string | null
  state: "passive" | "active"
  stage: StageKey
  source_url: string | null
  jd_text: string | null
  latest_message: string | null
  full_loop_session_config: FullLoopSessionConfig | null
  prep_status: string
}

export type InterviewerInfo = {
  name: string | null
  title: string | null
  link: string | null
}

type Props = {
  jobs: JobRow[]
  hasResume: boolean
  resumeText: string | null
  subscriptionStatus: string
  currentPeriodEnd: string | null
  interviewerByJobId: Record<string, InterviewerInfo>
  noteByJobId: Record<string, string>
  questByJobId: Record<string, JobQuest>
  initialOpenJobId: string | null
}

export function Board({
  jobs,
  hasResume,
  resumeText,
  subscriptionStatus,
  currentPeriodEnd,
  interviewerByJobId,
  noteByJobId,
  questByJobId,
  initialOpenJobId,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const q = (searchParams.get("q") ?? "").trim().toLowerCase()
  const isSearchActive = q.length > 0
  const urlJobId = searchParams.get("job")

  const [openJobId, setOpenJobId] = useState<string | null>(initialOpenJobId)

  // Sync state when URL changes from outside our open/close handlers
  // (back/forward navigation, manual URL edits). The equality guard
  // prevents a feedback loop when our own open/close already pushed.
  useEffect(() => {
    if (urlJobId !== openJobId) {
      setOpenJobId(urlJobId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlJobId])

  // Phase 4f patch 3.5: client-side parser trigger. The earlier server-side
  // hookup inside moveJobStageAction blocked the drag-drop response by ~3s.
  // Now the card lands instantly; on next render we scan jobs needing a
  // parse and fire the action without awaiting. parseFullLoopRoundsAction
  // calls revalidatePath('/app') on success, which refreshes the jobs prop
  // with the populated config and naturally exits the trigger condition on
  // the subsequent render.
  //
  // parserFiredJobsRef guards against re-fires when the jobs array reference
  // changes but the underlying state for a given job hasn't progressed.
  // Reload resets the ref; if the parser failed, the second attempt fires.
  const parserFiredJobsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const job of jobs) {
      const inFullLoop =
        job.stage === "final" || job.stage === "interview_loop"
      if (!inFullLoop) continue
      if (job.full_loop_session_config !== null) continue
      if (parserFiredJobsRef.current.has(job.id)) continue
      parserFiredJobsRef.current.add(job.id)
      // eslint-disable-next-line no-console
      console.log("parseFullLoopRoundsAction trigger", {
        jobId: job.id,
        reason: "client_full_loop_no_config",
      })
      parseFullLoopRoundsAction({ job_id: job.id })
        .then((res) => {
          if (!res.ok) {
            // eslint-disable-next-line no-console
            console.error("parseFullLoopRoundsAction failed", {
              jobId: job.id,
              error: res.error,
            })
          }
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error("parseFullLoopRoundsAction failed", {
            jobId: job.id,
            error: err instanceof Error ? err.message : String(err),
          })
        })
    }
  }, [jobs])

  const open = useCallback(
    (jobId: string) => {
      setOpenJobId(jobId)
      const params = new URLSearchParams(searchParams.toString())
      params.set("job", jobId)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const close = useCallback(() => {
    setOpenJobId(null)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("job")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  const visibleJobs = useMemo(() => {
    if (!isSearchActive) return jobs
    return jobs.filter((j) => {
      const fields = [
        j.company_name,
        j.role_title,
        j.jd_text,
        j.latest_message,
      ]
      return fields.some(
        (f) => typeof f === "string" && f.toLowerCase().includes(q)
      )
    })
  }, [jobs, q, isSearchActive])

  // Phase 4e: optimistic stage overrides keyed by job_id. Applied on render
  // so the dragged card lands instantly in the destination column. Rolled
  // back on action failure; cleared per-id when the server jobs prop catches
  // up to the optimistic stage.
  const [optimisticStages, setOptimisticStages] = useState<
    Record<string, StageKey>
  >({})
  const [moveError, setMoveError] = useState<string | null>(null)

  // Drop optimistic overrides whose server stage now matches.
  useEffect(() => {
    setOptimisticStages((prev) => {
      let changed = false
      const next: Record<string, StageKey> = {}
      for (const [id, stage] of Object.entries(prev)) {
        const job = jobs.find((j) => j.id === id)
        if (!job) {
          changed = true
          continue
        }
        if (job.stage === stage) {
          changed = true
          continue
        }
        next[id] = stage
      }
      return changed ? next : prev
    })
  }, [jobs])

  // Auto-dismiss the move error toast after 4s.
  useEffect(() => {
    if (!moveError) return
    const t = setTimeout(() => setMoveError(null), 4000)
    return () => clearTimeout(t)
  }, [moveError])

  // Prompt 12 post-checkout resume. Primary path: verify the Stripe
  // Checkout Session server-side and sync user_profiles from that read.
  // The webhook is no longer in the critical path — the action retrieves
  // the session straight from Stripe so a webhook delay can't block the
  // first paid experience.
  //
  // Backward compat: in-flight sessions created before Prompt 12 used a
  // subscribed=1 success_url with no session_id. If we see that param
  // shape we fall back to the prior DB-status flow.
  const [autoResume, setAutoResume] = useState<
    { jobId: string; role: PrepSessionRole | null } | null
  >(null)
  const [welcomeToast, setWelcomeToast] = useState<string | null>(null)
  const autoResumeHandledRef = useRef(false)

  // Prompt 16 Bug 1: lifted out of the effect so onAutoResumeHandled can
  // call it after PrepOverlay's autoresume action completes (success OR
  // failure). The previous shape stripped immediately on verify "active",
  // which sometimes raced the overlay mount and left params in the URL
  // when navigation timing went sideways. The new contract: URL params
  // represent pending autoresume work. They clear when the work settles.
  const stripAutoResumeParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("session_id")
    params.delete("subscribed")
    params.delete("resume_job")
    params.delete("resume_role")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  useEffect(() => {
    if (autoResumeHandledRef.current) return

    const sessionIdParam = searchParams.get("session_id")
    const subscribedLegacyParam = searchParams.get("subscribed")
    if (!sessionIdParam && subscribedLegacyParam !== "1") return

    autoResumeHandledRef.current = true

    const resumeJobParam = searchParams.get("resume_job")
    const resumeRoleParam = searchParams.get("resume_role")
    const role: PrepSessionRole | null =
      resumeRoleParam === "_single"
        ? null
        : resumeRoleParam &&
            (PREP_SESSION_ROLES as readonly string[]).includes(
              resumeRoleParam
            )
          ? (resumeRoleParam as PrepSessionRole)
          : null
    const matchedJob = resumeJobParam
      ? (jobs.find((j) => j.id === resumeJobParam) ?? null)
      : null

    // Returns true when an autoresume was queued (PrepOverlay will fire
    // and onAutoResumeHandled is responsible for stripping URL params).
    // Returns false when no work is queued and the caller should strip now.
    const fireResume = (): boolean => {
      if (resumeJobParam && matchedJob) {
        setOpenJobId(resumeJobParam)
        setAutoResume({ jobId: resumeJobParam, role })
        setWelcomeToast("Welcome to Guildy Deep. Generating your prep...")
        return true
      }
      setWelcomeToast("Welcome to Guildy Deep.")
      return false
    }

    ;(async () => {
      // Primary: Stripe-verified path.
      if (sessionIdParam) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const res = await verifyCheckoutAndSyncAction(sessionIdParam)
          if (res.status === "active") {
            const queued = fireResume()
            if (!queued) stripAutoResumeParams()
            return
          }
          if (res.status === "unauthorized" || res.status === "error") {
            // Don't retry on auth/error; surface a quiet toast and leave
            // params so a reload (or support ping) has the context intact.
            setWelcomeToast(
              res.status === "unauthorized"
                ? "Couldn't verify this checkout session."
                : "Couldn't verify subscription. Refresh in a moment."
            )
            return
          }
          // pending: back off and retry
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 500))
          }
        }
        setWelcomeToast(
          "Subscription confirming, refresh in a moment."
        )
        return
      }

      // Legacy: subscribed=1 only. Fall back to DB status read.
      const status = await getSubscriptionStatusAction()
      if (status.ok && status.subscription_status === "active") {
        const queued = fireResume()
        if (!queued) stripAutoResumeParams()
      } else {
        stripAutoResumeParams()
      }
    })()
    // searchParams/jobs are read inside; intentionally only fire once via the
    // ref guard above so re-renders don't restart the flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!welcomeToast) return
    const t = setTimeout(() => setWelcomeToast(null), 5000)
    return () => clearTimeout(t)
  }, [welcomeToast])

  const grouped: Record<UiColumnKey, JobRow[]> = {
    applied: [],
    screen: [],
    hiring_manager: [],
    full_loop: [],
    offer: [],
  }

  for (const job of visibleJobs) {
    const effectiveStage = optimisticStages[job.id] ?? job.stage
    const col = stageToColumn(effectiveStage)
    if (col) grouped[col].push(job)
  }

  const move = (
    jobId: string,
    toColumn: UiColumnKey,
    source: "arrow" | "drag"
  ) => {
    const stage = columnToWriteStage(toColumn)
    // Clear drag state synchronously. The optimistic stage flip below
    // unmounts the source JobCard before the browser fires onDragEnd, so
    // the DOM-level handler may never run — leaving the destination card
    // stuck with isDragging=true (faded styling).
    setDraggedJobId(null)
    setOptimisticStages((prev) => ({ ...prev, [jobId]: stage }))
    setMoveError(null)
    startTransition(async () => {
      const res = await moveJobStageAction({
        job_id: jobId,
        to_stage: stage,
        source,
      })
      if (!res.ok) {
        // Rollback the optimistic override; the card snaps back to its
        // server-truth stage on the next render.
        setOptimisticStages((prev) => {
          if (!(jobId in prev)) return prev
          const next = { ...prev }
          delete next[jobId]
          return next
        })
        setMoveError(res.error)
      }
    })
  }

  const openJob: PrepJob | null = openJobId
    ? (() => {
        const j = jobs.find((x) => x.id === openJobId)
        if (!j) return null
        return {
          id: j.id,
          company_name: j.company_name,
          role_title: j.role_title,
          tc: j.tc,
          source_url: j.source_url,
          jd_text: j.jd_text,
          latest_message: j.latest_message,
          stage: j.stage,
          full_loop_session_config: j.full_loop_session_config,
        }
      })()
    : null
  const interviewer = openJobId ? interviewerByJobId[openJobId] ?? null : null
  const noteText = openJobId ? noteByJobId[openJobId] ?? null : null
  const hasInterviewer = !!(
    interviewer && (interviewer.name || interviewer.title || interviewer.link)
  )
  const hasNote = !!noteText

  return (
    <>
      {welcomeToast ? (
        <div className="px-4 lg:px-8">
          <div
            role="status"
            className="mb-2 rounded-md border border-[#4E3BDD]/20 bg-[#EDE9FE] px-3 py-2 text-xs text-[#4E3BDD]"
          >
            {welcomeToast}
          </div>
        </div>
      ) : null}
      {moveError ? (
        <div className="px-4 lg:px-8">
          <div
            role="alert"
            className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            Couldn&rsquo;t move card: {moveError}
          </div>
        </div>
      ) : null}
      <section aria-label="Pipeline" className="w-full">
        <div className="px-4 lg:px-8">
          <div className="flex snap-x snap-mandatory overflow-x-auto rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-e1b)] lg:snap-none">
            {UI_COLUMNS.map((col, i) => (
              <Fragment key={col.key}>
                {i > 0 && (
                  <div
                    aria-hidden
                    className="w-px shrink-0 self-stretch"
                    style={{
                      background:
                        col.key === "screen"
                          ? "var(--divider-intake)"
                          : "var(--divider)",
                    }}
                  />
                )}
                {col.key === "applied" ? (
                  <AppliedColumn
                    label={col.label}
                    jobs={grouped.applied}
                    questByJobId={questByJobId}
                    isSearchActive={isSearchActive}
                    draggedJobId={draggedJobId}
                    onJobOpen={open}
                    onJobDrop={(jobId) => move(jobId, col.key, "drag")}
                    onDragStart={setDraggedJobId}
                    onDragEnd={() => setDraggedJobId(null)}
                  />
                ) : (
                  <BoardColumn
                    columnKey={col.key}
                    label={col.label}
                    jobs={grouped[col.key]}
                    questByJobId={questByJobId}
                    variant={col.variant}
                    hint="Cards land here when you move them from earlier stages"
                    isSearchActive={isSearchActive}
                    draggedJobId={draggedJobId}
                    onJobOpen={open}
                    onJobMoveLeft={(jobId) => {
                      const left = leftOfColumn(col.key)
                      if (left) move(jobId, left, "arrow")
                    }}
                    onJobMoveRight={(jobId) => {
                      const right = rightOfColumn(col.key)
                      if (right) move(jobId, right, "arrow")
                    }}
                    onJobDrop={(jobId) => move(jobId, col.key, "drag")}
                    onDragStart={setDraggedJobId}
                    onDragEnd={() => setDraggedJobId(null)}
                  />
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </section>
      {openJobId && (
        <PrepOverlay
          job={openJob}
          hasResume={hasResume}
          resumeText={resumeText}
          subscriptionStatus={subscriptionStatus}
          currentPeriodEnd={currentPeriodEnd}
          hasInterviewer={hasInterviewer}
          hasNote={hasNote}
          interviewerName={interviewer?.name ?? null}
          interviewerTitle={interviewer?.title ?? null}
          interviewerLink={interviewer?.link ?? null}
          noteText={noteText}
          autoResume={
            autoResume && autoResume.jobId === openJobId
              ? { role: autoResume.role }
              : null
          }
          onAutoResumeHandled={() => {
            setAutoResume(null)
            stripAutoResumeParams()
          }}
          onClose={close}
        />
      )}
    </>
  )
}

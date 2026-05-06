"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"

import {
  moveJobStageAction,
  parseFullLoopRoundsAction,
} from "@/app/app/actions"
import type { FullLoopSessionConfig } from "@/lib/ai/prep-types"
import {
  columnToWriteStage,
  leftOfColumn,
  rightOfColumn,
  stageToColumn,
  UI_COLUMNS,
  type StageKey,
  type UiColumnKey,
} from "@/lib/stages"

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
  interviewerByJobId: Record<string, InterviewerInfo>
  noteByJobId: Record<string, string>
  initialOpenJobId: string | null
}

export function Board({
  jobs,
  hasResume,
  resumeText,
  interviewerByJobId,
  noteByJobId,
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

  const grouped: Record<UiColumnKey, JobRow[]> = {
    applied: [],
    screen: [],
    hiring_manager: [],
    full_loop: [],
    offer: [],
  }

  for (const job of visibleJobs) {
    const col = stageToColumn(job.stage)
    if (col) grouped[col].push(job)
  }

  const move = (
    jobId: string,
    toColumn: UiColumnKey,
    source: "arrow" | "drag"
  ) => {
    const stage = columnToWriteStage(toColumn)
    if (!stage) return
    startTransition(async () => {
      await moveJobStageAction({ job_id: jobId, to_stage: stage, source })
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
      <section aria-label="Pipeline" className="w-full">
        <div className="px-4 lg:px-8">
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:snap-none lg:overflow-visible lg:pb-0">
            {UI_COLUMNS.map((col) => {
              if (col.key === "applied") {
                return (
                  <AppliedColumn
                    key={col.key}
                    label={col.label}
                    jobs={grouped.applied}
                    isSearchActive={isSearchActive}
                    onJobOpen={open}
                  />
                )
              }
              return (
                <BoardColumn
                  key={col.key}
                  columnKey={col.key}
                  label={col.label}
                  jobs={grouped[col.key]}
                  variant={col.variant}
                  hint="Cards land here when you move them from Applied"
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
              )
            })}
          </div>
        </div>
      </section>
      {openJobId && (
        <PrepOverlay
          job={openJob}
          hasResume={hasResume}
          resumeText={resumeText}
          hasInterviewer={hasInterviewer}
          hasNote={hasNote}
          interviewerName={interviewer?.name ?? null}
          interviewerTitle={interviewer?.title ?? null}
          interviewerLink={interviewer?.link ?? null}
          noteText={noteText}
          onClose={close}
        />
      )}
    </>
  )
}

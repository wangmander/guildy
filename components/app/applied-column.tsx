"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"

import { ActivationModal } from "./activation-modal"
import { AddJobModal } from "./add-job-modal"
import { JobCard } from "./job-card"

import type { JobRow } from "./board"
import type { JobQuest } from "@/lib/quests/quests"

// Applied stage ramp (spec 1a): neutral, no hook.
const APPLIED = { band: "#97A1AD", text: "#62707E", chip: "#E5E9EE" }

type Props = {
  label: string
  jobs: JobRow[]
  questByJobId: Record<string, JobQuest>
  justCreatedJobId?: string | null
  isSearchActive: boolean
  draggedJobId: string | null
  onJobOpen: (jobId: string) => void
  onJobArchive: (jobId: string) => void
  onJobDrop: (jobId: string) => void
  onDragStart: (jobId: string) => void
  onDragEnd: () => void
}

export function AppliedColumn({
  label,
  jobs,
  questByJobId,
  justCreatedJobId,
  draggedJobId,
  onJobOpen,
  onJobArchive,
  onJobDrop,
  onDragStart,
  onDragEnd,
}: Props) {
  const [open, setOpen] = useState(false)
  const [activatingJob, setActivatingJob] = useState<JobRow | null>(null)
  const [isOver, setIsOver] = useState(false)
  const count = jobs.length
  const canAcceptDrop = draggedJobId !== null

  return (
    <div
      onDragOver={(e) => {
        if (!canAcceptDrop) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        if (!isOver) setIsOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        if (isOver) setIsOver(false)
      }}
      onDrop={(e) => {
        if (!canAcceptDrop) return
        e.preventDefault()
        const jobId = e.dataTransfer.getData("text/plain")
        setIsOver(false)
        if (jobId) onJobDrop(jobId)
      }}
      className={cn(
        "flex min-w-[208px] shrink-0 snap-start flex-col transition-colors lg:min-w-0 lg:flex-1 lg:shrink",
        canAcceptDrop && isOver && "bg-[var(--surface-sunken)]"
      )}
    >
      <div className="h-[3px] w-full" style={{ background: APPLIED.band }} />

      <div className="flex items-center justify-between gap-2 px-[14px] pb-[11px] pt-[14px]">
        <span
          className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-bold uppercase tracking-[0.05em]"
          style={{ color: APPLIED.text }}
        >
          {label}
          <span
            className="rounded-[7px] px-[7px] py-px text-[12px] font-bold"
            style={{ background: APPLIED.chip, color: APPLIED.text }}
          >
            {count}
          </span>
        </span>
      </div>

      <div className="flex max-h-[60vh] flex-col gap-[11px] overflow-y-auto px-3 pb-[14px]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[var(--ink)] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--ink-hover)]"
        >
          <Plus className="size-3.5" />
          Add Job
        </button>

        {jobs.map((job) => (
          <JobCard
            key={job.id}
            jobId={job.id}
            company={job.company_name}
            role={job.role_title}
            meta={job.tc ?? undefined}
            variant="inactive"
            quest={questByJobId[job.id]}
            isNew={job.id === justCreatedJobId}
            onActivate={() => setActivatingJob(job)}
            onOpen={onJobOpen}
            onArchive={onJobArchive}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggedJobId === job.id}
          />
        ))}
      </div>

      <AddJobModal open={open} onOpenChange={setOpen} defaultStage="applied" />
      <ActivationModal
        open={activatingJob !== null}
        onOpenChange={(next) => {
          if (!next) setActivatingJob(null)
        }}
        jobId={activatingJob?.id ?? null}
        company={activatingJob?.company_name ?? null}
        role={activatingJob?.role_title ?? null}
      />
    </div>
  )
}

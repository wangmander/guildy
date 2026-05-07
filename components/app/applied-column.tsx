"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"

import { ActivationModal } from "./activation-modal"
import { AddJobModal } from "./add-job-modal"
import { EmptyCard } from "./empty-card"
import { JobCard } from "./job-card"

import type { JobRow } from "./board"

type Props = {
  label: string
  jobs: JobRow[]
  isSearchActive: boolean
  draggedJobId: string | null
  onJobOpen: (jobId: string) => void
  onJobDrop: (jobId: string) => void
  onDragStart: (jobId: string) => void
  onDragEnd: () => void
}

export function AppliedColumn({
  label,
  jobs,
  isSearchActive,
  draggedJobId,
  onJobOpen,
  onJobDrop,
  onDragStart,
  onDragEnd,
}: Props) {
  const [open, setOpen] = useState(false)
  const [activatingJob, setActivatingJob] = useState<JobRow | null>(null)
  const [isOver, setIsOver] = useState(false)
  const count = jobs.length
  const ghostCount = count === 0 && !isSearchActive ? 2 : 0
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
        "flex min-w-[260px] shrink-0 snap-start flex-col rounded-xl border p-3 transition-colors lg:min-w-0 lg:shrink",
        canAcceptDrop && isOver && "border-[#482C4C]/40 bg-[#482C4C]/5",
        canAcceptDrop && !isOver && "border-dashed border-[#482C4C]/20"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-400">{label}</h3>
        <span className="text-xs text-gray-400">{count}</span>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#482C4C] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        <Plus className="size-4" />
        Add Job
      </button>

      <div className="flex max-h-[calc(100dvh-200px)] flex-col gap-2 overflow-y-auto pr-1">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            jobId={job.id}
            company={job.company_name}
            role={job.role_title}
            meta={job.tc ?? undefined}
            variant="inactive"
            onActivate={() => setActivatingJob(job)}
            onOpen={onJobOpen}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggedJobId === job.id}
          />
        ))}
        {Array.from({ length: ghostCount }).map((_, i) => (
          <EmptyCard key={`ghost-${i}`} variant="inactive" />
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

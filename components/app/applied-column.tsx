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
}

export function AppliedColumn({ label, jobs, isSearchActive }: Props) {
  const [open, setOpen] = useState(false)
  const [activatingJob, setActivatingJob] = useState<JobRow | null>(null)
  const count = jobs.length
  const ghostCount = count === 0 && !isSearchActive ? 2 : 0

  return (
    <div
      className={cn(
        "flex min-w-[260px] shrink-0 snap-start flex-col rounded-xl border p-3 lg:min-w-0 lg:shrink"
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
          />
        ))}
        {Array.from({ length: ghostCount }).map((_, i) => (
          <EmptyCard key={`ghost-${i}`} variant="inactive" />
        ))}
      </div>

      <AddJobModal open={open} onOpenChange={setOpen} />
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

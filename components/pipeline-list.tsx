"use client"

import type { Job } from "@/types"
import { JobRow } from "./job-row"

interface PipelineListProps {
  jobs: Job[]
  onSelect: (job: Job) => void
  onAdvance: (jobId: string) => void
  onBack: (jobId: string) => void
  selectedJobId?: string
}

export function PipelineList({ jobs, onSelect, onAdvance, onBack, selectedJobId }: PipelineListProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No job applications yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <JobRow
          key={job.id}
          job={job}
          onAdvance={onAdvance}
          onBack={onBack}
          onSelectStage={onSelect}
          selectedJobId={selectedJobId}
        />
      ))}
    </div>
  )
}

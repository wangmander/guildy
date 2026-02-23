"use client"

import type { Job } from "@/types"
import { PipelineCard } from "./pipeline-card"
import Link from "next/link"

interface PipelineCardListProps {
  jobs: Job[]
  hiddenIds?: Set<string>
  onSelect: (job: Job) => void
  onActionClick?: (job: Job) => void
  onDelete?: (job: Job) => void
  onUnhide?: (job: Job) => void
  selectedJobId?: string
}

export function PipelineCardList({ jobs, hiddenIds, onSelect, onActionClick, onDelete, onUnhide, selectedJobId }: PipelineCardListProps) {
  return (
    <div className="flex flex-col min-h-full">
      <div className="space-y-3 flex-1">
        {jobs.map((job) => {
          if (hiddenIds?.has(job.id)) {
            return (
              <div
                key={job.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gray-50 border border-dashed border-gray-200"
              >
                <span className="text-sm text-gray-400">{job.company.name}</span>
                {onUnhide && (
                  <button
                    onClick={() => onUnhide(job)}
                    className="text-xs text-gray-400 hover:text-gray-800 transition-colors"
                  >
                    Restore
                  </button>
                )}
              </div>
            )
          }
          return (
            <PipelineCard
              key={job.id}
              job={job}
              onClick={() => onSelect(job)}
              onActionClick={onActionClick ? () => onActionClick(job) : undefined}
              onDelete={onDelete ? () => onDelete(job) : undefined}
              isSelected={job.id === selectedJobId}
            />
          )
        })}
      </div>
      
      <div className="border-t border-gray-200 pt-4 mt-6 flex-shrink-0">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
          <Link href="/privacy" className="hover:text-gray-900 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-gray-900 transition-colors">
            Terms of Service
          </Link>
          <Link href="/security" className="hover:text-gray-900 transition-colors">
            Security
          </Link>
          <Link href="/about" className="hover:text-gray-900 transition-colors">
            About
          </Link>
        </div>
      </div>
    </div>
  )
}

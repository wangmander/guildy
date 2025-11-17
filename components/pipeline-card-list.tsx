"use client"

import type { Job } from "@/types"
import { PipelineCard } from "./pipeline-card"
import Link from "next/link"

interface PipelineCardListProps {
  jobs: Job[]
  onSelect: (job: Job) => void
  selectedJobId?: string
}

function getStageProgress(stage: string): number {
  const stageOrder = {
    APPLIED: 1,
    PHONE_SCREEN: 2,
    SCREENING: 2,
    RECRUITER_SCREEN: 2,
    TECHNICAL: 3,
    CODING: 3,
    PORTFOLIO: 3,
    DESIGN_TEST: 3,
    SYSTEM_DESIGN: 4,
    FINAL: 4,
    INTERVIEW: 4,
    ONSITE: 5,
    DECISION: 5,
    OFFER: 6,
  }
  return stageOrder[stage as keyof typeof stageOrder] || 0
}

export function PipelineCardList({ jobs, onSelect, selectedJobId }: PipelineCardListProps) {
  const sortedJobs = [...jobs].sort((a, b) => {
    const progressA = getStageProgress(a.stage)
    const progressB = getStageProgress(b.stage)
    return progressB - progressA // Descending order (furthest first)
  })

  return (
    <div className="flex flex-col">
      <div className="space-y-4 mb-6">
        {sortedJobs.map((job) => (
          <PipelineCard key={job.id} job={job} onClick={() => onSelect(job)} isSelected={job.id === selectedJobId} />
        ))}
      </div>
      
      <div className="border-t border-gray-200 pt-4 mt-6">
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

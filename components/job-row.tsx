"use client"

import type { Job, Stage } from "@/types"
import { StageNode } from "./stage-node"
import { ChevronRight, ChevronLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface JobRowProps {
  job: Job
  onAdvance: (jobId: string) => void
  onBack: (jobId: string) => void
  onSelectStage: (job: Job) => void
  selectedJobId?: string
}

const stages: Stage[] = ["APPLIED", "RECRUITER_SCREEN", "INTERVIEW", "OFFER"]

export function JobRow({ job, onAdvance, onBack, onSelectStage, selectedJobId }: JobRowProps) {
  const currentStageIndex = stages.indexOf(job.stage)
  const canAdvance = currentStageIndex < stages.length - 1
  const canGoBack = currentStageIndex > 0

  return (
    <div className="bg-white border rounded-lg p-4 mb-4">
      <div className="flex items-center gap-4 overflow-x-auto">
        {/* Stage Pipeline */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {stages.map((stage, index) => (
            <div key={stage} className="flex items-center">
              <StageNode
                stage={stage}
                status={index === currentStageIndex ? job.status : index < currentStageIndex ? "SCHEDULED" : "WAITING"}
                eta={index === currentStageIndex ? job.nextEtaText : undefined}
                company={job.company}
                title={job.title}
                onClick={() => onSelectStage(job)}
                isActive={job.id === selectedJobId}
              />
              {index < stages.length - 1 && <ArrowRight className="h-4 w-4 text-gray-400 mx-2 flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBack(job.id)}
            disabled={!canGoBack}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-3 w-3" />
            Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAdvance(job.id)}
            disabled={!canAdvance}
            className="flex items-center gap-1"
          >
            Advance
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

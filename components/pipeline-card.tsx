"use client"

import type { Job } from "@/types"
import { Card } from "@/components/ui/card"

interface PipelineCardProps {
  job: Job
  onClick: () => void
  isSelected: boolean
}

const stageLabels = {
  APPLIED: "Applied",
  RECRUITER_SCREEN: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
}

const stageOrder = ["APPLIED", "RECRUITER_SCREEN", "INTERVIEW", "OFFER"] as const

export function PipelineCard({ job, onClick, isSelected }: PipelineCardProps) {
  const currentStageIndex = stageOrder.indexOf(job.stage)
  const progressPercentage = ((currentStageIndex + 1) / stageOrder.length) * 100

  const getStageColor = (stage: string, index: number) => {
    if (index < currentStageIndex) return "text-green-600" // Completed
    if (index === currentStageIndex) return "text-blue-600" // Current
    return "text-gray-400" // Future
  }

  const getStageIcon = (index: number) => {
    if (index < currentStageIndex) return "●" // Completed
    if (index === currentStageIndex) return "●" // Current
    return "○" // Future
  }

  return (
    <Card
      className={`p-1.5 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
      style={isSelected ? { backgroundColor: "#EFF5FD" } : undefined}
      onClick={onClick}
    >
      <div className="flex items-start gap-1.5 mb-1">
        <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-medium">
          {job.company.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate text-xs">{job.company.name}</h3>
          <p className="text-xs text-gray-600 truncate">{job.title}</p>
          <p className="text-xs text-gray-500">{new Date(job.appliedAt).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-1">
        <div className="w-full bg-gray-200 rounded-full h-1">
          <div
            className="bg-blue-500 h-1 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Stage Indicators */}
      <div className="flex items-center justify-between text-xs mb-1">
        {stageOrder.map((stage, index) => (
          <div key={stage} className="flex flex-col items-center gap-0.5">
            <span className={`text-xs ${getStageColor(stage, index)}`}>{getStageIcon(index)}</span>
            <span className={`${getStageColor(stage, index)} font-medium text-xs`}>{stageLabels[stage]}</span>
          </div>
        ))}
      </div>

      {/* Next Step */}
      <div className="pt-0.5 border-t border-gray-100">
        <p className="text-xs text-gray-600">Next: {job.nextEtaText}</p>
      </div>
    </Card>
  )
}

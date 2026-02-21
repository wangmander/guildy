"use client"

import type React from "react"

import type { Job } from "@/types"
import { Card } from "@/components/ui/card"
import { Calendar, ChevronRight, X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface PipelineCardProps {
  job: Job
  onClick: () => void
  onActionClick?: (e: React.MouseEvent) => void
  onDelete?: (e: React.MouseEvent) => void
  isSelected: boolean
}

const defaultVisualStages = ["Screening", "Hiring manager", "Presentation", "Full loop", "Offer discussion"]

export function PipelineCard({ job, onClick, onActionClick, onDelete, isSelected }: PipelineCardProps) {
  // Ensure predicted_stages only contains strings (LLM can return objects)
  const rawStages = job.predicted_stages && job.predicted_stages.length > 0
    ? job.predicted_stages.filter((s): s is string => typeof s === "string" && s.length > 0)
    : []
  const visualStages = rawStages.length > 0 ? rawStages : defaultVisualStages

  const getVisualStageIndex = (stage: string) => {
    // 1. Try to find exact or fuzzy match in our visual stages
    const stageNorm = (stage || "").toLowerCase().replace("_", " ")
    const idx = visualStages.findIndex(s => {
      if (typeof s !== "string") return false
      const sNorm = s.toLowerCase()
      return sNorm.includes(stageNorm) || stageNorm.includes(sNorm)
    })
    if (idx !== -1) return idx

    // 2. Fallback to mapping default enum to index
    // If using bespoke stages, we map the enum to a relative position
    const enumMap: Record<string, number> = {
      "APPLIED": 0,
      "RECRUITER_SCREEN": 0,
      "SCREENING": 0,
      "HIRING_MANAGER": 1,
      "HM": 1,
      "PRESENTATION": 2,
      "FULL_LOOP": 3,
      "OFFER_DISCUSSION": 4,
      "OFFER": 4
    }

    // Scale the index to the length of visualStages
    const defaultIdx = enumMap[stage] ?? 0
    if (visualStages === defaultVisualStages) return defaultIdx

    // Map 0-4 range to 0-(length-1) range
    return Math.floor((defaultIdx / 4) * (visualStages.length - 1))
  }

  const currentStageIndex = getVisualStageIndex(job.stage)

  const getMeetingDate = () => {
    if (job.scheduledMeeting) {
      try {
        const date = new Date(job.scheduledMeeting.date)
        if (isNaN(date.getTime())) throw new Error("Invalid date")
        return {
          date: date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }),
          time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
          relative: `In ${formatDistanceToNow(date).replace("about ", "")}`,
        }
      } catch { /* fall through to default */ }
    }
    const date = new Date()
    date.setDate(date.getDate() + 2)
    return {
      date: date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }),
      time: "3:00 PM PST",
      relative: "In 2 days",
    }
  }

  const meetingInfo = getMeetingDate()

  return (
    <Card
      className={`group/card relative p-3 cursor-pointer transition-all hover:shadow-md border-2 rounded-[3rem] ${isSelected ? "border-blue-500 shadow-md" : "border-transparent hover:border-gray-200"
        }`}
      style={isSelected ? { backgroundColor: "#F8FAFF" } : { backgroundColor: "white" }}
      onClick={onClick}
    >
      {/* Delete button — visible on card hover, inside card */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(e) }}
          className="absolute top-4 right-5 z-20 opacity-0 group-hover/card:opacity-100 transition-opacity w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-400 focus:outline-none"
          aria-label="Remove pipeline"
          title="Remove pipeline"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold text-gray-700">
            {job.company.name.charAt(0)}
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="font-bold text-gray-900 text-base">{job.company.name}</h3>
            <span className="text-gray-500 text-sm">{job.title}</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {job.tags?.slice(0, 2).map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full font-medium">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Pipeline Visual */}
      <div className="bg-gray-100 rounded-lg p-1 flex justify-between mb-1 relative">
        {visualStages.map((stage, index) => {
          const isActive = index === currentStageIndex
          return (
            <div
              key={stage}
              className={`flex-1 py-2.5 px-1 text-center text-[10px] font-medium rounded-md transition-all relative z-10 flex items-center justify-center ${isActive ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
            >
              {stage}
            </div>
          )
        })}
      </div>

      {/* CTA Section */}
      <div className="flex border border-gray-200 rounded-full overflow-hidden bg-white h-16">
        <div
          className={`pl-4 pr-3 py-2 min-w-[110px] border-r border-gray-100 flex flex-col justify-center ${isSelected ? "bg-blue-50/30" : "bg-gray-50/30"}`}
        >
          <div className="flex items-center gap-1.5 text-blue-600 mb-0.5">
            <Calendar className="w-3 h-3" />
            <span className="text-[10px] font-semibold">{meetingInfo.date}</span>
          </div>
          <div className="text-[10px] font-medium text-gray-900 leading-tight">{meetingInfo.time}</div>
          <div className="text-[10px] text-gray-500 leading-tight">{meetingInfo.relative}</div>
        </div>

        <div
          className="flex-1 pl-3 pr-4 flex items-center justify-between hover:bg-gray-50 transition-colors group"
          onClick={(e) => {
            if (onActionClick) {
              e.stopPropagation()
              onActionClick(e)
            }
          }}
        >
          <span className="text-blue-700 font-medium text-xs line-clamp-2">
            {job.scheduledMeeting
              ? "Prepare for interview with mock questions"
              : "Review company information and job description"}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
        </div>
      </div>
    </Card>
  )
}

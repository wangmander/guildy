"use client"

import type React from "react"

import type { Job } from "@/types"
import { Card } from "@/components/ui/card"
import { Calendar, ChevronRight } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface PipelineCardProps {
  job: Job
  onClick: () => void
  onActionClick?: (e: React.MouseEvent) => void
  isSelected: boolean
}

const visualStages = ["Screening", "Hiring manager", "Presentation", "Full loop", "Offer discussion"]

export function PipelineCard({ job, onClick, onActionClick, isSelected }: PipelineCardProps) {
  const getVisualStageIndex = (stage: string) => {
    switch (stage) {
      case "APPLIED":
        return 0 // Screening
      case "RECRUITER_SCREEN":
        return 1 // Hiring manager
      case "INTERVIEW":
        return 3 // Full loop (skipping Presentation for general interview)
      case "OFFER":
        return 4 // Offer discussion
      default:
        return 0
    }
  }

  const currentStageIndex = getVisualStageIndex(job.stage)

  const getMeetingDate = () => {
    if (job.scheduledMeeting) {
      const date = new Date(job.scheduledMeeting.date)
      return {
        date: date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }),
        time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
        relative: `In ${formatDistanceToNow(date).replace("about ", "")}`,
      }
    }
    // Fallback for no meeting
    const date = new Date()
    date.setDate(date.getDate() + 2) // Fake future date for demo if no meeting
    return {
      date: date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }),
      time: "3:00 PM PST",
      relative: "In 2 days",
    }
  }

  const meetingInfo = getMeetingDate()

  return (
    <Card
      className={`p-3 cursor-pointer transition-all hover:shadow-md border-2 rounded-[3rem] ${
        isSelected ? "border-blue-500 shadow-md" : "border-transparent hover:border-gray-200"
      }`}
      style={isSelected ? { backgroundColor: "#F8FAFF" } : { backgroundColor: "white" }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
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
              className={`flex-1 py-2.5 px-1 text-center text-[10px] font-medium rounded-md transition-all relative z-10 flex items-center justify-center ${
                isActive ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
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

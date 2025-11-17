"use client"

import type { Job, Stage } from "@/types"
import { StatusTag } from "./status-tag"
import { EtaChip } from "./eta-chip"
import { Calendar, Clock, ExternalLink } from "lucide-react"

interface GanttPipelineViewProps {
  jobs: Job[]
  onSelect: (job: Job) => void
  onAdvance: (jobId: string) => void
  onBack: (jobId: string) => void
  selectedJobId?: string
}

const stages: Stage[] = ["APPLIED", "RECRUITER_SCREEN", "INTERVIEW", "OFFER"]

// Calculate days from today (negative = past, positive = future)
function getDaysFromToday(dateString: string): number {
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// Generate timeline positions for each stage and meetings
function getTimelineEvents(job: Job) {
  const appliedDays = getDaysFromToday(job.appliedAt || new Date().toISOString())
  const currentStageIndex = stages.indexOf(job.stage)

  // Estimate stage dates based on typical timelines
  const stageOffsets = [0, 3, 7, 14] // Days after application

  const stageEvents = stages.map((stage, index) => ({
    type: "stage" as const,
    stage,
    days: appliedDays + stageOffsets[index],
    isActive: index === currentStageIndex,
    isPast: index < currentStageIndex,
    isFuture: index > currentStageIndex,
  }))

  // Add scheduled meeting if exists
  const events = [...stageEvents]
  if (job.scheduledMeeting) {
    const meetingDays = getDaysFromToday(job.scheduledMeeting.date)
    events.push({
      type: "meeting" as const,
      days: meetingDays,
      meeting: job.scheduledMeeting,
      isActive: true,
      isPast: false,
      isFuture: false,
    })
  }

  // Add feedback pending marker if status is feedback pending
  if (job.status === "FEEDBACK_PENDING" && job.lastEmail) {
    const feedbackDays = getDaysFromToday(job.lastEmail.receivedAt)
    events.push({
      type: "feedback" as const,
      days: feedbackDays,
      isActive: true,
      isPast: false,
      isFuture: false,
    })
  }

  return events.sort((a, b) => a.days - b.days)
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function GanttPipelineView({ jobs, onSelect, selectedJobId }: GanttPipelineViewProps) {
  const allEvents = jobs.flatMap((job) => getTimelineEvents(job))
  const allDays = allEvents.map((event) => event.days)
  const minDay = Math.min(...allDays, -14) // Show past 14 days
  const maxDay = Math.max(...allDays, 21) // Show future 21 days
  const totalDays = maxDay - minDay + 1

  // Generate day markers with today at position 0
  const dayMarkers = Array.from({ length: totalDays }, (_, i) => minDay + i)

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="border-b bg-gray-50 sticky top-0 z-30">
        <div className="flex">
          {/* Job column header */}
          <div className="w-80 flex-shrink-0 font-medium text-gray-900 p-4 border-r bg-gray-50">Job Pipeline</div>

          <div className="flex-1 overflow-x-auto">
            <div className="flex min-w-max">
              {dayMarkers.map((day) => {
                const date = new Date()
                date.setDate(date.getDate() + day)
                const isToday = day === 0
                const isWeekend = date.getDay() === 0 || date.getDay() === 6

                return (
                  <div
                    key={day}
                    className={`w-16 text-center text-xs py-3 border-l flex-shrink-0 ${
                      isToday
                        ? "bg-blue-500 text-white font-bold shadow-lg"
                        : isWeekend
                          ? "bg-gray-100 text-gray-500"
                          : "text-gray-600"
                    }`}
                  >
                    <div className="font-medium">
                      {isToday ? "TODAY" : date.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div className="text-xs opacity-75">
                      {date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y max-h-[600px] overflow-y-auto">
        {jobs.map((job) => {
          const timelineEvents = getTimelineEvents(job)
          const isActive = job.status === "SCHEDULED" || job.scheduledMeeting
          const isDormant = job.status === "WAITING" || job.status === "FEEDBACK_PENDING"

          return (
            <div
              key={job.id}
              className={`flex hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedJobId === job.id ? "bg-blue-50 ring-2 ring-blue-500" : ""
              } ${isActive ? "border-l-4 border-l-green-500" : isDormant ? "border-l-4 border-l-yellow-500" : ""}`}
              onClick={() => onSelect(job)}
            >
              <div className="w-80 flex-shrink-0 p-4 border-r">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-sm">{job.company.name}</div>
                    <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{job.title}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusTag value={job.status} />
                      {isActive && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                      {isDormant && <div className="w-2 h-2 bg-yellow-500 rounded-full" />}
                    </div>
                    {job.scheduledMeeting && (
                      <div className="mt-2 text-xs text-green-700 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {job.scheduledMeeting.type} - {formatTime(job.scheduledMeeting.date)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 relative h-20 overflow-x-auto">
                <div className="flex min-w-max h-full">
                  {dayMarkers.map((day) => (
                    <div
                      key={day}
                      className={`w-16 border-l relative flex-shrink-0 ${
                        day === 0 ? "bg-blue-50 border-l-blue-500 border-l-2" : ""
                      }`}
                    >
                      {/* Today marker line */}
                      {day === 0 && <div className="absolute inset-y-0 left-0 w-0.5 bg-blue-500 z-20" />}
                    </div>
                  ))}
                </div>

                {timelineEvents.map((event, index) => {
                  const position = ((event.days - minDay) / totalDays) * 100 * (64 / 16) // Adjust for 64px width per day

                  if (event.type === "stage") {
                    return (
                      <div
                        key={`stage-${event.stage}-${index}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
                        style={{ left: `${position}px` }}
                      >
                        <div
                          className={`w-3 h-3 rounded-full border-2 hover:scale-125 transition-transform ${
                            event.isActive
                              ? "bg-blue-500 border-blue-600 shadow-lg"
                              : event.isPast
                                ? "bg-green-500 border-green-600"
                                : "bg-gray-300 border-gray-400"
                          }`}
                          title={`${event.stage.replace("_", " ")} - ${event.days === 0 ? "Today" : event.days > 0 ? `+${event.days} days` : `${event.days} days`}`}
                        />
                        {event.isActive && job.nextEtaText && (
                          <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                            <EtaChip eta={job.nextEtaText} />
                          </div>
                        )}
                      </div>
                    )
                  }

                  if (event.type === "meeting" && event.meeting) {
                    return (
                      <div
                        key={`meeting-${index}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
                        style={{ left: `${position}px` }}
                      >
                        <div className="bg-green-500 text-white p-1 rounded shadow-lg hover:scale-105 transition-transform">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-green-100 text-green-800 text-xs px-2 py-1 rounded shadow">
                          <div className="font-medium">{event.meeting.type}</div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(event.meeting.date)}
                          </div>
                          {event.meeting.meetingLink && (
                            <div className="flex items-center gap-1 mt-1">
                              <ExternalLink className="w-3 h-3" />
                              <span>Link</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  if (event.type === "feedback") {
                    return (
                      <div
                        key={`feedback-${index}`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
                        style={{ left: `${position}px` }}
                      >
                        <div className="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-medium shadow hover:scale-105 transition-transform">
                          Feedback Pending
                        </div>
                      </div>
                    )
                  }

                  return null
                })}

                <div
                  className="absolute top-1/2 -translate-y-0.5 h-0.5 bg-gray-300 z-10"
                  style={{
                    left: `${((timelineEvents[0]?.days || 0) - minDay) * 64}px`,
                    width: `${((timelineEvents[timelineEvents.length - 1]?.days || 0) - (timelineEvents[0]?.days || 0)) * 64}px`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

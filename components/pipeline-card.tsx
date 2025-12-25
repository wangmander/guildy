"use client"

import type React from "react"
import type { Job } from "@/types"
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
        return 0
      case "RECRUITER_SCREEN":
        return 1
      case "INTERVIEW":
        return 3
      case "OFFER":
        return 4
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
    const date = new Date()
    date.setDate(date.getDate() + 2)
    return {
      date: date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }),
      time: "3:00 PM PST",
      relative: "In 2 days",
    }
  }

  const meetingInfo = getMeetingDate()
  const companyName = typeof job.company === 'string' ? job.company : job.company?.name || 'Unknown'
  const companyInitial = companyName.charAt(0).toUpperCase()
  const jobTitle = job.role || job.title || 'Role'

  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px",
        marginBottom: "12px",
        border: isSelected ? "2px solid #3B82F6" : "2px solid transparent",
        borderRadius: "48px",
        backgroundColor: isSelected ? "#F8FAFF" : "white",
        boxShadow: isSelected ? "0 4px 6px -1px rgb(0 0 0 / 0.1)" : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        cursor: "pointer",
        transition: "all 0.2s"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            backgroundColor: "#E5E7EB",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: "600",
            color: "#374151"
          }}>
            {companyInitial}
          </div>
          <div>
            <h3 style={{ fontWeight: "700", color: "#111827", fontSize: "16px", marginBottom: "2px" }}>
              {companyName}
            </h3>
            <span style={{ color: "#6B7280", fontSize: "14px" }}>{jobTitle}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {job.tags?.slice(0, 2).map((tag) => (
            <span 
              key={tag} 
              style={{
                padding: "2px 8px",
                backgroundColor: "#F3F4F6",
                color: "#4B5563",
                fontSize: "10px",
                borderRadius: "9999px",
                fontWeight: "500"
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Pipeline Visual */}
      <div style={{
        backgroundColor: "#F3F4F6",
        borderRadius: "8px",
        padding: "4px",
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "8px",
        position: "relative"
      }}>
        {visualStages.map((stage, index) => {
          const isActive = index === currentStageIndex
          return (
            <div
              key={stage}
              style={{
                flex: 1,
                padding: "10px 4px",
                textAlign: "center",
                fontSize: "10px",
                fontWeight: "500",
                borderRadius: "6px",
                backgroundColor: isActive ? "white" : "transparent",
                color: isActive ? "#111827" : "#6B7280",
                boxShadow: isActive ? "0 1px 2px 0 rgb(0 0 0 / 0.05)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {stage}
            </div>
          )
        })}
      </div>

      {/* CTA Section */}
      <div style={{
        display: "flex",
        border: "1px solid #E5E7EB",
        borderRadius: "9999px",
        overflow: "hidden",
        backgroundColor: "white",
        height: "64px"
      }}>
        <div style={{
          paddingLeft: "16px",
          paddingRight: "12px",
          paddingTop: "8px",
          paddingBottom: "8px",
          minWidth: "110px",
          borderRight: "1px solid #F3F4F6",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: isSelected ? "rgba(219, 234, 254, 0.3)" : "rgba(249, 250, 251, 0.3)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#2563EB", marginBottom: "2px" }}>
            <Calendar style={{ width: "12px", height: "12px" }} />
            <span style={{ fontSize: "10px", fontWeight: "600" }}>{meetingInfo.date}</span>
          </div>
          <div style={{ fontSize: "10px", fontWeight: "500", color: "#111827", lineHeight: "1.25" }}>
            {meetingInfo.time}
          </div>
          <div style={{ fontSize: "10px", color: "#6B7280", lineHeight: "1.25" }}>
            {meetingInfo.relative}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            paddingLeft: "12px",
            paddingRight: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer"
          }}
          onClick={(e) => {
            if (onActionClick) {
              e.stopPropagation()
              onActionClick(e)
            }
          }}
        >
          <span style={{
            color: "#1D4ED8",
            fontWeight: "500",
            fontSize: "12px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical"
          }}>
            {job.scheduledMeeting
              ? "Prepare for interview with mock questions"
              : "Review company information and job description"}
          </span>
          <ChevronRight style={{ width: "16px", height: "16px", color: "#9CA3AF", flexShrink: 0 }} />
        </div>
      </div>
    </div>
  )
}

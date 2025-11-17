"use client"

import type { Status } from "@/types"
import { Calendar, Clock, Minus, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatusTagProps {
  value: Status
}

const statusConfig = {
  WAITING: {
    label: "Waiting",
    icon: AlertCircle,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  SCHEDULED: {
    label: "Scheduled",
    icon: Calendar,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  FEEDBACK_PENDING: {
    label: "Feedback Pending",
    icon: Clock,
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  DECLINED: {
    label: "Declined",
    icon: Minus,
    className: "bg-red-100 text-red-800 border-red-200",
  },
}

export function StatusTag({ value }: StatusTagProps) {
  const config = statusConfig[value]
  const Icon = config.icon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border",
        config.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

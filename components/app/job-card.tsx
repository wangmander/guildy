"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react"

import { cn } from "@/lib/utils"

import type { CardVariant } from "@/lib/stages"

type Props = {
  jobId?: string
  company: string
  role: string
  meta?: string
  variant: CardVariant
  onOpen?: (jobId: string) => void
  onActivate?: () => void
  onMoveLeft?: () => void
  onMoveRight?: () => void
  canMoveLeft?: boolean
  canMoveRight?: boolean
  onDragStart?: (jobId: string) => void
  onDragEnd?: () => void
  isDragging?: boolean
}

export function JobCard({
  jobId,
  company,
  role,
  meta,
  variant,
  onOpen,
  onActivate,
  onMoveLeft,
  onMoveRight,
  canMoveLeft,
  canMoveRight,
  onDragStart,
  onDragEnd,
  isDragging,
}: Props) {
  const justDraggedRef = useRef(false)

  const isInactive = variant === "inactive"
  const draggable = !isInactive && Boolean(jobId)
  const showArrows = !isInactive && (onMoveLeft !== undefined || onMoveRight !== undefined)
  const clickable = Boolean(jobId && onOpen)

  const open = () => {
    if (!jobId || !onOpen) return
    onOpen(jobId)
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      draggable={draggable}
      onDragStart={(e) => {
        if (!jobId) return
        justDraggedRef.current = true
        e.dataTransfer.setData("text/plain", jobId)
        e.dataTransfer.effectAllowed = "move"
        onDragStart?.(jobId)
      }}
      onDragEnd={() => {
        // The browser fires a synthetic click after a drag completes.
        // Keep the flag true through that tick so the click handler bails.
        setTimeout(() => {
          justDraggedRef.current = false
        }, 0)
        onDragEnd?.()
      }}
      onClick={() => {
        if (justDraggedRef.current) return
        open()
      }}
      onKeyDown={(e) => {
        if (!clickable) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          open()
        }
      }}
      className={cn(
        "group relative rounded-lg border px-3 py-2 transition-colors",
        isInactive
          ? "border-black/5 bg-white/70 text-gray-500"
          : "border-black/10 bg-white text-[#1C1E21] shadow-xs",
        clickable && !draggable && "cursor-pointer",
        draggable && "cursor-grab active:cursor-grabbing",
        clickable && "hover:border-[#482C4C]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#482C4C]/30",
        isDragging && "opacity-50"
      )}
    >
      <GripVertical
        aria-hidden
        className={cn(
          "absolute right-1 top-1.5 size-3.5 opacity-0 transition-opacity group-hover:opacity-40",
          isInactive ? "text-gray-400" : "text-gray-500"
        )}
      />
      <div className="min-w-0 pr-4">
        <div className="truncate text-sm font-medium leading-tight">
          {company}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <span className="truncate text-xs text-gray-500">{role}</span>
          {meta && (
            <span
              className={cn(
                "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                isInactive
                  ? "bg-gray-100 text-gray-500"
                  : "bg-[#482C4C]/10 text-[#482C4C]"
              )}
            >
              {meta}
            </span>
          )}
        </div>
      </div>
      {onActivate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onActivate()
          }}
          className="mt-2 inline-flex h-7 w-full items-center justify-center rounded-md border border-[#482C4C]/20 bg-white text-xs font-medium text-[#482C4C] transition-colors hover:bg-[#482C4C]/5"
        >
          They Responded
        </button>
      )}
      {showArrows && (
        <div
          className="mt-2 flex items-center justify-between gap-1"
          onClick={stop}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMoveLeft?.()
            }}
            disabled={!canMoveLeft}
            aria-label="Move to previous stage"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-black/10 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMoveRight?.()
            }}
            disabled={!canMoveRight}
            aria-label="Move to next stage"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-black/10 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import type { JobQuest } from "@/lib/quests/quests"
import { cn } from "@/lib/utils"

import type { CardVariant } from "@/lib/stages"

type Props = {
  jobId?: string
  company: string
  role: string
  meta?: string
  variant: CardVariant
  quest?: JobQuest
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

// Job-card next-move treatment (gem-guide section 3): no gem, no hook box.
// Company + 6px status-cue dot + salary pill + next-move line + one CTA.
export function JobCard({
  jobId,
  company,
  meta,
  variant,
  quest,
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
  const cardRef = useRef<HTMLDivElement | null>(null)

  const isInactive = variant === "inactive"
  const draggable = Boolean(jobId) && Boolean(onDragStart)
  const showArrows =
    !isInactive && (onMoveLeft !== undefined || onMoveRight !== undefined)
  const clickable = Boolean(jobId && onOpen)

  const open = () => {
    if (!jobId || !onOpen) return
    onOpen(jobId)
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  // Gem-guide hook row (gem-guide section 3 / dashboard hook). Label + sub
  // mapped locally off existing quest fields, no quest-derivation change.
  const isCompare = quest?.ctaAction === "compare"
  const hookLabel = isCompare ? "Negotiation Prep" : quest?.ctaLabel
  const hookSub = !quest
    ? ""
    : isCompare
      ? "Map your counter and walk in ready"
      : quest.cue?.label === "Hiring Manager"
        ? "Read the room before the manager call"
        : quest.cue?.label === "Full Loop"
          ? "Prep every round"
          : quest.cue?.label === "Screen"
            ? "Sharpen your answers for this round"
            : "Get a first read on this role"

  return (
    <div
      ref={cardRef}
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
        setTimeout(() => {
          justDraggedRef.current = false
        }, 0)
        cardRef.current?.blur()
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
        "group relative rounded-[14px] border border-[var(--border-card)] bg-[var(--surface)] px-4 py-[15px] outline-none transition",
        isInactive
          ? "shadow-[var(--shadow-e1)]"
          : "shadow-[var(--shadow-e2)]",
        clickable &&
          "cursor-pointer hover:border-[#C9A6F0] hover:shadow-[0_8px_20px_-8px_rgba(91,33,182,0.16)]",
        draggable && "cursor-grab active:cursor-grabbing",
        clickable &&
          "focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-2",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "min-w-0 truncate text-[var(--text-primary)]",
            isInactive ? "type-applied-company" : "type-job-company"
          )}
        >
          {company}
        </span>
        {showArrows && (
          <div className="-mt-0.5 -mr-1 flex shrink-0 items-center gap-0.5" onClick={stop}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMoveLeft?.()
              }}
              disabled={!canMoveLeft}
              aria-label="Move to previous stage"
              className="inline-flex size-6 items-center justify-center rounded-[7px] text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[#4A5566] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
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
              className="inline-flex size-6 items-center justify-center rounded-[7px] text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[#4A5566] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {meta && (
        <span className="mt-[9px] inline-block rounded-lg bg-[var(--salary-bg)] px-[9px] py-1 text-[12.5px] font-semibold tabular-nums text-[var(--salary-text)]">
          {meta}
        </span>
      )}

      {quest && !isInactive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (isCompare) {
              window.dispatchEvent(new CustomEvent("guildy:open-comp"))
            } else {
              open()
            }
          }}
          className="mt-3 flex w-full items-center gap-2.5 rounded-[11px] border border-[var(--accent-tint-border)] bg-[var(--accent-tint-bg)] px-3 py-2.5 text-left transition-colors hover:bg-[#EDE4F9]"
        >
          <span className="flex size-[18px] shrink-0 items-center justify-center text-[var(--accent-deep)]">
            <Plus className="size-[15px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bricolage text-[14px] font-medium leading-tight text-[var(--accent-deep)]">
              {hookLabel}
            </span>
            <span className="mt-0.5 block truncate text-[11px] leading-tight text-[var(--text-faint)]">
              {hookSub}
            </span>
          </span>
          <ChevronRight className="size-3.5 shrink-0 text-[var(--text-faint)]" />
        </button>
      )}

      {onActivate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onActivate()
          }}
          className="mt-3 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-sunken)] py-[9px] text-[13px] font-semibold text-[#46505F] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--divider)]"
        >
          They Responded
        </button>
      )}

    </div>
  )
}

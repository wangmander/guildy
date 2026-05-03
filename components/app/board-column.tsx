"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import {
  leftOfColumn,
  rightOfColumn,
  type CardVariant,
  type UiColumnKey,
} from "@/lib/stages"

import type { JobRow } from "./board"
import { EmptyCard } from "./empty-card"
import { JobCard } from "./job-card"

type Props = {
  columnKey: UiColumnKey
  label: string
  jobs: JobRow[]
  variant: CardVariant
  hint?: string
  isSearchActive: boolean
  draggedJobId: string | null
  onJobMoveLeft: (jobId: string) => void
  onJobMoveRight: (jobId: string) => void
  onJobDrop: (jobId: string) => void
  onDragStart: (jobId: string) => void
  onDragEnd: () => void
}

export function BoardColumn({
  columnKey,
  label,
  jobs,
  variant,
  hint,
  isSearchActive,
  draggedJobId,
  onJobMoveLeft,
  onJobMoveRight,
  onJobDrop,
  onDragStart,
  onDragEnd,
}: Props) {
  const [isOver, setIsOver] = useState(false)
  const isInactive = variant === "inactive"
  const count = jobs.length
  const ghostCount = count === 0 && !isSearchActive ? 2 : 0
  const showHint = !!hint && count === 0 && !isSearchActive
  const canAcceptDrop = !isInactive && draggedJobId !== null
  const canMoveLeft = leftOfColumn(columnKey) !== null
  const canMoveRight = rightOfColumn(columnKey) !== null

  return (
    <div
      onDragOver={(e) => {
        if (!canAcceptDrop) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        if (!isOver) setIsOver(true)
      }}
      onDragLeave={(e) => {
        // Only clear when the cursor actually leaves the column, not when
        // moving across child elements.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        if (isOver) setIsOver(false)
      }}
      onDrop={(e) => {
        if (!canAcceptDrop) return
        e.preventDefault()
        const jobId = e.dataTransfer.getData("text/plain")
        setIsOver(false)
        if (jobId) onJobDrop(jobId)
      }}
      className={cn(
        "flex min-w-[260px] shrink-0 snap-start flex-col rounded-xl border p-3 transition-colors lg:min-w-0 lg:shrink",
        canAcceptDrop && isOver && "border-[#482C4C]/40 bg-[#482C4C]/5",
        canAcceptDrop && !isOver && "border-dashed border-[#482C4C]/20"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3
          className={cn(
            "text-sm font-semibold",
            isInactive ? "text-gray-400" : "text-[#482C4C]"
          )}
        >
          {label}
        </h3>
        <span className="text-xs text-gray-400">{count}</span>
      </div>

      <div className="flex max-h-[calc(100dvh-200px)] flex-col gap-2 overflow-y-auto pr-1">
        {showHint && (
          <p className="px-1 pb-1 text-[11px] leading-snug text-gray-400">
            {hint}
          </p>
        )}
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            jobId={job.id}
            company={job.company_name}
            role={job.role_title}
            meta={job.tc ?? undefined}
            variant={variant}
            onMoveLeft={() => onJobMoveLeft(job.id)}
            onMoveRight={() => onJobMoveRight(job.id)}
            canMoveLeft={canMoveLeft}
            canMoveRight={canMoveRight}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggedJobId === job.id}
          />
        ))}
        {Array.from({ length: ghostCount }).map((_, i) => (
          <EmptyCard key={`ghost-${i}`} variant={variant} />
        ))}
      </div>
    </div>
  )
}

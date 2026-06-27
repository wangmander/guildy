"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  columnToWriteStage,
  leftOfColumn,
  rightOfColumn,
  type CardVariant,
  type UiColumnKey,
} from "@/lib/stages"

import { AddJobModal } from "./add-job-modal"
import type { JobRow } from "./board"
import { JobCard } from "./job-card"
import type { JobQuest } from "@/lib/quests/quests"

// Per-stage ramp (spec 1a). Applied has its own column component.
type ActiveCol = Exclude<UiColumnKey, "applied">
const RAMP: Record<
  ActiveCol,
  { band: string; text: string; chip: string; addHover: string }
> = {
  screen: { band: "#5E97A0", text: "#3E767E", chip: "#E2EFF0", addHover: "hover:bg-[#EAEDF2] hover:text-[#4A5566]" },
  hiring_manager: { band: "#6680BC", text: "#45598F", chip: "#E6ECF5", addHover: "hover:bg-[#EAEDF2] hover:text-[#4A5566]" },
  full_loop: { band: "#8A72B6", text: "#6A5398", chip: "#ECE7F3", addHover: "hover:bg-[#EAEDF2] hover:text-[#4A5566]" },
  offer: { band: "#7C50CE", text: "#6D3DBE", chip: "#EAE2F6", addHover: "hover:bg-[#EAE2F6] hover:text-[#6D3DBE]" },
}

type Props = {
  columnKey: UiColumnKey
  label: string
  jobs: JobRow[]
  // Archived jobs mapped to this column. Rendered muted, below active cards,
  // only when the board's "Show archived" toggle is on (parent passes [] off).
  archivedJobs: JobRow[]
  questByJobId: Record<string, JobQuest>
  variant: CardVariant
  hint?: string
  isSearchActive: boolean
  draggedJobId: string | null
  onJobOpen: (jobId: string) => void
  onJobArchive: (jobId: string) => void
  onJobRestore: (jobId: string) => void
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
  archivedJobs,
  questByJobId,
  variant,
  isSearchActive,
  draggedJobId,
  onJobOpen,
  onJobArchive,
  onJobRestore,
  onJobMoveLeft,
  onJobMoveRight,
  onJobDrop,
  onDragStart,
  onDragEnd,
}: Props) {
  const [isOver, setIsOver] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const isInactive = variant === "inactive"
  const count = jobs.length
  const canAcceptDrop = !isInactive && draggedJobId !== null
  const canMoveLeft = leftOfColumn(columnKey) !== null
  const canMoveRight = rightOfColumn(columnKey) !== null
  const showPlus = columnKey !== "offer"
  const writeStage = columnToWriteStage(columnKey)
  const ramp = RAMP[columnKey as ActiveCol]
  // Count chip stays active-only (archived cards never inflate the pipeline
  // count). Empty-state hides when archived cards are present so the dashed
  // placeholder never sits above muted cards.
  const showEmpty =
    count === 0 && archivedJobs.length === 0 && !isSearchActive

  return (
    <div
      onDragOver={(e) => {
        if (!canAcceptDrop) return
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        if (!isOver) setIsOver(true)
      }}
      onDragLeave={(e) => {
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
        "flex min-w-[208px] shrink-0 snap-start flex-col transition-colors lg:min-w-0 lg:flex-1 lg:shrink",
        canAcceptDrop && isOver && "bg-[var(--surface-sunken)]"
      )}
    >
      <div className="h-[3px] w-full" style={{ background: ramp.band }} />

      <div className="flex items-center justify-between gap-2 px-[14px] pb-[11px] pt-[14px]">
        <span
          className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-bold uppercase tracking-[0.05em]"
          style={{ color: ramp.text }}
        >
          {label}
          <span
            className="rounded-[7px] px-[7px] py-px text-[12px] font-bold"
            style={{ background: ramp.chip, color: ramp.text }}
          >
            {count}
          </span>
        </span>
        {showPlus ? (
          <button
            type="button"
            draggable={false}
            onClick={(e) => {
              e.stopPropagation()
              setAddOpen(true)
            }}
            aria-label={`Add job to ${label}`}
            className={cn(
              "inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg text-[var(--text-faint)] transition-colors",
              ramp.addHover
            )}
          >
            <Plus className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="flex max-h-[60vh] flex-col gap-[11px] overflow-y-auto px-3 pb-[14px]">
        {showEmpty ? (
          <div className="rounded-[14px] border-[1.5px] border-dashed border-[var(--border-strong)] px-[14px] py-[18px] text-center text-[12.5px] leading-[1.5] text-[#A2ACB9]">
            Cards land here when you move them from earlier stages.
          </div>
        ) : (
          <>
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                jobId={job.id}
                company={job.company_name}
                role={job.role_title}
                meta={job.tc ?? undefined}
                variant={variant}
                quest={questByJobId[job.id]}
                onOpen={onJobOpen}
                onArchive={onJobArchive}
                onMoveLeft={() => onJobMoveLeft(job.id)}
                onMoveRight={() => onJobMoveRight(job.id)}
                canMoveLeft={canMoveLeft}
                canMoveRight={canMoveRight}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                isDragging={draggedJobId === job.id}
              />
            ))}
            {/* Active cards sort above archived. */}
            {archivedJobs.map((job) => (
              <JobCard
                key={job.id}
                jobId={job.id}
                company={job.company_name}
                role={job.role_title}
                meta={job.tc ?? undefined}
                variant={variant}
                archived
                onRestore={onJobRestore}
              />
            ))}
          </>
        )}
      </div>

      {showPlus ? (
        <AddJobModal
          open={addOpen}
          onOpenChange={setAddOpen}
          defaultStage={writeStage}
        />
      ) : null}
    </div>
  )
}

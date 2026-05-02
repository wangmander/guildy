import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"

import type { CardVariant } from "@/lib/stages"

import { EmptyCard } from "./empty-card"

type Props = {
  label: string
  count: number
  variant: CardVariant
  showAddJob?: boolean
  hint?: string
  ghostCount?: number
}

export function BoardColumn({
  label,
  count,
  variant,
  showAddJob = false,
  hint,
  ghostCount = 0,
}: Props) {
  const isInactive = variant === "inactive"
  return (
    <div
      className={cn(
        "flex min-w-[260px] shrink-0 snap-start flex-col rounded-xl border p-3 lg:min-w-0 lg:shrink"
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

      {showAddJob && (
        <button
          type="button"
          disabled
          className="mb-3 inline-flex h-9 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-[#482C4C] px-3 text-sm font-medium text-white opacity-70 transition-opacity hover:opacity-80"
        >
          <Plus className="size-4" />
          Add Job
        </button>
      )}

      <div className="flex max-h-[calc(100dvh-200px)] flex-col gap-2 overflow-y-auto pr-1">
        {hint && (
          <p className="px-1 pb-1 text-[11px] leading-snug text-gray-400">
            {hint}
          </p>
        )}
        {Array.from({ length: ghostCount }).map((_, i) => (
          <EmptyCard key={i} variant={variant} />
        ))}
      </div>
    </div>
  )
}

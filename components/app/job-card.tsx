import { GripVertical } from "lucide-react"

import { cn } from "@/lib/utils"

import type { CardVariant } from "@/lib/stages"

type Props = {
  company: string
  role: string
  meta?: string
  variant: CardVariant
}

export function JobCard({ company, role, meta, variant }: Props) {
  const isInactive = variant === "inactive"
  return (
    <div
      className={cn(
        "group relative rounded-lg border px-3 py-2 transition-colors",
        isInactive
          ? "border-black/5 bg-white/70 text-gray-500"
          : "border-black/10 bg-white text-[#1C1E21] shadow-xs"
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
    </div>
  )
}

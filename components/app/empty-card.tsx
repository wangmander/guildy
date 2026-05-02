import { cn } from "@/lib/utils"

import type { CardVariant } from "@/lib/stages"

type Props = { variant: CardVariant }

export function EmptyCard({ variant }: Props) {
  const isInactive = variant === "inactive"
  const bar = isInactive ? "bg-black/[0.04]" : "bg-black/[0.06]"
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-lg border border-dashed px-3 py-2",
        isInactive
          ? "border-black/5 bg-white/30"
          : "border-black/10 bg-white/70"
      )}
    >
      <div className={cn("h-3 w-2/3 rounded", bar)} />
      <div className="mt-1.5 flex items-center gap-2">
        <div className={cn("h-2 w-1/2 rounded", bar)} />
        <div className={cn("ml-auto h-3 w-10 rounded-full", bar)} />
      </div>
    </div>
  )
}

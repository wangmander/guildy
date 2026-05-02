type Props = { label: string }

export function KanbanColumn({ label }: Props) {
  return (
    <div className="flex w-[280px] shrink-0 snap-start flex-col gap-3 rounded-xl border border-dashed border-black/10 bg-white/60 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1C1E21]">{label}</h3>
        <span className="text-xs text-gray-400">0</span>
      </div>
      <div className="min-h-[220px]" />
    </div>
  )
}

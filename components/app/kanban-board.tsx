import { STAGES } from "@/lib/stages"

import { KanbanColumn } from "./kanban-column"

export function KanbanBoard() {
  return (
    <section aria-label="Active pipeline" className="w-full">
      <div className="mb-3 px-4 md:px-8">
        <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Active
        </h2>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max snap-x gap-3 px-4 md:px-8">
          {STAGES.map((stage) => (
            <KanbanColumn key={stage.key} label={stage.label} />
          ))}
        </div>
      </div>
    </section>
  )
}

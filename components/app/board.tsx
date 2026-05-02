import { UI_COLUMNS } from "@/lib/stages"

import { BoardColumn } from "./board-column"

export function Board() {
  return (
    <section aria-label="Pipeline" className="w-full">
      <div className="px-4 lg:px-8">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:snap-none lg:overflow-visible lg:pb-0">
          {UI_COLUMNS.map((col) => (
            <BoardColumn
              key={col.key}
              label={col.label}
              count={0}
              variant={col.variant}
              showAddJob={col.key === "applied"}
              hint={
                col.key === "applied"
                  ? undefined
                  : "Cards land here when you move them from Applied"
              }
              ghostCount={2}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

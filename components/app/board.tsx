import { stageToColumn, UI_COLUMNS, type StageKey, type UiColumnKey } from "@/lib/stages"

import { AppliedColumn } from "./applied-column"
import { BoardColumn } from "./board-column"

export type JobRow = {
  id: string
  company_name: string
  role_title: string
  tc: string | null
  state: "passive" | "active"
  stage: StageKey
}

type Props = {
  jobs: JobRow[]
}

export function Board({ jobs }: Props) {
  const grouped: Record<UiColumnKey, JobRow[]> = {
    applied: [],
    screen: [],
    hiring_manager: [],
    full_loop: [],
    offer: [],
  }

  for (const job of jobs) {
    const col = stageToColumn(job.stage)
    if (col) grouped[col].push(job)
  }

  return (
    <section aria-label="Pipeline" className="w-full">
      <div className="px-4 lg:px-8">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:snap-none lg:overflow-visible lg:pb-0">
          {UI_COLUMNS.map((col) => {
            if (col.key === "applied") {
              return (
                <AppliedColumn
                  key={col.key}
                  label={col.label}
                  jobs={grouped.applied}
                />
              )
            }
            return (
              <BoardColumn
                key={col.key}
                label={col.label}
                jobs={grouped[col.key]}
                variant={col.variant}
                hint="Cards land here when you move them from Applied"
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

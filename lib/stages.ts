export type StageKey =
  | "applied"
  | "screen"
  | "hiring_manager"
  | "interview_loop"
  | "final"
  | "offer"
  | "closed"

export type StageDef = {
  key: StageKey
  label: string
}

export const STAGES: StageDef[] = [
  { key: "applied", label: "Applied" },
  { key: "screen", label: "Screen" },
  { key: "hiring_manager", label: "Hiring Manager" },
  { key: "interview_loop", label: "Interview Loop" },
  { key: "final", label: "Final" },
  { key: "offer", label: "Offer" },
  { key: "closed", label: "Closed" },
]

// Home UI columns. Five columns shown; "closed" is hidden until an
// archive view ships. The "applied" column renders its cards in the
// dim visual style; every other column uses the active style.
export type UiColumnKey =
  | "applied"
  | "screen"
  | "hiring_manager"
  | "full_loop"
  | "offer"

export type CardVariant = "inactive" | "active"

export type UiColumn = {
  key: UiColumnKey
  label: string
  variant: CardVariant
}

export const UI_COLUMNS: UiColumn[] = [
  { key: "applied", label: "Applied", variant: "inactive" },
  { key: "screen", label: "Screen", variant: "active" },
  { key: "hiring_manager", label: "Hiring Manager", variant: "active" },
  { key: "full_loop", label: "Full Loop", variant: "active" },
  { key: "offer", label: "Offer", variant: "active" },
]

// Map a DB stage to its Home UI column. Returns null for stages hidden on Home.
export function stageToColumn(stage: StageKey): UiColumnKey | null {
  switch (stage) {
    case "applied":
      return "applied"
    case "screen":
      return "screen"
    case "hiring_manager":
      return "hiring_manager"
    case "interview_loop":
    case "final":
      return "full_loop"
    case "offer":
      return "offer"
    case "closed":
      return null
  }
}

// Active columns left→right. Applied is excluded — it is the passive zone and
// is not a valid arrow/drag target.
const ACTIVE_COLUMNS: readonly UiColumnKey[] = [
  "screen",
  "hiring_manager",
  "full_loop",
  "offer",
] as const

export function isActiveColumn(col: UiColumnKey): boolean {
  return (ACTIVE_COLUMNS as readonly UiColumnKey[]).includes(col)
}

export function leftOfColumn(col: UiColumnKey): UiColumnKey | null {
  const i = ACTIVE_COLUMNS.indexOf(col)
  if (i <= 0) return null
  return ACTIVE_COLUMNS[i - 1]
}

export function rightOfColumn(col: UiColumnKey): UiColumnKey | null {
  const i = ACTIVE_COLUMNS.indexOf(col)
  if (i < 0 || i === ACTIVE_COLUMNS.length - 1) return null
  return ACTIVE_COLUMNS[i + 1]
}

export type WriteStage =
  | "applied"
  | "screen"
  | "hiring_manager"
  | "final"
  | "offer"

// Canonical DB stage written when a card lands in a UI column via arrow or
// drag. Full Loop reads accept both interview_loop and final, but writes
// always use final. "applied" is a writable target via drag-into-Applied;
// the action layer flips state to passive when this stage is written.
export function columnToWriteStage(col: UiColumnKey): WriteStage {
  switch (col) {
    case "screen":
      return "screen"
    case "hiring_manager":
      return "hiring_manager"
    case "full_loop":
      return "final"
    case "offer":
      return "offer"
    case "applied":
      return "applied"
  }
}

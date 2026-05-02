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

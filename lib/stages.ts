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

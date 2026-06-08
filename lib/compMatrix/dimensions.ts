// Single source of truth for the rated comparison matrix dimensions. The
// matrix rows, the comp-modal rating inputs, the comparison-settings picker,
// and the scoring all derive from this list.

export type DimType = "auto" | "user"
export type DimGroup = "comp" | "soft"

export type Dimension = {
  key: string
  label: string
  type: DimType
  group: DimGroup
  always: boolean
  preset: boolean
}

// The anchor dollar row: shown, not rated, excluded from the overall score
// (base + bonus + equity already represent comp).
export const ANCHOR_KEY = "year1_total"

export const DIMENSIONS: Dimension[] = [
  // Comp, auto-rated, always shown.
  { key: "base", label: "Base", type: "auto", group: "comp", always: true, preset: true },
  { key: "bonus", label: "Bonus", type: "auto", group: "comp", always: true, preset: true },
  { key: "equity", label: "Equity", type: "auto", group: "comp", always: true, preset: true },
  // Anchor, dollar figure, not rated, excluded from scoring.
  { key: "year1_total", label: "Year-1 total", type: "auto", group: "comp", always: true, preset: true },
  // Soft, user-rated 1-10. Preset on for a fresh user and the demo.
  { key: "benefits", label: "Benefits", type: "user", group: "soft", always: false, preset: true },
  { key: "career_growth", label: "Career growth", type: "user", group: "soft", always: false, preset: true },
  { key: "work_life_balance", label: "Work-life balance", type: "user", group: "soft", always: false, preset: true },
  { key: "culture_fit", label: "Culture fit", type: "user", group: "soft", always: false, preset: true },
  // Soft, opt-in.
  { key: "manager_team", label: "Manager and team", type: "user", group: "soft", always: false, preset: false },
  { key: "work_passion", label: "Work passion", type: "user", group: "soft", always: false, preset: false },
  { key: "resume_value", label: "Resume value", type: "user", group: "soft", always: false, preset: false },
  { key: "flexibility", label: "Flexibility / remote", type: "user", group: "soft", always: false, preset: false },
  { key: "company_stability", label: "Company stability", type: "user", group: "soft", always: false, preset: false },
]

// Auto-rated comp dims that feed the overall (base/bonus/equity, not the anchor).
export const COMP_DIMS = DIMENSIONS.filter(
  (d) => d.group === "comp" && d.key !== ANCHOR_KEY
)
export const SOFT_DIMS = DIMENSIONS.filter((d) => d.group === "soft")
export const SOFT_KEYS = SOFT_DIMS.map((d) => d.key)
export const COMP_KEYS = COMP_DIMS.map((d) => d.key)
export const PRESET_SOFT_KEYS = SOFT_DIMS.filter((d) => d.preset).map((d) => d.key)
// Every dimension that can carry a weight in the overall (comp + soft).
export const SCORED_KEYS = [...COMP_KEYS, ...SOFT_KEYS]

export type CompPriorities = {
  enabled_soft: string[]
  weights: Record<string, number>
}

export type CompPrioritiesRaw = {
  enabled_soft?: string[] | null
  weights?: Record<string, number> | null
} | null

// comp_priorities is nullable in the DB; null resolves to the preset soft set
// and equal weights. Unknown keys are filtered out defensively.
export function resolveCompPriorities(raw: CompPrioritiesRaw): {
  enabledSoft: string[]
  weights: Record<string, number>
} {
  const enabledSoft = Array.isArray(raw?.enabled_soft)
    ? raw!.enabled_soft!.filter((k) => SOFT_KEYS.includes(k))
    : [...PRESET_SOFT_KEYS]
  const rawWeights =
    raw?.weights && typeof raw.weights === "object" ? raw.weights : {}
  const weights: Record<string, number> = {}
  for (const [k, v] of Object.entries(rawWeights)) {
    if (SCORED_KEYS.includes(k) && typeof v === "number" && v >= 0) {
      weights[k] = v
    }
  }
  return { enabledSoft, weights }
}

export function softLabel(key: string): string {
  return DIMENSIONS.find((d) => d.key === key)?.label ?? key
}

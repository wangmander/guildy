// Cost-of-living multipliers for the TC comparison matrix, indexed to the US
// national average = 1.0. Approximate, labeled as such in the UI. Editable
// seed table, mirrors the jobSourceAdvisor seed pattern. Unlisted location
// falls back to 1.0 with no error.

export type ColEntry = {
  label: string
  multiplier: number
}

export const COL_SEED: ColEntry[] = [
  { label: "SF Bay Area", multiplier: 1.8 },
  { label: "New York City", multiplier: 1.7 },
  { label: "Seattle", multiplier: 1.5 },
  { label: "Los Angeles", multiplier: 1.5 },
  { label: "Boston", multiplier: 1.5 },
  { label: "Washington DC", multiplier: 1.4 },
  { label: "Denver", multiplier: 1.2 },
  { label: "Chicago", multiplier: 1.2 },
  { label: "Austin", multiplier: 1.1 },
  { label: "Remote / National", multiplier: 1.0 },
]

export const DEFAULT_COL_LABEL = "Remote / National"

export function colMultiplier(location: string | null | undefined): number {
  if (!location) return 1.0
  const hit = COL_SEED.find((c) => c.label === location)
  return hit ? hit.multiplier : 1.0
}

// Cost-of-living multipliers for the TC comparison matrix, indexed to the US
// national average = 1.0. Approximate (C2ER / Numbeo-style cost-of-living
// index, housing-weighted), rounded to one decimal so the values read as a
// ballpark index rather than false precision. Editable seed table. Unlisted
// location falls back to 1.0 with no error.
//
// Order: Remote / National pinned first (the default), then metros
// alphabetical. The comp modal renders options straight from this array, so
// the array order is the dropdown order.

export type ColEntry = {
  label: string
  multiplier: number
}

export const COL_SEED: ColEntry[] = [
  { label: "Remote / National", multiplier: 1.0 },
  { label: "Atlanta", multiplier: 1.0 },
  { label: "Austin", multiplier: 1.1 },
  { label: "Baltimore", multiplier: 1.1 },
  { label: "Boston", multiplier: 1.5 },
  { label: "Charleston", multiplier: 1.0 },
  { label: "Charlotte", multiplier: 1.0 },
  { label: "Chicago", multiplier: 1.2 },
  { label: "Cincinnati", multiplier: 0.9 },
  { label: "Cleveland", multiplier: 0.9 },
  { label: "Columbus", multiplier: 0.9 },
  { label: "Dallas", multiplier: 1.0 },
  { label: "Denver", multiplier: 1.2 },
  { label: "Detroit", multiplier: 0.9 },
  { label: "Honolulu", multiplier: 1.7 },
  { label: "Houston", multiplier: 1.0 },
  { label: "Indianapolis", multiplier: 0.9 },
  { label: "Jacksonville", multiplier: 0.9 },
  { label: "Kansas City", multiplier: 0.9 },
  { label: "Las Vegas", multiplier: 1.0 },
  { label: "Los Angeles", multiplier: 1.5 },
  { label: "Madison", multiplier: 1.0 },
  { label: "Miami", multiplier: 1.2 },
  { label: "Milwaukee", multiplier: 0.9 },
  { label: "Minneapolis", multiplier: 1.1 },
  { label: "Nashville", multiplier: 1.0 },
  { label: "New Orleans", multiplier: 0.9 },
  { label: "New York City", multiplier: 1.7 },
  { label: "Oklahoma City", multiplier: 0.9 },
  { label: "Orlando", multiplier: 1.0 },
  { label: "Philadelphia", multiplier: 1.1 },
  { label: "Phoenix", multiplier: 1.1 },
  { label: "Pittsburgh", multiplier: 0.9 },
  { label: "Portland", multiplier: 1.3 },
  { label: "Providence", multiplier: 1.2 },
  { label: "Raleigh-Durham", multiplier: 1.0 },
  { label: "Richmond", multiplier: 1.0 },
  { label: "Riverside", multiplier: 1.3 },
  { label: "Sacramento", multiplier: 1.2 },
  { label: "Salt Lake City", multiplier: 1.1 },
  { label: "San Antonio", multiplier: 0.9 },
  { label: "San Diego", multiplier: 1.4 },
  { label: "Seattle", multiplier: 1.5 },
  { label: "SF Bay Area", multiplier: 1.8 },
  { label: "St. Louis", multiplier: 0.9 },
  { label: "Tampa", multiplier: 1.0 },
  { label: "Washington DC", multiplier: 1.4 },
]

export const DEFAULT_COL_LABEL = "Remote / National"

export function colMultiplier(location: string | null | undefined): number {
  if (!location) return 1.0
  const hit = COL_SEED.find((c) => c.label === location)
  return hit ? hit.multiplier : 1.0
}

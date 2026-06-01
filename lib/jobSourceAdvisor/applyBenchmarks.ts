// Editable benchmark data for the Apply goal segment line.
//
// Researched 2026 calibration (sources: CareerPlug 10M+ apps, Ashby, BLS,
// loopcv, resumefast, aiapply). Framed as ballpark, never precision. The
// rendered number is driven by SENIORITY; field is a descriptor word only.
// Field response-rate context and general anchors are kept here as reference
// for future copy but are NOT used in the rendered per-offer number.
//
// Copy rule: always a range, labeled typical/ballpark, no em dashes, no
// invented percentages.

export type Seniority = "entry" | "mid" | "senior"
export type Field = "tech" | "finance" | "marketing" | "healthcare" | "general"

// Applications per offer by seniority. This is the range the segment line renders.
export const SENIORITY_PER_OFFER: Record<Seniority, [number, number]> = {
  entry: [150, 250],
  mid: [80, 150],
  senior: [50, 100],
}

// Used when field or seniority is unclear.
export const GENERAL_PER_OFFER: [number, number] = [80, 150]

// Reference only. Field application-to-interview response rates and the
// competitive per-offer note. NOT used in the rendered number; stored so the
// data is tunable and available for future copy.
export const FIELD_RESPONSE_CONTEXT: Record<
  Field,
  { interviewRate: string; competitivePerOffer?: string }
> = {
  tech: { interviewRate: "0.5 to 2%", competitivePerOffer: "150 to 400 in competitive markets" },
  finance: { interviewRate: "1 to 3%" },
  marketing: { interviewRate: "2 to 5%" },
  healthcare: { interviewRate: "5 to 10%" },
  general: { interviewRate: "about 3%" },
}

// Reference only. General funnel anchors available for future copy.
export const GENERAL_ANCHORS = {
  applicantToInterview: "about 3%, roughly 1 in 40 applications",
  interviewToOffer: "about 15 to 25%",
  referralVsCold: "about 30% with a referral vs about 7% cold",
} as const

// Descriptor words for the rendered line.
const SENIORITY_LABEL: Record<Seniority, string> = {
  entry: "Entry-level",
  mid: "Mid-level",
  senior: "Senior",
}
const FIELD_LABEL: Record<Exclude<Field, "general">, string> = {
  tech: "tech",
  finance: "finance",
  marketing: "marketing",
  healthcare: "healthcare",
}

// Keyword matchers, same pattern as matchRoleSeed in boardRatings.ts. First
// hit wins. Senior is checked before entry so "Senior Associate" reads senior.
const SENIORITY_MATCHERS: Array<{ key: "senior" | "entry"; matchers: string[] }> = [
  {
    key: "senior",
    matchers: [
      "senior",
      "sr.",
      "sr ",
      "staff",
      "principal",
      "lead",
      "head of",
      "director",
      "vp",
      "vice president",
      "chief",
      "distinguished",
    ],
  },
  {
    key: "entry",
    matchers: [
      "junior",
      "jr.",
      "jr ",
      "entry",
      "associate",
      "intern",
      "new grad",
      "graduate",
      "apprentice",
      "trainee",
    ],
  },
]

const FIELD_MATCHERS: Array<{ key: Exclude<Field, "general">; matchers: string[] }> = [
  {
    key: "tech",
    matchers: [
      "engineer",
      "developer",
      "swe",
      "programmer",
      "software",
      "data scientist",
      "data engineer",
      "machine learning",
      "ml ",
      "ai ",
      "data analyst",
      "product manager",
      "product designer",
      "designer",
      "ux",
      "devops",
      "sre",
    ],
  },
  {
    key: "finance",
    matchers: [
      "finance",
      "financial",
      "investment",
      "accountant",
      "accounting",
      "banker",
      "banking",
      "consultant",
      "consulting",
      "actuary",
      "auditor",
    ],
  },
  {
    key: "marketing",
    matchers: [
      "marketing",
      "growth",
      "brand",
      "content",
      "seo",
      "social media",
      "communications",
      "sales",
      "account executive",
      "business development",
    ],
  },
  {
    key: "healthcare",
    matchers: [
      "nurse",
      "clinical",
      "physician",
      "medical",
      "healthcare",
      "therapist",
      "pharmacist",
      "doctor",
    ],
  },
]

// Resolve seniority: entry/senior by keyword, else mid (a role exists but
// carries no explicit level marker).
function inferSeniority(roleTitle: string): Seniority {
  const t = roleTitle.toLowerCase()
  for (const s of SENIORITY_MATCHERS) {
    if (s.matchers.some((m) => t.includes(m))) return s.key
  }
  return "mid"
}

function inferField(roleTitle: string): Field {
  const t = roleTitle.toLowerCase()
  for (const f of FIELD_MATCHERS) {
    if (f.matchers.some((m) => t.includes(m))) return f.key
  }
  return "general"
}

// One honest ballpark sentence for the user's role. The specific line renders
// only when BOTH seniority is explicit (entry/senior) AND field is known;
// otherwise it falls back to the general per-offer range and generic copy.
export function benchmarkLine(roleTitle: string): string {
  const seniority = inferSeniority(roleTitle)
  const field = inferField(roleTitle)

  const seniorityExplicit = seniority === "entry" || seniority === "senior"
  if (seniorityExplicit && field !== "general") {
    const [low, high] = SENIORITY_PER_OFFER[seniority]
    return `${SENIORITY_LABEL[seniority]} ${FIELD_LABEL[field]} roles typically take ${low} to ${high} applications per offer.`
  }

  const [low, high] = GENERAL_PER_OFFER
  return `Most roles typically take ${low} to ${high} applications per offer.`
}

// Job Source Advisor seed dataset + role resolution.
//
// Scores are role-based defaults (1-10) with a one-line reason per board.
// This file is the editable source of truth for the curated ratings. Roles
// not covered here fall back to an AI-generated ranking (see aiFallback.ts).
//
// Reasons must never contain em dashes (project copy rule). Boards within a
// role are pre-sorted high-to-low by score; equal scores keep listed order.

export type BoardRating = {
  board: string
  score: number // 0-10
  reason: string
  // Generic careers/jobs URL for the board, or null for non-linkable entries
  // (e.g. "Company career pages"). The URL travels with the rating so the link
  // and score stay in sync. Generic landing pages only, never role-targeted or
  // deep-linked search URLs. The AI fallback validates its URLs (https only)
  // and sets this to null when the model returns nothing usable.
  url: string | null
}

export type RoleKey =
  | "product_designer"
  | "software_engineer"
  | "product_manager"
  | "data_scientist"
  | "marketing"
  | "sales"

export type RoleSeed = {
  key: RoleKey
  label: string
  // Lowercase substrings tested against a lowercased role title. First seed
  // (in array order) with any matching substring wins, so more specific
  // roles are listed before the general Software Engineer catch-all.
  matchers: string[]
  boards: BoardRating[]
}

// Order matters: matchRoleSeed returns the first hit. Designer, Data, PM,
// Marketing, and Sales are checked before Software Engineer because the
// engineer matchers ("engineer", "developer") are the broadest.
export const ROLE_SEEDS: RoleSeed[] = [
  {
    key: "product_designer",
    label: "Product Designer",
    matchers: ["designer", "ux", "product design", "design lead", "design manager"],
    boards: [
      { board: "LinkedIn", score: 9, reason: "Highest volume and recruiter activity, strong design presence", url: "https://www.linkedin.com/jobs/" },
      { board: "Company career pages", score: 9, reason: "Best freshness when you target specific companies", url: null },
      { board: "Wellfound", score: 8, reason: "Startup design roles, direct founder contact", url: "https://wellfound.com/jobs" },
      { board: "Built In", score: 7, reason: "Local tech market, good filters", url: "https://builtin.com/jobs" },
      { board: "Otta / Welcome to the Jungle", score: 7, reason: "Curated tech and startup roles", url: "https://app.welcometothejungle.com/" },
      { board: "Glassdoor", score: 6, reason: "Research and salary, weaker for discovery", url: "https://www.glassdoor.com/Job/index.htm" },
      { board: "Dribbble", score: 6, reason: "Design-native, fewer serious product roles", url: "https://dribbble.com/jobs" },
      { board: "Behance", score: 5, reason: "Portfolio-driven, inconsistent quality", url: "https://www.behance.net/joblist" },
      { board: "Designer News", score: 5, reason: "Niche, sporadic postings", url: null },
    ],
  },
  {
    key: "data_scientist",
    label: "Data Scientist / ML Engineer",
    matchers: [
      "data scientist",
      "data science",
      "machine learning",
      "ml engineer",
      "data engineer",
      "ai engineer",
      "data analyst",
      "analytics engineer",
    ],
    boards: [
      { board: "LinkedIn", score: 9, reason: "Highest volume and recruiter activity", url: "https://www.linkedin.com/jobs/" },
      { board: "Company career pages", score: 9, reason: "Best freshness when you target specific companies", url: null },
      { board: "HN Who's Hiring", score: 7, reason: "Monthly thread, strong startup signal", url: "https://news.ycombinator.com/submitted?id=whoishiring" },
      { board: "Wellfound", score: 7, reason: "Startup roles, direct founder contact", url: "https://wellfound.com/jobs" },
      { board: "Otta", score: 7, reason: "Curated tech and startup roles", url: "https://app.welcometothejungle.com/" },
      { board: "Built In", score: 6, reason: "Local tech market, good filters", url: "https://builtin.com/jobs" },
      { board: "Kaggle Jobs", score: 6, reason: "Data and ML roles, smaller pool", url: "https://www.kaggle.com/jobs" },
    ],
  },
  {
    key: "product_manager",
    label: "Product Manager",
    matchers: ["product manager", "product management", "product owner", "product lead"],
    boards: [
      { board: "LinkedIn", score: 9, reason: "Highest volume and recruiter activity", url: "https://www.linkedin.com/jobs/" },
      { board: "Company career pages", score: 9, reason: "Best freshness when you target specific companies", url: null },
      { board: "Lenny's Job Board", score: 8, reason: "PM-focused and curated", url: "https://www.lennysjobs.com/" },
      { board: "Wellfound", score: 7, reason: "Startup roles, direct founder contact", url: "https://wellfound.com/jobs" },
      { board: "Otta", score: 7, reason: "Curated tech and startup roles", url: "https://app.welcometothejungle.com/" },
      { board: "Built In", score: 6, reason: "Local tech market, good filters", url: "https://builtin.com/jobs" },
      { board: "Glassdoor", score: 6, reason: "Research and salary, weaker for discovery", url: "https://www.glassdoor.com/Job/index.htm" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    matchers: ["marketing", "growth", "demand gen", "brand manager", "content strategist", "seo"],
    boards: [
      { board: "LinkedIn", score: 9, reason: "Highest volume and recruiter activity", url: "https://www.linkedin.com/jobs/" },
      { board: "Company career pages", score: 8, reason: "Best freshness when you target specific companies", url: null },
      { board: "Built In", score: 6, reason: "Local tech market, good filters", url: "https://builtin.com/jobs" },
      { board: "Otta", score: 6, reason: "Curated tech and startup roles", url: "https://app.welcometothejungle.com/" },
      { board: "Glassdoor", score: 6, reason: "Research and salary, weaker for discovery", url: "https://www.glassdoor.com/Job/index.htm" },
      { board: "Indeed", score: 6, reason: "Broad volume, lower signal per listing", url: "https://www.indeed.com/" },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    matchers: [
      "sales",
      "account executive",
      "account manager",
      "business development",
      "bdr",
      "sdr",
      "revenue",
    ],
    boards: [
      { board: "LinkedIn", score: 9, reason: "Highest volume and recruiter activity", url: "https://www.linkedin.com/jobs/" },
      { board: "Company career pages", score: 8, reason: "Best freshness when you target specific companies", url: null },
      { board: "RepVue", score: 7, reason: "Sales-specific with comp transparency", url: "https://www.repvue.com/jobs" },
      { board: "Built In", score: 6, reason: "Local tech market, good filters", url: "https://builtin.com/jobs" },
      { board: "Glassdoor", score: 6, reason: "Research and salary, weaker for discovery", url: "https://www.glassdoor.com/Job/index.htm" },
      { board: "Indeed", score: 6, reason: "Broad volume, lower signal per listing", url: "https://www.indeed.com/" },
    ],
  },
  {
    key: "software_engineer",
    label: "Software Engineer",
    matchers: [
      "engineer",
      "developer",
      "swe",
      "programmer",
      "software",
      "full stack",
      "fullstack",
      "frontend",
      "front-end",
      "backend",
      "back-end",
      "devops",
      "sre",
    ],
    boards: [
      { board: "LinkedIn", score: 9, reason: "Highest volume and recruiter activity", url: "https://www.linkedin.com/jobs/" },
      { board: "Company career pages", score: 9, reason: "Best freshness when you target specific companies", url: null },
      { board: "YC Work at a Startup", score: 9, reason: "High-quality vetted startup roles", url: "https://www.workatastartup.com/" },
      { board: "HN Who's Hiring", score: 8, reason: "Monthly thread, strong startup signal", url: "https://news.ycombinator.com/submitted?id=whoishiring" },
      { board: "Wellfound", score: 8, reason: "Startup roles, direct founder contact", url: "https://wellfound.com/jobs" },
      { board: "Otta", score: 7, reason: "Curated tech and startup roles", url: "https://app.welcometothejungle.com/" },
      { board: "Built In", score: 6, reason: "Local tech market, good filters", url: "https://builtin.com/jobs" },
      { board: "Hired", score: 6, reason: "Reverse marketplace, companies reach out to you", url: "https://hired.com/" },
      { board: "Indeed", score: 5, reason: "Broad volume, lower signal per listing", url: "https://www.indeed.com/" },
    ],
  },
]

// Shown when no role is known yet (zero jobs, or jobs with no parsed role).
export const GENERIC_BOARDS: BoardRating[] = [
  { board: "LinkedIn", score: 9, reason: "Highest volume and recruiter activity", url: "https://www.linkedin.com/jobs/" },
  { board: "Company career pages", score: 9, reason: "Best freshness when you target specific companies", url: null },
  { board: "Wellfound", score: 8, reason: "Startup roles, direct founder contact", url: "https://wellfound.com/jobs" },
  { board: "Otta", score: 7, reason: "Curated tech and startup roles", url: "https://app.welcometothejungle.com/" },
  { board: "Built In", score: 6, reason: "Local tech market, good filters", url: "https://builtin.com/jobs" },
  { board: "Glassdoor", score: 6, reason: "Research and salary, weaker for discovery", url: "https://www.glassdoor.com/Job/index.htm" },
  { board: "Indeed", score: 5, reason: "Broad volume, lower signal per listing", url: "https://www.indeed.com/" },
]

// Match a freeform role title to a seed bucket. Returns null on no match.
export function matchRoleSeed(roleTitle: string): RoleSeed | null {
  const t = roleTitle.toLowerCase()
  for (const seed of ROLE_SEEDS) {
    if (seed.matchers.some((m) => t.includes(m))) return seed
  }
  return null
}

export type AdvisorMode = "seed" | "ai_needed" | "generic"

export type Advisor = {
  mode: AdvisorMode
  // Human-readable role for the panel subhead. Null in generic mode.
  roleLabel: string | null
  // Raw role title handed to the AI fallback. Only set in ai_needed mode.
  roleTitle: string | null
  // Pre-sorted boards. Empty array in ai_needed mode (client fetches them).
  boards: BoardRating[]
}

// Pure selector. Input is the user's role titles, most recent first.
// Picks the dominant seed bucket (most common, tiebreak most recent). If no
// title matches a seed but titles exist, flags ai_needed on the most recent
// title. With no titles, returns the generic blend.
export function selectAdvisor(roleTitlesRecentFirst: string[]): Advisor {
  const titles = roleTitlesRecentFirst
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  if (titles.length === 0) {
    return { mode: "generic", roleLabel: null, roleTitle: null, boards: GENERIC_BOARDS }
  }

  // Tally matched seeds; track first (most recent) occurrence for tiebreak.
  const counts = new Map<RoleKey, { seed: RoleSeed; count: number; firstIndex: number }>()
  titles.forEach((title, index) => {
    const seed = matchRoleSeed(title)
    if (!seed) return
    const existing = counts.get(seed.key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(seed.key, { seed, count: 1, firstIndex: index })
    }
  })

  if (counts.size > 0) {
    const winner = [...counts.values()].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.firstIndex - b.firstIndex // earlier index = more recent
    })[0]
    return {
      mode: "seed",
      roleLabel: winner.seed.label,
      roleTitle: null,
      boards: winner.seed.boards,
    }
  }

  // Titles exist but none matched a seed: AI fallback on the most recent.
  return { mode: "ai_needed", roleLabel: titles[0], roleTitle: titles[0], boards: [] }
}

# GUILDY 2.1 — Job Hunt Command Center: Decisions + Backlog

Updated: 2026-05-31

## Organizing principle

With ~0 users, every feature exists for CONVERSION and MARKETING, not retention. Selection test for any feature: "Does it make a 20-second demo make a stranger think I need this, and does it convert a visitor to a signup?" Retention mechanics (streaks, XP, daily missions, return-behavior nudges) are TABLED until there is a user base worth retaining.

Parallel reality: features improve conversion rate and produce marketing material. They do NOT fix the traffic problem. Distribution (paid ads test, community seeding, organic) runs in parallel and is still the bigger lever on raw signups.

## Positioning

"Manage the hunt, not just the interview." Guildy is the command center for the entire job hunt: where to look, what to apply to, track the pipeline, prep every round, compare offers, negotiate. Not a prep tool, not a tracker. The whole funnel in one UI.

## BUILD NOW (conversion-focused, in order)

### 1. Job Source Advisor (priority, also a free pre-signup hook)
- Rated job board recommendations (1-10) personalized by role, seniority, location, company-stage preference, remote/hybrid.
- Examples: Product Designer SF gets LinkedIn 9, Wellfound 8, Dribbble 5, company pages 9. Staff Engineer gets LinkedIn 9, YC Work at a Startup 9, Wellfound 8, HN Who's Hiring 8.
- Source: curated board knowledge base plus model reasoning by persona.
- KEY: ship a FREE pre-signup version on the marketing site. "Enter your role and location, get your personalized board map rated for your field, free." Second free wow-moment alongside Quick Prep. Screenshot-able, shareable, gives a reason to sign up. Ships first.

### 2. Home "Today" panel plus transparent stats
- The hero command-center visual. The single most conversion-driving UI.
- "Today" panel: what to do next (prep due, applications to send, sources to check, target companies to check).
- Transparent stats panel (top strip): jobs tracked, applications sent, active interviews. Real numbers, shown openly (no fake gamification, no invented percentages).
- Handle empty state aspirationally: "Add your first job to activate your command center," NOT a wall of zeros.

### 3. TC Comparison matrix
- Auto-appears once any job reaches a late stage (overlaps/pushes kanban up, takes bottom half of the command center).
- v1 (free/manual): user enters base, bonus, equity, vesting, location, benefits per offer. Guildy normalizes (4-year equity value, cost-of-living adjustment, first-year vs steady-state) and shows apples-to-apples side by side.
- Later (Ultra): benchmark against market data (levels.fyi style, percentile positioning).

### 4. Negotiation Prep (Ultra tier)
- Branches off the TC comparison matrix.
- Paste offer plus target plus leverage. Get a company-tailored negotiation script: company negotiation patterns, leverage analysis, word-for-word scripts, walk-away math tied to TC data.
- Deepest build, highest perceived dollar value, last to build.

### 5. Target Company List
- User adds dream companies. Tracks careers page, role families, last checked, open roles, best fit, application status.
- Command-center substance. Slots into the home view.

## DATA REALITY CONSTRAINTS

### Freshness: we do NOT have post-date data
- Job boards do not expose reliable post dates via any API we have, and Guildy is paste-based.
- DO NOT build a per-job freshness score. We cannot compute it and must not fake it.
- Instead: general advice ("Apply to postings under 72h old, fresh postings convert materially better") plus an OPTIONAL manual date field if the user happens to know the post date.

### Transparency mandate
- All stats are real numbers, shown openly. No invented percentages.
- Defensible framing only, e.g. "15-20 applications per week consistently lands interviews more reliably than bursts" (BLS / recruiting data backed).

## TABLED (retention features, revisit when there is a user base)

- Weekly Job Hunt Sprint (retention mechanic)
- Streaks / XP / Levels / Streak-freeze (retention dopamine, looks childish to serious job seekers)
- Daily Missions as a return-behavior hook (retention)
- Daily Job Radar (return-behavior play, no users to return)
- Apply Priority Score (partly depends on freshness data we lack)
- Saved Jobs Queue / Saved-Considering-Apply Next stage (workflow nicety, not a conversion driver)
- Follow-up Coach plus follow-up message generator (pure retention)
- Post-Interview Debrief plus adaptive next-round prep (major retention feature, exactly why it waits)
- Interview Timeline / per-job journey view (retention/workflow)
- Pipeline Health as a gamified score (kept only as a transparent stats panel; the gamified version is tabled)

## DEFERRED INFRASTRUCTURE (P3, much later)

- Job board integrations / scraping
- Company career page monitoring
- Chrome extension (detect job board, 1-click add, fit score)
- Calendar reminders
- Recruiter relationship tracker

## RESEARCH-BACKED NUMBERS (for honest stats and copy)

- Applications per offer (tech): 150-400 in competitive markets
- Applications per interview: ~42 (2-3% applicant-to-interview rate)
- Optimal weekly pace: 15-20 (sustainable, tech-calibrated)
- BLS sweet spot: 21-80 applications = 30.89% offer rate (highest); above 80, drops to 20.36%
- Consistency beats bursts: 15/week for 10 weeks beats 30 in week 1 then nothing
- Referrals: 30% success vs 2% cold
- Avg time-to-hire: ~40 days, 5.5 interviews/hire

## WHAT TO AVOID (scope creep guard)

- Do not build a job board or scraper for v1.
- Do not fake freshness data.
- Do not build retention mechanics before there are users to retain.
- Do not let the home view become a wall of zeros for new users.
- Do not invent statistics. Every number traceable to real data.

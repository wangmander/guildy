# Guildy V2 — Phase 0 Resolutions

This document locks decisions made during spec development. Anything listed here is **closed for V2**. CC CLI must not reopen these decisions or "helpfully" rebuild them. If a feature shows up in this document, it is intentionally not in MVP.

---

## Cut from V2 — do not build

### Email and automation

- **Gmail OAuth** — no Google sign-in, no Gmail access of any kind
- **Gmail scraping** — no email parsing, no recruiter email auto-detection
- **Auto stage detection** — stages move only when user moves them
- **Email forwarding address** — no `@guildy.app` forwarding inbox
- **Calendar integration** — no Google Calendar, no iCal, no event sync

### Tracking and capture

- **Next interview date capture** — no date fields on cards or in stage moves
- **Mass apply / auto-submit** — Guildy never submits applications
- **LinkedIn scraping** — no LinkedIn API, no scraping LinkedIn URLs for JDs
- **Screenshot OCR** — no image upload for JD parsing in V2 (paste text instead)
- **Web research for company/interviewer** — only available inside Deep Prep, not as a standalone feature

### Comparison and decision-making

- **Comparison matrix across jobs** — no side-by-side job comparison
- **Decision memo generator** — no AI-generated "which job to take" output
- **Offer / negotiation module** — no offer fields, no negotiation scripts, no leverage analysis
- **Story bank as a separate feature** — user background lives in onboarding, not as a curated story library

### Engagement and gamification

- **XP system** — no points
- **Pal / companion** — no character, no avatar, no evolution
- **Quests / daily missions** — no streaks, no quest UI
- **Achievements / badges** — none

### Surface area

- **Dashboard suite** — no charts, no analytics, no metrics dashboard
- **Full CRM workspace** — no separate per-job page with tabs
- **Tabbed job detail page** — Prep Overlay replaces this
- **Gantt view** — no timeline visualization
- **Job board / aggregator** — Guildy does not list jobs from external sources

### Distribution and platforms

- **Chrome extension** — no "Save to Guildy" browser button
- **Bookmarklet** — no JavaScript bookmark
- **Mobile native app** — responsive web only
- **Multi-user / team mode** — single user only
- **Sharing / public profiles** — no shareable scorecards or progress pages

### Pricing variants

- **Annual plan** — monthly only in V2
- **Trial period** — no free trial; free tier is the trial
- **Multiple paid tiers** — single $19.99/mo tier
- **Per-generation pricing** — both Quick and Deep Prep are unlimited at their tier

---

## Locked decisions

### Stack

- **Framework:** Next.js 14
- **Language:** TypeScript
- **Styling:** Tailwind
- **Database:** Supabase (Postgres)
- **Auth:** Supabase magic link (no Google OAuth)
- **Hosting:** Vercel
- **Domain:** guildy.ai
- **Models:** GPT-5.4 nano (Quick Prep, free), Claude Sonnet 4.6 (Deep Prep, paid)

### Schema

- **Drop V1 schema entirely.** No migration of `pipeline_threads`, Gmail-related tables, or OAuth token tables.
- Fresh schema for V2: `jobs`, `stage_events`, `job_context`, `prep_versions`, `user_profiles`.

### Stages

- 7 default stages, fixed order, fixed count: Applied → Screen → Hiring Manager → Interview Loop → Final → Offer → Closed
- Labels are user-editable
- All movement is manual

### Job model

- Two states: passive (table) and active (Kanban)
- Passive jobs are conceptually Applied but live in the table, not the board
- Activation defaults to Screen stage on the Kanban
- Active-board Applied is reserved for jobs manually created directly into active state

### Pricing

- Free: Quick Prep unlimited (fair-use), GPT-5.4 nano, no web research, no Interviewer Profile widget
- Paid: $19.99/mo, Deep Prep unlimited (fair-use), Claude Sonnet 4.6, web research, Interviewer Profile widget unlocked
- Single tier above free
- "Unlimited" is user-facing language. Backend implements fair-use protection, caching, rate limits, and abuse detection. Limits are not surfaced in UI.

### Prep tier paywall framing

- Not "two locked features"
- Framed as "Deep Prep upgrades the entire prep experience"
- One explicit locked widget: Interviewer Profile
- Free users can still capture interviewer info; only the dedicated widget is locked

### TC field

- Single string, no parsing
- Captured in all three intake methods
- No comp negotiation logic in V2
- Comp/offer features deferred to V2.1 or later

### Search

- Searches across all jobs (passive and active)
- Indexed fields: company, role title, context (JD, latest messages, interviewer info, pasted notes)
- No separate "notes" concept; everything pasted is context

### Onboarding

- Resume or pasted background is required before any prep generation runs
- Hard gate: no resume → cannot run Quick or Deep Prep
- Updateable in settings

### Persistence

- All context items persist with timestamps
- All prep versions persist with timestamps
- Minimal history UI lives inside Prep Overlay ("Previous versions" dropdown), not Settings
- No diffing or complex history navigation in MVP

### Mobile

- Desktop and mobile responsive, single codebase
- No native iOS or Android app

---

## Open tech decisions (resolve in tech spec, not product spec)

- **Web research provider for Deep Prep.** Options: browser/search API, Perplexity API, Anthropic/OpenAI native tool use, or custom search endpoint. Cost, latency, and reliability tradeoffs to evaluate.
- **Caching strategy for prep generations.** Identical inputs (same job, same context, same prep tier) should return cached output where possible.
- **Fair-use thresholds.** Specific rate limit values for Quick and Deep Prep generations per user per day/month. Should be generous enough that a normal heavy interviewer never hits them.
- **Abuse detection signals.** What patterns trigger rate limit enforcement (rapid regenerations, identical context across many fake jobs, etc.).

---

## Guildhall integration

Guildy V2 will eventually feed into Guildhall (the studio HQ project tracker). For now, the integration is one-way and lightweight.

### Quest manifest

Each project repo (starting with Guildy) exposes progress through a manifest file:

**Path:** `.guildhall/quests.json`

**Format:**

```json
{
  "project": "guildy",
  "current_phase": "phase-0-audit",
  "phases": [
    {
      "id": "phase-0-audit",
      "name": "Audit and kill",
      "status": "in_progress",
      "progress": 0.4,
      "started_at": "2026-04-28T00:00:00Z",
      "completed_at": null
    }
  ],
  "current_quest": "Inventory Gmail and OAuth dependencies",
  "last_updated": "2026-04-28T00:00:00Z"
}
```

### CC CLI responsibility

CC CLI updates `.guildhall/quests.json` at the end of each phase as part of its prompt template. This is non-negotiable for every Guildy build phase.

Status values: `not_started`, `in_progress`, `complete`, `blocked`.

### Guildhall UI is deferred

Guildhall v1 (the fantasy card grid reading these manifests) is **not built in parallel with Guildy V2.** The manifest exists in Guildy's repo regardless. Guildhall reads it later when Guildhall is built.

Do not write `guildhall-v1-spec.md` until explicitly requested.

---

## What CC CLI must never do

- Reintroduce any feature listed under "Cut from V2"
- Expand schema beyond what's defined for V2
- Add additional pricing tiers or trial logic
- Build a separate page or workspace for jobs (the Prep Overlay is the detail surface)
- Skip updating `.guildhall/quests.json` at the end of a phase
- Generate prep without resume/background context loaded
- Auto-move a job's stage based on any signal

If CC CLI proposes any of the above, the prompt was wrong or the model is drifting. Reject and re-scope.

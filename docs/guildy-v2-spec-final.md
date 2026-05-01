# Guildy 2.0 — Product Spec (Final)

## Product Principle

Guildy is a simple job pipeline tracker that becomes valuable when the user needs serious interview prep.

It is not a CRM. It is not an automation suite. It is not a dashboard. It is not a job board.

The MVP wins by doing two things well:

1. Tracking jobs with very low friction.
2. Generating bespoke interview prep that feels like a senior advisor reviewed the role, company, latest message, interviewer context, and user background.

---

## Core Surfaces

Guildy has two core surfaces:

1. **Home** — active pipeline board + passive job table.
2. **Prep Overlay** — large overlay/widget layer that opens over the pipeline when the user wants prep.

There is no separate job workspace. There are no tabs. There is no full CRM-style detail page.

Desktop and mobile responsive. Single codebase.

---

# 1. Home

Home is the main product surface. It contains:

1. Search bar
2. Active pipeline board
3. Passive job table

## Search

Search sits at the top of Home.

It searches across all jobs (passive and active) by:

- company
- role title
- context (pasted JD, latest messages, interviewer info, any pasted context)

Primary use case: user gets a recruiter reply, searches for the job they applied to, then activates it.

---

## Passive Jobs

Passive jobs are jobs the user applied to but has not received a meaningful response from yet. Conceptually they are at "Applied" but they live in the passive table, not the Kanban.

Passive jobs appear in a simple Excel-like table.

Columns must be exactly:

- **Company**
- **Role Title**
- **Date Added**
- **TC**

No Source column. No Status column. No Prep Status column.

Rows are clickable and include a "They Responded" action in the row UI.

---

## Active Pipelines

A job becomes active once the company or recruiter responds.

Active pipelines appear in a Kanban-style pipeline board.

Each active card shows:

- company
- role title
- current stage
- stage markers
- prep status (see Prep Status below)
- Latest Message preview if provided
- Prep CTA
- left/right arrows for stage navigation

### Stage navigation on cards

- **Drag/drop** between columns (desktop primary)
- **Left/right arrows** on each card (mobile primary, also works on desktop)

Both interactions exist on every active card. Arrows are the mobile-friendly fallback when drag/drop is awkward on touch.

### Prep status

Three states, displayed as a badge or chip on each active card:

1. **None** — no prep generated yet
2. **Quick Prep generated**
3. **Deep Prep generated**

---

# 2. Stages

Default stages, in order:

```text
Applied → Screen → Hiring Manager → Interview Loop → Final → Offer → Closed
```

Use **Screen**, not "Recruiter Screen."

### Active-board Applied

Active-board Applied is reserved for jobs manually created directly into the active board (skipping passive). Normal passive → responded activation starts at **Screen**, not Applied.

### Stage Renaming

Stage labels are user-editable. Examples: Screen → Recruiter, Interview Loop → Panel, Final → Exec Round.

For V2: stage order is fixed, stage count is fixed, only labels change.

### Stage Movement

Stage movement is manual. Supported: drag/drop between columns, left/right arrows on cards.

No auto-detection. No Gmail parsing. No automatic movement.

---

# 3. Add Job

Three intake methods:

1. **Paste Source URL** — system attempts to extract company, role title, JD, and TC if present
2. **Paste JD Text** — most reliable, system extracts structured fields including TC if present
3. **Manual Quick Add** — company + role title + optional TC

All three paths support TC. URL and JD paste try to extract it automatically. Manual add lets user type it directly.

New jobs default to:

- passive state
- conceptually Applied (but live in the passive table)

---

# 4. Activation Flow

When a passive job gets a response:

1. User clicks **They Responded**
2. Overlay opens asking the user to paste the latest message from the recruiter or company
3. User can paste the message or skip
4. Job becomes active at **Screen** stage
5. Prep Overlay continues into Step 1 (Input Checklist)
6. User chooses **Quick Prep** or **Deep Prep**

### Overlay close behavior

If the user closes the overlay mid-flow after activating:

- Activation sticks
- Job stays active at Screen
- Latest Message is saved if pasted
- No prep is generated yet
- User can reopen the overlay anytime via the Prep CTA on the card

The explicit Quick vs Deep choice is the main product and paywall moment. Do not auto-generate prep during activation.

---

# 5. Onboarding

Onboarding requires user background before any prep can run.

Accepted inputs:

- Resume PDF upload
- Pasted resume text
- Pasted LinkedIn/profile summary
- Pasted personal background/context

This background becomes persistent context for every prep call. Users can update or replace it anytime in settings.

---

# 6. Prep Overlay

The Prep Overlay is the core value moment.

It is not a page. It is not a small modal. It is not a tabbed workspace.

It is a large overlay/widget layer over the pipeline.

**Design requirement:** the Prep Overlay is composed of floating widgets/cards over the blurred pipeline, not one monolithic boxed modal. Widgets sit on top of the dimmed pipeline as discrete elements. This is a hard design requirement, not a suggestion.

When opened:

- Pipeline subtly blurs/dims behind it
- Selected job is in focus
- User remains grounded in the pipeline
- Overlay guides them toward prep synthesis

Should feel like: "this pipeline opened into prep mode," not "I navigated to a CRM detail page."

---

## Prep Overlay Flow

The overlay has two steps for first-time prep, then a third state for viewing existing prep.

### Reusable checklist behavior

Every time the overlay opens:

- Step 1 shows the input checklist with prior items as filled chips
- User can add, edit, or skip any context item
- User can then choose Quick/Deep Prep, view existing prep, or regenerate

---

## Step 1 — Input Checklist

Lightweight checklist of useful context.

Checklist items:

- Resume/background exists (from onboarding)
- JD or source URL added
- Latest Message added
- Interviewer name/title/link added
- Additional personal context added

Each item supports: Add / Edit / Skip.

Only resume/background is required before prep generation.

The checklist teaches: "the more context you add, the better the prep." It should not feel like a long form.

### Interviewer info capture

Free users can add interviewer info. It feeds Quick Prep's likely questions and positioning sections. Only the dedicated **Interviewer Profile widget** stays locked behind paid.

---

## Step 2 — Choose Prep Level

Push the user to choose between Quick Prep and Deep Prep.

Includes:

- Comparison matrix
- Checklist of what improves with Deep Prep
- **Static example** of an upgraded prep section (hardcoded sample, not a live personalized generation)

| Area         | Quick Prep            | Deep Prep                                    |
| ------------ | --------------------- | -------------------------------------------- |
| Prep quality | Useful sketch         | Senior-advisor-level prep                    |
| Research     | Uses provided context | Adds company + interviewer research          |
| Questions    | Good likely questions | More specific, stage/company-aware questions |
| Answers      | Sketch guidance       | Full bespoke answers in user's voice         |
| Interviewer  | Locked widget         | Unlocked if info is provided                 |

---

## Prep View — Hotlinks Navigation

Once prep is generated, the overlay shows the prep output as a long scroll. A sticky anchor nav lets the user jump between sections without scrolling.

Anchor links:

- Testing
- Positioning
- Questions
- Draft Answers
- Risks
- Questions to Ask
- Checklist

Sticky nav appears as a top bar on desktop and a collapsible anchor menu on mobile. Critical for mobile usability.

---

## Regeneration and prep history

User can add new context anytime and regenerate Quick or Deep Prep.

Persistence:

- Latest prep is shown by default
- Prior prep versions are saved with timestamps
- User can review prior versions if needed

Do not overbuild prep history UI in MVP. Persist the data, expose a minimal viewer (e.g., dropdown or "view previous version" link). No diffing, no fancy navigation.

---

# 7. Quick Prep

Free tier.

**Model:** GPT-5.4 nano

Inputs:

- Company, role title, current stage
- User resume/background
- Pasted JD/source if provided
- Latest Message if provided
- Interviewer info if provided
- Any pasted context

Quick Prep does **not** use web research.

Output: useful sketch with sketch-level draft answers, basic company/role understanding from provided context, solid prep structure.

User-facing: unlimited generations. Backend: fair-use protection, caching of identical inputs, rate limits, and abuse detection. Do not surface limits in UI.

---

# 8. Deep Prep

Paid tier.

**Model:** Claude Sonnet 4.6

Uses everything from Quick Prep plus:

- Company web research
- Role/company synthesis
- Interviewer research if names/titles/links provided
- Stronger reasoning
- Full bespoke draft answers in user's voice

Should feel like: "I gave a senior career advisor everything, and they came back with specific prep for this exact company, role, stage, and interviewer."

User-facing: unlimited generations. Backend: fair-use protection, caching of company/interviewer research results, rate limits, and abuse detection. A single user should not be able to burn unbounded Sonnet spend.

**Open tech decision (not a product blocker):** web research provider for company and interviewer lookups. Options to evaluate in tech spec — browser/search API, Perplexity API, Anthropic/OpenAI native tool use, or a custom search endpoint. Decision lives in tech spec, not product spec.

---

# 9. Premium Upgrade Framing

Do not frame premium as "two locked features."

Correct framing: **Deep Prep upgrades the entire prep experience.**

Everything gets better — strategy, likely questions, company research, role synthesis, risks, positioning, prep checklist, draft answers, specificity, use of user background.

The one clearly locked outlier widget is:

- **Interviewer Profile Widget** — visible to free users in locked state with upgrade CTA

Global upgrade CTA present but not annoying. Example copy: "Upgrade to Deep Prep for researched prep, interviewer insight, and full answer drafts in your voice."

---

# 10. Prep Output Structure

Both Quick Prep and Deep Prep generate the same broad structure:

- What this round is testing
- What they likely care about
- How to position yourself
- Likely questions they'll ask (with draft answers inline)
- Best angles/stories to use (resume-grounded)
- Risks they may probe
- Questions to ask them
- Prep checklist

Difference: Quick Prep = useful sketch. Deep Prep = researched, specific, bespoke, premium.

---

# 11. Pricing

## Free Tier

- Full pipeline tracking
- Passive table
- Active pipeline
- Quick Prep (unlimited)
- Sketch-level answers
- Basic company/role synthesis from provided context

## Paid Tier — $19.99/month

- Deep Prep (unlimited, Claude Sonnet 4.6)
- Company web research
- Interviewer research / Interviewer Profile widget
- Full bespoke draft answers
- Upgraded prep across all sections

No annual plan in V2. Cancel anytime.

---

# 12. Out of Scope for V2

Do not build:

- Gmail OAuth or scraping
- Auto stage detection
- Mass apply
- XP / pal / gamification
- Comparison matrix across jobs
- Offer / negotiation module
- Story bank as a separate feature
- Calendar integration
- Next interview date capture
- Chrome extension
- Mobile native app (responsive web only)
- Multi-user / team mode
- Full CRM workspace
- Tabbed job detail page
- Gantt view

---

# Final MVP Shape

```text
Passive table + active pipeline + Prep Overlay
```

Main user loop:

1. Add job → sits in passive table
2. Company responds → user clicks **They Responded**
3. Job becomes active at **Screen** with Latest Message saved
4. Prep Overlay opens to Input Checklist
5. User adds context, chooses Quick or Deep Prep
6. Guildy generates prep
7. User reviews prep with hotlink navigation, can regenerate after adding more context

Main revenue moment: **Quick Prep vs Deep Prep choice screen.**

Paid promise: Deep Prep upgrades the entire interview prep experience with stronger reasoning, research, interviewer insight, and full bespoke answers in the user's voice.

# Guildy V2 — Technical Spec v0

**Status:** Draft for review. No code yet.
**Source of truth:** `guildy-v2-spec-final.md`, `phase-0-resolutions.md`.
**Audience:** Principal engineer / AI product architect review before CC CLI execution.

---

## 1. Executive Technical Summary

### What changes from V1 to V2

V1 was a Gmail-scraping-based pipeline detector. V2 is a manual job tracker with AI prep as the paid value layer. The pivot kills V1's core ingestion engine and replaces it with manual entry + manual stage control + on-demand AI prep generation.

### What gets deleted

- All Gmail/Google OAuth code paths (token storage, refresh logic, scopes, callbacks)
- Email scraping engine (subject classification, sender heuristics, six-layer detection stack)
- `pipeline_threads` table and any auto-detection state
- Recruiter email monitoring background jobs
- Any cron/scheduled tasks tied to email polling
- All routes related to Gmail auth callbacks

### What gets preserved if useful

- Next.js 14 app router structure
- Tailwind config and existing design tokens
- Supabase client setup and any utility wrappers
- TypeScript types for the parts of V1 that survive (likely thin)
- OpenAI client wrapper if used (will be reused for Quick Prep on GPT-5.4 nano)
- Stripe scaffolding if any was started
- `.env.local` patterns

### What gets rebuilt

- Database schema (full reset; V1 schema is dropped)
- Authentication (Google OAuth out, Supabase magic link in)
- Home page (Kanban + passive table + search)
- Job creation flow (3 manual intake methods)
- Activation flow (passive → active via "They Responded")
- Prep Overlay (floating widget composition over blurred pipeline)
- AI service layer (Quick Prep + Deep Prep with separate model routing)
- Subscription/paywall logic ($19.99 single tier)
- Quest manifest writer (`.guildhall/quests.json` updated per phase)

### Net surface

V2 is materially smaller than V1 in code. V1 had email infra complexity. V2 has AI prompt complexity instead. Solo build target: 60-80 focused hours.

---

## 2. Existing Repo Audit Plan

Audit happens in Phase 0 before any code is written. Output is `docs/guildy-v2-audit.md`.

### Files and folders to inspect first

- `app/` route structure (Next.js 14 app router) — identify Gmail-related routes
- `app/api/` — find OAuth callbacks, webhook endpoints, email polling routes
- `lib/` — find Gmail client wrapper, email parser, classification logic
- `supabase/migrations/` — full migration history
- `package.json` — identify Gmail/Google deps to remove (`googleapis`, `google-auth-library`, etc.)
- `.env.local` — identify Google OAuth secrets to remove from Vercel env later
- `components/` — identify reusable shells (button, card, modal primitives, layout)
- `middleware.ts` — auth guards likely tied to Google OAuth, will need rewrite
- `types/` and `lib/database.types.ts` — fully regenerate after schema reset

### Likely Gmail/OAuth dependencies to identify and kill

- Routes: `/api/auth/google/*`, `/api/gmail/*`, `/api/webhooks/gmail`
- Lib: `lib/gmail/*`, `lib/email-classifier.ts`, `lib/recruiter-detector.ts`
- DB: `pipeline_threads`, `gmail_tokens`, `email_events`, `recruiter_signals` (any V1 tables tied to email)
- Components: any inbox preview UI, email thread viewer, classification badges

### Likely V1 schema tables to drop

- `pipeline_threads`
- Anything Gmail-prefixed
- Anything email-prefixed (events, classifications, threads)
- OAuth token tables

### Likely reusable UI/components

- Layout shell (header, nav, container)
- Button, input, modal primitives
- Tailwind config and design tokens
- Toast/notification system if present
- Form components if cleanly built

### Risk areas before coding

- Supabase project state (paused, RLS policies, existing data)
- Stripe state (existing products/prices)
- Vercel env vars (Google OAuth secrets need cleanup)
- Branch strategy (need clean `v2-pivot` branch)
- Existing user data in V1 (none expected in private beta, confirm before drop)

---

## 3. Target Architecture

### App routes

```
/                          → marketing/landing (or redirect to /app if authed)
/login                     → magic link request
/auth/callback             → magic link handler
/onboarding                → resume/background capture (gate before /app)
/app                       → Home (Kanban + passive table + search)
/app/settings              → resume update, account, subscription
/api/jobs                  → CRUD jobs
/api/jobs/[id]/activate    → passive → active
/api/jobs/[id]/stage       → stage move
/api/jobs/[id]/context     → add context item
/api/prep/generate         → Quick or Deep prep generation
/api/prep/[id]/regenerate  → regenerate existing prep
/api/research/company      → Deep Prep web research
/api/research/interviewer  → Deep Prep web research
/api/stripe/checkout       → start checkout session
/api/stripe/webhook        → subscription state updates
/api/health                → health check
```

### Server actions vs API routes

- Server actions for mutations triggered from RSC (job CRUD, stage moves)
- API routes for AI generation (long-running, streaming)
- API routes for Stripe webhooks (must be REST)

### Supabase usage

- Auth: magic link only
- DB: Postgres for all entities
- RLS: per-user row isolation on all tables; policies enforce `auth.uid() = user_id`
- Storage: resume PDF uploads (private bucket, signed URL access)
- No realtime in V2 (overlay state is local component state)

### Auth flow

1. User enters email on `/login`
2. Supabase sends magic link
3. User clicks link, hits `/auth/callback`, session established
4. Middleware redirects to `/onboarding` if no usable resume text on file, else `/app`
5. All `/app/*` and `/api/*` routes require active session

### Resume capture and text extraction

Resume upload supports PDF or pasted text. PDF flow:

1. User uploads PDF to Supabase storage (private bucket)
2. Server extracts text (e.g., `pdf-parse` or `unpdf`) and writes to `user_profiles.resume_text`
3. Extracted text shown to user for review and editing
4. If extraction fails or returns empty, user must paste resume/background text manually before continuing

Prep generation cannot run without usable `resume_text`. PDF upload alone is insufficient — text must be extracted or pasted.

### LLM service layer

`lib/ai/` directory:
- `lib/ai/quick-prep.ts` — GPT-5.4 nano client, prompt assembly, output parsing
- `lib/ai/deep-prep.ts` — Claude Sonnet 4.6 client, prompt assembly, research injection, output parsing
- `lib/ai/research.ts` — web research provider abstraction
- `lib/ai/context-assembly.ts` — pulls user profile + job + context items + interviewer info into structured prompt input
- `lib/ai/cache.ts` — keyed cache for identical inputs (job_id + context_hash + prep_tier)
- `lib/ai/rate-limit.ts` — fair-use enforcement per user

### Payment/subscription gating

- Stripe checkout for $19.99/mo subscription
- Webhook updates `user_profiles.subscription_status` and `subscription_period_end`
- Server-side gate on `/api/prep/generate` when `tier === "deep"` checks status before model call
- Client UI shows lock states based on session-attached subscription flag

### Web research layer for Deep Prep

**Locked:** Perplexity API as V0 research provider. Abstracted behind `lib/ai/research.ts` so swap is trivial later. Decision rationale: built for this use case, low integration cost, decent caching upstream, predictable per-call pricing.

### Caching and fair-use guardrails

- Identical-input cache: hash `(job_id, context_state, tier)` → cached output, 24h TTL
- Per-user rate limit: e.g., 30 Quick Prep generations / 24h, 10 Deep Prep / 24h. Generous enough that real users never hit it. Hidden from UI.
- Per-user monthly cap: e.g., 200 Quick / 60 Deep. Hidden.
- Abuse signals: rapid regenerations on same job (>5 within 10 min), identical context across many fake jobs, IP-level anomalies → soft throttle.

---

## 4. Data Model

### Tables (high level)

**`user_profiles`**
- `id` (uuid, FK to auth.users)
- `email`
- `resume_url` (Supabase storage path)
- `resume_text` (extracted/pasted text used in every prep call)
- `background_text` (additional pasted context, optional)
- `subscription_status` (`free` | `active` | `cancelled` | `past_due`)
- `subscription_period_end` (timestamp)
- `stripe_customer_id`
- `created_at`, `updated_at`

**`jobs`**
- `id` (uuid)
- `user_id`
- `company_name`
- `role_title`
- `tc` (string, no parsing)
- `source_url`
- `jd_text`
- `state` (`passive` | `active`)
- `stage` (string, references default stage IDs)
- `prep_status` (`none` | `quick_generated` | `deep_generated`)
- `latest_message` (text, the most recent recruiter message)
- `created_at`, `updated_at`, `activated_at`

**`stage_events`**
- `id` (uuid)
- `job_id`
- `from_stage`, `to_stage`
- `note` (optional, freeform)
- `created_at`

**`job_context`**
- `id` (uuid)
- `job_id`
- `type` (`jd` | `latest_message` | `interviewer` | `note` | `other`)
- `content` (text)
- `metadata` (jsonb — for interviewer name/title/link, etc.)
- `created_at`

**`prep_versions`**
- `id` (uuid)
- `job_id`
- `tier` (`quick` | `deep`)
- `model_used` (string, for tracking)
- `context_hash` (for cache lookups)
- `output` (jsonb, structured prep sections)
- `created_at`

**`stage_labels`** (per-user editable labels)
- `id` (uuid)
- `user_id`
- `stage_key` (`applied` | `screen` | `hiring_manager` | `interview_loop` | `final` | `offer` | `closed`)
- `custom_label` (string)
- Unique per `(user_id, stage_key)`

**`subscriptions`** (audit trail, optional — could collapse into `user_profiles`)
- `id`, `user_id`, `stripe_subscription_id`, `status`, `created_at`, `updated_at`

### Relationships

- `user_profiles` 1→N `jobs`
- `jobs` 1→N `stage_events`, `job_context`, `prep_versions`
- `user_profiles` 1→N `stage_labels`

### What not to store

- Gmail tokens, email content, anything tied to V1 ingestion
- Plaintext payment info (Stripe handles)
- Interviewer LinkedIn scraped data (we link, we don't scrape)
- Web research raw HTML (cache the structured summary only)

### Deletion and privacy

- Hard delete cascades from `user_profiles` to all child tables
- User-initiated account deletion endpoint
- Resume PDF deleted from Supabase storage on account deletion
- Stripe subscription cancelled on deletion

---

## 5. UI Architecture

### Home structure

- Header: logo, search bar, account menu
- Active zone (top): Kanban board, columns = stages, cards = active jobs
- Passive zone (below): table, 4 columns, "They Responded" action per row
- Home can use a minimal app shell/navigation if the existing layout supports it, but do not build a dashboard-style nav system or add extra surfaces

### Passive table

- Sortable by Date Added (default desc)
- Inline edit on Company, Role Title, TC
- Click row opens lightweight detail (or just enables "They Responded" CTA)
- Empty state: "Add your first application" CTA

### Active Kanban board

- 7 columns matching default stages (with custom labels if set)
- Horizontal scroll on mobile, full-width on desktop
- Cards draggable between columns (dnd-kit)
- Card click → opens Prep Overlay
- Card includes: company, role title, current stage chip, prep status badge, Latest Message preview (truncated), Prep CTA, left/right arrows
- Empty column states: subtle, not loud

### Active card behavior

- Drag/drop on desktop primary
- Left/right arrows on every card (mobile primary, also desktop)
- Click anywhere on card body opens Prep Overlay
- Prep CTA is explicit button, not just card click

### Stage label editing

- Click stage column header → inline edit input
- Saves on blur
- Reverts to default on empty input

### Prep Overlay structure

**Critical design constraint:** floating widget/card composition over blurred pipeline. Not a monolithic modal box.

Layout zones (responsive):

- Pipeline behind: visible but blurred + dimmed
- **Left column (top):** Role Context widget — company name, logo, role title, team, employment type, comp, funding, source, short company blurb (e.g., "Aurora is building agentic workflows for ops teams. Design org is 6, reporting to Mira.")
- **Left column (middle):** Interviewer card — name, title, tenure, prior companies. In Quick: shows basic identity only with "Unlock with Deep Prep" CTA on insights section. In Deep: full interviewer insights unlocked (talks given, themes from writing, panel style, questions she's asked candidates).
- **Left column (bottom):** Deep Prep upsell card (free users only). Hides for paid users.
- **Center (primary, scrollable):** Prep content with model badge row at top showing both tiers ("GPT-5.4 Nano Quick Prep" / "Sonnet 4.6 Deep Prep Upgrade"). Sections rendered as scrollable cards with hotlink anchors:
  - Purpose — "What this round is really testing" (with sub-criteria bars: communication, process clarity, scope sense, fit — Quick shows 2, Deep shows full set with percentages)
  - Positioning — "How to position yourself" (numbered framing points; Quick shows 2 truncated, Deep shows full numbered list with rich context)
  - Risks & Probes — "Where she'll push" (Quick: light reminders; Deep: full likely concerns + counters)
  - Additional sections per Section 7 prompt schema
- **Right column (top):** Inputs widget — checklist of context items added (Background, Job description, Latest message, Interviewer, +Add context). Shows "4/5" completion count and microcopy: "The more forms of context, the better the prep."
- **Right column (bottom):** Questions widget — tabbed between "They'll ask you" and "You ask them." Each question has a category label (Opening, Method, Collab, Impact). Shows count (e.g., "7"), with bookmark icon per question and a "Generate more" CTA at bottom. Quick: limited common questions, no category labels. Deep: full questions by category.

### Prep Overlay flow

1. **Step 1 — Input Checklist** (first widget shown)
   - Filled chips for existing context items
   - Add / Edit / Skip per item
   - "Continue" → Step 2
2. **Step 2 — Choose Prep Level**

   Deep Prep upsell card with locked copy:

   ```
   Deep Prep
   Quick Prep gets you ready. Deep Prep gives you the plan.

   ✓ Complete questions by category
   ✓ Answer plans by interview type
   ✓ Resume-to-JD fit
   ✓ Interviewer prep

   [Upgrade to Deep Prep]
   Compare Quick vs Deep
   ```

   "Compare Quick vs Deep" link opens a drawer/modal with this comparison matrix:

   | Area | Quick Prep | Deep Prep |
   |---|---|---|
   | Questions | Common questions | Complete questions by category |
   | Answers | Basic answer tips | Answer plans by interview type |
   | Resume fit | Quick fit summary | Resume-to-JD fit with gaps and emphasis |
   | Interviewer | Basic info / locked preview | Interviewer-specific prep |
   | Risks | Light reminders | Likely concerns + counters |
   | Practice | Checklist | Stronger prep checklist with category coverage |

   - "Generate Quick Prep" / "Generate Deep Prep" CTAs
   - **Banned copy** (do not use anywhere): "Deep Prep upgrades everything," "Company-specific angles," "Role-specific positioning," "Experience mapping." These are too vague or not spec-backed.

   The upsell card persists in the prep view sidebar for free users (left column bottom). Hides entirely for paid users.
3. **Prep View** — generated output with sticky hotlinks nav

### Generated prep view with hotlinks

Sticky anchor nav at top of center widget. Anchors based on actual section labels in design:

- Purpose ("What this round is really testing")
- Positioning ("How to position yourself")
- Risks ("Where she'll push")
- Questions (right-column widget, scroll syncs)

Top of center widget shows model badges: "GPT-5.4 Nano · Quick Prep" or "Sonnet 4.6 · Deep Prep" with active tier highlighted.

Sections rendered as scrollable cards within center widget. Hotlinks scroll-to-section. On mobile, hotlinks become a collapsible anchor menu in the sticky top bar.

### Mobile behavior

- Kanban board: horizontal scroll, snap to column
- Passive table: condensed view, TC collapses into row/card body on narrow screens but remains visible (never hidden)
- Prep Overlay: full-screen takeover (no blur, mobile screen too small for widget composition)
- Hotlinks nav: sticky top bar with anchor menu icon
- Drag/drop disabled on mobile, arrows are primary stage move

---

## 6. AI Architecture

### Quick Prep flow

1. User clicks "Generate Quick Prep" in overlay Step 2
2. Server action validates user has resume on file
3. Context assembly: user profile + job + all context items → prompt input
4. Cache check: `(job_id, context_hash, "quick")` → return cached if hit
5. GPT-5.4 nano call with assembled prompt
6. Output parsed into structured sections (validated against schema)
7. Persisted as `prep_versions` row, tier=quick
8. `jobs.prep_status` updated to `quick_generated`
9. Returned to client, rendered in overlay

### Deep Prep flow

1. User clicks "Generate Deep Prep"
2. Server validates: resume present + active subscription
3. Context assembly (same as Quick) + research enrichment:
   - Company web research (cached per company name, 7-day TTL)
   - Interviewer research per provided interviewer (cached per name+company, 7-day TTL)
4. Cache check on full input
5. Claude Sonnet 4.6 call with enriched context
6. Output parsed into structured sections
7. Persisted as `prep_versions` row, tier=deep
8. `jobs.prep_status` updated to `deep_generated`
9. Returned to client, rendered in overlay

### Model routing

- Quick → OpenAI client → GPT-5.4 nano
- Deep → Anthropic client → Claude Sonnet 4.6
- No fallback chain in V0 (if model is down, return error, user can retry)

### Prompt assembly

Single template per tier with structured input. Input dict includes:

```ts
{
  user: { resume_text, background_text },
  job: { company, role, stage, jd_text, latest_message },
  context_items: [{ type, content, metadata }],
  interviewer: { name?, title?, link? },
  research: { company_summary?, interviewer_summary? }, // deep only
  stage_label: string // resolved custom label
}
```

### Context assembly

`lib/ai/context-assembly.ts`:
- Pull `user_profiles` row for resume + background
- Pull `jobs` row for company/role/stage/JD
- Pull all `job_context` rows, group by type
- Resolve stage label from `stage_labels` if customized
- For Deep: kick off research calls in parallel, await before assembly

### Research injection

Research outputs are structured summaries (not raw HTML) with these fields:

- Company: business model, recent news, headcount/funding, product summary, culture signals
- Interviewer: role at company, tenure, focus areas, public signal (talks/posts), likely priorities

Injected into Deep Prep prompt as labeled sections.

### Prep versioning

- Every generation creates a new `prep_versions` row, never overwrites
- Latest version (by `created_at`) is shown by default
- Prep Overlay exposes a minimal "Previous versions" dropdown link in the prep view header
- Old versions retained indefinitely (small storage cost)
- No diffing, no complex history UI

### Regeneration

- "Regenerate" button in prep view
- Reopens Step 1 with current chips
- User adds context, clicks regenerate
- Same flow as initial generation, new `prep_versions` row created

### Failure states

- Model API error → toast "Generation failed, try again," no DB write
- Research provider error → do not silently downgrade. Surface to user with two options: retry research, or continue without research with explicit warning that Deep Prep is running without web context. Never produce weaker Deep Prep silently.
- Rate limit hit → soft message "You've hit a high-volume threshold, please slow down," no error
- Validation failure on output schema → retry once, then surface error

### Abuse and cost protection

- Per-user rate limits enforced server-side before model call
- Cache hits don't count against limits
- Identical job + identical context within 5 min returns cached
- Heavy-regeneration pattern (>5 regens / 10 min on same job) triggers cooldown
- All limits hidden from UI

---

## 7. Prompt Architecture

### System prompt strategy

Single system prompt per tier with strict role definition. Quick Prep system prompt emphasizes "useful sketch, lean on provided context, don't fabricate." Deep Prep system prompt emphasizes "senior interview advisor, ground every answer in resume + research, don't hallucinate interviewer details."

### Input schema for prep generation

Strict JSON input fed to model. Every field labeled. Empty fields explicitly marked as `null` so model knows what's missing.

```ts
type PrepInput = {
  user_resume: string;           // never null after onboarding
  user_background: string | null;
  company: string;
  role: string;
  stage: string;                 // resolved label
  stage_default: string;         // canonical stage key
  jd: string | null;
  latest_message: string | null;
  interviewer: { name?: string; title?: string; link?: string } | null;
  context_items: Array<{ type: string; content: string }>;
  research: {                    // deep only, null for quick
    company: string | null;
    interviewer: string | null;
  } | null;
  tier: "quick" | "deep";
}
```

### Output schema for prep sections

Model must return this exact JSON structure. Validated server-side. Schema includes optional fields that Quick Prep returns null/empty for and Deep Prep populates fully.

```ts
type PrepOutput = {
  // Both tiers
  what_round_is_testing: {
    summary: string;
    criteria: Array<{
      label: string;          // e.g., "Communication", "Process clarity"
      question: string;       // probing question
      score?: number;         // 0-100, Deep only — Quick returns null
    }>;
  };
  how_to_position_yourself: {
    summary: string;
    framing_points: Array<{
      title: string;
      description: string;    // Quick: 2 points truncated. Deep: full set with rich context.
    }>;
  };
  likely_questions: Array<{
    question: string;
    category?: string;        // Deep only: "Background", "Role fit", "Behavioral", etc.
    answer_plan?: string;     // Deep only: structured plan per category
    answer_tip: string;       // Quick: basic tip. Deep: full plan summary.
  }>;
  questions_to_ask: Array<{
    question: string;
    interviewer_type?: string; // Deep only: tailored by interviewer
  }>;
  risks_to_address: Array<{
    risk: string;
    counter?: string;          // Deep only: prepared counter
  }>;
  prep_checklist: string[];

  // Deep only — null/empty for Quick
  resume_to_jd_fit?: {
    strong_matches: string[];
    visible_gaps: string[];
    emphasize: string[];
    avoid_overemphasizing: string[];
  };
  interviewer_insights?: {
    talks_given?: string[];
    writing_themes?: string[];
    panel_style?: string;
    questions_asked_candidates?: string[];
    tailored_positioning: string;
  };
  best_angles: Array<{
    angle: string;
    resume_grounding: string;  // explicit citation to resume item
  }>;
}
```

For Quick Prep, the model returns 3-5 likely questions, 2 positioning points, 2-3 risks. For Deep Prep, the model returns 8-12 total likely questions distributed across relevant categories (not 8 per category), 4+ positioning points, full risks with counters, full resume-to-JD fit, full interviewer insights.

### Quick vs Deep differences

- **Quick:** common questions without category labels, basic answer tips (2-3 sentences), 2 positioning points truncated, light risks (no counters), no resume-to-JD fit, no interviewer insights, no per-category answer plans
- **Deep:** complete questions by 8 categories, full answer plans per category, 4+ rich positioning points, risks with prepared counters, full resume-to-JD fit (matches/gaps/emphasize/avoid), full interviewer insights tailored to provided interviewer, mock-style guidance for practice

The difference is real at the prompt and output schema level, not just UI masking.

### Keeping output bespoke, not generic

- Reject any answer that doesn't reference at least one specific item from resume or context
- System prompt includes explicit anti-pattern examples ("DO NOT say 'research the company.' DO say 'Their Series C announcement last month positions X as a competitor to Y, which connects to your work on Z.'")
- For Deep, require model to cite which research finding informed each major answer

### Grounding answers

- Resume text always present in prompt
- Each context item passed with type label
- Latest message highlighted as most recent signal
- For Deep, research summaries are labeled as "verified facts" vs prep guidance

### Avoiding hallucinated interviewer facts

- If interviewer name provided but research turns up nothing → output explicitly says "interviewer info not verified, treat as generic round"
- Model instructed to never invent interviewer biographical details
- Research provider responses validated for source URLs before injection

---

## 8. Payment and Gating

### Free vs paid feature boundary (concrete)

Quick Prep is not a stripped-down empty version. It is a lightweight version of the same prep concepts. Deep Prep unlocks the complete, personalized, role-specific versions.

**Quick Prep (free) shows:**
- Small set of common questions, no category labels
- Basic answer tips per question
- Simple prep checklist
- Quick company/stage summary in Role Context widget
- Basic interviewer identity if available (name, title, tenure, prior companies)
- Truncated "How to position yourself" — first 2 framing points only
- Light "Risks & Probes" reminders
- Limited "Purpose" sub-criteria (2 of 4)
- Locked preview state on Interviewer Insights with "Unlock with Deep Prep" CTA

**Deep Prep (paid) unlocks:**
- **Complete questions by category** — questions expanded into 8 categories: Background / tell me about yourself, Role fit, Behavioral, Product/design judgment, Leadership/conflict, Weakness/gaps, Company motivation, Questions for them
- **Answer plans by interview type** — guidance per category:
  - Background: strongest 60-second story
  - Role fit: why the user fits this exact job
  - Behavioral: STAR-style story plan
  - Product/design judgment: how to frame tradeoffs, process, taste, decisions
  - Leadership/conflict: stories that show seniority and influence
  - Weakness/gaps: safe counters for likely concerns
  - Company motivation: why this company without sounding generic
  - Questions for them: sharper questions by interviewer type
- **Resume-to-JD fit** — concrete mapping with strong matches, visible gaps, what to emphasize, what to avoid overemphasizing
- **Interviewer prep** — full interviewer-specific insights (talks given, writing themes, panel style, questions asked of candidates), tailored positioning per interviewer
- **Likely concerns + counters** — full risks section with prepared responses
- **Stronger prep checklist** — category-aware checklist beyond the basic Quick version
- Full "Purpose" criteria with all sub-criteria scored
- Full "Positioning" framing points with rich context
- All hidden upsell cards removed from UI

### UI gating rule

If the user is on Quick Prep, do not show the full Deep Prep experience for free. Visually the UI looks premium, but content is gated, shortened, or shown as locked preview. Specifically:

- Interviewer Insights section: locked preview with CTA, no actual insights
- "How to position yourself": truncated to first 2 points, "See full plan" → upgrade
- "Where she'll push": light reminders only, full counters locked
- Questions widget: common questions only, no category labels, no per-category answer plans

### Backend enforcement

- `/api/prep/generate` checks `user_profiles.subscription_status` when `tier === "deep"`
- Free users can still call `/api/prep/generate?tier=quick` unlimited (with fair-use rate limits)
- Webhook updates status on subscription events (created, updated, deleted, payment_failed)
- Grace period: 3 days past `subscription_period_end` before downgrade
- Stripe webhook signature verification required

### Prompt-side gating

Quick Prep prompt instructs model to:
- Generate fewer items per section
- Use shorter, more general guidance
- Skip category labels on questions
- Skip per-category answer plans
- Skip resume-to-JD gap analysis
- Skip interviewer-specific tailoring beyond basic identity

Deep Prep prompt instructs model to:
- Generate full structured output across all categories
- Provide answer plans per question category
- Include resume-to-JD fit mapping
- Tailor positioning to specific interviewer if research available
- Surface likely concerns with prepared counters

This ensures the gating is real at the model output level, not just a UI mask.

### Pricing

- **Free** — Quick Prep unlimited (fair-use), GPT-5.4 nano, no web research, no Interviewer Insights
- **Paid** — $19.99/mo, Deep Prep unlimited (fair-use), Claude Sonnet 4.6, web research, Interviewer Insights unlocked, all Deep Prep features above
- Single tier above free
- "Unlimited" is user-facing copy. Backend implements fair-use protection, caching, rate limits, abuse detection. Limits hidden from UI.

### Upsell copy lock

**Use these exact strings:**
- H1: "Deep Prep"
- H2: "Quick Prep gets you ready. Deep Prep gives you the plan."
- Button: "Upgrade to Deep Prep"
- Secondary link: "Compare Quick vs Deep"

**Banned copy:**
- "Deep Prep upgrades everything"
- "Company-specific angles"
- "Role-specific positioning"
- "Experience mapping"

---

## 9. Migration Strategy from V1

### Branch strategy

- Tag current `main` as `v1-archive`
- Create `v2-pivot` branch from `main`
- Phase 0 audit and Phase 1 schema reset happen on `v2-pivot`
- Merge to `main` only after Phase 5 (Quick Prep working end-to-end)
- Old `main` (V1) takes deployment offline during transition

### Schema reset approach

1. Snapshot V1 Supabase project (export to local SQL dump for archive)
2. Drop all V1 tables in single migration
3. Apply V2 schema migration
4. Regenerate TypeScript types
5. No data migration (private beta, minimal users)

### What to drop

- All V1 tables
- All V1 routes (Gmail-related)
- All V1 components tied to email UI
- Google OAuth env vars from Vercel

### What to keep temporarily

- Layout shell and design tokens
- Tailwind config
- Supabase client setup
- Stripe scaffolding if any
- Reusable primitives (button, input, modal base)

### Rollback plan

- `v1-archive` tag preserves V1 codebase
- V1 Supabase SQL dump preserves V1 data
- Vercel preview URLs allow side-by-side comparison
- DNS swap can revert if V2 has critical bug post-launch

### Environment variable changes

Remove:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GMAIL_*` anything

Add:
- `ANTHROPIC_API_KEY` (Deep Prep)
- `OPENAI_API_KEY` (already present, Quick Prep)
- `PERPLEXITY_API_KEY` (or alternative web research provider)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- Confirm Supabase service role key still valid

---

## 10. Phased Implementation Plan

### Phase 0 — Audit (4-6 hours)

Output: `docs/guildy-v2-audit.md` + `v2-pivot` branch + `.guildhall/quests.json` scaffold

Acceptance:
- Audit doc lists all V1 files with keep/delete classification
- All Gmail/OAuth routes inventoried
- Risk areas flagged
- No code changes yet

### Phase 1 — Schema, auth reset, Stripe skeleton (5-7 hours)

Output: V1 schema dropped, V2 schema applied, magic link auth working, Stripe product + webhook plumbing in place

Acceptance:
- `npx supabase db reset` produces V2 schema
- Magic link login works end-to-end
- Onboarding gate redirects users without usable resume text to `/onboarding`
- Resume PDF upload + text extraction (or paste fallback) works
- Old Google OAuth code fully removed
- Stripe $19.99/mo product/price created
- `/api/stripe/webhook` endpoint exists with signature verification
- Webhook updates `user_profiles.subscription_status` correctly (test with Stripe CLI)
- No paywall UI yet — full gating wired in Phase 6

### Phase 2 — Home shell (6-8 hours)

Output: Home page with empty Kanban + empty passive table + search

Acceptance:
- `/app` renders Home for authed users
- 7 stage columns visible with default labels
- Passive table renders with 4 columns
- Search input present (functionality stubbed in Phase 3)
- Mobile responsive: Kanban horizontal scrolls, passive table compresses

### Phase 3 — Job CRUD + activation + stage movement (8-10 hours)

Output: full job lifecycle works

Acceptance:
- Add Job modal with 3 intake methods
- New jobs appear in passive table
- "They Responded" flow moves job to active Kanban at Screen
- Drag/drop between Kanban columns works
- Left/right arrows on cards work
- Stage label editing works
- Search returns results across passive + active by company/role/context

### Phase 4 — Prep Overlay shell (6-8 hours)

Output: overlay opens, Step 1 checklist works, Step 2 paywall screen renders, no AI generation yet

Acceptance:
- Click on active card opens Prep Overlay over blurred pipeline
- Floating widget composition (not monolithic modal)
- Input Checklist shows filled chips for existing context
- Add/Edit/Skip context items works
- Step 2 renders comparison matrix + static Deep Prep example
- Generate buttons present but stub (Phase 5/6)
- Mobile: overlay goes full-screen takeover

### Phase 5 — Quick Prep generation (6-8 hours)

Output: Quick Prep works end-to-end

Acceptance:
- Click "Generate Quick Prep" calls `/api/prep/generate`
- Context assembly pulls user + job + context items
- GPT-5.4 nano call produces structured output
- Output validated against schema
- Persisted as `prep_versions` row
- Rendered in overlay with hotlinks nav
- Regeneration works
- Cache hit returns instantly on identical input
- Rate limits enforced server-side

### Phase 6 — Deep Prep + research + paywall gating (8-10 hours)

Output: Deep Prep works, paid users can access, free users hit paywall

Acceptance:
- Stripe checkout flow connected (skeleton from Phase 1 reused)
- "Generate Deep Prep" gated by subscription
- Web research provider integrated (Perplexity)
- Company research cached per company, 7-day TTL
- Interviewer research cached per name+company
- Claude Sonnet 4.6 generates with research-enriched context
- Research failure surfaces retry/continue choice (no silent downgrade)
- Interviewer Profile widget unlocked for paid users
- Free users see locked state with upgrade CTA

### Phase 7 — Polish, mobile, fair-use (6-8 hours)

Output: production-ready beta

Acceptance:
- Empty states for all surfaces
- Loading states during AI generation (with progress feedback)
- Error states surface gracefully
- Mobile fully tested across Kanban, overlay, paywall
- Fair-use rate limits implemented and tested
- Onboarding flow polished
- Account/settings page works
- Subscription cancellation flow works

### Phase 8 — Ship (open-ended)

Final QA, copy pass, launch.

---

## 11. Risks and Open Decisions

### Locked: Deep Prep web research provider

Perplexity API as V0 provider, abstracted behind `lib/ai/research.ts`. Swap remains easy if needed.

### Risk: Supabase paused/restored state

V1 Supabase project may be paused. Audit must confirm restoration before Phase 1. If restoration loses data, no V2 issue (we drop V1 schema anyway), but downtime affects V1 archive.

### Risk: Auth transition

Magic link is simpler than OAuth but some users may not check email reliably. Acceptable for V2 beta. If conversion suffers post-launch, evaluate adding Google sign-in (without Gmail scopes).

### Risk: LLM cost abuse

Mitigated by caching, rate limits, and abuse detection. Worst-case single user: ~$5-8/month if hammering Deep Prep. With $19.99 revenue, still margin-positive but watch monthly logs.

### Risk: Preserving V1 code

Phase 0 audit must be aggressive about deletion. Bias toward "delete and rebuild" over "preserve and refactor" for anything ambiguous. V2 is materially different product; carrying V1 logic forward will create confusion.

### Resolved: Stripe timing

Stripe product/price and webhook skeleton now set up in Phase 1, not Phase 6. Subscription state plumbing in place when AI gating is built.

### Risk: Model API availability

GPT-5.4 nano and Claude Sonnet 4.6 must be confirmed available at build time. If either changes, model routing layer makes swap straightforward, but prompt tuning may need adjustment.

### Risk: Responsive overlay complexity

Floating widget composition is harder to make responsive than a simple modal. Mobile fallback to full-screen takeover simplifies this, but desktop widget layout needs design iteration. Build full-screen mobile first, layer widget composition on desktop.

---

## 12. Anti-Drift Checklist

### Things CC CLI must not build

- Anything reading or writing email
- Anything related to Google OAuth scopes beyond basic auth (and we're not even using Google auth)
- Auto stage detection of any kind
- Comparison matrix or decision memo features
- Offer / negotiation module
- XP, pal, quest, achievement systems
- Calendar integration or interview date capture
- Chrome extension
- Native mobile app code
- Multi-user or team features
- Tabbed job detail page
- Gantt or timeline views

### Things CC CLI must verify before coding

- Read `guildy-v2-spec-final.md` and `phase-0-resolutions.md` at start of every phase
- Read `docs/guildy-v2-audit.md` after Phase 0 completes
- Confirm `.guildhall/quests.json` exists and update at end of phase
- Confirm current branch is `v2-pivot`, not `main`

### Things CC CLI must ask before changing

- Any deviation from the locked product spec
- Any addition of new tables beyond the V2 schema
- Any new API route not in the architecture section
- Any new dependency not on the approved list
- Any change to Quick Prep / Deep Prep model routing
- Any change to pricing or paywall behavior

---

## Resolved Blockers

1. **Web research provider:** Perplexity API approved as V0, behind `lib/ai/research.ts` abstraction.
2. **V1 user data:** No real data worth preserving (private beta). Export full SQL backup before drop as safety net.
3. **Stripe state:** If V1 Stripe is unused/test only, create fresh V2 product and price. If real customers exist, stop and review with Michael.
4. **Onboarding hard gate:** Confirmed. Prep generation requires usable `resume_text`. PDF upload alone is insufficient — text must extract or be pasted.

All blockers resolved. Phase 0 ready to run.

---

## Recommendation

**Greenlight Phase 0.** All blockers resolved.

Phase 0 produces no production code. It produces an audit doc and a `.guildhall/quests.json` scaffold. Low risk, high signal.

Next step: Phase 0 prompt for CC CLI. Do not generate later phase prompts yet — Phase 1 plan adjusts based on actual repo state revealed by audit.

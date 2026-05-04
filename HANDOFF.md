# Guildy V2 — Handoff State

> ANY new Claude chat reads THIS file first. After every phase ships, /phase-done updates sections marked [LIVE].

## North Star

Guildy creates massive value for one thing: **getting users hired**. Every decision filters through that lens. If a feature doesn't make a user more likely to nail their next interview round, it doesn't ship.

## North Star Metrics

- **NSM 1: Jobs tracked per user.** More jobs = more pipeline = more value. Activation = adding 3+ jobs.
- **NSM 2: Final-round interviews reached per user.** This is where prep matters most. Conversion from Applied → Full Loop → Offer is the funnel that makes Guildy worth $19.99/mo.
- Secondary: Deep Prep generations per Full Loop job (signal that prep gets used at the moment of truth).
- Anti-metric: Quick-only users who never touch Deep. Means the upgrade story is broken.

## Design principles (do not compromise)

1. **Prep > tracking.** The board is the wrapper. The prep is the product.
2. **Stage-aware everything.** Screen prep ≠ Hiring Manager prep ≠ Full Loop prep. Generic prep is failure.
3. **Floating widget overlay is sacred.** Not a modal. Not a drawer. Not a full-page route. Three-column floating overlay that lets the board breathe behind it.
4. **Direct, terse, no fluff.** UI copy, prep copy, error copy. Michael's voice across every surface.
5. **Light, editorial, professional.** Clean, restrained, treated like a serious tool for a serious moment. Not consumer-app cute, not bro-y, not gamified. Calm surface so the prep content feels confident and trustworthy.
6. **AI is the primary actor.** User pastes context, Guildy generates value. Manual data entry is the unlock, not the work.
7. **Reversible by default.** Drag/drop, regenerate, undo. Nothing destructive without explicit confirm.

## Current state [LIVE]

- Branch: v2-pivot
- Last phase shipped: **Phase 4c-4** — Overlay layout v2: InputsWidget inline-expand (popover killed), QuestionsWidget moved to center as inline modules, UpgradeWidget restored bottom-left FE-only with spec-locked copy + Compare drawer (Radix Dialog), tier-aware center modules with locked-preview pattern, compact center top row
- Date: 2026-05-04
- Project status: ready for Phase 4d (multi-session Full Loop)

## Locked models [LIVE]

- `QUICK_PREP_MODEL = "claude-haiku-4-5-20251001"` — wired, exported from `lib/ai/models.ts`, written to `prep_versions.model_used` for tier=quick
- `DEEP_PREP_MODEL = "claude-sonnet-4-6"` — wired, exported from `lib/ai/models.ts`, written to `prep_versions.model_used` for tier=deep
- `extract-jd.ts` = gpt-4o-mini (separate path, stays OpenAI)

## What's left to V2.0 launch [LIVE]

Total realistic: ~32-41 hours, ~4-5 focused build sessions.

### Phase 4d — Multi-session Full Loop, Option C+ (~3-4h) — NEXT
- Each session = its own prep generation = its own prep_versions row
- context_hash includes session name
- Full-attention LLM call per session (not nested array in one call)
- 4 default sessions: Hiring Manager, Cross-functional, Skills/Portfolio, Bar Raiser
- LLM picks plausible names from JD/company context
- No schema change

### Phase 4c-4 — DONE
- Overlay layout v2: InputsWidget grows inline (no popover); right column is just InputsWidget; QuestionsTheyAsk + QuestionsYouAsk render as full-width center modules.
- UpgradeWidget restored from git, bottom-left of overlay, visible only when tier=quick. Spec-locked copy (H1 "Deep Prep" / H2 "Quick Prep gets you ready. Deep Prep gives you the plan." / button "Upgrade to Deep Prep" / secondary "Compare Quick vs Deep"). Upgrade click logs `"upgrade clicked, paywall ships in 6b"`. CompareTiersDrawer uses existing Radix Dialog primitive with the spec section 6 comparison matrix.
- Tier-aware center module visibility: Quick view truncates positioning to first 2 frames + LockedPreviewModule teaser, hides Risk counters (Quick prep produces null counters, Deep gets real ones), hides per-question answer plans + categories on questions_they_ask, intermixes 4 LockedPreviewModule cards (full positioning, risk counters, per-category answer plans, resume-to-JD fit). Deep view unlocks everything; ResumeJdFit lives only as a Quick locked preview (resume-to-JD analysis is woven into Positioning + Risks via the prompt per 4c-2 Option C).
- Compact center top: single row with stage heading, tier toggle, and Regenerate icon button (hidden until prep is ready).
- Cross-column trigger renamed: `openPopover` → `expandInputsSection`. InterviewerWidget click still pulses InputsWidget border (600ms) and opens the interviewer section.
- New components: `locked-preview-module.tsx`, `compare-tiers-drawer.tsx`. No prompt or model changes; no schema changes; no new server actions.
- Banned-copy grep gate run before commit (passes — none of "Deep Prep upgrades everything", "Company-specific angles", "Role-specific positioning", "Experience mapping" appear in any new/changed component).

### Phase 4c-3 — DONE
- Inputs widget: 5 rows (Background, JD, Latest Message, Interviewer, Additional context). Count "N/5" with "Deep is sharper with all 5" subtext. Each filled row shows a 50-char preview. Clicking a row opens the popover at that section. Hint chip "Deep" on Interviewer + Additional context.
- Add Context popover: 360px wide, accordion-style with 4 sections (JD, Latest message, Interviewer 3-fields, Additional context). Each section has Save + Clear. Edit pre-fills from current server state. Pulses when triggered from across columns.
- InterviewerWidget: display-only (name + title + LinkedIn-style link chip). Click anywhere → opens popover at interviewer section with cross-column pulse highlight.
- Tier-aware gating: Generate Deep button disabled when `jobs.jd_text` empty, native `title` tooltip "Paste the JD to generate Deep Prep". Quick stays enabled whenever resume present.
- Server actions renamed for consistency: `setLatestMessageAction` → `updateJobLatestMessageAction` (now accepts null for clear); `setInterviewerAction` → `upsertInterviewerAction` (extended to name/title/link, at least one required). New: `updateJobJdAction`, `clearInterviewerAction`, `upsertNoteAction`, `clearNoteAction`. All revalidate `/app`.
- generatePrepAction: server-side Deep guard (returns error if tier=deep + jd_text empty). `context_hash` now includes resume_text, note content, and tier. Fetches note row + full interviewer metadata (name/title/link) and passes all to generatePrep.
- PrepInput extended with `interviewer_title`, `interviewer_link`, `note_text`. `buildUserPrompt` renders an [INTERVIEWER] block (name/title/link) and an [ADDITIONAL CONTEXT] block.
- No schema migrations. job_context already supports type='note' in the CHECK constraint; first use of that type. Existing prep_versions rows become cache misses on next generate (acceptable).

### Phase 4c-2 — DONE
- Quick → Haiku 4.5, Deep → Sonnet 4.6, both via Anthropic tool use with ephemeral prompt caching on system message
- `lib/ai/models.ts` is the single source of truth for model strings
- `getCachedPrepAction` + `generatePrepAction` accept `tier` and route accordingly; `model_used` written from constants
- Paywall removed: UpgradeWidget deleted, DeepPrepPaywall deleted, Lock icon dropped, tier-aware EmptyState/LoadingSkeleton/CTA copy
- InterviewerWidget renders `interviewer_insights` when tier=deep + present
- QuestionsWidget renders expandable `answer_plan` per Deep question (collapsed by default)
- Phase 6b marker comment lives in `generatePrepAction` for the future subscription gate

### Phase 5 — Perplexity research for Deep Prep (~5-7h)
- Company research cached per company, 7-day TTL
- Interviewer research cached per (interviewer_name, company), no expiry
- `lib/ai/research.ts` module
- Failure surfaces retry/continue, never silent downgrade

### Phase 6 — Polish (~5-6h)
- FTUE empty state ("Add 3 jobs to unlock your pipeline")
- Mobile responsive: overlay becomes full-screen takeover
- Error states with clear retry paths
- Loading states with progress feedback (not just spinners)

### Phase 6.5 — Pre-launch infrastructure (~6h)
- Legal: ToS + Privacy Policy via Termly (templated, ~1h)
- Resend transactional email (receipts, magic link improvements, ~2h)
- PostHog analytics (track NSM 1 + NSM 2, ~1h)
- End-to-end QA pass on 10 real jobs (~2h)

### Phase 6b — Stripe + paywall (~8-12h)
- Stripe checkout session
- Webhook handler: subscription.created, updated, deleted, invoice.payment_failed
- Subscription state in user_profiles
- Paywall gate on tier='deep' API call
- Customer portal for cancellation
- Grace period on payment failure
- Test via Stripe CLI before deploy
- $19.99/mo single tier

### Phase 7 — Production deploy (~3h)
- guildy.ai DNS to Vercel
- SSL via Vercel
- Production env vars (refer to .env.example for list — never list values here)
- Production smoke test
- Banned-copy audit (no "AI-powered" cliches)

## Deferred to V2.1 post-launch

- Fair-use rate limits (no users = no abusers)
- Hotlinks nav inside overlay
- Prep history viewer
- FTUE iteration based on real user data
- Per-session interviewer storage (currently one main interviewer per job)
- Mobile native app

## Don't rebuild (kill list)

Gmail/OAuth, auto-stage detection, comparison matrix, negotiation module, XP/pal, Gantt, Chrome extension, native mobile, multi-interviewer panels.

## Process — how phases run

1. New Claude chat reads THIS file first, then `git log --oneline -10` for recent commits.
2. Confirms current state with user (1 sentence). Does not re-explain context already in this file.
3. Drafts scope-check for next phase. Includes:
   - Goal in 1 sentence
   - Files touched (CC CLI confirms via repo search)
   - Files NOT touched
   - Acceptance criteria (testable)
   - Out of scope (explicit list)
   - Risks
4. User reviews scope-check, pushes back if drift, approves with /go.
5. CC CLI implements, commits, pushes.
6. User smoke-tests in browser.
7. User invokes /phase-done with phase name, summary, and any new blockers.
8. CC CLI updates [LIVE] sections, commits HANDOFF.md alongside if not already done, pushes.

## Prompt engineering principles for CC CLI

- /phase-start for new phases (drafts scope-check)
- /scope-check for tight bug patches
- /phase-done after phase ships and is smoke-tested
- ALWAYS confirm scope before code (CC CLI auto-shipped twice in early sessions — bad)
- File paths described as responsibilities ("the prep canvas component"), not hardcoded paths (CC CLI's repo search finds them)
- /clear between phases to drop context noise
- Don't bundle phases — one phase per CC CLI session, ideally
- Push back when CC CLI drifts ("we already shipped that," "that's deferred to V2.1")
- Models locked — do not let CC CLI re-verify or "helpfully" suggest alternatives

## Schema gotchas (CC CLI got these wrong before)

- prep_versions columns: id, job_id, user_id, tier, model_used, context_hash, output, created_at. NO stage column (lives in output jsonb). NO content column (it's output). model_used NOT NULL.
- Cache lookup: latest row by created_at desc for (job_id, tier). Versions persist, never overwrite.
- job_context table: type='interviewer' rows, ONE per job (delete-then-insert upsert).
- jobs.latest_message is a text column on jobs table.

## Communication preferences (Michael)

- Direct, terse, no hedging
- No em dashes
- One question per turn maximum
- Push back when wrong
- ~15 years product design experience — skip basics
- No mocks/PPTs/visuals — consumes context budget

## Security

- HANDOFF.md is committed to git and visible in the repo. NEVER write secrets, API keys, env values, customer data, resume text, or any sensitive content here.
- Reference env vars by name only (e.g., "ANTHROPIC_API_KEY needed in .env.local"). Never include values.

## Open questions / blockers [LIVE]

- None right now. Phase 4d ready to ship.

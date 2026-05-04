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
- Last phase shipped: **Phase 4c bugfix patch 2** — skeleton flash, backdrop click, ESC focus ring fixes
- Date: 2026-05-03
- Project status: ready for Phase 4c-2 (Anthropic migration + paywall removal)

## Locked models [LIVE]

- `QUICK_PREP_MODEL = "claude-haiku-4-5-20251001"` (NOT YET WIRED — currently gpt-4o-mini in code, migrates in Phase 4c-2)
- `DEEP_PREP_MODEL = "claude-sonnet-4-6"` (NOT YET WIRED — currently paywall shell, generates real prep in Phase 4c-2)
- `extract-jd.ts` = gpt-4o-mini (separate path, stays OpenAI for now)

## What's left to V2.0 launch [LIVE]

Total realistic: ~32-41 hours, ~4-5 focused build sessions.

### Phase 4c-2 — Anthropic migration + paywall removal (~2-3h) — NEXT
- Quick: gpt-4o-mini → Haiku 4.5
- Deep: paywall shell → real Sonnet 4.6
- No paywall surfaces during test mode (both tiers free + functional)
- extract-jd.ts unchanged
- Single Anthropic SDK alongside existing OpenAI SDK

### Phase 4d — Multi-session Full Loop, Option C+ (~3-4h)
- Each session = its own prep generation = its own prep_versions row
- context_hash includes session name
- Full-attention LLM call per session (not nested array in one call)
- 4 default sessions: Hiring Manager, Cross-functional, Skills/Portfolio, Bar Raiser
- LLM picks plausible names from JD/company context
- No schema change

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

- None right now. Phase 4c-2 ready to ship.

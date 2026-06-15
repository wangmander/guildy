# Guildy V2

Job pipeline tracker with AI interview prep. Pivoting from V1 (Gmail-scraping) to V2 (manual + Prep Overlay).

## Source of truth

Always read these before starting work:

- @docs/guildy-v2-spec-final.md — locked product spec
- @docs/phase-0-resolutions.md — scope locks, kill list, open tech decisions
- @docs/guildy-v2-tech-spec-v0.md — architecture, data model, phasing
- @docs/guildy-v2-audit.md — Phase 0 audit, keep/delete/rebuild classifications
- @.guildhall/quests.json — current phase progress

## Stack

Next.js 14 App Router, TypeScript, Tailwind, Supabase (Postgres + Auth + Storage), Vercel. Domain: guildy.ai.

- Auth: Supabase magic link (no Google OAuth)
- Models: Claude Haiku 4.5 (claude-haiku-4-5-20251001) for Quick Prep, Claude Sonnet 4.6 (claude-sonnet-4-6) for Deep Prep. extract-jd.ts uses gpt-4o-mini (separate concern, stays OpenAI for now).
- Web research: Perplexity API behind lib/ai/research.ts
- Payments: Stripe, $19.99/mo single tier

## Hard scope locks (do not rebuild)

See @docs/phase-0-resolutions.md for the full kill list. Top-level summary:

- No Gmail OAuth, no Gmail scraping, no email automation
- No auto stage detection
- No comparison matrix across jobs
- No offer/negotiation module (deferred to V2.1)
- No XP, pal, or gamification
- No Gantt view, no Chrome extension, no native mobile app

If something on the kill list shows up in a request, flag it before implementing.

## Phase status

Track progress in .guildhall/quests.json. Update at end of each phase. Current phase scope and acceptance criteria live in the tech spec.

## Branch convention

- main — V1 archive (do not touch)
- v2-pivot — active V2 work
- v1-archive — git tag pointing at V1 final state

## Workflow

1. Use Plan Mode for any phase or significant feature (Shift+Tab)
2. Read source docs before coding
3. Confirm scope before implementing
4. Update quest manifest at phase completion
5. /clear between phases to reset context

## Locked phase roadmap to V2.0 launch

Order is locked. Do not reorder, do not skip, do not "helpfully" combine phases.

1. Phase 4c-2 — Anthropic migration (Quick→Haiku 4.5, Deep→Sonnet 4.6, generate-prep.ts only) + paywall removal. extract-jd.ts stays OpenAI. ~2-3h. ✓ shipped at 0e6ecfa
2. Phase 4c-3 — Complete context inputs (editable + updatable) + tier-aware Deep gate. ✓ shipped at fea3f3c
3. Phase 4c-4 — Overlay layout v2 + tier differentiation + upsell restoration. ✓ closed at 43f651e (patches 1-9 rolled in; full detail in HANDOFF.md "Phase 4c shipped — archive"). Patch 10 (post-close): Background editable inline from InputsWidget at f6f1b11. Patch 12 (post-close, bundles patch 11): operating contract preamble in HANDOFF + new guildy-narrative.md anchor + UpgradeWidget gradient flip + inline Upgrade chip in tier selector at c2eb4b4
4. Phase 4d — Multi-session Full Loop, Option C+ (per-session generations, own prep_versions row, context_hash includes session name). No schema change. ~3-4h — NEXT
5. Phase 5 — Perplexity web research for Deep Prep, cached per company 7d TTL, per interviewer name+company. ~5-7h
6. Phase 6 — Polish + mobile responsive overlay + FTUE empty state + error states + loading states. ~5-6h
7. Phase 6.5 — Legal (ToS/PP via Termly) + Resend transactional email + PostHog analytics + end-to-end QA on 10 real jobs. ~6h
8. Phase 6b — Stripe checkout + webhook + subscription state + customer portal + grace period. ~8-12h
9. Phase 7 — Production deploy, guildy.ai DNS, SSL, Vercel env vars, prod smoke test. ~3h

Total: 32-41 hours, ~4-5 focused build sessions.

Models locked:
- QUICK_PREP_MODEL = "claude-haiku-4-5-20251001"
- DEEP_PREP_MODEL = "claude-sonnet-4-6"
- NEGOTIATION_PREP_MODEL = "claude-opus-4-8" (V2.1 Feature 4, Negotiation Prep; no fallback)
- extract-jd.ts = gpt-4o-mini (stays)

V2.1 Command Center (on v2-pivot): F1 left rail (Stats/Job Source Advisor/Today), F2 Today panel, F3 TC Comparison matrix. The matrix was REBUILT into a normalized 1-10 rated comparison (comp dims base/bonus/equity auto-rate relative to the offers on the table, soft dims user-rate 1-10, user-weighted overall picks a winner; year-1 total kept as the one dollar figure, COL-adjusted and steady-state removed from the view but kept in `normalize.ts`/`colSeed.ts`). Registry `lib/compMatrix/dimensions.ts`, scoring `lib/compMatrix/scoring.ts`. The matrix lives in a persistent bottom strip that raises a full-width sheet (`tc-matrix-sheet.tsx`). New columns (apply via Supabase SQL editor, prod cannot take db push): `job_compensation.ratings jsonb` and `user_profiles.comp_priorities jsonb`.

F4 Negotiation Prep is FINALIZED (branches off the rated matrix; reached via the comp sheet's per-offer Negotiate buttons). COL and steady-state are stripped from the entire F4 path; the panel and the model anchor on year-1 total only (walk-away math reads `normalize.ts` outputs, never the model). Company patterns degrade honestly when grounding is thin (no fabricated specifics). `NEGOTIATION_PREP_MODEL = "claude-opus-4-8"` (no fallback, written to `model_used`), gated on the existing $19.99 subscription, no $49.99 Ultra tier. App `maxDuration` is 300. Its migration `negotiation_preps` is PENDING MANUAL PROD APPLICATION via the Supabase SQL editor (prod cannot take a db push); the table must be applied before F4 traffic.

Deferred to V2.1 post-launch:
- Hotlinks nav
- Prep history viewer
- FTUE iteration on real user data
- URL JD extraction (LinkedIn auth wall, Greenhouse/Lever JS-rendering — needs different strategy)
- Streaming Deep generation (modules render progressively as Sonnet emits)

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
- Models: GPT-5.4 nano for Quick Prep, Claude Sonnet 4.6 for Deep Prep
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

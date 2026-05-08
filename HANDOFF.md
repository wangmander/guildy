# Operating Contract for Claude

This file is the source of truth. Read it fully before responding.

You are a cofounder-level product strategist, AI systems architect, and prompt engineer for Guildy V2. Not a passive assistant.

## Stance
- Direct, terse, no hedging, no em dashes.
- Push back when the user is wrong. Don't drift from locked spec to be agreeable.
- One question per turn maximum.
- Skip basics. Michael has 15 years product design experience.
- No mocks, PPTs, slides, or visual artifacts (consumes context budget).

## Decision rules
- Recommend the strongest path, not a neutral menu.
- Cut scope aggressively. Favor revenue path over polish.
- Acceptance criteria are testable, not aspirational.
- Phase verification means: build runs, target flow works end-to-end, no regressions, acceptance criteria met. Not "smoke test" or market validation.
- "Done" means working in browser, committed, pushed, HANDOFF.md updated. Not "TypeScript clean."

## Prompt engineering rules
- CC CLI prompts must include: read-first list, goal in 1 sentence, files to modify, files NOT to modify, acceptance criteria, out-of-scope list, risks. Wait for scope confirmation before go.
- Bake HANDOFF.md and CLAUDE.md updates into every patch's scope. Don't leave them as separate commits.

## Anti-drift rules
- If a patch hits 2-3 iterations without verifying clean, stop patching. Diagnose first. Add real diagnostic logging if needed. Look at actual data before writing the next fix.
- "Should fix it" hypotheses without diagnostic data have failed twice on this project. Don't repeat the pattern.
- If a chat is 6+ patches deep on one phase, hand off to fresh chat at the next clean phase boundary.

## Pressure-test every recommendation
- Does this move closer to revenue?
- Does this break a locked spec decision? (Check the kill list and locked decisions below.)
- Is this scope creep dressed up as "while we're in here"?
- Will a real paying user notice if we skip this?
- Should this be a follow-up patch instead of bundled?

## Phase done procedure

After every phase ships, `/phase-done` updates sections marked [LIVE].

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
- Last phase shipped: **Phase 6.5 at `<commit-hash>`** — Termly legal pages + PostHog 3 events + V2.1 Ultra tier note. Phase 5 (Anthropic web_search grounding) and patch series 5.1/5.3/5.4 shipped earlier in this branch. Detail for every shipped phase lives in the archive section below.

  Prior shipped: Phase 5 at `9d1f26c` (patch 5.1 at `2801a59`, patch 5.3 at `b29f038`, patch 5.4 at `18acb73`) — Anthropic `web_search_20250305` server-tool wired inline into Deep Prep generation. Hard MUST directive in a separate cached system block forces Sonnet to ground company-specific positioning and risks before emitting `submit_prep`. Quick path byte-identical. Phase 4e (kanban polish), Phase 4f (multi-session config), and Phase 4d (multi-session core) shipped earlier in this branch. Detail for every shipped phase lives in the archive section below.
- Date: 2026-05-07
- Project status: ready for Phase 6.5 (Termly + 3 PostHog events + 3-job smoke)

## Locked models [LIVE]

- `QUICK_PREP_MODEL = "claude-haiku-4-5-20251001"` — wired, exported from `lib/ai/models.ts`, written to `prep_versions.model_used` for tier=quick
- `DEEP_PREP_MODEL = "claude-sonnet-4-6"` — wired, exported from `lib/ai/models.ts`, written to `prep_versions.model_used` for tier=deep
- `extract-jd.ts` = gpt-4o-mini (separate path, stays OpenAI)

## What's left to V2.0 launch [LIVE]

V2.0 P0 LAUNCH SPRINT — locked scope, target Monday May 11. ~10 prompts, ~12-15h.

### Phase 6b — Stripe + paywall (Sat-Sun) — NEXT
IN: Stripe Checkout (hosted page, NOT custom UI). Webhooks for subscription.created, subscription.updated, subscription.deleted, payment_failed. Paywall logic gating tier=deep features. Stripe-hosted customer portal link (NOT custom UI). Single tier $19.99/mo. Basic grace period via Stripe Smart Retries default behavior.
OUT: Custom checkout UI. Custom customer portal UI. Complex grace period (multi-stage retry, dunning, win-back).
Estimate: 4 prompts, 6-8h.

### Phase 7 — Production deploy (Sunday late)
IN: guildy.ai DNS + SSL via Vercel. Production env vars (Anthropic, Supabase, Stripe live keys, PostHog). Banned-copy audit final pass. Smoke on 3 jobs in prod.
Estimate: 1-2 prompts, 2h.

### Phase 6 (general polish) — KILLED
Critical-path errors fold into Phase 6b as they surface during build.

## V2.1 backlog [POST-LAUNCH]

Priority order:

1. Mobile responsive (kanban horizontal scroll, prep overlay layout for small viewports)
2. FTUE walkthrough (empty state guidance, post-create cues, first-job tour)
3. Resend transactional email setup + welcome email
4. Drip lifecycle campaigns (day 1 / day 3 / day 7)
5. Interviewer profile grounding in Deep Prep
6. Gemini 2.5 research abstraction + lib/ai/research.ts
7. Custom Stripe customer portal UI
8. Per-user cost guardrails on AI spend (monthly cap)
8a. Server-side in-flight lock on Deep generation (rapid Try Again clicks can currently fire duplicate Sonnet calls; UI lock from patch 5.1 mitigates only within the loading window — patch 5.4 known gap)
8b. Ultra tier ($49.99/mo): Opus 4.7 max-quality generation + Concierge Interviewer Intel feature — multi-source interviewer research (LinkedIn, X, Substack, podcasts, GitHub, conference talks) producing a rapport-building brief per interviewer per round. Hyper-whale tier. Margins are wide because Concierge research is bounded (one brief per round, not per session); defensible because no other prep tool is doing it at this depth.
9. Full PostHog funnel and cohort analysis
10. Comprehensive error states across every action
11. Progress feedback polish on long operations
12. 10-job QA pass with edge cases (international comp, multiple offers, withdrawn jobs)

## Phase 4c–6.5 shipped — archive

### Phase 6.5 — DONE (Termly + PostHog 3 events + V2.1 Ultra tier note)
- `lib/analytics.ts` (NEW): server-side PostHog capture via fetch to the public capture endpoint. Three exported helpers — `trackSignupCompleted(userId)`, `trackFirstPrepGenerated(userId, jobId, tier, modelUsed)`, `trackSubscriptionPaid(userId, tier)` (stub for Phase 6b's Stripe webhook). All no-op when `NEXT_PUBLIC_POSTHOG_KEY` is unset; capture errors swallowed via try/catch so analytics never block the user flow.
- `components/posthog-provider.tsx` (NEW): client-only provider initialized in `useEffect`. Calls `posthog.init` with `capture_pageview: true` and `person_profiles: "identified_only"`. No-ops gracefully when env vars are missing. Wraps children straight through (no actual context provider — `posthog-js` is global).
- `app/layout.tsx`: imports `PostHogProvider` and wraps `{children}` in the body. RootLayout stays a server component; only the provider is client.
- `app/onboarding/actions.ts` `completeOnboardingAction`: fires `signup_completed` after the resume gate passes, before redirect to `/app`.
- `app/app/actions.ts` `generatePrepAction`: after a successful `prep_versions` insert, count rows by user_id; if `count === 1` (the user's very first prep), fires `first_prep_generated` with `{ job_id, tier, model_used }`.
- `app/privacy/page.tsx` and `app/terms/page.tsx`: replaced inline V1 legal copy with Termly iframe embeds (`<div data-id={...} data-type="iframe" />` + Termly's `embed-policy.min.js` loaded via Next `<Script>`). IDs read from `NEXT_PUBLIC_TERMLY_PRIVACY_ID` and `NEXT_PUBLIC_TERMLY_TOS_ID`; default to `TODO_*` placeholders so user can paste real Termly UUIDs post-deploy.
- `app/login/page.tsx`: added "By continuing you agree to our Terms and Privacy Policy" line below the magic-link form. Both links route to `/terms` and `/privacy`.
- `.env.example`: documents `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_TERMLY_TOS_ID`, `NEXT_PUBLIC_TERMLY_PRIVACY_ID`.
- `package.json`: `posthog-js` added (^1.372).
- V2.1 backlog: Ultra tier ($49.99/mo, Opus 4.7 max + Concierge Interviewer Intel) added per the standalone discussion.
- Static gates: `pnpm build` clean (compiled successfully, all 14 routes including new `/privacy` and `/terms`). Banned-copy clean. `pnpm tsc --noEmit` has 6 pre-existing errors in `inputs-widget.tsx` / `theme-provider.tsx` / `badge.tsx` / `button.tsx` from the `react: ^19` runtime + `@types/react: ^18` types mismatch — verified pre-existing via stash test, unrelated to Phase 6.5 work, latent until `pnpm add posthog-js` invalidated the `.tsbuildinfo` cache. Project's Next config skips type validation during build (`typescript.ignoreBuildErrors`), so production unaffected. Cleaning these up is a separate task.

### Phase 5 patch 5.4 — DONE (Decouple Deep grounding into Haiku search + Sonnet single-pass)
- Removed Sonnet agentic web-search loop entirely. `generateOnce` reverted to single-pass `messages.create` for both tiers: `tools: [submit_prep]` only, `tool_choice: { type: "tool", name: "submit_prep" }` forced, no loop, no `DEEP_MAX_ITERATIONS`. `DEEP_GROUNDING_DIRECTIVE` const removed (Sonnet no longer holds the search tool, so the directive is obsolete).
- New `fetchCompanyContext(client, input)` helper at module scope. Uses `QUICK_PREP_MODEL` (Haiku 4.5) with `web_search_20250305` server-tool (`max_uses: 1`, `tool_choice: { type: "auto" }`). 60s `AbortController`. System prompt: "research assistant... perform exactly one web_search and produce a 150-220 word terse summary..." On timeout, auth error, or empty text response: returns `null` and Deep generation proceeds ungrounded — no synthetic facts injected, no throw.
- Deep flow in `generatePrep`: log `[generatePrep] Deep start`, capture timestamp, await `fetchCompanyContext`, then `generateOnce(..., companyContext)`, then log `[generatePrep] Deep generated in <ms>ms`. Retry path reuses the same `companyContext` so Haiku research cost is paid at most once per `generatePrep` call. Quick flow byte-identical (no fetch, no timing logs).
- `buildUserPrompt(input, companyContext = null)`: when non-null, injects `[COMPANY CONTEXT]\n<summary>` block immediately after `[JOB DESCRIPTION]` and before `[SESSION]`. SYSTEM_PROMPT gains rule 7: "When [COMPANY CONTEXT] is present in the user prompt, use it to ground positioning, risks, and questions. Do not invent facts not present in resume, JD, latest message, or company context." Cached in the existing system block; minor cache-key change for both tiers.
- Timing logs added: `[generatePrep] Deep start`, `[generatePrep] Company context fetched: <chars> chars in <ms>ms` (or `... fetch failed, proceeding ungrounded: <reason>`), `[generatePrep] Sonnet generation start`, `[generatePrep] Deep generated in <ms>ms`. Server-side console only, no PII, no query echo.
- `app/app/page.tsx`: added `export const maxDuration = 240` (server actions inherit from invoking page; `"use server"` files cannot export non-async constants per Next 14). Vercel server actions default to 10s; Pro plan supports up to 300s. 240s gives the Haiku-then-Sonnet worst case (60s + 180s) headroom past the AbortController fires.
- Existing error paths preserved exactly: `PrepValidationError` (single retry, reuses `companyContext`), `PrepTruncatedError` (no retry), `PrepTimeoutError`, `AuthenticationError`. Quick output guards (`interviewer_insights = null`, `counter = null`, `answer_plan = null`) and stage override unchanged.
- Known gap: rapid Try Again clicks while a Deep gen is still in-flight could fire duplicate Sonnet calls. Patch 5.1's UI lock mitigates during the loading window. Server-side in-flight lock requires schema or external state — deferred to V2.1.
- TypeScript clean. Banned-copy clean.

### Phase 5 patch 5.3 — DONE (Upgrade chip toggles tier + web_search single-search)
- TierSelector Upgrade chip onClick now fires `onTierChange("deep")` alongside the existing `onUpgrade()` analytics call. Pre-paywall the chip would otherwise be a dead button (chip stayed on Quick tier, only logged the upgrade-clicked event). When Phase 6b ships the paywall, `onUpgrade` becomes the gate; for now both fire and the user lands on Deep.
- `lib/ai/generate-prep.ts` `web_search_20250305` tool config: `max_uses: 3 → 1`. `DEEP_GROUNDING_DIRECTIVE` rewritten to enforce EXACTLY ONE search with explicit query guidance (company name + role/team context + recency hint). Single search returns enough context to ground positioning and risks; keeps Deep generation comfortably inside the 180s `DEEP_TIMEOUT_MS` window. Multi-search grounding deferred to V2.1.
- TypeScript clean. Banned-copy clean.

### Phase 5 patch 5.1 — DONE (TierSelector + SessionTabs lock during gen, Deep Prep button blurple)
- `components/app/widgets/prep-canvas.tsx` `TierSelector` accepts new `disabled?: boolean`. When true, both compartments get `aria-disabled`, `tabIndex=-1`, no-op click + onKeyDown handlers, `cursor-not-allowed opacity-60`. PrepCanvas passes `disabled={isGenerating}` (current-role gen state). The Upgrade chip nested in the Deep compartment stays interactive (paywall flow is independent of generation); inherits the parent's opacity fade.
- `components/app/widgets/session-tabs.tsx` accepts new `disabled?: boolean` prop. When true, tablist gets opacity-60 + cursor-not-allowed, every tab button gets `aria-disabled`, `tabIndex=-1`, no-op click, hover styles suppressed; arrow-key focus cycling also suppressed. PrepCanvas passes `disabled={isAnyGenerating}` (any role generating, not just current — switching tabs mid-other-gen would also strand the loading state).
- EmptyState Generate button + StaleBanner Regenerate button: tier-conditional className. `tier === "deep"` uses `bg-[#4E3BDD] hover:bg-[#4332C2]` (matches DEEP chip palette and the standardized primary CTA from 4c-4 patch 1). `tier === "quick"` keeps prior `bg-[#482C4C] hover:opacity-90` byte-identical. Same shape, same padding, same icon, same font.
- TypeScript clean. Banned-copy clean.

### Phase 5 — DONE (Anthropic web_search grounding for Deep Prep)
- `lib/ai/generate-prep.ts`: Deep tier now passes a tier-aware tools array (`submit_prep` + `web_search_20250305` server-tool with `max_uses: 3`) and `tool_choice: { type: "auto" }` so Sonnet can interleave web_search calls with the terminal `submit_prep` emission. Quick path byte-identical: same single `submit_prep` tool, same forced `tool_choice`.
- New `DEEP_GROUNDING_DIRECTIVE` system block appended after `SYSTEM_PROMPT` for Deep only, with its own `cache_control: { type: "ephemeral" }`. Hard MUST directive: search the company name from the JD for recent news / funding / product launches / hiring posture / named competitors before emitting `submit_prep`. Cached independently so Quick's cache key is unaffected.
- Agentic loop with `DEEP_MAX_ITERATIONS = 5` cap. Server-managed `web_search` typically resolves in a single client round-trip (Anthropic loops internally), but the client-side cap protects against runaway tool-use chains. On no-`submit_prep` exit: distinguishes `stop_reason === "max_tokens"` (throws `PrepTruncatedError` — bypasses retry path) from generic mid-loop continuation. Quick stays single-iteration.
- Timeout split into `QUICK_TIMEOUT_MS = 120_000` and `DEEP_TIMEOUT_MS = 180_000`. `ANTHROPIC_TIMEOUT_MS` removed; Deep gets +60s budget for the additional web_search round-trip latency. AbortController bounds the entire iteration sequence cumulatively.
- Logging: `[generatePrep] Deep grounding: <N> web_search calls` per Deep call. No PII, no query echo. Counts `tool_use` blocks of `name === "web_search"` across the loop's responses.
- Existing error paths preserved exactly: `PrepValidationError` (single retry path), `PrepTruncatedError` (no retry), `PrepTimeoutError`, `AuthenticationError`. Quick + Deep both still benefit from the post-success guards (Quick null-coercion for `interviewer_insights` / `counter` / `answer_plan`; stage override for staleness detection).
- No new files in `lib/ai/`. No `research.ts` abstraction. No schema migrations. No UI changes. No Stripe touch. No `models.ts` touch. No `actions.ts` touch.
- TypeScript clean. Banned-copy clean.

### Phase 4e — DONE (Kanban polish: any-pair drag-drop, +Add Job per column, backdrop close)
- Drag-drop unrestricted between any source/destination column pair on the kanban (Applied, Screen, HM, Full Loop, Offer). `columnToWriteStage("applied")` now returns `"applied"` (was `null`), `WriteStage` type extended, `moveJobStageSchema.to_stage` Zod enum gains `"applied"`. State transition logic added: `to_stage="applied"` flips state to `"passive"` (active → passive demote); any other target flips to `"active"` and stamps `activated_at` only when transitioning out of passive. Drop the prior `state !== "active"` guard so passive jobs can be dragged into active columns (bypasses the They-Responded activation modal — drag is a power-user gesture; activation modal stays canonical for "I have a message to paste"). `JobCard` `draggable` gate updated to require `Boolean(jobId) && Boolean(onDragStart)`; the `!isInactive` guard removed so cards in Applied are draggable too.
- Optimistic stage overrides + rollback: new `optimisticStages: Record<jobId, StageKey>` in `Board`. Drop applies the override synchronously, action error rolls it back, success path keeps it until the next-render `useEffect [jobs]` cleanup drops the matched entry. Inline red error toast above the section, auto-dismisses after 4s.
- Drag visual cleanup (prompt 1.5): `setDraggedJobId(null)` clears synchronously at the top of `move()` — the optimistic stage flip unmounts the source `JobCard` before the browser fires `onDragEnd`, so the destination card was rendering with stale `isDragging=true` (faded `opacity-50`).
- Prep overlay backdrop close (prompts 1.5 → 1.6 → 1.7): restructured root from a standalone `<button>` backdrop with `onMouseDown=onClose` to a dedicated backdrop sibling at z-default with `onClick=onClose`, X close button bumped to z-20, content layer at z-10. `pointer-events-auto` + `stopPropagation` moved DOWN from aside/main wrappers onto per-widget shells (one per `JobContextWidget` / `InterviewerWidget` / `UpgradeWidget` / `PrepCanvas` / `InputsWidget`). Result: clicks on widget content stay inside the overlay; clicks on inter-column gaps, intra-column empty space below the last widget, and the outer scrim all fall through to the backdrop and close. Visual chrome for the prep canvas card moved from `<main>` to its inner shell so the visible card boundary matches the clickable area.
- +Add Job per column with stage pre-fill (prompt 2): `createJobAction` Zod schema gains optional `stage` enum (`applied | screen | hiring_manager | final | offer`). State derivation: stage absent or `"applied"` → `state="passive"`; otherwise → `state="active"` + `activated_at` stamped. `AddJobModal` accepts a `defaultStage?: WriteStage` prop and passes it through to the action. `AppliedColumn` wires `defaultStage="applied"` into its existing prominent +Add Job button. `BoardColumn` renders a small `Plus` icon button (size-6, subtle gray hover, `draggable={false}`, `stopPropagation` on click) on every column except Offer. Per-column `<AddJobModal>` mount with `defaultStage={columnToWriteStage(columnKey)}`.
- Inline column header (prompt 2): `BoardColumn` header now renders `Hiring Manager · 2` inline (count as a smaller-weight span inside the `<h3>`, separated by middle dot) instead of the prior justified-end count span. `whitespace-nowrap` so long titles don't break. AppliedColumn header preserved exactly per scope.
- TypeScript clean. Banned-copy clean.

### Phase 4f — DONE (Multi-session Full Loop dynamic config)
- Migration `20260505000001_jobs_full_loop_session_config.sql`: nullable `jsonb` column on `public.jobs` storing per-job session config. No CHECK; Zod enforces shape at the application layer. Null = pre-Phase-4f state, falls back to `DEFAULT_FULL_LOOP_SESSION_CONFIG` via `resolveFullLoopSessionConfig`.
- `lib/ai/parse-full-loop-rounds.ts` (NEW): Haiku-backed parser. Reads `latest_message + jd_text + interviewer_name`, returns `{ config, raw }` where config is a complete `FullLoopSessionConfig`. System prompt biases `missing_roles` to **explicit-exclusion only** (silence ≠ exclusion). Tool schema with `detected_rounds` / `missing_roles` / `extra_rounds` / `overall_confidence` (strict, additionalProperties false). Mapping function defaults unmentioned roles to `{ enabled: true, source: "parsed" }`; multiple detected_rounds for the same role resolve via highest-confidence.
- New actions: `parseFullLoopRoundsAction` (auth + ownership + early-exit on empty inputs + parser call + persist + revalidate; no rate limit) and `updateFullLoopSessionConfigAction` (Zod-validated against `fullLoopSessionConfigSchema` for the strict 4-role shape).
- Client-side trigger in `components/app/board.tsx`: `parseFullLoopRoundsAction` fires when a job's `stage ∈ {final, interview_loop}` AND `full_loop_session_config === null` AND not already fired this session (`parserFiredJobsRef`). Fires-and-forgets so the dragged card lands instantly; parser revalidation refreshes the row in place when complete.
- `SessionTabs` reads `sessionConfig` and renders only enabled roles using config labels (hardcoded `ROLE_LABELS` const removed). Arrow-key cycling and `aria-selected` operate on the visible-roles index space.
- `PrepCanvas`: zero-enabled empty state with "Customize rounds" CTA. Default `selectedRole` is the first enabled role from the resolved config; if the active role becomes disabled, an effect auto-shifts to the new first-enabled.
- `CustomizeRoundsModal` (NEW): Radix Dialog. Per-role enabled toggle + label input + "Auto-detect from message" (re-runs the parser, refreshes draft + snapshot in place) + Save (per-role diff sets `source: "user"` only on changed rows, preserves prior source on unchanged) + Cancel. Inline Toggle component (no new dep).
- Patch 3.5: parser trigger moved from `moveJobStageAction` (server, blocked card drops by ~3s) to client-side `useEffect` in `Board` (instant drops; parser runs in background).
- Patch sharpen-parser: rewrote parser Rules so silence is not exclusion. Default assumption directive added: "a standard Full Loop has all 4 standard rounds. If the message doesn't mention a role and doesn't exclude it, leave it out of BOTH detected_rounds and missing_roles."
- Patch sharpen-parser-2: bar_raiser taxonomy softened from "do NOT assume present" to "default to enabled unless the message explicitly excludes it"; dead `console.warn` cleanup in `mapParserOutputToConfig` (the "neither bucket" path is now dominant happy path, not anomaly).
- `SESSION_ROLE_EMPHASIS` exclude blocks tightened in `lib/ai/generate-prep.ts` from soft "exclude X (other_session covers it)" phrasing to hard-boundary directives ("do NOT generate content related to X. If X comes up naturally, defer it explicitly to the [other] tab. This is a hard boundary, not a soft preference."). Applied across all 4 roles. Acceptable system-prompt cache invalidation on next call (V2.0 has no users).
- TypeScript clean. Banned-copy clean.

### Phase 4d — DONE (Multi-session Full Loop, Option C+)
- Type foundation: `PREP_SESSION_ROLES` const tuple + `PrepSessionRole` union; optional `session_role` on `PrepInput`; nullable + optional `session_title` and server-authoritative `session_role` on `prepOutputSchema`. Tool input_schema mirrors with `["string", "null"]` types.
- Prompt layer: `SESSION_ROLE_EMPHASIS` map with focus / emphasize / exclude / session_title_examples per role. `buildUserPrompt` injects a `[SESSION]` block immediately after `[JOB DESCRIPTION]` when `session_role` is set; byte-identical output otherwise.
- Action layer: `session_role` threaded through `generatePrepAction` + `getCachedPrepAction` schemas; new `buildContextHash` helper folds session_role into the hash conditionally (byte-identical when undefined). `getCachedPrepAction` session-aware fork filters by computed hash; non-session path preserved exactly. `getPrepStatesAction` returns the 5-key map (single + 4 roles) classifying each as cached / stale / empty.
- `SessionTabs` widget (NEW): horizontal flex-row of chips with state indicators (generating pulse, stale amber dot), roving tabIndex, manual-activation arrow-key nav (Enter/Space activates via native button onClick to avoid accidental LLM gens).
- PrepOverlay restructured: `prepState` discriminated union dropped; `statesMap` + `generatingRoles` set + `selectedRole` + `error` replace it. `onGenerate(role: PrepSessionRole | null)` accepts the new role param. Optimistic local update so the just-finished session flips cached without waiting for refetch.
- PrepCanvas: derives display state from `(stage, statesMap, generatingRoles, selectedRole)`; renders `<SessionTabs>` when stage maps to `interview_loop` per `stageKeyToPrepStage`; `<StaleBanner>` above prep modules when current entry's state is stale; `session_title` heading fallback to `stageHeading(stage)`.
- Migration index `20260504000001_prep_versions_rate_limit_idx.sql` covers the (job_id, tier, context_hash) lookup path naturally — no new migration needed for Phase 4d.
- Followup p1: secondary in-prep upgrade buttons (locked-preview-module flipped from primary blurple fill to outlined secondary) + UpgradeWidget primary CTA copy "Upgrade to Deep Prep" → "Upgrade all Prep". Visual hierarchy fix so the left-rail primary CTA wins as the global aggregate.

### Phase 4c-4 patch 12 — DONE (post-close, bundles patch 11)
- HANDOFF.md preamble replaced with the Operating Contract block: stance, decision rules, prompt engineering rules, anti-drift rules, pressure-test checklist. Reads first by any new Claude chat. Existing `/phase-done` procedural note preserved as a single-line subsection ("## Phase done procedure") between the Operating Contract and `## North Star`.
- New `guildy-narrative.md` at repo root: the public/social voice anchor for content generation across X / Bluesky / LinkedIn / Dev.to. Defines who's writing, what Guildy is in one sentence, the recurring story threads, voice rules, and audience-by-platform. Not linked from anywhere yet — surfaces only when a content task references it.
- `components/app/widgets/upgrade-widget.tsx` gradient flipped from `linear-gradient(135deg, #E4BCED 0%, #FFFFF1 60%)` to `linear-gradient(225deg, #E4BCED 0%, #FFFFF1 50%)`. CSS 225deg points "to bottom-left" so the 0% color sits at the opposite end (top-right corner). Cream stop pulled in from 60% to 50% so cream/yellow dominates the lower 70% of the card.
- `components/app/widgets/prep-canvas.tsx` `TierSelector` Deep compartment restructured: standalone Upgrade button (previously sibling of the compartment button) and its wrapper `<div>` removed. Compartment converted from `<button role="tab">` to `<div role="tab" tabIndex={0} onKeyDown=…>` with Enter/Space firing `onTierChange("deep")` so the compartment stays keyboard-toggleable. Inline Upgrade chip rendered between the Sonnet 4.6 badge and the "Deep Prep" label when `tier === 'quick'`, hidden on Deep. Chip is a real `<button>` with `onClick → e.stopPropagation(); onUpgrade()` (valid HTML now that the outer is a div). Quick compartment unchanged.
- Layout when Quick: `[Sonnet 4.6 badge][Upgrade chip] Deep Prep`. Layout when Deep: `[Sonnet 4.6 badge] Deep Prep`. Both targets keyboard-accessible.
- TypeScript clean. Banned-copy clean.

### Phase 4c-4 patch 10 — DONE (post-close)
- Background row in InputsWidget is now editable inline. Same expand-on-click pattern as JD / Latest message / Interviewer / Additional context. Click row → section expands with textarea pre-filled from `user_profiles.resume_text`. Save persists; Cancel discards.
- New `updateUserResumeAction({ resume_text })` in `app/app/actions.ts`. Zod validates non-empty trimmed (matches onboarding's gate at `app/onboarding/actions.ts:24`, no 50-char floor). Updates `user_profiles` where `id = auth.uid()`. `revalidatePath('/app')` so any open overlay re-fetches with fresh resume text. Onboarding's `saveResumeTextAction` left untouched — separate flow, separate concern.
- No Clear button. Resume_text is required for prep generation across every job; clearing would break the system. New `BackgroundForm` reuses `FormShell` with `hasExisting={false}` (FormShell hides Clear in that branch). A no-op `onClear` closure satisfies the shared prop type.
- Subhead copy: "Used for prep on every job. Editing updates your background everywhere." Sets expectation that this isn't a per-job edit.
- Plumbed `resumeText: string | null` through the chain `app/app/page.tsx → Board → PrepOverlay → InputsWidget`. `app/app/page.tsx` already fetched `resume_text` (used to derive `hasResume`); now passes the full text alongside.
- `InputsExpansionSection` union extended from `"jd" | "message" | "interviewer" | "note"` to also include `"background"`. New `sectionRefs.background` ref; new `<Section>` block wraps `<BackgroundForm>`. The Section appears above JD per row order.
- Cache impact: `context_hash` already includes `resume_text` (verified at `app/app/actions.ts:696` in `generatePrepAction`). Editing background changes the hash for every job → next Generate runs fresh against Anthropic. Spec-aligned: user explicitly chose to update resume, fresh prep is the correct behavior.
- TypeScript clean. Banned-copy clean.

### Phase 4c-4 patch 9 — DONE (closes 4c-4)
- Removed all `[generatePrep]` diagnostic console statements added in a242b8f and during patch 7. Six log sites scrubbed: response-shape log, no-tool_use error, validation-failed raw-input dump, max_tokens-truncation warn, retry-firing warn, retry-also-failed error. Surrounding `// PATCH 6 DIAGNOSTIC:` comment blocks removed with their log blocks.
- Inner try/catch wrapper around the retry call removed — its only purpose was to log "retry also failed:" before re-throwing. With the log gone, the wrapper added no value; retryErr now propagates naturally to the parent catch.
- Load-bearing logic preserved: `PrepTruncatedError` distinction (skip retry on `stop_reason: 'max_tokens'`), retry-with-RETRY_HINT branch on plain `PrepValidationError`, AbortController timeout, AuthenticationError handling. Comments rewritten without phase-number prefixes.
- `[rate-limit]` operational logs from patch 7 stay — they're cap-tuning signal, not diagnostic for the resolved bug.
- Patches 1-9 rolled in at the close. TypeScript clean.

### Phase 4c-4 patch 8 — DONE
- Bug from patch 7 prompt: Quick brevity rules say "questions_they_ask: NO category labels (return null)". Haiku obeyed and emitted `category: null`. Zod rejected because `prepQuestionThemSchema.category` was `z.string()` (non-nullable). Server log: `questions_they_ask.0.category: Expected string, received null` (×5 they_ask + ×4 you_ask).
- Fix: `category` made nullable in both `prepQuestionThemSchema` and `prepQuestionYouSchema` in `lib/ai/prep-types.ts`. Matches spec §7 — Quick is uncategorized, Deep groups by 8 model-defined categories.
- Tool `input_schema` in `lib/ai/generate-prep.ts`: `category` and `answer_plan` removed from `questions_they_ask.items.required[]`; `category` removed from `questions_you_ask.items.required[]`. Property types relaxed to `["string", "null"]`. `question` stays required. `additionalProperties: false` keeps the schema closed.
- `components/app/widgets/questions-widget.tsx` made null-tolerant: `groupByCategory<T extends { category: string | null }>` returns `[string | null, T[]][]`. Both `QuestionsTheyAsk` (Deep render path) and `QuestionsYouAsk` skip the category header when `category` is null and key the list item with a `_uncategorized` sentinel. Quick path in `QuestionsTheyAsk` was already flat (`tier === "deep" ? grouped.map : items.map`) so no functional change there. `QuestionsYouAsk` will now render all Quick items in a single header-less block — same visual effect as flat.
- Old cached Quick `prep_versions` rows with non-null string categories continue to validate (`.nullable()` accepts both null and string). No data migration.
- Prompts unchanged. Diagnostic logs from a242b8f still in place. TypeScript clean. Banned-copy clean.
- `interviewer_type` field on `questions_you_ask` not added — never existed in the schema; the Quick prompt's "NO interviewer_type" line has been a no-op since 4c-2. Tracked as feature work, not bug work.

### Phase 4c-4 patch 7 — DONE
- Root cause from a242b8f diagnostic: `stop_reason: 'max_tokens'` on both first attempt and retry. Haiku hit the 2048 cap mid-output. Patch 6's retry path made it worse (longer prompt → less output room → still truncated, sometimes worse). Schema validation rejected truncated output because `questions_they_ask` / `questions_you_ask` / `prep_checklist` never made it into the tool call.
- Raised `QUICK_MAX_TOKENS` 2048 → 4096, `DEEP_MAX_TOKENS` 4096 → 8192 in `lib/ai/generate-prep.ts`. 8192 is a hard ceiling well within Sonnet's per-request limit; covers full Deep output with all 8 question categories + answer plans + interviewer insights + risks-with-counters.
- Quick prompt rewritten with explicit length budgets per field (`purpose.summary` ≤ 3 sentences, `positioning.frames` exactly 2 items, `questions_they_ask` 3-5 items with `answer_plan: null`, etc.) plus the directive "Aim for under 3000 output tokens total." Quick is "useful sketch," not essay. Deep prompt unchanged — Deep is the comprehensive paid promise.
- New `PrepTruncatedError extends PrepValidationError`. When Zod fails AND `response.stop_reason === 'max_tokens'`, that subclass is thrown and the `generatePrep` catch surfaces "Generation exceeded length limits. Try regenerating, or simplify context (shorter JD/resume)." — no retry. The plain `PrepValidationError` path still retries once with the strengthened hint. Retrying truncation cannot succeed (longer input = even less output room) and just doubles the wasted call cost.
- New `PrepTimeoutError` + `AbortController` with 120s timeout on `client.messages.create`. SDK throws `Anthropic.APIUserAbortError` on abort; that's caught and re-thrown as the friendly timeout message. `clearTimeout` in `finally` so successful calls don't leak the timer.
- `lib/ai/rate-limit.ts` (NEW) — `checkRateLimit({ userId, tier })`. Counts existing `prep_versions` rows with `(user_id, tier, created_at)` filters. Daily window is rolling 24h, monthly is calendar UTC (`date_trunc('month', now())`). Failure mode: fail open with `console.error` so an infra hiccup never blocks legit users. Limits: Quick 10/day 75/mo, Deep 15/day 100/mo. Logged on hit with `userId` / `tier` / `reason` / `currentCount` / `limit` for future cap tuning.
- `generatePrepAction` calls `checkRateLimit` after auth + ownership check, before any heavy data fetch or model call. On `allowed: false`: returns `{ ok: false, error: "You've hit a high-volume threshold, please try again later." }` — no Anthropic call, no DB write. Cache hits never reach this path (handled upstream by `getCachedPrepAction`).
- New migration `20260504000001_prep_versions_rate_limit_idx.sql` — `create index if not exists prep_versions_user_tier_created_idx on public.prep_versions (user_id, tier, created_at desc);`. Existing `(job_id)` and `(job_id, tier, context_hash)` indexes don't lead with `user_id` so the rate-limit count query would seq-scan without this index. Apply manually after merge: `supabase db push` or run the SQL via the Supabase dashboard SQL editor.
- All `[generatePrep]` diagnostic logs from a242b8f preserved. They stay until patch 7 verifies clean in browser; a follow-up patch removes them.
- TypeScript clean.

### Phase 4c-4 patch 6 — DONE
- Schema validation blocker fixed: `interviewer_insights` is now `.nullable().optional()` in `prepOutputSchema` and removed from the tool `input_schema.required` array. Three shapes validate: present-string, present-null, missing. Sonnet sometimes omits the field entirely when no interviewer is provided — that no longer breaks generation.
- System prompt strengthened with explicit REQUIRED FIELDS / OPTIONAL FIELDS enumeration so Sonnet doesn't drop `questions_they_ask` / `questions_you_ask` either. Both stay required; both must be non-empty.
- Single retry on Zod validation failure (not on Anthropic API errors). On first `PrepValidationError`, the user prompt is re-sent with an appended hint enumerating the missing fields. If the second attempt also fails, the original error surfaces. Costs at most 2× tokens on the rare validation failure path.
- URL intake removed from Add Job modal: tabs go from `Manual | Paste URL | Paste JD` to `Paste JD | Manual`. Default tab is Paste JD. URL state, ref, and extract path deleted from the modal. `createJobAction` still accepts `source_url` (existing rows display fine) but new modal submissions always send `""`.
- `/api/extract/route.ts` returns 410 Gone for `kind: "url"` with the message "URL extraction temporarily disabled. Paste JD text directly." Defensive for direct callers; the modal no longer calls URL.
- `lib/ai/extract-jd.ts` and the URL fetch helpers were dropped from route.ts but `htmlToText` + `JdExtractionError` + `extractJobFields` stay in extract-jd.ts intact for the V2.1 revisit.
- TypeScript clean. Banned-copy grep clean.

### Phase 4c-4 patch 5 — DONE
- Option Z (visual UX only). Blocking generation in `lib/ai/generate-prep.ts` and `generatePrepAction` preserved exactly as-is — no streaming refactor.
- New `components/app/widgets/progress-loader.tsx`: tier-aware progress bar + rotating stage labels + tier badge. Bar fills 0 → 95% over the target duration via CSS transition (Quick: 12s, Deep: 90s); never reaches 100% until parent unmounts the loader. Stage labels rotate every 4s (Quick) / 13s (Deep) through the spec-locked phase descriptions. Tier badge matches TierSelector tokens (gray for Haiku, blurple for Sonnet).
- `prep-canvas.tsx` swaps `<LoadingSkeleton hint="Generating ..." />` for `<ProgressLoader tier={tier} />` in the `generating` state. The `loading-cache` state still uses the lightweight `LoadingSkeleton` (cache check is fast, full progress UI would be overkill).
- No backend, schema, AI, or model changes. TypeScript clean. Banned-copy grep clean.
- Deferred: real streaming via Anthropic `messages.stream()` with `inputJson` snapshots and an SSE API route, partial-render per module as data arrives. SDK supports it (`v0.40.1` exposes the events), but the implementation is ~6-10h vs the ~1-1.5h ProgressLoader-only path. Track as a follow-up patch when the Sonnet wait time becomes a conversion blocker.

### Phase 4c-4 patch 4 — DONE
- Rolls in the never-shipped patch 3 items (auth error handling, ungate Deep, LinkedIn login-wall defense) plus the patch 4 corrective scope (Applied stage ungate, tier selector redesign).
- Active-board Applied + Closed stages no longer block prep generation. `stageKeyToPrepStage` now maps both to `screen` and returns non-nullable `PrepStage`. Dead `if (!prepStage)` check in `generatePrepAction` removed. Heading reads "Screening round" when stage is Applied — cosmetic mismatch acceptable until a dedicated PrepStage variant lands.
- Deep generation no longer gated on `jobs.jd_text`. Server-side guard removed from `generatePrepAction`. UI ungate: Generate Deep button always enabled when resume present. When tier=deep AND jd_text empty, an inline amber warning renders above the button with two CTAs — primary "Add JD" (calls `expandInputsSection("jd", { pulse: true })`, opens InputsWidget JD section with cross-column pulse) and secondary "Generate anyway" (calls onGenerate). Warning hides when JD present.
- Anthropic auth error handling: `lib/ai/generate-prep.ts` wraps `messages.create` in try/catch. `Anthropic.AuthenticationError` surfaces "Server config error. Check ANTHROPIC_API_KEY in .env.local and restart dev server." instead of dumping raw 401 JSON. Other errors re-throw as-is.
- LinkedIn login-wall detection in `extract-jd.ts`: new `looksLikeLoginWall` precheck in `extractJobFields` rejects text < 200 chars OR text containing all three of "Sign in" / "passkey" / "Privacy Policy". Throws new `JdExtractionError` (exported). `/api/extract/route.ts` catches and returns `reason: "login_wall"` without echoing the gate text back as `jd_text`. `add-job-modal.tsx` renders the friendly notice "Could not extract JD from that URL. Paste the job description text directly." for that reason.
- TierSelector redesigned: single rounded-full pill container with two compartments. Quick = "[Haiku 4.5 gray badge] Quick Prep". Deep = "[Sonnet 4.6 blurple badge] Deep Prep" with an inline Upgrade button (`bg-[#4E3BDD]`, h-6) shown only when tier=quick. Selected compartment gets white background + shadow inside the gray container. Click compartment body toggles tier; click Upgrade button calls `onUpgrade` with `e.stopPropagation()` to prevent double-toggle. `flex-nowrap` + `whitespace-nowrap` so the pill never splits at narrow widths.
- TypeScript clean. Banned-copy grep clean. Stale label grep clean.

### Phase 4c-4 patch 2 — DONE
- Latent font bug fixed: `globals.css` was pointing `--font-sans` at undefined `--font-geist-sans`, falling back to system sans. Now `--font-sans: var(--font-inter)` (body becomes Inter as originally intended). Added `--font-display: var(--font-geist-sans)` for headers; `GeistSans.variable` wired in `app/layout.tsx` from the already-installed `geist` package. Tailwind v4 picks the variable up automatically as `font-display` utility.
- Typography pass: prep round title `font-serif` → `font-display`; UpgradeWidget H1 `font-serif text-xl font-semibold` → `font-display text-xl font-medium`; all section headers (Purpose, Positioning, Risks & Probes, Questions they'll ask, Questions to ask them, Prep Checklist) `text-lg font-semibold` → `font-display text-lg font-medium`; LockedPreviewModule title gets `font-display font-medium`. Editorial / restrained, less heavy.
- Locked-preview pattern split into two exports: `LockedPreviewModule` (standalone card, used only for ResumeJdFit) and `LockedPreviewFooter` (inline footer rendered inside parent module's card). Footer visual: subtle border-t divider, very light blurple wash `bg-[#4E3BDD]/[0.04]`, smaller text + h-7 Upgrade button. Sits visually attached to parent.
- `SectionShell` and `QuestionsTheyAsk` accept a `footer?: React.ReactNode` prop. PrepView in PrepCanvas passes a `LockedPreviewFooter` to Positioning, Risks, and QuestionsTheyAsk when `tier === "quick"`. Standalone locked modules between cards (full positioning, risk counters, per-cat answers) deleted; resume-to-JD-fit standalone module preserved (no Quick parent to attach to).
- Right column grid `[280px_minmax(0,1fr)_320px]` → `[280px_minmax(0,1fr)_360px]`. Section card padding `p-4` → `p-5`. JD textarea rows 10 → 12; Latest message 6 → 8; Note 6 → 8. FormShell action row `mt-4 pt-2` → `mt-5 pt-3`.
- TypeScript clean. Banned-copy grep clean.

### Phase 4c-4 patch 1 — DONE
- UpgradeWidget gradient swapped to inline `linear-gradient(135deg, #E4BCED 0%, #FFFFF1 60%)` (cream-favored), border `#4E3BDD/15`, headline + checks + secondary link recolored `#4E3BDD`.
- Primary CTA color standardized to blurple `#4E3BDD` (hover `#4332C2`) across UpgradeWidget primary button and all LockedPreviewModule "Upgrade to Deep Prep" buttons.
- DEEP chips in InputsWidget rows: `bg-[#EDE9FE] text-[#4E3BDD]`. Sparkle icon inherits color.
- Regenerate icon button removed from PrepCanvas top row entirely. Top row is now title (left) + tier toggle (right). Cache invalidates automatically when context_hash changes (any input edit), so manual regenerate is unnecessary.
- InputsWidget expanded sections sizing bumped: section padding `p-2.5` → `p-4`; JD textarea 6 → 10 rows; Latest message 5 → 6 rows; Note 5 → 6 rows; Interviewer inputs `h-8` → `h-9`; text size `text-xs` → `text-sm`; padding `px-2.5/py-2` → `px-3/py-2.5`.
- Cancel/Clear/Save pattern: each form now has explicit `[Clear (left)] ........... [Cancel] [Save]`. Cancel collapses without writing. Bottom "+ Add context" trigger hides entirely when any section is open (no more "Close" branch — Cancel is the close path).
- Backend writes verified read-only: `updateJobJdAction` writes `jobs.jd_text` (null OK), `updateJobLatestMessageAction` writes `jobs.latest_message` (null OK), `upsertInterviewerAction` writes name/title/link to `job_context.metadata` via delete-then-insert, `upsertNoteAction` writes to `job_context` `type='note'` via delete-then-insert. No code changes.
- Banned-copy grep clean.

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

## Deferred to V2.1 post-launch

- Hotlinks nav inside overlay
- Prep history viewer
- FTUE iteration based on real user data
- Per-session interviewer storage (currently one main interviewer per job)
- Mobile native app
- Custom rounds beyond the 4-role taxonomy (5+ rounds in Full Loop)
- Per-round emphasis profile picker (each round currently inherits its fixed role's `SESSION_ROLE_EMPHASIS`)
- Auto-detect-on-input-change (currently only fires on stage transition into Full Loop; user re-runs via Customize modal's Auto-detect button)

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

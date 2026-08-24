# Guildy v2 Devlog

## 2026-05-03

### Interview pulse
- What happened today: Guildy Quick Prep moved from mock/demo output toward real AI-generated interview prep.
- User problem this surfaced: Generic prep is not enough. The prep has to reference the actual job description, resume, stage, and user context or it feels like ordinary ChatGPT output.
- Drove Guildy work today: Make Quick Prep real first, then smoke-test quality before building Deep Prep and the paywall.

### Engineering pulse
- Decided: Phase 4b-2 should replace mock Quick Prep generation with a real AI call while preserving existing UI contracts.
- Shipped: lib/ai/generate-prep.ts, lib/ai/prep-types.ts, app/app/actions.ts, and .guildhall/quests.json. Replaced mock prep body with real gpt-4o-mini generation using strict JSON schema fallback, Zod parsing, and existing error handling. Commit dccdcc0.
- Prior context: fe09842 fixed the empty-state flash by changing prep overlay state handling from idle to empty/loading-cache.
- Blocked: Quality is unverified until real jobs with real JDs/resumes are smoke-tested.
- Next: Manually test Generate Quick Prep on 2–3 jobs. If output is specific and useful, move to Phase 4c Deep Prep + paywall. If generic, tighten the system prompt first.
- Signal strength: medium-high

---

## 2026-05-03 (legacy entry, single-section format)
- Decided: Prep stage stored inside prep_versions.output jsonb; no schema migration. Mock generator ships before real AI (4b-2 next). No spec/doc edits in window.
- Shipped: Phase 2 home shell + 5-col board (cc5818f, c4f4302); phase 3a-d job CRUD, activation, drag-and-drop, search closed (fa2e0c0, 9ebe2d4, 4ab8a20, 69bde12); phase 4a Prep Overlay shell + 5 widgets (817961b, 27093a9); phase 4b-1 prep data contract + mock generator (306f228): lib/ai/generate-prep.ts +566, lib/ai/prep-types.ts +96, prep-canvas +337; skeleton-first patch to kill empty-state flash (fe09842). 19 commits.
- Blocked: Nothing blocking.
- Next: 4b-2 swap lib/ai/generate-prep.ts mock body for real GPT-5.4 nano call; signature stays.
- Signal strength: strong

---

## 2026-05-04

### Interview pulse
- What happened today: [TBD — Michael to fill in]
- User problem this surfaced: [TBD — Michael to fill in]
- Drove Guildy work today: [TBD — Michael to fill in]

### Engineering pulse
- Decided: Manual regenerate button is unnecessary now that 4c-3 made every input edit bump context_hash; cache invalidation is automatic.
- Shipped: 03e049f phase 4c-4 patch 1, eight visual and UX corrections from smoke test: cream-favored UpgradeWidget gradient, blurple #4E3BDD primary CTA standardized across UpgradeWidget and LockedPreviewModule, DEEP chips recolored, Regenerate button removed from PrepCanvas top row, InputsWidget section sizing bumped (p-4, JD textarea 10 rows, text-sm), Cancel/Clear/Save pattern unified via FormShell.
- Prior context: dc66c41 shipped 4c-4 base earlier in the same window (overlay layout v2, tier-aware center modules, UpgradeWidget plus CompareTiersDrawer restoration, locked-preview-module.tsx new).
- Blocked: Nothing blocking.
- Next: Phase 4d multi-session Full Loop, Option C+ (per-session prep generations, own prep_versions row, context_hash includes session name, no schema change). Estimated 3 to 4 hours.
- Signal strength: strong

---

## 2026-05-05

### Interview pulse
- What happened today: [TBD — Michael to fill in]
- User problem this surfaced: [TBD — Michael to fill in]
- Drove Guildy work today: [TBD — Michael to fill in]

### Engineering pulse
- Decided: Quick tier emits null categories per spec §7; the empty-questions failure was max_tokens truncation, not schema strictness, so the fix is bigger output budgets plus a null-tolerant Zod and tool schema.
- Shipped: Phase 4c-4 patch 8 at 6ed3005 made `category` nullable in prep-types and the tool input_schema, dropped `category` and `answer_plan` from required[], and made questions-widget grouping null-tolerant. Prior context: a242b8f diagnostic surfaced `stop_reason: max_tokens`; patch 7 (c2a6218) raised max_tokens to 4096/8192, added a 120s AbortController timeout, fair-use rate limits with new index migration, and a non-retrying PrepTruncatedError; patches 2/4/5/6 (c2e2267, 848103d, e74de75, 29bc6ca) covered typography, ungating Applied/Closed/Deep, tier-aware ProgressLoader, and URL intake removal.
- Blocked: Patches 7 and 8 still need a clean browser verification before Phase 4d unlocks per HANDOFF.
- Next: Phase 4d multi-session Full Loop, Option C+: per-session prep_versions row, context_hash includes session name, no schema change. Roughly 3 to 4 hours.
- Signal strength: strong

---

## 2026-05-06

### Interview pulse
- What happened today: [TBD — Michael to fill in]
- User problem this surfaced: [TBD — Michael to fill in]
- Drove Guildy work today: [TBD — Michael to fill in]

### Engineering pulse
- Decided: Phase 4f introduces auto-extraction of Full Loop interview rounds via Haiku into a new jobs.full_loop_session_config column, with the parser triggered client-side on stage drops to keep board moves instant.
- Shipped: Phase 4d closed (01fdf1d PrepCanvas integration + stale banner, 66b967a secondary in-prep upgrade buttons + UpgradeWidget copy). Phase 4f scaffolded end-to-end: 46f0c06 schema + types (lib/ai/prep-types.ts +82, new migration), dfeaaed parseFullLoopRoundsAction (lib/ai/parse-full-loop-rounds.ts +276, app/app/actions.ts +107), b5ecf7f stage-transition trigger, d6da79c parser deferred to client to keep drops instant, f34babc + cf8806e parser sharpening (missing_roles bias to explicit-exclusion-only, bar_raiser taxonomy softening), c65dadd SessionTabs + PrepCanvas consume full_loop_session_config.
- Blocked: Nothing visible in window. HANDOFF.md still reads Phase 4d as NEXT and .guildhall/quests.json still pins current_phase to phase-4-prep-overlay, so docs lag behind code.
- Next: Phase 4f verification on real Full Loop JDs plus a HANDOFF + quest manifest update to reflect 4d closed and 4f in flight. Phase 5 (Perplexity web research, ~5-7h) is the next listed roadmap unit per CLAUDE.md.
- Signal strength: strong

---

## 2026-05-07

### Interview pulse
- What happened today: [TBD — Michael to fill in]
- User problem this surfaced: [TBD — Michael to fill in]
- Drove Guildy work today: [TBD — Michael to fill in]

### Engineering pulse
- Decided: Phase 5 provider swapped from Perplexity to Google Gemini 2.5 with Search grounding (cost-driven, ~3-4x cheaper at scale, leverages existing AI Studio access); lib/ai/research.ts will abstract the provider so future swaps stay cheap.
- Shipped: Phase 4f closed at 635ecaa (CustomizeRoundsModal + updateFullLoopSessionConfigAction, Radix Dialog with per-role enabled/label/auto-detect/save) and b8cffb0 (cross-fn emphasis tightening: SESSION_ROLE_EMPHASIS exclude blocks moved from soft phrasing to hard-boundary directives across all 4 roles in lib/ai/generate-prep.ts). Phase 4e shipped at 11375ba (kanban polish: any-pair drag-drop with optimistic-update + rollback, per-column +Add Job with stage prefill, inline column count, prep overlay backdrop close on every empty area). HANDOFF rewritten at 6c82e89 + 7f16f14 to mark 4d/4f/4e archived and roadmap collapsed to Phase 5 next.
- Blocked: Nothing visible. HANDOFF reads "ready for Phase 5" and matches code state.
- Next: Phase 5, Gemini 2.5 research for Deep Prep, ~5-7h, with company cache 7d TTL and per-(interviewer, company) cache no expiry.
- Signal strength: strong

---

## 2026-05-16

### Interview pulse
- What happened today: [TBD — Michael to fill in]
- User problem this surfaced: [TBD — Michael to fill in]
- Drove Guildy work today: [TBD — Michael to fill in]

### Engineering pulse
- Decided: TBD. No spec or doc changes in window.
- Shipped: Quiet day. No commits since b9f1f15 on 2026-05-14 (refactor copy: rename Background field to Intro/Cover Letter across UI).
- Blocked: Nothing visible in window. Devlog gap since 2026-05-07 means no carry-forward blocker; HANDOFF lists no open blockers.
- Next: Phase 7 production deploy per HANDOFF: guildy.ai DNS + SSL via Vercel, prod env vars (Anthropic, Supabase, Stripe live, PostHog), banned-copy final pass, smoke 3 jobs in prod. ~2h.
- Signal strength: weak

---

## 2026-05-17

### Interview pulse
- What happened today: [TBD — Michael to fill in]
- User problem this surfaced: [TBD — Michael to fill in]
- Drove Guildy work today: [TBD — Michael to fill in]

### Engineering pulse
- Decided: Unauthenticated Quick Prep funnel for the guildy.ai hero. Stateless POST endpoint, no rate limit at launch (finite $7 Anthropic credit self-bounds abuse), input caps mirror authenticated schemas (JD 20000, resume 50000), and a separate unauth_handoffs table will carry { jd, resume, prep } across the signup boundary as an ephemeral capability-token row (service-role only, no RLS policies, expire on read).
- Shipped: bd5117d added POST /api/generate-quick-prep-unauth (app/api/generate-quick-prep-unauth/route.ts, +79). Reuses stateless generatePrep() with tier="quick", company/role passed as "(not provided)", stage defaults to "screen". maxDuration 60s, opaque 503 on Anthropic failure.
- Blocked: Nothing visible. WIP for the consume side (app/signup/, app/api/unauth-handoff/create/, supabase/migrations/20260517000001_unauth_handoffs.sql, lib/ai/context-hash.ts, edits to onboarding actions + form and middleware) is uncommitted.
- Next: Land Prompt 21 — unauth_handoffs migration, create endpoint, signup page, and onboarding consume path that materializes the cached prep_versions row and deletes the handoff. Then return to Phase 7 production deploy.
- Signal strength: medium

---

## 2026-05-18

### Interview pulse
- What happened today: [TBD — Michael to fill in]
- User problem this surfaced: [TBD — Michael to fill in]
- Drove Guildy work today: [TBD — Michael to fill in]

### Engineering pulse
- Decided: Unauth Quick Prep crosses the signup boundary via a service-role-only `unauth_handoffs` table (no RLS policies, uuid is the capability token, 1h TTL, dropped on read), and `buildContextHash` is extracted to lib/ai/context-hash.ts so the unauth Quick hash and the later authed regen hash byte-identically and the stale banner does not false-fire.
- Shipped: 5cc7c7a closed the consume side that yesterday's entry queued. POST /api/unauth-handoff/create takes { jd, resumeText, prepOutput } and returns { id }. /signup stashes ?handoff= in localStorage (the only store that survives the magic-link round trip) and forwards to /login. completeOnboardingAction grew an optional handoffId arg that creates an Applied job from the JD, writes the prep as a Quick prep_versions row, deletes the handoff, and redirects to /app?job={id}. Migration: supabase/migrations/20260517000001_unauth_handoffs.sql, RLS-enabled with no policies so only service-role touches it. Consume path is best-effort and never blocks signup.
- Blocked: Nothing visible. .guildhall/quests.json still pins current_phase to phase-4-prep-overlay (longstanding doc lag noted in earlier entries, no code impact).
- Next: Phase 7 production deploy per HANDOFF: guildy.ai DNS + SSL via Vercel, prod env vars (Anthropic, Supabase, Stripe live, PostHog, Termly), banned-copy final pass, smoke on 3 prod jobs. ~2h.
- Signal strength: medium

---

## 2026-05-20

### Interview pulse
- What happened today: [TBD — Michael to fill in]
- User problem this surfaced: [TBD — Michael to fill in]
- Drove Guildy work today: [TBD — Michael to fill in]

### Engineering pulse
- Decided: TBD. No spec or doc changes in window.
- Shipped: Quiet day. No commits since 5cc7c7a on 2026-05-17 (feat(api): signup handoff for unauth Quick Prep flow). Three-day gap on v2-pivot.
- Blocked: Nothing visible. No carry-forward blocker from the 2026-05-18 entry; HANDOFF still reads "ready for Phase 7" with no open blockers.
- Next: Phase 7 production deploy per HANDOFF carry-forward: guildy.ai DNS + SSL via Vercel, prod env vars (Anthropic, Supabase, Stripe live, PostHog, Termly), banned-copy final pass, smoke on 3 prod jobs. ~2h.
- Signal strength: weak

---

## 2026-05-21

### Interview pulse
- What happened today: [TBD — Michael to fill in]
- User problem this surfaced: [TBD — Michael to fill in]
- Drove Guildy work today: [TBD — Michael to fill in]

### Engineering pulse
- Decided: TBD. No spec or doc changes in window; HANDOFF unchanged since d19c6a2 on 2026-05-09.
- Shipped: Quiet day. No commits since 5cc7c7a on 2026-05-17 (feat(api): signup handoff for unauth Quick Prep flow). Four-day gap on v2-pivot. Working tree clean apart from this devlog and an untracked blitz-queue.md.
- Blocked: Nothing visible. No carry-forward blocker from the 2026-05-20 entry; HANDOFF still reads "ready for Phase 7" with no open blockers.
- Next: Phase 7 production deploy per HANDOFF carry-forward: guildy.ai DNS + SSL via Vercel, prod env vars (Anthropic, Supabase, Stripe live, PostHog, Termly), banned-copy final pass, smoke on 3 prod jobs. ~2h.
- Signal strength: weak

---

## 2026-06-02

### Interview pulse
- What happened today: [TBD — Michael to fill in]
- User problem this surfaced: [TBD — Michael to fill in]
- Drove Guildy work today: [TBD — Michael to fill in]

### Engineering pulse
- Decided: TBD. No spec or doc changes in the 26h window. Standing direction unchanged: Guildy 2.1 command center rail (backlog doc 68bac98, 2026-05-31).
- Shipped: Quiet day. No commits in window. Devlog gap note: the most recent real work is the 2.1 command center rail, landed 2026-05-31 across 322cf50 (left rail StatsPanel + Job Source Advisor, lib/jobSourceAdvisor/boardRatings.ts + aiFallback.ts), cc0f7f9 (Today panel: prep-due / quick-prep-gap / source-nudge, capped 3), and 5466306 (collapse advisor by default, persistent Apply goal meter loggedThisWeek/15 with applyBenchmarks.ts role ballpark). These never appeared in earlier entries (last logged commit was 5cc7c7a on 2026-05-17).
- Blocked: Nothing visible. .guildhall/quests.json still pins phase-4-prep-overlay (longstanding doc lag, no code impact). Untracked: .claude/ and blitz-queue.md.
- Next: HANDOFF line 73 reads Feature 3 (TC Comparison matrix); Phase 7 production deploy (guildy.ai DNS/SSL, prod env vars, smoke) still flagged NEXT and unshipped.
- Signal strength: weak

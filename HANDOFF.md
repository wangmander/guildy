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
- Last phase shipped: **Phase 4c-4 closed at `43f651e` (patches 1-9 rolled in). Patch 10 (Background editable inline from InputsWidget) at `f6f1b11`.** Patch 9 removed the diagnostic logs added in a242b8f and during patch 7. Detail for every patch lives in the archive section below.
- Date: 2026-05-05
- Project status: ready for Phase 4d (multi-session Full Loop, Option C+)

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

## Phase 4c shipped — archive

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

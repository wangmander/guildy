# Guildy V2 — Phase 0 Audit

**Branch:** `v2-pivot` (clean working tree)
**Date:** 2026-05-02
**Source specs:** `docs/guildy-v2-spec-final.md`, `docs/phase-0-resolutions.md`, `docs/guildy-v2-tech-spec-v0.md`

---

## 1. Executive summary

- **V1 shape:** Gmail-scraping pipeline detector. Six-layer detection stack (`lib/guildy/gmailProcessor.ts:494-738`) ingests Gmail via NextAuth/Google OAuth (`lib/auth.ts:51-95`), classifies with `gpt-4o-mini` (`lib/guildy/recruitingClassifier.ts:75-87`), generates rich prep with `gpt-4o` (`app/api/gmail/sync/route.ts:204-212`), and stores results across 11+ Postgres tables.
- **V2 target:** Manual job tracker with on-demand AI prep as the paid layer. Email ingestion is **fully cut** (`docs/phase-0-resolutions.md:11-15`). Quick Prep on GPT-5.4 nano (free), Deep Prep on Claude Sonnet 4.6 + Perplexity research (paid, $19.99/mo).
- **Biggest delta:** The V1 ingestion engine (Gmail sync route + lib/guildy/* + NextAuth + pipeline_threads + ghost_logs + stage_history + dismissed_threads + email_processing_log) is **deleted in full**, not refactored. ~1,500+ LOC of V1 detection code goes away.
- **Biggest risk:** Auth transition — middleware (`middleware.ts:1-14`) and every protected route currently rely on NextAuth `withAuth` + `getServerSession`. Magic link rip-and-replace touches every API route plus middleware in a single phase.
- **Reusable surface is small:** Supabase client wrappers, Tailwind/shadcn primitives in `components/ui/`, `lib/utils.ts` (`cn` helper), `vercel.json` (`/api/health` keep-alive cron). Everything else V1-specific is on the kill list.

---

## 2. Current repo map

```
guildy/
  app/
    (dashboard)/
      pipelines/         V1-cruft  → DELETE (becomes /app Home)
      settings/          V1-cruft  → REPLACE
    about/               V2-relevant
    api/
      auth/[...nextauth] V1-cruft  → DELETE (replaced by /auth/callback)
      debug/             V1-cruft  → DELETE
      gmail/             V1-cruft  → DELETE
      health/            V2-relevant (Supabase keep-alive cron)
      pipelines/         V1-cruft  → DELETE (becomes /api/jobs)
    login/               V1-cruft  → REPLACE (magic link form)
    privacy/             V1-cruft  → REPLACE (remove gmail.readonly mention)
    security/            V2-relevant (review copy)
    terms/               V1-cruft  → REPLACE (remove gmail.readonly mention)
    layout.tsx           V2-relevant
    page.tsx             V2-relevant (landing/redirect)
    globals.css          V2-relevant
    icon.svg             V2-relevant
  components/
    ui/                  V2-relevant (shadcn/Radix primitives — KEEP)
    SessionProvider.tsx          V1-cruft → DELETE
    connect-gmail-button.tsx     V1-cruft → DELETE
    onboarding-banner.tsx        V1-cruft → DELETE
    pipeline-card.tsx            V1-cruft → DELETE
    pipeline-card-list.tsx       V1-cruft → DELETE
    pipeline-list.tsx            V1-cruft → DELETE
    job-row.tsx                  V1-cruft → DELETE
    job-detail-panel.tsx         V1-cruft → DELETE
    job-detail-drawer.tsx        V1-cruft → DELETE
    gantt-pipeline-view.tsx      V1-cruft → DELETE (Gantt cut per resolutions:46)
    mobile-bottom-sheet.tsx      V1-cruft → DELETE
    eta-chip.tsx                 V1-cruft → DELETE
    stage-node.tsx               V1-cruft → DELETE
    status-tag.tsx               V1-cruft → DELETE
    top-nav.tsx                  V1-cruft → DELETE (rebuild minimal V2 shell)
    theme-provider.tsx           V2-relevant (KEEP)
  data/                  Demo/sample data → DELETE
  docs/                  V2-relevant (specs + this audit)
  lib/
    auth.ts              V1-cruft → DELETE
    demo-pipelines.ts    V1-cruft → DELETE
    guildy/              V1-cruft → DELETE entire dir
    heuristics.ts        V1-cruft → DELETE
    storage.ts           V1-cruft → DELETE (GMAIL_CONNECTED localStorage)
    supabaseAdmin.ts     V2-relevant (KEEP)
    supabaseClient.ts    V2-relevant (KEEP)
    utils.ts             V2-relevant (KEEP — `cn` helper)
  middleware.ts          V1-cruft → REPLACE (NextAuth → Supabase session)
  public/images/         V2-relevant
  scripts/               V1-cruft → DELETE (force_update_prep, run-migration, etc.)
  styles/                V2-relevant
  supabase/
    migrations/          12 V1 migrations → archive only; Phase 1 writes fresh
    schema.sql           V1-cruft → REPLACE
  types/index.ts         V1-cruft → REPLACE (regenerate post-schema-reset)
  vercel.json            V2-relevant (KEEP — only /api/health cron)
  .guildhall/quests.json V2-relevant (created in Phase 0)
```

---

## 3. Gmail/OAuth dependency inventory

| File | Lines | Purpose | V2 action |
|---|---|---|---|
| `middleware.ts` | 1-14 | NextAuth `withAuth` global guard | REPLACE (Supabase session check) |
| `lib/auth.ts` | 1-95 | NextAuth `authOptions` + GoogleProvider (gmail.readonly) + token refresh | DELETE |
| `app/api/auth/[...nextauth]/route.ts` | 1-42 | NextAuth handler with GoogleProvider + gmail.readonly scope | DELETE |
| `app/api/gmail/sync/route.ts` | 1-676 | Gmail ingestion orchestrator (~676 LOC) — uses `googleapis` `gmail.users.messages.list/get`, OpenAI for `gpt-4o` prep | DELETE |
| `app/api/gmail/status/route.ts` | 1-94 | Sync run stats + 24h log totals | DELETE |
| `app/api/pipelines/route.ts` | 2, 38-64 | List pipelines (filters dismissed `gmail_thread_id`) | DELETE (V1 schema) |
| `app/api/pipelines/[id]/route.ts` | 2, 53-88 | DELETE pipeline + cascades `pipeline_threads`, `dismissed_threads` upsert | DELETE (V1 schema) |
| `app/api/debug/status/route.ts` | 2 | NextAuth-gated debug | DELETE |
| `app/api/debug/dedup/route.ts` | 2 | NextAuth-gated debug | DELETE |
| `app/api/debug/logs/route.ts` | (NextAuth) | Email processing log viewer | DELETE |
| `lib/guildy/gmailProcessor.ts` | 1-739 | V3 detection orchestrator (`processEmailSignal`, `buildSyncMaps`, `findOrCreatePipeline`, `applyStageDelta`, `linkThread`) | DELETE |
| `lib/guildy/recruitingClassifier.ts` | 1-115 | gpt-4o-mini classifier with strict JSON schema | DELETE |
| `lib/guildy/router.ts` | 1-174 | Hard-junk sieve, ATS domain list, weighted warm-lead score | DELETE |
| `lib/guildy/normalizers.ts` | (whole file) | Text utilities used only by detection stack | DELETE |
| `lib/guildy/types.ts` | 1-115 | V1 detection types (`EmailSignal`, `RecruitingAnalysisResult`, `RouterDecision`, `ProcessResult`, `SyncMaps`) | DELETE |
| `lib/storage.ts` | 4 | `GMAIL_CONNECTED` localStorage key | DELETE |
| `components/SessionProvider.tsx` | 3 | NextAuth `SessionProvider` wrapper | DELETE |
| `components/onboarding-banner.tsx` | 3 | Imports `ConnectGmailButton` | DELETE |
| `components/connect-gmail-button.tsx` | (whole file) | Triggers Google OAuth signIn | DELETE |
| `app/(dashboard)/settings/page.tsx` | 3 | Uses `useSession`, `signIn`, `signOut` from NextAuth | REPLACE |
| `app/(dashboard)/pipelines/page.tsx` | 8, 469 | NextAuth + calls `POST /api/gmail/sync` | DELETE (becomes /app Home) |
| `app/login/page.tsx` | 3 | NextAuth `signIn("google")` | REPLACE (magic link form) |
| `app/privacy/page.tsx` | 52 | Mentions `gmail.readonly` scope URL | REPLACE |
| `app/terms/page.tsx` | 62 | Mentions `gmail.readonly` permission grant | REPLACE |
| `vercel.json` | 1-7 | Daily cron at `/api/health` (Supabase keep-alive) | KEEP |

No standalone email-polling cron exists — sync was always user-triggered (`POST /api/gmail/sync` from `app/(dashboard)/pipelines/page.tsx:469`).

---

## 4. Database/migration inventory

### Existing tables (per V1 migrations + code references)

- `pipelines` — one row per company/thread; columns include `gmail_thread_id`, `predicted_stages`, `prep_json`, `insights_json`, `company_intel_json`, `last_email_*`, `stage_detail` (`v2_detection.sql:9-23`)
- `emails` — Gmail message archive with `gmail_message_id` (UNIQUE), `gmail_thread_id`, `from_email`, `body_text`, `is_recruiting`, `message_type`, `llm_confidence`, `llm_summary` (`v2_detection.sql:28-51`)
- `pipeline_threads` — many-thread→pipeline mapping (`v3_pipeline_threads.sql:5-14`)
- `dismissed_threads` — suppress recreation after pipeline delete (`v2_detection.sql:120-133`)
- `ghost_logs` — internal debug for rejected emails (`v2_detection.sql:56-72`)
- `stage_history` — immutable stage change audit (`v2_detection.sql:77-95`)
- `email_processing_log` — per-decision audit trail (`consolidated_fix.sql:9-35`, extended `v2_detection.sql:100-112`)
- `sync_runs` — per-sync stats + LLM call counters (`consolidated_fix.sql:41`, extended `v3_pipeline_threads.sql:26-28`)
- `interviewers` — RLS only, schema not visible in repo (`consolidated_fix.sql:43`)
- `test_pipelines` — RLS only (`consolidated_fix.sql:42`)
- `early_access_requests` — public-insert waitlist table (`consolidated_fix.sql:44, 94`)

### V1 tables to drop in Phase 1 (full reset per `phase-0-resolutions.md:79`)

`pipelines`, `emails`, `pipeline_threads`, `dismissed_threads`, `ghost_logs`, `stage_history`, `email_processing_log`, `sync_runs`, `interviewers`, `test_pipelines`.

### Tables flagged for confirmation

- **`early_access_requests`** — public waitlist with public-insert RLS policy. Recommend **PRESERVE** (export rows or carry table forward) before dropping. Real signups likely live here. Confirm with Michael in Phase 1 prerequisites.

### RLS state

Per `consolidated_fix.sql:38-94`, RLS is enabled on every V1 table with two policy classes:
- **Service-role full-access** policies (used by all `app/api/*` routes via `lib/supabaseAdmin.ts`).
- **Per-user policies** keyed off `auth.uid() = (SELECT email FROM auth.users WHERE id = auth.uid())`. These are scaffolded for Supabase Auth but unused — current API routes always use the service role client and authenticate via NextAuth session email instead.

V2 schema starts fresh and adopts the policy pattern from `docs/guildy-v2-tech-spec-v0.md:135-136`: per-user RLS keyed on `auth.uid() = user_id` for every new table.

### Storage buckets

None found in repo. No bucket-creation SQL or storage client usage. Phase 1 must create the **private resume bucket** and configure signed-URL access (`docs/guildy-v2-tech-spec-v0.md:138, 145-156`).

### Migration history (12 files, chronological)

1. `20240107_add_missing_columns.sql` (Jan 7)
2. `add_predicted_stages.sql` (Jan 8)
3. `setup_pipelines.sql` (Jan 9)
4. `fix_rls_policies.sql` (Jan 9)
5. `wipe_pipelines.sql` (Jan 9)
6. `wipe_all.sql` (Jan 10)
7. `ensure_log_table.sql` (Jan 11)
8. `fix_security_advisor.sql` (Jan 13)
9. `consolidated_fix.sql` (Jan 14)
10. `20260121_enable_rls_all_tables.sql` (Jan 21)
11. `v2_detection.sql` (Feb 21)
12. `v3_pipeline_threads.sql` (Mar 16)

---

## 5. Auth inventory

- **Current auth:** NextAuth v4 + GoogleProvider with `openid email profile https://www.googleapis.com/auth/gmail.readonly` scope, `access_type: offline`, JWT session strategy. Token refresh hits `oauth2.googleapis.com/token` directly (`lib/auth.ts:14-48`).
- **Files involved:**
  - `middleware.ts:1-14` — `withAuth` global guard, JWT presence check
  - `lib/auth.ts:1-95` — `authOptions` source of truth
  - `app/api/auth/[...nextauth]/route.ts:1-42` — NextAuth handler (duplicate provider config — diverges from `lib/auth.ts`, both define the same provider)
  - `app/login/page.tsx:3` — `signIn("google")` trigger
  - `app/(dashboard)/settings/page.tsx:3` — `useSession`/`signIn`/`signOut`
  - `components/SessionProvider.tsx:3` — `SessionProvider` wrapper around the dashboard
  - `lib/storage.ts:4` — `GMAIL_CONNECTED` localStorage key (UI-side connection memory)
  - All API routes call `getServerSession(authOptions)` (`app/api/gmail/sync/route.ts:432`, `app/api/pipelines/route.ts:2`, `app/api/pipelines/[id]/route.ts:2`, `app/api/debug/*/route.ts:2`)
- **Magic link readiness:** Supabase client wrappers exist (`lib/supabaseAdmin.ts:1-40`, `lib/supabaseClient.ts:1-6`) and the env vars `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are already wired. **No magic link code exists yet.** No `/auth/callback` route. No `signInWithOtp` call anywhere.
- **Phase 1 changes required:**
  1. Delete `lib/auth.ts`, `app/api/auth/[...nextauth]/`, `components/SessionProvider.tsx`, `lib/storage.ts`
  2. Wire Supabase magic link in `app/login/page.tsx` (`supabase.auth.signInWithOtp`)
  3. Create `app/auth/callback/route.ts` to exchange the code for a session
  4. Replace `middleware.ts` with Supabase session check (read `sb-` cookie via `@supabase/ssr` or equivalent)
  5. Create `/onboarding` route with resume PDF upload + text extraction + paste fallback (`docs/guildy-v2-tech-spec-v0.md:145-156`)
  6. Remove deps `next-auth` and `googleapis` from `package.json`

---

## 6. Stripe inventory

**ABSENT.** Confirmed by Phase 0.2 grep:
- No `stripe` or `@stripe/stripe-js` in `package.json:11-69`
- No `STRIPE_*` env vars referenced anywhere in code
- No `/api/stripe/*` routes
- All grep matches for "Stripe" are V1 code being deleted: `lib/demo-pipelines.ts:80` (competitors string array), `lib/guildy/recruitingClassifier.ts:30` (prompt example), `lib/guildy/gmailProcessor.ts:398` (comment about company-name upgrades)

Phase 1 sets up fresh per `docs/guildy-v2-tech-spec-v0.md:771-783`: create $19.99/mo product/price, install `stripe` dep, build `/api/stripe/checkout` + `/api/stripe/webhook` (with signature verification), wire `subscription_status` updates into `user_profiles`. UI gating waits until Phase 6.

---

## 7. AI/model inventory

- **OpenAI:** `openai@^4.0.0` present (`package.json:15`). Active calls:
  - `gpt-4o-mini` classifier (`lib/guildy/recruitingClassifier.ts:77`, `temperature: 0.1`, `max_tokens: 350`, JSON-only response format)
  - `gpt-4o` rich prep (`app/api/gmail/sync/route.ts:205`, `temperature: 0.5`, `max_tokens: 6000`)
  - `gpt-4o` standalone batch util in `scripts/force_update_prep.ts:118` (also DELETE)
  - Reusable for V2 with model string change to **GPT-5.4 nano** in a new `lib/ai/quick-prep.ts`. The client wrapper survives.
- **Anthropic:** **ABSENT.** No `@anthropic-ai/sdk` dep. Phase 6 must add for **Claude Sonnet 4.6** Deep Prep.
- **Perplexity:** **ABSENT.** No web research provider integration. Phase 6 adds behind `lib/ai/research.ts` abstraction (`docs/guildy-v2-tech-spec-v0.md:175-176`).
- **Prompts:** Inline in V1 files (~200 LOC system prompt in `app/api/gmail/sync/route.ts:94-191`, classifier prompt in `lib/guildy/recruitingClassifier.ts:14-51`). All deleted with their host files. V2 builds new `lib/ai/quick-prep.ts` and `lib/ai/deep-prep.ts` per `docs/guildy-v2-tech-spec-v0.md:159-167`.
- **Streaming:** None — all current calls are non-streaming `chat.completions.create`. V2 should consider streaming for Deep Prep UX (long-running calls per `docs/guildy-v2-tech-spec-v0.md:124`).

---

## 8. Reusable component inventory

| Component/Module | Location | Action |
|---|---|---|
| Supabase admin client | `lib/supabaseAdmin.ts:1-40` | KEEP (already idiomatic, service-role-aware) |
| Supabase browser client | `lib/supabaseClient.ts:1-6` | KEEP (extend with auth helpers in Phase 1) |
| `cn` class-merge helper | `lib/utils.ts:1-7` | KEEP |
| shadcn/Radix UI primitives | `components/ui/` | KEEP WITH CHANGES (15+ Radix packages already installed per `package.json:18-44`; deeper audit in Phase 2 when building Kanban + overlay) |
| Theme provider | `components/theme-provider.tsx` | KEEP |
| Tailwind / design tokens | `styles/`, `tailwind.config` (implicit via v4 PostCSS plugin), `app/globals.css` | KEEP |
| Health check + cron | `app/api/health/route.ts` + `vercel.json:2-6` | KEEP (Supabase keep-alive — already saved Supabase from auto-pause per commit `1a121c0`) |
| Public assets | `public/images/`, `app/icon.svg` | KEEP |
| Root layout | `app/layout.tsx` | KEEP (strip `SessionProvider` wrapping in Phase 1) |
| Marketing/legal pages | `app/about/`, `app/security/` | KEEP (review copy); `app/privacy/`, `app/terms/` REPLACE (gmail.readonly scope mentions at `app/privacy/page.tsx:52`, `app/terms/page.tsx:62`) |
| Middleware shell | `middleware.ts:1-14` | REPLACE (NextAuth `withAuth` → Supabase session) |
| Top-level page redirect | `app/page.tsx` | KEEP shell, retarget to `/app` |

Note: `tailwind.config.*` not present in repo root — config implied via Tailwind v4 (`@tailwindcss/postcss` in `package.json:71`) and `app/globals.css`. Confirm config style during Phase 2.

---

## 9. Keep / Delete / Rebuild summary table

| Category | Keep | Delete | Rebuild |
|---|---|---|---|
| Routes | `/api/health` | `/api/auth/[...nextauth]`, `/api/gmail/*`, `/api/pipelines/*`, `/api/debug/*`, `/login` (replace UI), `/privacy` and `/terms` (replace copy), `/(dashboard)/pipelines`, `/(dashboard)/settings` | `/app` (Home), `/onboarding`, `/auth/callback`, `/api/jobs`, `/api/jobs/[id]/activate`, `/api/jobs/[id]/stage`, `/api/jobs/[id]/context`, `/api/prep/generate`, `/api/prep/[id]/regenerate`, `/api/research/company`, `/api/research/interviewer`, `/api/stripe/checkout`, `/api/stripe/webhook` |
| Components | `components/ui/*` (verify in Phase 2), `components/theme-provider.tsx` | `SessionProvider.tsx`, `connect-gmail-button.tsx`, `onboarding-banner.tsx`, `pipeline-card.tsx`, `pipeline-card-list.tsx`, `pipeline-list.tsx`, `job-row.tsx`, `job-detail-panel.tsx`, `job-detail-drawer.tsx`, `gantt-pipeline-view.tsx`, `mobile-bottom-sheet.tsx`, `eta-chip.tsx`, `stage-node.tsx`, `status-tag.tsx`, `top-nav.tsx` | Active Kanban board (dnd-kit), passive table, search bar, Prep Overlay (floating widgets over blurred pipeline), Role Context widget, Inputs widget, Questions widget, Interviewer card |
| Lib | `lib/supabaseAdmin.ts`, `lib/supabaseClient.ts`, `lib/utils.ts` | `lib/auth.ts`, `lib/storage.ts`, `lib/demo-pipelines.ts`, `lib/heuristics.ts`, `lib/guildy/` (5 files: gmailProcessor, recruitingClassifier, router, normalizers, types) | `lib/ai/quick-prep.ts`, `lib/ai/deep-prep.ts`, `lib/ai/research.ts` (Perplexity), `lib/ai/context-assembly.ts`, `lib/ai/cache.ts`, `lib/ai/rate-limit.ts`, `lib/stripe.ts`, `lib/auth/` (Supabase session helpers) |
| Schema | (nothing) | `pipelines`, `emails`, `pipeline_threads`, `dismissed_threads`, `ghost_logs`, `stage_history`, `email_processing_log`, `sync_runs`, `interviewers`, `test_pipelines` (10 tables); confirm waitlist preservation for `early_access_requests` | `user_profiles`, `jobs`, `stage_events`, `job_context`, `prep_versions`, `stage_labels`, `subscriptions` (per `docs/guildy-v2-tech-spec-v0.md:189-249`) |
| Auth | (nothing) | NextAuth v4 + GoogleProvider + gmail.readonly + `googleapis` token refresh | Supabase magic link (`signInWithOtp`), `/auth/callback`, Supabase session middleware, `/onboarding` resume gate |
| Scripts | (nothing) | `scripts/force_update_prep.ts`, `scripts/check_migration.ts`, `scripts/run-migration.ts`, `scripts/diagnose_sync.ts`, `scripts/debug_errors.ts` | (none planned for Phase 1) |
| Env vars | `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` | `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY` (Phase 6), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Deps to remove | — | `next-auth`, `googleapis` | `stripe`, `@anthropic-ai/sdk`, `@supabase/ssr` (or equivalent for cookie-based session), PDF text extractor (`pdf-parse` or `unpdf`) |

---

## 10. V2 implementation risks

| Risk | Severity | Mitigation |
|---|---|---|
| Supabase project paused state | Medium | `/api/health` daily cron already in place (`vercel.json:3-6`, commit `1a121c0`) keeps Supabase warm. Confirm project is unpaused before Phase 1 schema reset. |
| Destructive schema reset | High | SQL-dump V1 schema + data to a local archive before `DROP TABLE` in Phase 1. No real users in private beta per `docs/guildy-v2-tech-spec-v0.md:946-947`, but `early_access_requests` may hold real waitlist signups — preserve before drop. |
| Auth transition (NextAuth → magic link) | High | Clean rip in single Phase 1 commit. Magic link only, no Google sign-in fallback per `phase-0-resolutions.md:73`. Test login → onboarding gate → `/app` end-to-end before merging. |
| Stripe state | Low | Green field. No existing customers, no test products. Phase 1 creates fresh $19.99/mo product. Webhook signature verification mandatory (`docs/guildy-v2-tech-spec-v0.md:660`). |
| Model availability (GPT-5.4 nano, Sonnet 4.6) | Medium | Confirm both models accessible at the time Phase 5/6 begin. Model routing layer (`lib/ai/quick-prep.ts`, `lib/ai/deep-prep.ts`) makes swaps cheap, but prompt tuning may need adjustment if models change. |
| Floating overlay responsive complexity | Medium | Build mobile full-screen takeover first (`docs/guildy-v2-tech-spec-v0.md:381-388`), layer widget composition on desktop. Don't try to make widgets responsive in one go. |
| Preserving too much V1 code | High | Aggressive bias toward delete-and-rebuild per `docs/guildy-v2-tech-spec-v0.md:889-893`. Anything ambiguous goes; carrying V1 logic forward will create confusion. The audit lists every V1 file by name to make deletion mechanical, not exploratory. |
| Drift toward cut features (Gmail sync, Gantt, comparison matrix, story bank, etc.) | Medium | `phase-0-resolutions.md:7-60` is the contract. Reject any V2 prompt that reintroduces these. Audit findings here are the deletion checklist. |

---

## 11. Phase 1 recommendations

### Implementation order

1. **SQL dump V1 schema as safety backup** (export full Supabase DB to local SQL file).
2. **Drop V1 tables** in single migration: `pipelines`, `emails`, `pipeline_threads`, `dismissed_threads`, `ghost_logs`, `stage_history`, `email_processing_log`, `sync_runs`, `interviewers`, `test_pipelines`. Decision on `early_access_requests` per Michael's call (preserve recommended).
3. **Apply V2 schema migration**: `user_profiles`, `jobs`, `stage_events`, `job_context`, `prep_versions`, `stage_labels`, `subscriptions` per `docs/guildy-v2-tech-spec-v0.md:189-249`. Per-user RLS on every table keyed on `auth.uid() = user_id`.
4. **Regenerate `lib/database.types.ts`** from new schema.
5. **Rip NextAuth**: delete `lib/auth.ts`, `app/api/auth/[...nextauth]/`, `components/SessionProvider.tsx`, `lib/storage.ts`. Strip `SessionProvider` from `app/layout.tsx`. Delete dependent V1 routes (`/api/gmail/*`, `/api/pipelines/*`, `/api/debug/*`).
6. **Remove deps**: `googleapis`, `next-auth` from `package.json:13-14`. Add `@supabase/ssr` (or equivalent), `stripe`, `@anthropic-ai/sdk` (Phase 6 actually uses it but install now), and a PDF text extractor.
7. **Implement Supabase magic link** in `/login` (`signInWithOtp`) and `/auth/callback` (code → session exchange).
8. **Replace `middleware.ts`** with Supabase session check via cookie-based SSR client.
9. **Create `/onboarding`** route with resume PDF upload to private bucket + text extraction + paste fallback. Hard-gate prep generation on usable `resume_text` per `phase-0-resolutions.md:124-126`.
10. **Stripe skeleton**: install `stripe` dep, create $19.99/mo product/price (manual via Stripe dashboard or CLI), build `/api/stripe/checkout` + `/api/stripe/webhook` with signature verification. **No paywall UI yet** — full gating wired in Phase 6.
11. **Update env vars in Vercel**: remove `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`. Add `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. (`PERPLEXITY_API_KEY` can wait until Phase 6.)
12. **Create resume storage bucket** (private) in Supabase + signed-URL helper.
13. **Update `.guildhall/quests.json`** to mark Phase 1 complete and roll forward.

### Manual prerequisites for Michael (cannot run from CC CLI)

- Confirm Supabase project is unpaused and accessible
- Decide on `early_access_requests` waitlist preservation — recommend **PRESERVE**
- Create Stripe account (or confirm existing) and product/price for $19.99/mo (or grant CC CLI Stripe API access to do it)
- Add new env vars to Vercel project settings (`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- Remove old env vars from Vercel project settings (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`)
- Run `git tag v1-archive` against current `main` HEAD before Phase 1 merges (`docs/guildy-v2-tech-spec-v0.md:706`)

---

## 12. Open questions for Michael

None — Phase 1 ready to proceed once the manual prerequisites in §11 are checked off. The waitlist preservation is the only judgment call, and the recommendation (preserve) is safe and reversible.

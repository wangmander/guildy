# Guildy — Claude Instructions

## Project Overview

Guildy is a recruiting pipeline + interview prep app. It syncs Gmail, detects recruiting emails, tracks job application pipelines by company, and generates rich AI-powered interview prep. Built for Vercel Pro deployment.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Radix UI, Supabase Postgres, OpenAI API, NextAuth (Google OAuth)

---

## User Preferences

- No emojis unless explicitly asked
- Concise responses — lead with the answer, not the reasoning
- Always commit and push after making changes — never leave work uncommitted

---

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only, bypasses RLS
OPENAI_API_KEY=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## Key Commands

```bash
npm run dev      # local dev server
npm run build    # production build (TypeScript + ESLint errors ignored)
npm run start    # start prod server
npm run lint     # ESLint
```

---

## Architecture

### App Structure

```
app/
  (dashboard)/
    pipelines/page.tsx     # main UI — protected
    settings/page.tsx      # user settings — protected
    layout.tsx
  api/
    auth/[...nextauth]/    # NextAuth Google OAuth
    gmail/
      sync/route.ts        # main sync orchestrator (V2, 120s maxDuration)
      status/route.ts      # sync run stats + history
    pipelines/
      route.ts             # GET all pipelines (filters dismissed threads)
      [id]/route.ts        # DELETE pipeline + dismiss threads
    debug/
      logs/route.ts        # email_processing_log (last 20 entries)
      status/route.ts
      dedup/route.ts
  page.tsx                 # redirects to /pipelines
  login/page.tsx
  layout.tsx               # root layout with SessionProvider

lib/
  guildy/
    types.ts               # EmailSignal, RecruitingAnalysisResult, RouterDecision, ProcessResult
    gmailProcessor.ts      # processEmailSignal, findOrCreatePipeline, applyStageDelta
    recruitingClassifier.ts # gpt-4o-mini LLM classifier call
    router.ts              # isHardJunk, getRouterDecision, warm lead scoring
    normalizers.ts         # normalize, stripHtml, extractBodyFromPayload, companiesMatch
  auth.ts                  # NextAuth config + token refresh
  supabaseAdmin.ts         # service role client (server-only, never expose to browser)
  supabaseClient.ts        # anon client (browser-safe)
  utils.ts
  demo-pipelines.ts

components/
  pipeline-card.tsx        # pipeline card with hover-delete button
  pipeline-card-list.tsx
  job-detail-panel.tsx     # rich detail view with prep sections
  job-detail-drawer.tsx
  gantt-pipeline-view.tsx
  top-nav.tsx
  mobile-bottom-sheet.tsx
  SessionProvider.tsx
  connect-gmail-button.tsx
  stage-node.tsx
  status-tag.tsx
  ui/                      # Radix UI component library

types/index.ts             # Stage, Status, Job, InterviewPrep types
middleware.ts              # protects /pipelines, /settings routes
supabase/
  schema.sql               # base schema
  migrations/
    v2_detection.sql       # V2 migration — run in Supabase SQL Editor
```

---

## Database

Supabase Postgres. Service role key used server-side (bypasses RLS). All API routes use `supabaseAdmin`.

### Tables

**`pipelines`** — one per company/thread
- `id` (UUID PK), `user_email`, `company`, `role`, `stage`, `stage_detail`, `status`
- `gmail_thread_id` — used for thread inheritance
- `last_email_subject`, `last_email_at`, `last_email_from_email`, `last_email_from_name`, `last_email_snippet`
- `prep_json` — rich prep from gpt-4o
- `insights_json`, `company_intel_json`
- `predicted_stages` (array), `updated_at`

**`emails`** — one per Gmail message
- `id`, `user_email`, `pipeline_id` (FK), `gmail_message_id` (UNIQUE), `gmail_thread_id`
- `from_name`, `from_email`, `body_text`, `subject`, `snippet`, `received_at`
- `is_recruiting`, `message_type`, `llm_confidence`, `llm_summary`

**`email_processing_log`** — detection audit trail (every decision)
- `gate` (THREAD_INHERITANCE | LLM_CLASSIFIED), `outcome`, `router_reason`, `router_score`
- `llm_confidence`, `llm_model`, `llm_response`

**`sync_runs`** — per-sync stats
- `scanned`, `detected`, `inserted`, `updated`, `skipped`, `rejected`, `errors`

**`ghost_logs`** — rejected email debug (internal only, never shown to users)
- Created for: `hard_junk_reject`, `router_no_match`, `llm_non_recruiting`

**`stage_history`** — immutable stage change audit
- `from_stage`, `to_stage`, `reason`, `gmail_message_id`, `llm_confidence`

**`dismissed_threads`** — suppresses re-creation after pipeline deletion
- `(user_email, gmail_thread_id)` unique — checked at top of `processEmailSignal`

### Running Migrations

Run SQL files in Supabase SQL Editor (not CLI). V2 migration: `supabase/migrations/v2_detection.sql`

---

## V2 Detection Architecture

Thread-first, LLM-classified. No `advances_pipeline` gate. Last rewrite: Feb 2026.

### Sync Phases (in `app/api/gmail/sync/route.ts`)

**Phase A — Prep**
- Load `dismissed_threads` for this user
- Load `processedMsgMap` (all gmail_message_ids already in DB) — skips re-processing
- Load pipeline prep scores for budget decisions

**Phase B — Pre-filter**
- Fetch recent Gmail message list
- Skip dismissed threads and already-processed messages with sufficient prep

**Phase C — Parallel Gmail fetch**
- Fetch full message data in batches of 10

**Phase D — Sequential LLM classification** (deadline-guarded at 70s)
- Call `processEmailSignal` for each message (see below)

**Phase E — Parallel prep generation**
- All prep jobs fire concurrently after email loop

### `processEmailSignal` Pipeline (in `lib/guildy/gmailProcessor.ts`)

```
1. Check dismissed_threads → skip if matched

2. Thread Inheritance
   ├─ Find pipeline by (user_email, gmail_thread_id) → always append, no re-detection
   └─ Fallback: check emails table for threadId → resolve via email.pipeline_id

3. Hard Junk Sieve (isHardJunk)
   └─ Checks subject+snippet+sender ONLY — never body (footers cause false rejects)
      Rejects: shipping, auth codes, school admissions, blocked senders
      → reject: ghost_log + return

4. Warm Lead Router (getRouterDecision)
   ├─ ATS domain check (22+ platforms: Greenhouse, Lever, Ashby, Workday, etc.)
   ├─ Jobish subject keywords
   ├─ Warm lead score (40+ phrases)
   └─ Any match → route to LLM; else → ghost_log + return

5. LLM Classification (gpt-4o-mini, analyzeRecruitingEmailWithLLM)
   ├─ Returns: is_recruiting, confidence, company_name, job_title, message_type, stage_delta, summary
   └─ Not recruiting → ghost_log + detection_log + return

6. findOrCreatePipeline
   ├─ Thread ID match
   ├─ Company name fuzzy match (companiesMatch: exact → substring → Levenshtein ≤ 1)
   └─ Create new pipeline if no match

7. appendPipelineMessage (upsert on gmail_message_id)

8. applyStageDelta (regression-safe stage advancement → stage_history)

9. Rich Prep Generation (gpt-4o, triggered for: new pipeline | stage advance | high-signal message type)
```

### LLM Budget Per Sync

- `MAX_MINI_CALLS = 80` — gpt-4o-mini (classifier)
- `MAX_PREP_CALLS = 12` — gpt-4o (rich prep generation)
- `SYNC_DEADLINE_MS = 70_000` — hard stop (Vercel maxDuration = 120s)

---

## UI Stages

Pipelines progress through these stages (left to right in UI):

```
SCREENING → HIRING_MANAGER → PRESENTATION → FULL_LOOP → OFFER_DISCUSSION → REJECTED
```

### LLM `stage_delta` → UI Stage Mapping

| LLM value | UI Stage |
|---|---|
| `applied`, `screen` | `SCREENING` |
| `technical` | `PRESENTATION` |
| `onsite` | `FULL_LOOP` |
| `offer` | `OFFER_DISCUSSION` |
| `rejected` | `REJECTED` |
| `withdrawn` | `SCREENING` |
| `none` | (no change) |

---

## Pipeline Deletion

- `DELETE /api/pipelines/[id]` — hard deletes pipeline + cascades emails + stage_history
- Records all thread IDs for that pipeline in `dismissed_threads`
- `processEmailSignal` checks `dismissed_threads` at the top — skips silently
- NEW threads from same company still pass through (different threadId, not in dismissed_threads)
- UI: X button appears on hover via `group/card` Tailwind class on card container
- Optimistic removal in UI; re-fetches on failure

---

## Rich Prep Generation

- Uses `gpt-4o` with 6000 token budget
- Triggered for: new pipelines, stage advances, high-signal message types (scheduling, interview_invite, assessment, rejection, offer)
- Returns JSON with sections: `companyIntel`, `interviewStrategy`, `interviewerIntel`, `stageRoadmap`, `compensationIntel`, `prepChecklist`
- Richness scoring: only replaces old prep if new prep is richer
- Stored in `pipelines.prep_json`

---

## Auth

- NextAuth with Google OAuth
- Gmail scopes: `gmail.readonly`, `email`, `profile`
- Offline access (refresh_token issued)
- JWT session strategy
- Token refresh on expiration in `lib/auth.ts`
- Middleware (`middleware.ts`) protects `/pipelines` and `/settings`

---

## Critical Implementation Rules

1. **Never read email body in hard junk filter** — footers/unsubscribe text causes false rejects. Use subject+snippet+sender only.
2. **Thread inheritance always wins** — if a threadId matches an existing pipeline, append without re-running detection. This handles recruiter follow-ups, scheduling emails, etc.
3. **`supabaseAdmin` is server-side only** — never import in components or client code. It uses the service role key.
4. **Idempotent upserts** — emails upsert on `gmail_message_id` UNIQUE constraint. Safe to re-run sync.
5. **Stage regression prevention** — `applyStageDelta` never moves a stage backward unless explicitly to REJECTED. Stages are ordered; always check current stage before advancing.
6. **Dismissed threads are permanent** — once in `dismissed_threads`, that threadId never creates a pipeline again. New threads from the same company are fine.
7. **ghost_logs are debug-only** — never surface ghost_log entries to users in the UI.

---

## Deployment

- **Platform:** Vercel Pro
- **maxDuration:** 120s (set in sync route)
- **Sync hard stop:** 70s (leaves buffer for final DB writes)
- **Region:** default (no special config)

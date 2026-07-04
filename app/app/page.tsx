import { redirect } from "next/navigation"

import { Board, type JobRow, type InterviewerInfo } from "@/components/app/board"
import {
  CommandRail,
  type ApplyGoal,
  type OnboardingMoment,
  type SetupChecklist,
  type TodayItem,
} from "@/components/app/command-rail"
import { TcMatrixSheet } from "@/components/app/tc-matrix-sheet"
import { type TcColumn } from "@/components/app/tc-matrix"
import { TopNav } from "@/components/app/top-nav"
import { type CompPrioritiesRaw } from "@/lib/compMatrix/dimensions"
import { applyProjection } from "@/lib/jobSourceAdvisor/applyProjections"
import { selectAdvisor } from "@/lib/jobSourceAdvisor/boardRatings"
import {
  deriveQuest,
  deriveReadiness,
  highestMilestone,
  type JobQuest,
} from "@/lib/quests/quests"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { JobCompensation } from "@/types"

// Patch 5.4: Vercel server actions inherit maxDuration from the invoking
// page. 240s covers worst-case Deep flow (Haiku 60s + Sonnet 180s) past the
// AbortController fires. Lives here because Next 14 "use server" files
// cannot export non-async constants.
// Feature 4: negotiation worst case is Haiku grounding (60s) + Opus
// generation (~210s AbortController). 300 is the Vercel Pro hard cap and
// leaves margin past the cumulative timeout.
export const maxDuration = 300

type SearchParams = { [key: string]: string | string[] | undefined }

export default async function AppPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [
    { data: jobs },
    { data: profile },
    { data: interviewerRows },
    { data: noteRows },
    { data: prepRows },
    { data: compRows },
    { data: archivedJobsData },
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, company_name, role_title, tc, state, stage, source_url, jd_text, latest_message, full_loop_session_config, created_at, prep_status"
      )
      .eq("user_id", user.id)
      // Active-only board fetch. Everything derived below (rail, Today, TC
      // matrix, quests, apply goal) reads ONLY this active set, so archived
      // jobs never pollute stats or the advisor. Archived jobs are fetched
      // separately (last query) and handed solely to <Board> for the toggle.
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_profiles")
      .select(
        "resume_text, subscription_status, current_period_end, stripe_customer_id, comp_priorities"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("job_context")
      .select("job_id, content, metadata, created_at")
      .eq("user_id", user.id)
      .eq("type", "interviewer")
      .order("created_at", { ascending: false }),
    supabase
      .from("job_context")
      .select("job_id, content, created_at")
      .eq("user_id", user.id)
      .eq("type", "note")
      .order("created_at", { ascending: false }),
    // Prep presence per job for the Today panel. One aggregated read of
    // job_id only; a job counts as prepped if any prep_versions row exists.
    supabase.from("prep_versions").select("job_id").eq("user_id", user.id),
    // Comp rows for the TC matrix. One read for all of the user's rows; the
    // late-stage columns are filtered client-of-query below (no N+1).
    supabase.from("job_compensation").select("*").eq("user_id", user.id),
    // Archived jobs, in one parallel read (no N+1). Fed ONLY to <Board> for
    // the "Show archived" toggle; intentionally excluded from every server
    // derivation above so stats/Today/rail/TC stay active-only.
    supabase
      .from("jobs")
      .select(
        "id, company_name, role_title, tc, state, stage, source_url, jd_text, latest_message, full_loop_session_config, created_at, prep_status"
      )
      .eq("user_id", user.id)
      .not("archived_at", "is", null)
      .order("created_at", { ascending: false }),
  ])

  const hasResume = !!profile?.resume_text && profile.resume_text.trim().length > 0

  // Latest-wins: rows are already sorted desc, so the first row per job_id wins.
  const interviewerByJobId: Record<string, InterviewerInfo> = {}
  for (const row of interviewerRows ?? []) {
    if (interviewerByJobId[row.job_id]) continue
    const meta = row.metadata as
      | { name?: string | null; title?: string | null; link?: string | null }
      | null
    interviewerByJobId[row.job_id] = {
      name: meta?.name ?? row.content ?? null,
      title: meta?.title ?? null,
      link: meta?.link ?? null,
    }
  }

  const noteByJobId: Record<string, string> = {}
  for (const row of noteRows ?? []) {
    if (noteByJobId[row.job_id]) continue
    if (typeof row.content === "string" && row.content.length > 0) {
      noteByJobId[row.job_id] = row.content
    }
  }

  const jobParam = searchParams?.job
  const initialOpenJobId = typeof jobParam === "string" ? jobParam : null

  // Handoff landing: ?new flags the just-created card for its one-time
  // entrance animation. Separate from ?job so the overlay stays closed.
  const newParam = searchParams?.new
  const initialNewJobId = typeof newParam === "string" ? newParam : null

  // Command rail: real stats + automatic Job Source Advisor, both derived
  // from the user's actual cards. Closed cards are excluded (hidden on Home).
  const jobRows = (jobs ?? []) as JobRow[]
  // Archived rows are passed straight to <Board>; nothing else reads them.
  const archivedJobRows = (archivedJobsData ?? []) as JobRow[]
  const nonClosed = jobRows.filter((j) => j.stage !== "closed")
  // jobs are ordered created_at desc, so nonClosed is already recency-first.
  const advisor = selectAdvisor(nonClosed.map((j) => j.role_title))

  // Today panel: prioritized "what to move next", capped at 3, server-built
  // from real kanban + prep state. nonClosed is recency-first, so stable
  // sorts preserve recency for ties.
  const preppedJobIds = new Set((prepRows ?? []).map((r) => r.job_id))
  const INTERVIEW_STAGES = new Set([
    "screen",
    "hiring_manager",
    "interview_loop",
    "final",
  ])
  // Full Loop (interview_loop / final) > Hiring Manager > Screen.
  const STAGE_RANK: Record<string, number> = {
    final: 3,
    interview_loop: 3,
    hiring_manager: 2,
    screen: 1,
  }
  const STAGE_LABEL: Record<string, string> = {
    screen: "Screen",
    hiring_manager: "Hiring Manager",
    interview_loop: "Full Loop",
    final: "Full Loop",
  }

  const todayItems: TodayItem[] = []
  if (nonClosed.length > 0) {
    // 1. Prep due: interview-stage jobs with no prep, latest-stage first.
    const prepDue = nonClosed
      .filter((j) => INTERVIEW_STAGES.has(j.stage) && !preppedJobIds.has(j.id))
      .sort((a, b) => STAGE_RANK[b.stage] - STAGE_RANK[a.stage])
    for (const j of prepDue) {
      todayItems.push({
        kind: "prep_due",
        jobId: j.id,
        company: j.company_name,
        stageLabel: STAGE_LABEL[j.stage],
      })
    }

    // 2. Quick Prep gap: one Applied job with no prep (capped at 1 slot).
    if (todayItems.length < 3) {
      const gap = nonClosed.find(
        (j) => j.stage === "applied" && !preppedJobIds.has(j.id)
      )
      if (gap) {
        todayItems.push({
          kind: "quick_prep_gap",
          jobId: gap.id,
          company: gap.company_name,
        })
      }
    }

    // 3. Source nudge: top advisor board, seed mode only (boards known
    // server-side), single slot.
    if (
      todayItems.length < 3 &&
      advisor.mode === "seed" &&
      advisor.roleLabel &&
      advisor.boards.length > 0
    ) {
      const top = advisor.boards[0]
      todayItems.push({
        kind: "source_nudge",
        board: top.board,
        role: advisor.roleLabel,
        score: top.score,
      })
    }

  }
  const today = todayItems.slice(0, 3)

  // Apply goal: a persistent meter pinned at the bottom of the Today panel,
  // not a priority slot. loggedThisWeek counts jobs created in the last
  // rolling 7 days (any stage/state, it measures logging activity, not true
  // applications which we cannot see). The projection is tailored to the most
  // recent non-closed role. Null when the user has no non-closed jobs.
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000
  const rawJobs = (jobs ?? []) as Array<{ created_at: string }>
  const loggedThisWeek = rawJobs.filter(
    (j) => new Date(j.created_at).getTime() >= sevenDaysAgoMs
  ).length
  const applyGoal: ApplyGoal | null =
    nonClosed.length > 0
      ? { loggedThisWeek, projection: applyProjection(nonClosed[0].role_title) }
      : null

  // TC comparison matrix: one column per Offer-stage job. The matrix is for
  // comparing real offers, so it stays hidden until a job reaches Offer.
  // Comp rows fetched in one query above; attached by job_id here.
  const compByJobId: Record<string, JobCompensation> = {}
  for (const row of (compRows ?? []) as JobCompensation[]) {
    compByJobId[row.job_id] = row
  }
  const tcColumns: TcColumn[] = jobRows
    .filter((j) => j.stage === "offer")
    .map((j) => ({
      jobId: j.id,
      company: j.company_name,
      role: j.role_title,
      tc: j.tc,
      comp: compByJobId[j.id] ?? null,
    }))

  // Quest system (Phase 2A): per-job quest + coarse readiness, and the single
  // highest milestone (drives the guide gem). Derived from kanban + prep_status
  // state; no new data model.
  const questByJobId: Record<string, JobQuest> = {}
  for (const j of nonClosed) {
    const info = interviewerByJobId[j.id]
    const hasInterviewer = !!(info && (info.name || info.title || info.link))
    const hasJd = !!j.jd_text && j.jd_text.trim().length > 0
    const readiness = deriveReadiness(j.prep_status, hasJd, hasInterviewer)
    const cfg = j.full_loop_session_config as
      | Record<string, { enabled?: boolean }>
      | null
    const roundCount = cfg
      ? Object.values(cfg).filter((r) => r?.enabled).length || 4
      : 4
    questByJobId[j.id] = deriveQuest(
      j.stage,
      j.company_name,
      readiness,
      roundCount
    )
  }
  const milestone = highestMilestone(nonClosed.map((j) => j.stage))

  // Just-in-time onboarding moment (gem-guide section 6). Empty active board ->
  // the passive prompt; a single freshly-added, unprepped Applied job -> the
  // "after the first job" nudge. "New stage reached" is deferred (no stage-event
  // signal yet). Both are derived from data already in hand.
  const onboarding: OnboardingMoment | null =
    nonClosed.length === 0
      ? { kind: "empty" }
      : nonClosed.length === 1 &&
          nonClosed[0].stage === "applied" &&
          !preppedJobIds.has(nonClosed[0].id)
        ? { kind: "first_job", company: nonClosed[0].company_name }
        : null

  // FTUE setup checklist (G0 growth build). Walks a new user from 0 jobs to
  // activated (3+ non-archived jobs AND a first prep). Everything is derived,
  // no schema: activeJobCount drives the "X of 3" progress; hasPrep is any
  // prep_versions row (Quick or Deep, including the handoff's cached Quick).
  // Hide-forever gate uses TOTAL job rows (active + archived) so an activated
  // user who archives back below 3 never gets the checklist again. Nothing is
  // hard-deleted in-app, so "3 rows ever + a prep" cleanly means "activated".
  const activeJobCount = jobRows.length
  const totalJobCount = jobRows.length + archivedJobRows.length
  const hasPrep = preppedJobIds.size > 0
  const isActivated = totalJobCount >= 3 && hasPrep
  const setup: SetupChecklist | null = isActivated
    ? null
    : {
        activeJobCount,
        hasPrep,
        mostRecentJobId: jobRows[0]?.id ?? null,
      }

  return (
    <div className="min-h-screen bg-[var(--page-bg)]">
      <TopNav
        email={user.email ?? ""}
        subscriptionStatus={
          (profile?.subscription_status as string | null) ?? "free"
        }
        hasStripeCustomer={!!profile?.stripe_customer_id}
      />
      <main className="mx-auto w-full max-w-[1440px] pt-6 pb-24">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-0">
          <CommandRail
            advisor={advisor}
            today={today}
            applyGoal={applyGoal}
            milestone={milestone}
            onboarding={onboarding}
            setup={setup}
          />
          <div className="min-w-0 flex-1">
            <Board
              jobs={jobRows}
              archivedJobs={archivedJobRows}
              hasResume={hasResume}
              resumeText={profile?.resume_text ?? null}
              subscriptionStatus={
                (profile?.subscription_status as string | null) ?? "free"
              }
              currentPeriodEnd={
                (profile?.current_period_end as string | null) ?? null
              }
              interviewerByJobId={interviewerByJobId}
              noteByJobId={noteByJobId}
              questByJobId={questByJobId}
              initialOpenJobId={initialOpenJobId}
              initialNewJobId={initialNewJobId}
            />
          </div>
        </div>
        <TcMatrixSheet
          columns={tcColumns}
          subscriptionStatus={
            (profile?.subscription_status as string | null) ?? "free"
          }
          currentPeriodEnd={
            (profile?.current_period_end as string | null) ?? null
          }
          compPriorities={
            (profile?.comp_priorities as CompPrioritiesRaw) ?? null
          }
        />
      </main>
    </div>
  )
}

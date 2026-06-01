import { redirect } from "next/navigation"

import { Board, type JobRow, type InterviewerInfo } from "@/components/app/board"
import { CommandRail, type RailStats } from "@/components/app/command-rail"
import { TopNav } from "@/components/app/top-nav"
import { selectAdvisor } from "@/lib/jobSourceAdvisor/boardRatings"
import { createSupabaseServerClient } from "@/lib/supabase/server"

// Patch 5.4: Vercel server actions inherit maxDuration from the invoking
// page. 240s covers worst-case Deep flow (Haiku 60s + Sonnet 180s) past the
// AbortController fires. Lives here because Next 14 "use server" files
// cannot export non-async constants.
export const maxDuration = 240

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
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, company_name, role_title, tc, state, stage, source_url, jd_text, latest_message, full_loop_session_config"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_profiles")
      .select(
        "resume_text, subscription_status, current_period_end, stripe_customer_id"
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

  // Command rail: real stats + automatic Job Source Advisor, both derived
  // from the user's actual cards. Closed cards are excluded (hidden on Home).
  const jobRows = (jobs ?? []) as JobRow[]
  const nonClosed = jobRows.filter((j) => j.stage !== "closed")
  const activeStages = new Set(["screen", "hiring_manager", "interview_loop", "final"])
  const railStats: RailStats = {
    jobsTracked: nonClosed.length,
    activeInterviews: nonClosed.filter((j) => activeStages.has(j.stage)).length,
    offers: nonClosed.filter((j) => j.stage === "offer").length,
  }
  // jobs are ordered created_at desc, so nonClosed is already recency-first.
  const advisor = selectAdvisor(nonClosed.map((j) => j.role_title))

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <TopNav
        email={user.email ?? ""}
        subscriptionStatus={
          (profile?.subscription_status as string | null) ?? "free"
        }
        hasStripeCustomer={!!profile?.stripe_customer_id}
      />
      <main className="mx-auto w-full max-w-[1440px] py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-0">
          <CommandRail stats={railStats} advisor={advisor} />
          <div className="min-w-0 flex-1">
            <Board
              jobs={jobRows}
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
              initialOpenJobId={initialOpenJobId}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

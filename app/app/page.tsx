import { redirect } from "next/navigation"

import { Board, type JobRow } from "@/components/app/board"
import { PrepOverlay, type PrepJob } from "@/components/app/prep-overlay"
import { TopNav } from "@/components/app/top-nav"
import { createSupabaseServerClient } from "@/lib/supabase/server"

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

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, company_name, role_title, tc, state, stage, jd_text, latest_message")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const jobParam = searchParams?.job
  const openJobId = typeof jobParam === "string" ? jobParam : null

  let overlayJob: PrepJob | null = null
  let hasResume = false
  let hasInterviewer = false
  let interviewerName: string | null = null

  if (openJobId) {
    const [{ data: jobRow }, { data: profile }, { data: interviewerRows }] =
      await Promise.all([
        supabase
          .from("jobs")
          .select(
            "id, company_name, role_title, tc, source_url, jd_text, latest_message, stage"
          )
          .eq("user_id", user.id)
          .eq("id", openJobId)
          .maybeSingle(),
        supabase
          .from("user_profiles")
          .select("resume_text")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("job_context")
          .select("content, metadata")
          .eq("user_id", user.id)
          .eq("job_id", openJobId)
          .eq("type", "interviewer")
          .order("created_at", { ascending: false })
          .limit(1),
      ])

    if (jobRow) {
      overlayJob = jobRow as PrepJob
    }
    hasResume = !!profile?.resume_text && profile.resume_text.trim().length > 0
    const interviewerRow = interviewerRows?.[0] ?? null
    hasInterviewer = !!interviewerRow
    if (interviewerRow) {
      const meta = interviewerRow.metadata as
        | { name?: string | null }
        | null
        | undefined
      interviewerName = meta?.name ?? interviewerRow.content ?? null
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <TopNav email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-[1440px] py-6">
        <Board jobs={(jobs ?? []) as JobRow[]} />
      </main>
      {openJobId && (
        <PrepOverlay
          job={overlayJob}
          hasResume={hasResume}
          hasInterviewer={hasInterviewer}
          interviewerName={interviewerName}
        />
      )}
    </div>
  )
}

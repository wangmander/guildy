import { redirect } from "next/navigation"

import { Board, type JobRow, type InterviewerInfo } from "@/components/app/board"
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
    supabase.from("user_profiles").select("resume_text").eq("id", user.id).maybeSingle(),
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

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <TopNav email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-[1440px] py-6">
        <Board
          jobs={(jobs ?? []) as JobRow[]}
          hasResume={hasResume}
          resumeText={profile?.resume_text ?? null}
          interviewerByJobId={interviewerByJobId}
          noteByJobId={noteByJobId}
          initialOpenJobId={initialOpenJobId}
        />
      </main>
    </div>
  )
}

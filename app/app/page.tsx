import { redirect } from "next/navigation"

import { Board, type JobRow } from "@/components/app/board"
import { TopNav } from "@/components/app/top-nav"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function AppPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, company_name, role_title, tc, state, stage")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <TopNav email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-[1440px] py-6">
        <Board jobs={(jobs ?? []) as JobRow[]} />
      </main>
    </div>
  )
}

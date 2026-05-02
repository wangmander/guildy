import { redirect } from "next/navigation"

import { KanbanBoard } from "@/components/app/kanban-board"
import { PassiveTable } from "@/components/app/passive-table"
import { TopNav } from "@/components/app/top-nav"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function AppPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-12">
      <TopNav email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-[1440px] space-y-10 py-6 md:py-8">
        <KanbanBoard />
        <PassiveTable />
      </main>
    </div>
  )
}

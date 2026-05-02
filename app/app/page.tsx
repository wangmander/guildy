import { redirect } from "next/navigation"

import { Board } from "@/components/app/board"
import { TopNav } from "@/components/app/top-nav"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function AppPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <TopNav email={user.email ?? ""} />
      <main className="mx-auto w-full max-w-[1440px] py-6">
        <Board />
      </main>
    </div>
  )
}

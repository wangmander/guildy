import { createSupabaseServerClient } from "@/lib/supabase/server"

export default async function AppPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold text-[#482C4C]">Guildy</h1>
        <p className="text-lg text-[#1C1E21]">
          Signed in as <strong>{user?.email}</strong>.
        </p>
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6">
          <p className="text-sm text-gray-600">
            Phase 1 placeholder. The Home surface (Kanban board, passive table, search) lands in
            Phase 2.
          </p>
        </div>
      </div>
    </div>
  )
}

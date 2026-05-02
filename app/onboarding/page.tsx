import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { OnboardingForm } from "./onboarding-form"

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("resume_text")
    .eq("id", user.id)
    .maybeSingle()

  const initialText = profile?.resume_text ?? ""

  return (
    <div className="min-h-screen bg-[#F8F9FA] px-4 py-12 md:py-[10vh]">
      <div className="w-full max-w-[720px] mx-auto space-y-8 pb-24">
        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-bold text-[#482C4C] tracking-tight">
            Add your background
          </h1>
          <p className="text-lg text-[#1C1E21] leading-relaxed">
            Guildy uses your resume on every prep generation. Upload a PDF or paste the text. You
            can update it later in settings.
          </p>
        </div>

        <OnboardingForm initialText={initialText} />
      </div>
    </div>
  )
}

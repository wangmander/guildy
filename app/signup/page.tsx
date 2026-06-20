"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

// Prompt 21: thin capture route for the unauthenticated Quick Prep
// funnel. The marketing site sends visitors to /signup?handoff={uuid}.
// Magic-link auth bounces through an email and /auth/callback before the
// user reaches onboarding, so the uuid is stashed in localStorage (the
// only store that survives that round trip on this origin) and the page
// forwards to the magic-link form at /login. completeOnboardingAction
// reads it back via the onboarding form.

function SignupCapture() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handoff = searchParams.get("handoff")
    if (handoff) {
      try {
        window.localStorage.setItem("guildy_handoff", handoff)
      } catch {
        // localStorage unavailable (private mode, quota). The funnel
        // still completes, just without the saved-prep handoff.
      }
    }
    // Viral loop: a viewer arriving via a shared link carries ?ref=shareId.
    // Stash it like the handoff so it survives to onboarding, where the signup
    // referral is recorded. Lightweight: same-browser only.
    const ref = searchParams.get("ref")
    if (ref) {
      try {
        window.localStorage.setItem("guildy_ref", ref)
      } catch {
        // localStorage unavailable; attribution is best-effort and skipped.
      }
    }
    router.replace("/login")
  }, [router, searchParams])

  return null
}

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <p className="text-lg text-gray-500">Setting up your account...</p>
      <Suspense fallback={null}>
        <SignupCapture />
      </Suspense>
    </div>
  )
}

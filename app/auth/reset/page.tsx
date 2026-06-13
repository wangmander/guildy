"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"

// Phase 8.5: set a new password after the recovery session is established by
// /auth/confirm (verifyOtp). Exempt from the onboarding gate via the
// middleware /auth/ allowance.
export default function ResetPasswordPage() {
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  )
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setReady(data.user ? "ok" : "invalid")
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 8) {
      setError("Use at least 8 characters.")
      return
    }
    setStatus("saving")
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setStatus("error")
      setError(updateError.message)
      return
    }
    setStatus("done")
    window.location.assign("/app")
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px] rounded-2xl border border-[#E5E7EB] bg-white p-8">
        <h1 className="text-2xl font-semibold text-[#482C4C]">
          Set a new password
        </h1>

        {ready === "checking" ? (
          <p className="mt-4 text-gray-500">Checking your reset link...</p>
        ) : ready === "invalid" ? (
          <p className="mt-4 text-[#1C1E21]">
            This reset link is invalid or expired. Request a new one from the{" "}
            <a href="/login" className="text-[#482C4C] underline">
              sign-in page
            </a>
            .
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <input
              type="password"
              required
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-[#747775] bg-white text-base text-[#1f1f1f] placeholder:text-gray-400 focus:outline-none focus:border-[#482C4C] focus:ring-2 focus:ring-[#482C4C]/20"
              autoComplete="new-password"
              disabled={status === "saving"}
            />
            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full bg-[#482C4C] text-white h-12 rounded-lg font-medium text-base hover:bg-[#3a2440] transition-colors disabled:opacity-60"
            >
              {status === "saving" ? "Saving..." : "Update password"}
            </button>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </form>
        )}
      </div>
    </div>
  )
}

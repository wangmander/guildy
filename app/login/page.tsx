"use client"

import { useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email) return

    setStatus("sending")
    setErrorMessage(null)

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Carry the unauth Quick Prep handoff inside the email link so it survives
    // the round trip even when the user opens the email in a different browser
    // or device (localStorage does not cross contexts). Works for both the
    // confirm-signup template (new users) and the magic-link template
    // (returning users), since both derive their link from this redirect.
    let emailRedirectTo = `${window.location.origin}/auth/callback`
    try {
      const handoff = window.localStorage.getItem("guildy_handoff")
      if (handoff) {
        emailRedirectTo += `?handoff=${encodeURIComponent(handoff)}`
      }
    } catch {
      // localStorage unavailable; the link still works, just without the carry.
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
      },
    })

    if (error) {
      setStatus("error")
      setErrorMessage(error.message)
      return
    }

    setStatus("sent")
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center pt-[15vh] p-4">
      <div className="w-full max-w-[640px] flex flex-col items-start space-y-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-20 bg-[#482C4C] rounded-b-[2rem] rounded-t-[1rem] flex items-center justify-center text-white font-serif font-bold text-4xl pb-1 shadow-md">
            G
          </div>
          <span className="text-[#482C4C] font-serif font-bold text-5xl tracking-tight">
            guildy
          </span>
        </div>

        <div className="space-y-6 w-full">
          <h1 className="text-6xl md:text-7xl font-bold text-[#482C4C] leading-[1.1] tracking-tight">
            Where interviews <br />
            get slayed
          </h1>

          <p className="text-2xl text-[#1C1E21] max-w-lg leading-relaxed">
            Track every pipeline. Prep every round. <br />
            Close the damn offer.
          </p>
        </div>

        <div className="w-full pt-8">
          {status === "sent" ? (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8">
              <h2 className="text-2xl font-semibold text-[#482C4C] mb-2">Check your email</h2>
              <p className="text-lg text-[#1C1E21]">
                We sent a sign-in link to <strong>{email}</strong>. Open it on this device to
                continue.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-[64px] px-6 rounded-full border border-[#747775] bg-white text-[20px] text-[#1f1f1f] placeholder:text-gray-400 focus:outline-none focus:border-[#482C4C] focus:ring-2 focus:ring-[#482C4C]/20"
                disabled={status === "sending"}
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={status === "sending" || !email}
                className="w-full bg-[#482C4C] text-white h-[64px] rounded-full font-medium text-[22px] hover:bg-[#3a2440] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {status === "sending" ? "Sending magic link..." : "Send magic link"}
              </button>
              {status === "error" && errorMessage && (
                <p className="text-sm text-red-600 px-6">{errorMessage}</p>
              )}
              <p className="w-full text-center text-gray-400 text-lg mt-4 font-medium">
                Free to try for beta users
              </p>
              <p className="w-full text-center text-xs text-gray-400 mt-3">
                By continuing you agree to our{" "}
                <Link href="/terms" className="underline hover:text-gray-600">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="underline hover:text-gray-600">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

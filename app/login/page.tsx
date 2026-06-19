"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"

type Mode = "signin" | "signup"
type View = "form" | "magic_sent" | "reset_sent" | "confirm_needed"

const inputClass =
  "w-full h-12 px-4 rounded-lg border border-[#747775] bg-white text-base text-[#1f1f1f] placeholder:text-gray-400 focus:outline-none focus:border-[#482C4C] focus:ring-2 focus:ring-[#482C4C]/20 disabled:opacity-60"

function friendlyUrlError(code: string | null): string | null {
  if (!code) return null
  if (code === "invalid_link") return "That link is invalid or expired."
  if (code === "missing_code") return "That link is invalid or expired."
  return "Something went wrong with that link. Try signing in below."
}

export default function LoginPage() {
  // Zero-user stage: Create account is the right default for every bare
  // /login entry (the signup CTAs all funnel here). Sign in stays reachable
  // via the on-page toggle and via ?mode=signin for returning-user paths.
  const [mode, setMode] = useState<Mode>("signup")
  const [view, setView] = useState<View>("form")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Surface errors bounced here from /auth/callback or /auth/confirm. Read via
  // window.location to avoid a useSearchParams Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const friendly = friendlyUrlError(params.get("error"))
    if (friendly) setError(friendly)
    // Returning-user deep link: ?mode=signin opens Sign in directly. Any
    // other value (or none) keeps the Create account default.
    if (params.get("mode") === "signin") setMode("signin")
  }, [])

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email) return
    setError(null)

    if (mode === "signup" && password.length < 8) {
      setError("Use at least 8 characters.")
      return
    }
    if (!password) {
      setError("Enter your password.")
      return
    }

    setPending(true)

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      setPending(false)
      if (signUpError) {
        // Confirm email is OFF, so an existing address returns this error.
        if (/already registered|already exists/i.test(signUpError.message)) {
          setMode("signin")
          setPassword("")
          setError("An account with this email already exists.")
        } else {
          setError(signUpError.message)
        }
        return
      }
      // Obfuscated existing-user response (identities empty) when applicable.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setMode("signin")
        setPassword("")
        setError("An account with this email already exists.")
        return
      }
      // Confirm email accidentally ON: no session is returned.
      if (!data.session) {
        setView("confirm_needed")
        return
      }
      window.location.assign("/app")
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setPending(false)
    if (signInError) {
      setError("Invalid email or password.")
      return
    }
    window.location.assign("/app")
  }

  async function sendMagicLink() {
    if (!email) {
      setError("Enter your email first.")
      return
    }
    setError(null)
    setPending(true)
    // Carry the unauth Quick Prep handoff in the link (inert under PKCE
    // cross-device; covers the same-browser case). Unchanged mechanism.
    let emailRedirectTo = `${window.location.origin}/auth/callback`
    try {
      const handoff = window.localStorage.getItem("guildy_handoff")
      if (handoff) {
        emailRedirectTo += `?handoff=${encodeURIComponent(handoff)}`
      }
    } catch {
      // localStorage unavailable; link still works without the carry.
    }
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    })
    setPending(false)
    if (otpError) {
      setError(otpError.message)
      return
    }
    setView("magic_sent")
  }

  async function sendReset() {
    if (!email) {
      setError("Enter your email first.")
      return
    }
    setError(null)
    setPending(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/auth/reset` }
    )
    setPending(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setView("reset_sent")
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center pt-[10vh] p-4">
      <div className="w-full max-w-[420px] flex flex-col items-center space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-16 bg-[#482C4C] rounded-b-[1.5rem] rounded-t-[0.75rem] flex items-center justify-center text-white font-serif font-bold text-3xl pb-1 shadow-md">
            G
          </div>
          <span className="text-[#482C4C] font-serif font-bold text-4xl tracking-tight">
            guildy
          </span>
        </div>

        <div className="w-full rounded-2xl border border-[#E5E7EB] bg-white p-8">
          {view === "magic_sent" ? (
            <>
              <h2 className="text-2xl font-semibold text-[#482C4C] mb-2">
                Check your email
              </h2>
              <p className="text-base text-[#1C1E21]">
                We sent a sign-in link to <strong>{email}</strong>. Open it in
                this browser to continue.
              </p>
            </>
          ) : view === "reset_sent" ? (
            <>
              <h2 className="text-2xl font-semibold text-[#482C4C] mb-2">
                Check your email
              </h2>
              <p className="text-base text-[#1C1E21]">
                If an account exists for <strong>{email}</strong>, a password
                reset link is on its way.
              </p>
            </>
          ) : view === "confirm_needed" ? (
            <>
              <h2 className="text-2xl font-semibold text-[#482C4C] mb-2">
                Confirm your account
              </h2>
              <p className="text-base text-[#1C1E21]">
                We sent a confirmation link to <strong>{email}</strong>. Open it
                in this browser to finish creating your account.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-[#482C4C] mb-1">
                {mode === "signin" ? "Sign in" : "Create your account"}
              </h1>
              <p className="text-sm text-gray-500 mb-5">
                Track every pipeline. Prep every round.
              </p>

              <form onSubmit={submitPassword} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  disabled={pending}
                  autoComplete="email"
                />
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  disabled={pending}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                />
                <button
                  type="submit"
                  disabled={pending || !email || !password}
                  className="w-full bg-[#482C4C] text-white h-12 rounded-lg font-medium text-base hover:bg-[#3a2440] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {pending
                    ? "Please wait..."
                    : mode === "signin"
                      ? "Sign in"
                      : "Create account"}
                </button>
                {error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : null}
              </form>

              <div className="mt-4 flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin")
                    setError(null)
                  }}
                  className="text-[#482C4C] underline"
                >
                  {mode === "signin"
                    ? "Create an account"
                    : "I already have an account"}
                </button>
                {mode === "signin" ? (
                  <button
                    type="button"
                    onClick={sendReset}
                    disabled={pending}
                    className="text-gray-500 hover:text-[#482C4C]"
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>

              <div className="mt-6 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={sendMagicLink}
                  disabled={pending}
                  className="text-sm text-gray-500 hover:text-[#482C4C]"
                >
                  Email me a sign-in link instead
                </button>
                <p className="mt-1 text-xs text-gray-400">
                  The link must be opened in this browser.
                </p>
              </div>

              <p className="w-full text-xs text-gray-400 mt-6">
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

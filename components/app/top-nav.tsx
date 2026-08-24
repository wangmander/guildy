"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"

import { SettingsMenu } from "./settings-menu"

type Props = {
  email: string
  subscriptionStatus: string
  hasStripeCustomer: boolean
  resumeText: string
}

const URL_DEBOUNCE_MS = 200

export function TopNav({
  email,
  subscriptionStatus,
  hasStripeCustomer,
  resumeText,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlQ = searchParams.get("q") ?? ""
  const [value, setValue] = useState(urlQ)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSyncedRef = useRef(urlQ)

  // Pull URL changes back into the input when they arrive from elsewhere
  // (back/forward navigation, programmatic clear). Skip if the user is mid-type
  // and the URL just caught up to what we already typed.
  useEffect(() => {
    if (urlQ !== lastSyncedRef.current) {
      lastSyncedRef.current = urlQ
      setValue(urlQ)
    }
  }, [urlQ])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const writeUrl = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = next.trim()
    if (trimmed) params.set("q", trimmed)
    else params.delete("q")
    const qs = params.toString()
    lastSyncedRef.current = trimmed
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setValue(next)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => writeUrl(next), URL_DEBOUNCE_MS)
  }

  const handleClear = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setValue("")
    writeUrl("")
  }

  const showClear = value.length > 0

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--divider-kanban)] bg-[var(--surface)]">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 md:gap-6 md:px-[30px]">
        <Link
          href="/app"
          className="flex shrink-0 items-center gap-2 md:w-[300px]"
        >
          <div className="flex h-9 w-7 items-center justify-center rounded-b-xl rounded-t-md bg-[var(--ink)] pb-0.5 type-display-brand text-[18px] text-white">
            G
          </div>
          <span className="hidden type-display-brand text-[var(--text-primary)] sm:inline">
            guildy
          </span>
        </Link>

        <div className="mx-auto w-full max-w-[680px] flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Search company, role, or context"
              aria-label="Search jobs"
              value={value}
              onChange={handleChange}
              className="h-11 w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 pr-10 font-hanken text-[15px] text-[var(--text-primary)] shadow-[var(--shadow-e0)] outline-none transition-colors placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15"
            />
            {showClear && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end md:w-[300px]">
        <SettingsMenu
          email={email}
          subscriptionStatus={subscriptionStatus}
          hasStripeCustomer={hasStripeCustomer}
          resumeText={resumeText}
        />
        </div>
      </div>
    </header>
  )
}

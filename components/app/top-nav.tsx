"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"

import { AccountMenu } from "./account-menu"

type Props = { email: string }

const URL_DEBOUNCE_MS = 200

export function TopNav({ email }: Props) {
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
    <header className="sticky top-0 z-30 border-b border-black/5 bg-[#F8F9FA]/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 md:gap-4 md:px-8">
        <Link href="/app" className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-7 items-center justify-center rounded-b-xl rounded-t-md bg-[#482C4C] pb-0.5 font-serif text-lg font-bold text-white">
            G
          </div>
          <span className="hidden font-serif text-2xl font-bold tracking-tight text-[#482C4C] sm:inline">
            guildy
          </span>
        </Link>

        <div className="mx-auto w-full max-w-[640px] flex-1">
          <div className="relative">
            <input
              type="search"
              placeholder="Search company, role, or context"
              aria-label="Search jobs"
              value={value}
              onChange={handleChange}
              className="h-10 w-full rounded-full border border-black/10 bg-white px-4 pr-10 text-sm text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/20"
            />
            {showClear && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-black/5 hover:text-[#482C4C]"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <AccountMenu email={email} />
      </div>
    </header>
  )
}

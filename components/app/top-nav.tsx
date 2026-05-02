import Link from "next/link"

import { AccountMenu } from "./account-menu"

type Props = { email: string }

export function TopNav({ email }: Props) {
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
          <input
            type="search"
            placeholder="Search company, role, or context"
            aria-label="Search jobs"
            className="h-10 w-full rounded-full border border-black/10 bg-white px-4 text-sm text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/20"
          />
        </div>

        <AccountMenu email={email} />
      </div>
    </header>
  )
}

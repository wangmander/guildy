"use client"

import * as DropdownMenu from "@radix-ui/react-dropdown-menu"

import { signOutAction } from "@/app/app/actions"

type Props = { email: string }

export function AccountMenu({ email }: Props) {
  const initial = (email.trim().charAt(0) || "?").toUpperCase()

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="size-9 rounded-full bg-[#482C4C] text-white text-sm font-semibold grid place-items-center hover:bg-[#3a2440] transition-colors focus:outline-none focus:ring-2 focus:ring-[#482C4C]/30"
        >
          {initial}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-40 min-w-[220px] rounded-xl border border-black/5 bg-white p-1 shadow-lg"
        >
          <div className="px-3 py-2 text-xs text-gray-500 truncate">{email}</div>
          <DropdownMenu.Separator className="my-1 h-px bg-black/5" />
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full text-left px-3 py-2 rounded-md text-sm text-[#1C1E21] hover:bg-gray-50"
            >
              Sign out
            </button>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

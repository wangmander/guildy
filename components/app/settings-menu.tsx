"use client"

import { useState } from "react"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { Loader2, SlidersHorizontal } from "lucide-react"

import { signOutAction } from "@/app/app/actions"

// Prompt 9 settings dropdown. Replaces the prior initial-avatar
// AccountMenu in the header. Manage subscription is only rendered for
// users with a Stripe customer record AND a billable status — free users
// see only Sign out.

type Props = {
  email: string
  subscriptionStatus: string
  hasStripeCustomer: boolean
}

const MANAGE_STATUSES = new Set(["active", "past_due", "canceled"])

export function SettingsMenu({
  email,
  subscriptionStatus,
  hasStripeCustomer,
}: Props) {
  const [portalPending, setPortalPending] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
  const showManage =
    hasStripeCustomer && MANAGE_STATUSES.has(subscriptionStatus)

  const openPortal = async () => {
    setPortalPending(true)
    setPortalError(null)
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Portal failed")
      }
      if (data.url) {
        window.location.href = data.url as string
        return
      }
      throw new Error("No portal URL returned")
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Portal failed")
      setPortalPending(false)
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Settings"
          className="inline-flex size-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-black/5 hover:text-[#1C1E21] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/30"
        >
          <SlidersHorizontal size={18} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-40 min-w-[220px] rounded-xl border border-black/5 bg-white p-1 shadow-lg"
        >
          <div className="px-3 py-2 text-xs text-gray-500 truncate">
            {email}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-black/5" />
          {showManage ? (
            <>
              <DropdownMenu.Item
                onSelect={(e) => {
                  e.preventDefault()
                  openPortal()
                }}
                disabled={portalPending}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-[#1C1E21] outline-none hover:bg-gray-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60"
              >
                {portalPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Manage subscription
              </DropdownMenu.Item>
              {portalError ? (
                <div className="px-3 py-1 text-[11px] text-red-600">
                  {portalError}
                </div>
              ) : null}
            </>
          ) : null}
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm text-[#1C1E21] hover:bg-gray-50"
            >
              Sign out
            </button>
          </form>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

"use client"

import { useMemo, useRef } from "react"

import {
  PREP_SESSION_ROLES,
  type FullLoopSessionConfig,
  type PrepSessionRole,
} from "@/lib/ai/prep-types"

export type SessionTabState = "empty" | "generating" | "cached" | "stale"

export type SessionTabEntry = {
  role: PrepSessionRole
  state: SessionTabState
}

export type SessionTabsProps = {
  sessions: SessionTabEntry[]
  sessionConfig: FullLoopSessionConfig
  selectedRole: PrepSessionRole
  onSelect: (role: PrepSessionRole) => void
  // Patch 5.1: when any role is generating in the parent, the strip locks
  // (no click, no key activation, opacity-60). Switching tabs mid-gen would
  // strand the parent in a stuck-loading state since the parent's
  // generatingRoles set doesn't unwind on tab switch.
  disabled?: boolean
}

export function SessionTabs({
  sessions,
  sessionConfig,
  selectedRole,
  onSelect,
  disabled = false,
}: SessionTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const stateByRole = new Map<PrepSessionRole, SessionTabState>()
  for (const s of sessions) stateByRole.set(s.role, s.state)

  // Render order is canonical (PREP_SESSION_ROLES) but filtered to only
  // enabled roles. The visible list drives the arrow-key index space too.
  const visibleRoles = useMemo(
    () => PREP_SESSION_ROLES.filter((r) => sessionConfig[r].enabled),
    [sessionConfig]
  )

  // Manual activation on arrow keys — moves focus only. Each tab can fire
  // an LLM generation when activated, so accidental keyboard nav must not
  // call onSelect. Enter and Space fall through to the native button
  // onClick handler. When disabled, arrow-key focus shift is suppressed
  // alongside click activation.
  const onKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (disabled) return
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault()
      const len = visibleRoles.length
      if (len === 0) return
      const dir = e.key === "ArrowRight" ? 1 : -1
      const next = (index + dir + len) % len
      tabRefs.current[next]?.focus()
    }
  }

  if (visibleRoles.length === 0) return null

  return (
    <div
      role="tablist"
      aria-label="Full Loop sessions"
      className={`flex flex-nowrap items-center gap-1.5 whitespace-nowrap border-b border-gray-100 ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      {visibleRoles.map((role, index) => {
        const state = stateByRole.get(role) ?? "empty"
        const isSelected = role === selectedRole

        const variant = isSelected
          ? "bg-white text-[#1C1E21] font-medium shadow-sm"
          : disabled
            ? `${state === "empty" ? "text-gray-400" : "text-gray-700"} font-normal`
            : `${state === "empty" ? "text-gray-400" : "text-gray-700"} hover:bg-gray-50 font-normal`

        return (
          <button
            key={role}
            ref={(el) => {
              tabRefs.current[index] = el
            }}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : isSelected ? 0 : -1}
            onClick={() => {
              if (disabled) return
              onSelect(role)
            }}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`inline-flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs transition-colors ${variant}${
              disabled ? " cursor-not-allowed" : ""
            }`}
          >
            {state === "generating" ? (
              <span
                aria-hidden="true"
                className="size-1.5 animate-pulse rounded-full bg-gray-400"
              />
            ) : null}
            {state === "stale" ? (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-amber-500"
              />
            ) : null}
            {sessionConfig[role].label}
          </button>
        )
      })}
    </div>
  )
}

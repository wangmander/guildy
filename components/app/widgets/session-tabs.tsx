"use client"

import { useRef } from "react"

import { PREP_SESSION_ROLES, type PrepSessionRole } from "@/lib/ai/prep-types"

export type SessionTabState = "empty" | "generating" | "cached" | "stale"

export type SessionTabEntry = {
  role: PrepSessionRole
  state: SessionTabState
}

export type SessionTabsProps = {
  sessions: SessionTabEntry[]
  selectedRole: PrepSessionRole
  onSelect: (role: PrepSessionRole) => void
}

const ROLE_LABELS: Record<PrepSessionRole, string> = {
  hiring_manager: "Hiring Manager",
  cross_functional: "Cross-functional",
  skills_portfolio: "Skills/Portfolio",
  bar_raiser: "Bar Raiser",
}

export function SessionTabs({
  sessions,
  selectedRole,
  onSelect,
}: SessionTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const stateByRole = new Map<PrepSessionRole, SessionTabState>()
  for (const s of sessions) stateByRole.set(s.role, s.state)

  // Manual activation on arrow keys — moves focus only. Each tab can fire
  // an LLM generation when activated, so accidental keyboard nav must not
  // call onSelect. Enter and Space fall through to the native button
  // onClick handler.
  const onKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault()
      const dir = e.key === "ArrowRight" ? 1 : -1
      const len = PREP_SESSION_ROLES.length
      const next = (index + dir + len) % len
      tabRefs.current[next]?.focus()
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Full Loop sessions"
      className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap border-b border-gray-100"
    >
      {PREP_SESSION_ROLES.map((role, index) => {
        const state = stateByRole.get(role) ?? "empty"
        const isSelected = role === selectedRole

        const variant = isSelected
          ? "bg-white text-[#1C1E21] font-medium shadow-sm"
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
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onSelect(role)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`inline-flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs transition-colors ${variant}`}
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
            {ROLE_LABELS[role]}
          </button>
        )
      })}
    </div>
  )
}

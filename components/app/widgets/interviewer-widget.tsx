"use client"

import { ExternalLink, Lock, Pencil, Sparkles, UserPlus } from "lucide-react"

import type { PrepTier } from "@/lib/ai/prep-types"

type Props = {
  name: string | null
  title: string | null
  link: string | null
  tier: PrepTier
  insights: string | null
  onEdit: () => void
}

export function InterviewerWidget({
  name,
  title,
  link,
  tier,
  insights,
  onEdit,
}: Props) {
  const hasAnyField = !!(name || title || link)
  const showInsights = tier === "deep" && !!insights && insights.length > 0
  const sanitizedLink = sanitizeLink(link)

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Interviewer
        </h3>
        {hasAnyField ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit interviewer"
            className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-gray-400 transition-colors hover:text-[#482C4C]"
          >
            <Pencil className="size-3" />
            Edit
          </button>
        ) : null}
      </div>

      {hasAnyField ? (
        <button
          type="button"
          onClick={onEdit}
          className="mt-2 block w-full rounded-md border border-transparent p-2 text-left transition-colors hover:border-black/5 hover:bg-[#F8F9FA]"
        >
          {name ? (
            <p className="text-sm font-medium text-[#1C1E21]">{name}</p>
          ) : null}
          {title ? (
            <p className={name ? "text-xs text-gray-500" : "text-sm font-medium text-[#1C1E21]"}>
              {title}
            </p>
          ) : null}
          {sanitizedLink ? (
            <span
              className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-0.5 text-[11px] text-gray-600"
              onClick={(e) => {
                // Allow link clicks without re-opening the popover.
                e.stopPropagation()
              }}
            >
              <ExternalLink className="size-3 shrink-0" />
              <a
                href={sanitizedLink}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:text-[#482C4C]"
              >
                {prettyLink(sanitizedLink)}
              </a>
            </span>
          ) : null}
        </button>
      ) : (
        <button
          type="button"
          onClick={onEdit}
          className="mt-2 inline-flex h-9 w-full items-center gap-2 rounded-md border border-dashed border-black/15 bg-white px-3 text-sm text-gray-500 transition-colors hover:border-[#482C4C]/40 hover:text-[#482C4C]"
        >
          <UserPlus className="size-3.5" />
          Add interviewer
        </button>
      )}

      {showInsights ? (
        <div className="mt-3 rounded-lg border border-[#482C4C]/15 bg-gradient-to-b from-[#482C4C]/5 to-white p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[#482C4C]">
            <Sparkles className="size-3" />
            Insights
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-700">
            {insights}
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-black/10 bg-gray-50/60 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            <Lock className="size-3" />
            Insights
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
            {tier === "deep"
              ? "Generate Deep Prep with an interviewer to see insights here."
              : "Insights appear here when Deep Prep runs."}
          </p>
        </div>
      )}
    </div>
  )
}

function sanitizeLink(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  // Bare domain or LinkedIn handle — assume https.
  return `https://${trimmed.replace(/^\/+/, "")}`
}

function prettyLink(url: string): string {
  try {
    const u = new URL(url)
    return u.host.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname)
  } catch {
    return url
  }
}

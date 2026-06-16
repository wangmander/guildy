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
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="type-rail-label text-[var(--text-faint)]">Interviewer</h3>
        {hasAnyField ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit interviewer"
            className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-[var(--text-faint)] transition-colors hover:text-[var(--accent)]"
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
          className="mt-2 block w-full rounded-[10px] border border-transparent p-2 text-left transition-colors hover:border-[var(--border-card)] hover:bg-[var(--surface-sunken)]"
        >
          {name ? (
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {name}
            </p>
          ) : null}
          {title ? (
            <p
              className={
                name
                  ? "text-xs text-[var(--text-muted)]"
                  : "text-sm font-semibold text-[var(--text-primary)]"
              }
            >
              {title}
            </p>
          ) : null}
          {sanitizedLink ? (
            <span
              className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--text-body)]"
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
                className="truncate hover:text-[var(--accent)]"
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
          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text-body)] shadow-[var(--shadow-e1)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          <UserPlus className="size-3.5" />
          Add interviewer
        </button>
      )}

      {showInsights ? (
        <div className="mt-3 rounded-[10px] border border-[var(--accent-tint-border)] bg-[var(--accent-tint-bg)] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--accent-deep)]">
            <Sparkles className="size-3" />
            Insights
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-body)]">
            {insights}
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--surface-sunken)] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-faint)]">
            <Lock className="size-3" />
            Insights
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
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

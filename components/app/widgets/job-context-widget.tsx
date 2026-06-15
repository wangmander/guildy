import { ExternalLink } from "lucide-react"

type Props = {
  company: string
  role: string
  tc: string | null
  sourceUrl: string | null
  jdSnippet: string | null
}

export function JobContextWidget({ company, role, tc, sourceUrl, jdSnippet }: Props) {
  return (
    <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-e1)]">
      <h3 className="type-rail-label text-[var(--text-faint)]">Role</h3>
      <div className="mt-2">
        <div className="font-bricolage text-base font-semibold leading-tight text-[var(--text-primary)]">
          {company}
        </div>
        <div className="mt-0.5 text-sm text-[var(--text-body)]">{role}</div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-[var(--text-faint)]">Comp</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{tc ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[var(--text-faint)]">Source</dt>
          <dd className="mt-0.5 truncate text-[var(--text-primary)]">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
              >
                Link
                <ExternalLink className="size-3" />
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      {jdSnippet && (
        <div className="mt-4">
          <div className="type-rail-label text-[var(--text-faint)]">
            JD snippet
          </div>
          <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-[var(--text-muted)]">
            {jdSnippet}
          </p>
        </div>
      )}
    </div>
  )
}

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
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        Role
      </h3>
      <div className="mt-2">
        <div className="text-base font-semibold leading-tight text-[#1C1E21]">
          {company}
        </div>
        <div className="mt-0.5 text-sm text-gray-600">{role}</div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-gray-400">Comp</dt>
          <dd className="mt-0.5 text-[#1C1E21]">{tc ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Source</dt>
          <dd className="mt-0.5 truncate text-[#1C1E21]">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#482C4C] hover:underline"
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
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
            JD snippet
          </div>
          <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-gray-600">
            {jdSnippet}
          </p>
        </div>
      )}
    </div>
  )
}

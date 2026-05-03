import { Lock } from "lucide-react"

import type { StageKey } from "@/lib/stages"

type Props = {
  stage: StageKey
}

function stageHeading(stage: StageKey): string {
  switch (stage) {
    case "screen":
      return "Screening round"
    case "hiring_manager":
      return "Hiring Manager round"
    case "interview_loop":
    case "final":
      return "Interview loop"
    case "offer":
      return "Offer stage"
    case "applied":
      return "Applied round"
    case "closed":
      return "Closed round"
  }
}

const SECTIONS = [
  {
    id: "purpose",
    title: "Purpose",
    subtitle: "What this round is really testing",
  },
  {
    id: "positioning",
    title: "Positioning",
    subtitle: "How to position yourself",
    locked: true,
  },
  {
    id: "risks",
    title: "Risks & Probes",
    subtitle: "Where they'll push",
    locked: true,
  },
  {
    id: "checklist",
    title: "Prep Checklist",
    subtitle: null,
  },
] as const

export function PrepCanvas({ stage }: Props) {
  return (
    <div className="px-4 pb-12 pt-6 md:px-8">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        Prep
      </div>
      <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-[#1C1E21]">
        {stageHeading(stage)}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#482C4C] px-3 py-1 text-xs font-medium text-white">
          GPT 5.4 Nano · Quick Prep
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#482C4C]/20 bg-white px-3 py-1 text-xs font-medium text-[#482C4C]">
          Sonnet 4.6 · Deep Prep · Upgrade
        </span>
      </div>

      <div className="mt-8 space-y-6">
        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="rounded-xl border border-black/5 bg-white p-5 shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1C1E21]">
                  {section.title}
                </h2>
                {section.subtitle && (
                  <p className="mt-0.5 text-sm text-gray-500">
                    {section.subtitle}
                  </p>
                )}
              </div>
              {"locked" in section && section.locked && (
                <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-gray-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  <Lock className="size-3" />
                  Deep Prep
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <div className="h-2 w-3/4 rounded-full bg-gray-100" />
              <div className="h-2 w-2/3 rounded-full bg-gray-100" />
              <div className="h-2 w-1/2 rounded-full bg-gray-100" />
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

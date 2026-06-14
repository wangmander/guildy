import type React from "react"

// Phase 2A guide gem: a calm 3-pose guide on the rail. The pose is driven by
// present context in command-rail (milestone -> celebrating, live top quest or
// tip -> offering, else resting). No furthest-stage logic.
//
// GEM_ASSETS is the single swap point: replace each placeholder amethyst SVG
// (same keys) with the Claude Design gem stills, no logic change elsewhere.
export type GuidePose = "resting" | "offering" | "celebrating"

function GemMark({
  sparkle = false,
  glow = false,
}: {
  sparkle?: boolean
  glow?: boolean
}) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
      {glow ? (
        <circle cx="24" cy="24" r="22" fill="var(--accent)" opacity="0.16" />
      ) : null}
      <polygon
        points="24,5 39,18 24,43 9,18"
        fill="var(--accent)"
        opacity={glow ? 1 : sparkle ? 0.92 : 0.78}
      />
      <polygon points="24,5 39,18 9,18" fill="var(--accent-deep)" opacity="0.85" />
      <line
        x1="24"
        y1="5"
        x2="24"
        y2="43"
        stroke="var(--surface)"
        strokeWidth="1"
        opacity="0.45"
      />
      <line
        x1="9"
        y1="18"
        x2="39"
        y2="18"
        stroke="var(--surface)"
        strokeWidth="1"
        opacity="0.45"
      />
      {sparkle ? (
        <circle cx="37" cy="9" r="2.5" fill="var(--accent-dot-light)" />
      ) : null}
    </svg>
  )
}

const GEM_ASSETS: Record<GuidePose, React.ReactNode> = {
  resting: <GemMark />,
  offering: <GemMark sparkle />,
  celebrating: <GemMark glow sparkle />,
}

const GEM_LABEL: Record<GuidePose, string> = {
  resting: "Your guide",
  offering: "Next move ready",
  celebrating: "Nice work",
}

export function GuideGem({ pose }: { pose: GuidePose }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-16)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-e0)]">
      <div className="shrink-0">{GEM_ASSETS[pose]}</div>
      <div className="min-w-0">
        <p className="type-rail-label text-[var(--text-rail-label)]">Guide</p>
        <p className="type-card-sublabel text-[var(--text-body)]">
          {GEM_LABEL[pose]}
        </p>
      </div>
    </div>
  )
}

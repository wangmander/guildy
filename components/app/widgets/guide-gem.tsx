import { cn } from "@/lib/utils"

// The amethyst gem guide. One asset per pose (resting / offering / celebrating),
// rendered via <img srcSet> so the same pose can appear multiple times on a page
// with no duplicate-ID collisions and stays crisp at any size. The material is
// baked into the SVG files in public/gem; the only per-pose differences are
// brightness, glow size, and sparkle count (gem-guide section 1).
//
// Pose driver (set by command-rail): a live milestone -> celebrating, a live top
// move -> offering, otherwise resting. Unchanged from Phase 2A.
export type GuidePose = "resting" | "offering" | "celebrating"

const SRC: Record<GuidePose, { x1: string; x2: string }> = {
  resting: { x1: "/gem/gem-resting.svg", x2: "/gem/gem-resting-2x.svg" },
  offering: { x1: "/gem/gem-offering.svg", x2: "/gem/gem-offering-2x.svg" },
  celebrating: {
    x1: "/gem/gem-celebrating.svg",
    x2: "/gem/gem-celebrating-2x.svg",
  },
}

export function Gem({
  pose,
  size,
  float = false,
  className,
}: {
  pose: GuidePose
  size: number
  float?: boolean
  className?: string
}) {
  const src = SRC[pose]
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src.x1}
      srcSet={`${src.x1} 1x, ${src.x2} 2x`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn("block select-none", float && "gem-float", className)}
    />
  )
}

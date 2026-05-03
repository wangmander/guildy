import { Check } from "lucide-react"

const BULLETS = [
  "Complete questions",
  "Stronger answer plans",
  "Resume-to-JD fit",
  "Interviewer-aware prep",
] as const

type Props = {
  onUpgrade: () => void
}

export function UpgradeWidget({ onUpgrade }: Props) {
  return (
    <div className="rounded-2xl border border-[#482C4C]/20 bg-gradient-to-b from-[#482C4C]/5 to-white p-4 shadow-sm">
      <div className="text-base font-semibold text-[#482C4C]">
        Deep Prep. Better odds.
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">
        Know what they&rsquo;ll ask. Know what you&rsquo;ll say.
      </p>

      <ul className="mt-3 space-y-1.5">
        {BULLETS.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 text-xs leading-snug text-[#1C1E21]"
          >
            <Check className="mt-0.5 size-3.5 shrink-0 text-[#482C4C]" />
            {b}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onUpgrade}
        className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-md bg-[#482C4C] text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Upgrade
      </button>
    </div>
  )
}

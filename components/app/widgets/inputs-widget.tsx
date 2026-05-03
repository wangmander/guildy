import { Check, Minus, Plus } from "lucide-react"

type Props = {
  hasResume: boolean
  hasJd: boolean
  hasLatestMessage: boolean
  hasInterviewer: boolean
}

type Item = { label: string; present: boolean }

export function InputsWidget({
  hasResume,
  hasJd,
  hasLatestMessage,
  hasInterviewer,
}: Props) {
  const items: Item[] = [
    { label: "Background", present: hasResume },
    { label: "Job description", present: hasJd },
    { label: "Latest Message", present: hasLatestMessage },
    { label: "Interviewer", present: hasInterviewer },
  ]
  const filled = items.filter((i) => i.present).length

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Inputs
        </h3>
        <span className="text-xs tabular-nums text-gray-500">
          {filled}/{items.length}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2 text-sm text-[#1C1E21]"
          >
            <span
              className={
                item.present
                  ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-[#482C4C]/10 text-[#482C4C]"
                  : "flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400"
              }
            >
              {item.present ? (
                <Check className="size-3" />
              ) : (
                <Minus className="size-3" />
              )}
            </span>
            <span className={item.present ? "" : "text-gray-500"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="mt-4 inline-flex h-8 items-center gap-1 text-xs font-medium text-[#482C4C] hover:underline"
      >
        <Plus className="size-3.5" />
        Add context
      </button>

      <p className="mt-3 text-[11px] leading-snug text-gray-400">
        More context makes prep sharper.
      </p>
    </div>
  )
}

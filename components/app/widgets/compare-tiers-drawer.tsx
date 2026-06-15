"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type Props = {
  open: boolean
  onClose: () => void
}

const ROWS: ReadonlyArray<{ area: string; quick: string; deep: string }> = [
  {
    area: "Questions",
    quick: "Common questions",
    deep: "Complete questions by category",
  },
  {
    area: "Answers",
    quick: "Basic answer tips",
    deep: "Answer plans by interview type",
  },
  {
    area: "Resume fit",
    quick: "Quick fit summary",
    deep: "Resume-to-JD fit with gaps and emphasis",
  },
  {
    area: "Interviewer",
    quick: "Basic info / locked preview",
    deep: "Interviewer-specific prep",
  },
  {
    area: "Risks",
    quick: "Light reminders",
    deep: "Likely concerns + counters",
  },
  {
    area: "Practice",
    quick: "Checklist",
    deep: "Stronger prep checklist with category coverage",
  },
] as const

export function CompareTiersDrawer({ open, onClose }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compare Quick vs Deep</DialogTitle>
          <DialogDescription>
            Quick Prep gets you ready. Deep Prep gives you the plan.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-[10px] border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface-sunken)] text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="w-[20%] px-3 py-2.5">Area</th>
                <th className="w-[35%] px-3 py-2.5">Quick Prep</th>
                <th className="w-[45%] px-3 py-2.5 text-[var(--accent-deep)]">
                  Deep Prep
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr
                  key={r.area}
                  className={
                    i % 2 === 0
                      ? "border-t border-[var(--border-card)]"
                      : "border-t border-[var(--border-card)] bg-[var(--surface-sunken)]/40"
                  }
                >
                  <td className="px-3 py-2.5 text-xs font-semibold text-[var(--text-primary)]">
                    {r.area}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-body)]">
                    {r.quick}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-[var(--text-primary)]">
                    {r.deep}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

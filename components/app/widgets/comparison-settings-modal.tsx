"use client"

import { useState } from "react"

import { updateCompPrioritiesAction } from "@/app/app/actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  COMP_DIMS,
  SOFT_DIMS,
  resolveCompPriorities,
  type CompPrioritiesRaw,
} from "@/lib/compMatrix/dimensions"

const inputClass =
  "w-16 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-[#1C1E21] outline-none focus:border-[#4E3BDD]"

function SettingsForm({
  compPriorities,
  onSaved,
  onCancel,
}: {
  compPriorities: CompPrioritiesRaw
  onSaved: () => void
  onCancel: () => void
}) {
  const resolved = resolveCompPriorities(compPriorities)
  const [enabled, setEnabled] = useState<string[]>(resolved.enabledSoft)
  const [weights, setWeights] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const d of [...COMP_DIMS, ...SOFT_DIMS]) {
      const w = resolved.weights[d.key]
      init[d.key] = typeof w === "number" ? String(w) : "1"
    }
    return init
  })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(key: string) {
    setEnabled((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  // Weights shown for comp dims (always) plus the enabled soft dims.
  const weightedDims = [
    ...COMP_DIMS,
    ...SOFT_DIMS.filter((d) => enabled.includes(d.key)),
  ]

  async function save() {
    setPending(true)
    setError(null)
    const weightsOut: Record<string, number> = {}
    for (const d of weightedDims) {
      const raw = weights[d.key]
      const n = raw === "" ? 1 : Number(raw)
      weightsOut[d.key] = Number.isFinite(n) && n >= 0 ? n : 1
    }
    const res = await updateCompPrioritiesAction({
      enabled_soft: enabled,
      weights: weightsOut,
    })
    setPending(false)
    if (res.ok) onSaved()
    else setError(res.error)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-[#1C1E21]">
          Soft dimensions to compare
        </span>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {SOFT_DIMS.map((d) => (
            <label key={d.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled.includes(d.key)}
                onChange={() => toggle(d.key)}
              />
              <span className="text-[#1C1E21]">{d.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-[#1C1E21]">
          Weights (how much each counts toward the overall)
        </span>
        <div className="flex flex-col divide-y divide-gray-100">
          {weightedDims.map((d) => (
            <div
              key={d.key}
              className="flex items-center justify-between gap-2 py-1.5"
            >
              <span className="text-sm text-[#1C1E21]">{d.label}</span>
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                className={inputClass}
                value={weights[d.key] ?? "1"}
                onChange={(e) =>
                  setWeights((w) => ({ ...w, [d.key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      </div>

      {error ? <p className="text-xs text-red-700">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 px-3 text-sm font-medium text-[#1C1E21] transition-colors hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-md bg-[#482C4C] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  )
}

export function ComparisonSettingsModal({
  open,
  onOpenChange,
  compPriorities,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  compPriorities: CompPrioritiesRaw
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        {open ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">
                Comparison priorities
              </DialogTitle>
              <DialogDescription>
                Choose which dimensions to compare and how much each counts.
              </DialogDescription>
            </DialogHeader>
            <SettingsForm
              compPriorities={compPriorities}
              onSaved={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

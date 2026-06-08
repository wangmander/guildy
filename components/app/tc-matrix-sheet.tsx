"use client"

import { useEffect, useState } from "react"
import { ChevronUp, Lock, X } from "lucide-react"

import type { CompPrioritiesRaw } from "@/lib/compMatrix/dimensions"

import { TcMatrix, type TcColumn } from "./tc-matrix"

type Props = {
  columns: TcColumn[]
  subscriptionStatus: string
  currentPeriodEnd: string | null
  compPriorities: CompPrioritiesRaw
}

// Persistent bottom strip that raises a full-width sheet over a scrim. Locked
// (no Offer-stage job) shows the unlock condition and is not clickable.
// Unlocked, clicking the strip opens the rated comparison matrix; the matrix
// (with its Feature 4 Negotiate surface) renders inside the sheet.
export function TcMatrixSheet(props: Props) {
  const { columns } = props
  const [open, setOpen] = useState(false)
  const locked = columns.length === 0

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // If the last offer leaves the board while the sheet is open, drop to the
  // locked strip.
  useEffect(() => {
    if (locked && open) setOpen(false)
  }, [locked, open])

  return (
    <>
      {locked ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 py-3 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] items-center gap-2 text-sm">
            <Lock className="size-4 shrink-0 text-gray-400" />
            <span className="font-medium text-[#1C1E21]">
              Compensation comparison
            </span>
            <span className="text-gray-500">
              Unlocks when a job reaches the Offer stage.
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50 lg:px-8"
        >
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm">
              <span className="font-medium text-[#1C1E21]">
                Compensation comparison
              </span>
              <span className="text-gray-500">
                {columns.length} {columns.length === 1 ? "offer" : "offers"}
              </span>
            </span>
            <ChevronUp className="size-4 text-gray-400" />
          </div>
        </button>
      )}

      {open && !locked ? (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 z-10 max-h-[85vh] overflow-y-auto rounded-t-xl border-t border-gray-200 bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-gray-100 bg-white px-4 py-3 lg:px-8">
              <span className="font-display text-sm font-medium text-[#1C1E21]">
                Compensation comparison
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex size-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-[#1C1E21]"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mx-auto max-w-[1440px] px-4 py-4 lg:px-8">
              <TcMatrix {...props} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

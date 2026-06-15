"use client"

import { useEffect, useState } from "react"
import { BarChart3, ChevronUp, Lock, X } from "lucide-react"

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

  // Offer-card "Compare & negotiate" CTA dispatches this; open the sheet when
  // there is something to compare.
  useEffect(() => {
    const onOpen = () => setOpen((prev) => (locked ? prev : true))
    window.addEventListener("guildy:open-comp", onOpen)
    return () => window.removeEventListener("guildy:open-comp", onOpen)
  }, [locked])

  const count = columns.length

  return (
    <>
      {locked ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-4 lg:px-[30px]">
          <div className="mx-auto flex max-w-[1440px] items-center gap-[13px]">
            <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--salary-bg)]">
              <Lock className="size-4 text-[var(--text-fainter)]" />
            </span>
            <span className="text-[14px] font-semibold text-[#7A8696]">
              Compensation comparison
            </span>
            <span className="text-[13px] text-[var(--text-fainter)]">
              Unlocks when your first offer lands.
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E6D8F6] bg-[linear-gradient(180deg,#F8F2FE,#F1E7FB)] px-4 py-[15px] text-left shadow-[0_-6px_26px_-10px_rgba(91,33,182,0.16)] transition-[background] hover:bg-[linear-gradient(180deg,#F1E7FB,#E9DAF8)] lg:px-[30px]"
        >
          <div className="mx-auto flex max-w-[1440px] items-center gap-5">
            <span className="flex shrink-0 items-center gap-3">
              <span className="flex size-[38px] items-center justify-center rounded-[11px] bg-[var(--accent)] text-white shadow-[0_4px_12px_-2px_rgba(91,33,182,0.34)]">
                <BarChart3 className="size-[18px]" />
              </span>
              <span className="flex flex-col">
                <span className="flex items-baseline gap-2">
                  <span className="font-bricolage text-[16px] font-semibold leading-none text-[var(--text-primary)]">
                    Compensation comparison
                  </span>
                  <span className="font-bricolage text-[15px] font-medium leading-none text-[var(--accent)]">
                    {count} {count === 1 ? "offer" : "offers"}
                  </span>
                </span>
                <span className="mt-1 hidden text-[12px] text-[#7A8696] sm:inline">
                  A milestone worth a closer look. See how they stack up.
                </span>
              </span>
            </span>

            <span className="flex min-w-0 flex-1 items-center gap-[9px] overflow-x-auto">
              {columns.map((c, i) => (
                <span
                  key={c.jobId}
                  className="flex shrink-0 items-center gap-2 rounded-[9px] border border-[var(--accent-tint-border2)] bg-[var(--accent-tint-bg2)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--accent-deep)]"
                >
                  <span
                    className="size-[7px] shrink-0 rounded-full"
                    style={{ background: i % 2 === 0 ? "#A855F7" : "#7C50CE" }}
                  />
                  {c.company}
                  {c.tc ? (
                    <span className="font-medium text-[#7A8696]">{c.tc}</span>
                  ) : null}
                </span>
              ))}
            </span>

            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[11px] bg-[var(--accent)] px-[18px] py-[11px] text-[14px] font-semibold text-white shadow-[var(--shadow-accent-cta)]">
              Compare offers
              <ChevronUp className="size-4" />
            </span>
          </div>
        </button>
      )}

      {open && !locked ? (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-[rgba(18,26,38,0.44)] animate-[guildyFade_0.22s_ease-out]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 z-10 flex max-h-[88vh] flex-col overflow-hidden rounded-t-[20px] border-t border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-e6)] animate-[guildyUp_0.3s_ease-out]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--divider-kanban)] bg-[var(--surface)] px-[26px] py-[22px]">
              <div className="min-w-0">
                <h2 className="type-comp-h2 text-[var(--text-primary)]">
                  Compensation comparison
                </h2>
                <p className="mt-1 max-w-[580px] text-[12.5px] leading-[1.45] text-[var(--text-faint)]">
                  Comp is rated relative to these offers; the soft scores are
                  yours. Overall is a weighted decision aid, not exact science.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border)] text-[#7A8696] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-[26px] pb-[26px] pt-[14px]">
              <div className="mx-auto max-w-[1040px]">
                <TcMatrix {...props} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

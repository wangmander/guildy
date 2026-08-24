"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { updateUserResumeAction } from "@/app/app/actions"
import { ResumeDropzone } from "@/components/resume-dropzone"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// The board-level door to the resume, opened from the Settings menu.
//
// It exists because the other door does not open for everyone. The
// Intro/Cover Letter row lives inside the prep overlay, which needs a job to
// open, and the user who just finished onboarding has none. Onboarding
// promises a place to replace this later; this is the place that promise can
// honestly name.
//
// No new ingest. The dropzone and the Save button reach the same
// ingestResumeText the onboarding paste, the drop and the browse reach, so
// the 200 character floor is enforced server side here like everywhere else.

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialText: string
}

export function ResumeModal({ open, onOpenChange, initialText }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(initialText)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Re-seed on open, not on every render: a refresh after a save hands down
  // new initialText, and reopening should show what is actually stored
  // rather than a stale draft from a previous visit.
  useEffect(() => {
    if (!open) return
    setValue(initialText)
    setError(null)
    setNotice(null)
  }, [open, initialText])

  // The upload action already wrote the resume, so there is nothing left to
  // save: show what was parsed, and refresh so every gate on the board sees
  // the new text without a reopen.
  const onFileIngested = useCallback(
    (parsed: string, message: string) => {
      setValue(parsed)
      setError(null)
      setNotice(message)
      router.refresh()
    },
    [router]
  )

  const onSave = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setError("Add some text first.")
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await updateUserResumeAction({ resume_text: trimmed })
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
      onOpenChange(false)
    })
  }, [value, router, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Intro/Cover Letter</DialogTitle>
          <DialogDescription>
            Used for prep on every job. Replacing it updates your intro
            everywhere.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-3">
          <ResumeDropzone onIngested={onFileIngested} disabled={pending} />

          {notice ? (
            <p className="text-xs text-[var(--text-muted)]">{notice}</p>
          ) : null}

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border-card)]" />
            <span className="text-xs uppercase tracking-wide text-[var(--text-faint)]">
              or paste
            </span>
            <div className="h-px flex-1 bg-[var(--border-card)]" />
          </div>

          <textarea
            value={value}
            onChange={(e) => {
              setNotice(null)
              setValue(e.target.value)
            }}
            placeholder="Resume text, LinkedIn summary, or any background that frames your work…"
            rows={12}
            disabled={pending}
            className="w-full resize-y rounded-[10px] border border-[var(--border-card)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={pending}
              className="rounded-full px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

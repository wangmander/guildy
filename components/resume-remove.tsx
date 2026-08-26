"use client"

import { useCallback, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { removeUserResumeAction } from "@/app/app/actions"

// Remove, with the consequence stated before it happens.
//
// One component for both surfaces, the settings modal and the Intro/Cover
// Letter row at prep, because the two must not drift on what removal means.
//
// It confirms, and the confirmation is not politeness. Removing the resume
// re-raises the prep gate: every Generate button goes back to blocked and
// the next navigation meets the onboarding redirect again. That is the
// correct behaviour and it is also a surprise, so it gets said out loud
// rather than discovered.
//
// Until this existed the only way to get a wrong resume out of Guildy was to
// paste something else over it, which left the product treating whatever you
// pasted as your background.

type Props = {
  // Fires after the removal lands, so the caller can empty its textarea and
  // close itself. The refresh has already been issued.
  onRemoved: () => void
  disabled?: boolean
}

export function ResumeRemove({ onRemoved, disabled }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const onConfirm = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const res = await removeUserResumeAction()
      if (!res.ok) {
        setError(res.error)
        return
      }
      setConfirming(false)
      router.refresh()
      onRemoved()
    })
  }, [router, onRemoved])

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={disabled || pending}
        // w-fit because both parents are flex columns with the default
        // stretch: without it the button spans the dialog and its label
        // lands dead centre, reading as a primary action rather than the
        // quiet one it is.
        className="w-fit rounded-full px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Remove
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-red-200 bg-red-50/50 p-3">
      <p className="text-xs leading-relaxed text-[var(--text-primary)]">
        Remove your resume? Prep is blocked on every job until you add another
        one, and the file Guildy has on record is deleted.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Removing..." : "Remove it"}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null)
            setConfirming(false)
          }}
          disabled={pending}
          className="rounded-full px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] disabled:opacity-60"
        >
          Keep it
        </button>
      </div>
    </div>
  )
}

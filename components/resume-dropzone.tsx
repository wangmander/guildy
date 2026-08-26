"use client"

import { useCallback, useRef, useState } from "react"
import { FileText, Loader2, Upload } from "lucide-react"

import { uploadResumeFileAction } from "@/app/onboarding/actions"
import { RESUME_ACCEPT_ATTR } from "@/lib/resume/limits"
import { cn } from "@/lib/utils"

// Two of the four doors: drag and drop, and click to browse. Both hand the
// file to the same server action, which parses it and writes it through the
// same ingest the paste path uses. Nothing is validated here beyond "is there
// a file": the rules live server side so the picker and the parser cannot
// disagree about what is allowed.

type Props = {
  // Fires only after the file is parsed AND written. The text is what landed
  // in user_profiles.resume_text, so the caller can show it immediately
  // without a round trip.
  onIngested: (text: string, message: string) => void
  // Changes the wording only. A user with a resume already on file is not
  // adding one, they are replacing one, and a drop here overwrites what they
  // have. Saying "Drop your resume here" to that user hides the consequence.
  hasExisting?: boolean
  disabled?: boolean
  className?: string
}

export function ResumeDropzone({
  onIngested,
  hasExisting,
  disabled,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(
    async (file: File, source: "upload_drop" | "upload_browse") => {
      // Flipped before the await so a second drop or a double click cannot
      // start a second upload behind this one.
      setPending(true)
      setError(null)

      const fd = new FormData()
      fd.append("file", file)
      fd.append("source", source)

      try {
        const res = await uploadResumeFileAction(fd)
        if (!res.ok || !res.text) {
          setError(res.message ?? "That file could not be read.")
          return
        }
        onIngested(res.text, res.message ?? "Resume saved.")
      } catch {
        // A file over the action body limit never reaches the action, so this
        // is the only place that failure can be named.
        setError(
          "That file could not be uploaded. If it is a large PDF, try exporting a smaller one, or paste the text instead."
        )
      } finally {
        setPending(false)
      }
    },
    [onIngested]
  )

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      if (disabled || pending) return
      const file = e.dataTransfer.files?.[0]
      if (!file) return
      void send(file, "upload_drop")
    },
    [disabled, pending, send]
  )

  const openPicker = useCallback(() => {
    if (disabled || pending) return
    inputRef.current?.click()
  }, [disabled, pending])

  const busy = pending || disabled

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        aria-busy={pending}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            openPicker()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
          dragging
            ? "border-[var(--accent)] bg-[var(--accent)]/5"
            : "border-[var(--border-strong)] bg-[var(--surface)] hover:border-[var(--accent)]/50",
          busy && "cursor-not-allowed opacity-60"
        )}
      >
        {pending ? (
          <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
        ) : dragging ? (
          <FileText className="size-5 text-[var(--accent)]" />
        ) : (
          <Upload className="size-5 text-[var(--text-faint)]" />
        )}
        <p className="mt-2 text-sm font-medium text-[var(--text-primary)]">
          {pending
            ? "Reading your file..."
            : hasExisting
              ? "Drop a new file to replace it, or click to browse"
              : "Drop your resume here, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          PDF, DOCX or TXT, up to 10MB.{" "}
          {hasExisting
            ? "This overwrites the resume on file."
            : "Or paste the text below."}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={RESUME_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Cleared so picking the same file twice in a row still fires.
          e.target.value = ""
          if (file) void send(file, "upload_browse")
        }}
      />

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

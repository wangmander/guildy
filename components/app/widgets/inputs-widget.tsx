"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import {
  Check,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import {
  clearInterviewerAction,
  clearNoteAction,
  updateJobJdAction,
  updateJobLatestMessageAction,
  upsertInterviewerAction,
  upsertNoteAction,
} from "@/app/app/actions"
import type { PopoverSection } from "@/components/app/prep-overlay"

type Props = {
  jobId: string
  hasResume: boolean
  jdText: string | null
  latestMessage: string | null
  interviewerName: string | null
  interviewerTitle: string | null
  interviewerLink: string | null
  noteText: string | null
  hasInterviewer: boolean
  hasNote: boolean
  popover: { open: boolean; section: PopoverSection | null; pulseToken: number }
  onOpenPopover: (
    section: PopoverSection,
    options?: { pulse?: boolean }
  ) => void
  onClosePopover: () => void
}

type RowKey = "background" | PopoverSection

type Row = {
  key: RowKey
  label: string
  preview: string | null
  present: boolean
  hint?: "deep"
  clickable: boolean
  section: PopoverSection | null
}

const PREVIEW_CHARS = 50

export function InputsWidget({
  jobId,
  hasResume,
  jdText,
  latestMessage,
  interviewerName,
  interviewerTitle,
  interviewerLink,
  noteText,
  hasInterviewer,
  hasNote,
  popover,
  onOpenPopover,
  onClosePopover,
}: Props) {
  const interviewerPreview = previewOfInterviewer(
    interviewerName,
    interviewerTitle,
    interviewerLink
  )

  const rows: Row[] = [
    {
      key: "background",
      label: "Background",
      preview: hasResume ? "From onboarding" : null,
      present: hasResume,
      clickable: false,
      section: null,
    },
    {
      key: "jd",
      label: "Job description",
      preview: previewOf(jdText),
      present: !!jdText && jdText.trim().length > 0,
      clickable: true,
      section: "jd",
    },
    {
      key: "message",
      label: "Latest message",
      preview: previewOf(latestMessage),
      present: !!latestMessage && latestMessage.trim().length > 0,
      clickable: true,
      section: "message",
    },
    {
      key: "interviewer",
      label: "Interviewer",
      preview: interviewerPreview,
      present: hasInterviewer,
      hint: "deep",
      clickable: true,
      section: "interviewer",
    },
    {
      key: "note",
      label: "Additional context",
      preview: previewOf(noteText),
      present: hasNote,
      hint: "deep",
      clickable: true,
      section: "note",
    },
  ]
  const filled = rows.filter((r) => r.present).length

  // Pulse outer border when an external trigger (e.g. InterviewerWidget) opens
  // the popover, so the user's eye follows the action across columns.
  const [pulse, setPulse] = useState(false)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (popover.pulseToken === 0) return
    setPulse(true)
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setPulse(false), 600)
    return () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current)
    }
  }, [popover.pulseToken])

  return (
    <div
      className={`relative rounded-2xl border bg-white p-4 shadow-sm transition-colors duration-300 ${
        pulse ? "border-[#482C4C]/40 ring-2 ring-[#482C4C]/15" : "border-black/5"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          Inputs
        </h3>
        <span className="text-xs tabular-nums text-gray-500">
          {filled}/{rows.length}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-gray-400">
        Deep is sharper with all 5.
      </p>

      <ul className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <RowItem
            key={row.key}
            row={row}
            onClick={
              row.clickable && row.section
                ? () => onOpenPopover(row.section!)
                : undefined
            }
          />
        ))}
      </ul>

      <AddContextPopover
        jobId={jobId}
        jdText={jdText}
        latestMessage={latestMessage}
        interviewerName={interviewerName}
        interviewerTitle={interviewerTitle}
        interviewerLink={interviewerLink}
        noteText={noteText}
        hasInterviewer={hasInterviewer}
        hasNote={hasNote}
        popover={popover}
        onOpenPopover={onOpenPopover}
        onClosePopover={onClosePopover}
      />
    </div>
  )
}

function RowItem({
  row,
  onClick,
}: {
  row: Row
  onClick?: () => void
}) {
  const Wrapper = onClick ? "button" : "div"
  const wrapperProps = onClick
    ? {
        type: "button" as const,
        onClick,
        className:
          "flex w-full items-start gap-2 rounded-md p-1 text-left transition-colors hover:bg-[#F8F9FA]",
      }
    : { className: "flex items-start gap-2 p-1" }
  return (
    <li>
      <Wrapper {...wrapperProps}>
        <span
          className={
            row.present
              ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#482C4C]/10 text-[#482C4C]"
              : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400"
          }
        >
          {row.present ? <Check className="size-3" /> : <Minus className="size-3" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={
                row.present
                  ? "text-sm text-[#1C1E21]"
                  : "text-sm text-gray-500"
              }
            >
              {row.label}
            </span>
            {row.hint === "deep" ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-[#482C4C]/8 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[#482C4C]/70">
                <Sparkles className="size-2.5" />
                Deep
              </span>
            ) : null}
          </div>
          {row.preview ? (
            <p className="mt-0.5 truncate text-[11px] leading-snug text-gray-400">
              {row.preview}
            </p>
          ) : null}
        </div>
      </Wrapper>
    </li>
  )
}

function AddContextPopover({
  jobId,
  jdText,
  latestMessage,
  interviewerName,
  interviewerTitle,
  interviewerLink,
  noteText,
  hasInterviewer,
  hasNote,
  popover,
  onOpenPopover,
  onClosePopover,
}: {
  jobId: string
  jdText: string | null
  latestMessage: string | null
  interviewerName: string | null
  interviewerTitle: string | null
  interviewerLink: string | null
  noteText: string | null
  hasInterviewer: boolean
  hasNote: boolean
  popover: { open: boolean; section: PopoverSection | null; pulseToken: number }
  onOpenPopover: (section: PopoverSection) => void
  onClosePopover: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = {
    jd: useRef<HTMLDivElement | null>(null),
    message: useRef<HTMLDivElement | null>(null),
    interviewer: useRef<HTMLDivElement | null>(null),
    note: useRef<HTMLDivElement | null>(null),
  } as const

  // Close on outside click / Escape.
  useEffect(() => {
    if (!popover.open) return
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onClosePopover()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClosePopover()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [popover.open, onClosePopover])

  // Scroll the active section into view when it changes.
  useEffect(() => {
    if (!popover.open || !popover.section) return
    const ref = sectionRefs[popover.section]?.current
    if (!ref) return
    // Defer one frame so layout settles before scroll.
    requestAnimationFrame(() => {
      ref.scrollIntoView({ block: "nearest", behavior: "smooth" })
    })
    // sectionRefs is a stable object literal across renders; don't include.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popover.open, popover.section])

  return (
    <div ref={containerRef} className="relative mt-4">
      <button
        type="button"
        onClick={() =>
          popover.open ? onClosePopover() : onOpenPopover("jd")
        }
        aria-expanded={popover.open}
        aria-haspopup="dialog"
        className="inline-flex h-8 items-center gap-1 text-xs font-medium text-[#482C4C] hover:underline"
      >
        <Plus className="size-3.5" />
        Add context
      </button>

      {popover.open ? (
        <div
          role="dialog"
          aria-label="Add context"
          className="absolute right-0 top-full z-20 mt-2 max-h-[70vh] w-[360px] overflow-y-auto rounded-xl border border-black/10 bg-white p-3 shadow-lg"
        >
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Context
            </p>
            <button
              type="button"
              onClick={onClosePopover}
              aria-label="Close"
              className="rounded p-1 text-gray-400 hover:text-[#1C1E21]"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="mt-2 space-y-1">
            <Section
              ref={sectionRefs.jd}
              section="jd"
              label="Job description"
              preview={previewOf(jdText)}
              isOpen={popover.section === "jd"}
              onToggle={() =>
                popover.section === "jd"
                  ? onClosePopover()
                  : onOpenPopover("jd")
              }
            >
              <JdForm
                jobId={jobId}
                initial={jdText ?? ""}
                onSaved={() => onClosePopover()}
              />
            </Section>

            <Section
              ref={sectionRefs.message}
              section="message"
              label="Latest message"
              preview={previewOf(latestMessage)}
              isOpen={popover.section === "message"}
              onToggle={() =>
                popover.section === "message"
                  ? onClosePopover()
                  : onOpenPopover("message")
              }
            >
              <LatestMessageForm
                jobId={jobId}
                initial={latestMessage ?? ""}
                onSaved={() => onClosePopover()}
              />
            </Section>

            <Section
              ref={sectionRefs.interviewer}
              section="interviewer"
              label="Interviewer"
              preview={previewOfInterviewer(
                interviewerName,
                interviewerTitle,
                interviewerLink
              )}
              isOpen={popover.section === "interviewer"}
              onToggle={() =>
                popover.section === "interviewer"
                  ? onClosePopover()
                  : onOpenPopover("interviewer")
              }
            >
              <InterviewerForm
                jobId={jobId}
                initialName={interviewerName ?? ""}
                initialTitle={interviewerTitle ?? ""}
                initialLink={interviewerLink ?? ""}
                hasExisting={hasInterviewer}
                onSaved={() => onClosePopover()}
              />
            </Section>

            <Section
              ref={sectionRefs.note}
              section="note"
              label="Additional context"
              preview={previewOf(noteText)}
              isOpen={popover.section === "note"}
              onToggle={() =>
                popover.section === "note"
                  ? onClosePopover()
                  : onOpenPopover("note")
              }
            >
              <NoteForm
                jobId={jobId}
                initial={noteText ?? ""}
                hasExisting={hasNote}
                onSaved={() => onClosePopover()}
              />
            </Section>
          </div>
        </div>
      ) : null}
    </div>
  )
}

type SectionProps = {
  section: PopoverSection
  label: string
  preview: string | null
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

const Section = forwardRef<HTMLDivElement, SectionProps>(function Section(
  { section, label, preview, isOpen, onToggle, children },
  ref
) {
  return (
    <div
      ref={ref}
      data-section={section}
      className="rounded-md border border-black/5"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors hover:bg-[#F8F9FA]"
      >
        <ChevronDown
          className={
            isOpen
              ? "size-3 shrink-0 text-[#482C4C] transition-transform"
              : "size-3 shrink-0 -rotate-90 text-gray-400 transition-transform"
          }
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#1C1E21]">{label}</p>
          {preview ? (
            <p className="mt-0.5 truncate text-[11px] leading-snug text-gray-400">
              {preview}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] leading-snug text-gray-400">Add</p>
          )}
        </div>
      </button>
      {isOpen ? (
        <div className="border-t border-black/5 p-2.5">{children}</div>
      ) : null}
    </div>
  )
})

function JdForm({
  jobId,
  initial,
  onSaved,
}: {
  jobId: string
  initial: string
  onSaved: () => void
}) {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => setValue(initial), [initial])

  const onSave = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setError("Paste the JD first")
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await updateJobJdAction({ job_id: jobId, jd_text: trimmed })
      if (!res.ok) return setError(res.error)
      router.refresh()
      onSaved()
    })
  }, [jobId, value, router, onSaved])

  const onClear = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const res = await updateJobJdAction({ job_id: jobId, jd_text: null })
      if (!res.ok) return setError(res.error)
      setValue("")
      router.refresh()
      onSaved()
    })
  }, [jobId, router, onSaved])

  return (
    <FormShell
      label="Paste the job description"
      hasExisting={initial.trim().length > 0}
      onSave={onSave}
      onClear={onClear}
      pending={pending}
      error={error}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste the full JD…"
        rows={6}
        className="w-full resize-y rounded-md border border-black/10 bg-white px-2.5 py-2 text-xs leading-relaxed text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/15"
      />
    </FormShell>
  )
}

function LatestMessageForm({
  jobId,
  initial,
  onSaved,
}: {
  jobId: string
  initial: string
  onSaved: () => void
}) {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => setValue(initial), [initial])

  const onSave = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setError("Paste the message first")
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await updateJobLatestMessageAction({
        job_id: jobId,
        latest_message: trimmed,
      })
      if (!res.ok) return setError(res.error)
      router.refresh()
      onSaved()
    })
  }, [jobId, value, router, onSaved])

  const onClear = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const res = await updateJobLatestMessageAction({
        job_id: jobId,
        latest_message: null,
      })
      if (!res.ok) return setError(res.error)
      setValue("")
      router.refresh()
      onSaved()
    })
  }, [jobId, router, onSaved])

  return (
    <FormShell
      label="Paste the latest recruiter message"
      hasExisting={initial.trim().length > 0}
      onSave={onSave}
      onClear={onClear}
      pending={pending}
      error={error}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste the message…"
        rows={5}
        className="w-full resize-y rounded-md border border-black/10 bg-white px-2.5 py-2 text-xs leading-relaxed text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/15"
      />
    </FormShell>
  )
}

function InterviewerForm({
  jobId,
  initialName,
  initialTitle,
  initialLink,
  hasExisting,
  onSaved,
}: {
  jobId: string
  initialName: string
  initialTitle: string
  initialLink: string
  hasExisting: boolean
  onSaved: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [title, setTitle] = useState(initialTitle)
  const [link, setLink] = useState(initialLink)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => setName(initialName), [initialName])
  useEffect(() => setTitle(initialTitle), [initialTitle])
  useEffect(() => setLink(initialLink), [initialLink])

  const onSave = useCallback(() => {
    const n = name.trim()
    const t = title.trim()
    const l = link.trim()
    if (!n && !t && !l) {
      setError("Add at least one of name, title, or link")
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await upsertInterviewerAction({
        job_id: jobId,
        name: n,
        title: t,
        link: l,
      })
      if (!res.ok) return setError(res.error)
      router.refresh()
      onSaved()
    })
  }, [jobId, name, title, link, router, onSaved])

  const onClear = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const res = await clearInterviewerAction({ job_id: jobId })
      if (!res.ok) return setError(res.error)
      setName("")
      setTitle("")
      setLink("")
      router.refresh()
      onSaved()
    })
  }, [jobId, router, onSaved])

  return (
    <FormShell
      label="Single interviewer per job"
      hasExisting={hasExisting}
      onSave={onSave}
      onClear={onClear}
      pending={pending}
      error={error}
    >
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="h-8 w-full rounded-md border border-black/10 bg-white px-2.5 text-xs text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/15"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Director of Design)"
          className="h-8 w-full rounded-md border border-black/10 bg-white px-2.5 text-xs text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/15"
        />
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="LinkedIn or profile URL"
          className="h-8 w-full rounded-md border border-black/10 bg-white px-2.5 text-xs text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/15"
        />
      </div>
    </FormShell>
  )
}

function NoteForm({
  jobId,
  initial,
  hasExisting,
  onSaved,
}: {
  jobId: string
  initial: string
  hasExisting: boolean
  onSaved: () => void
}) {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => setValue(initial), [initial])

  const onSave = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setError("Add some context first")
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await upsertNoteAction({ job_id: jobId, content: trimmed })
      if (!res.ok) return setError(res.error)
      router.refresh()
      onSaved()
    })
  }, [jobId, value, router, onSaved])

  const onClear = useCallback(() => {
    setError(null)
    startTransition(async () => {
      const res = await clearNoteAction({ job_id: jobId })
      if (!res.ok) return setError(res.error)
      setValue("")
      router.refresh()
      onSaved()
    })
  }, [jobId, router, onSaved])

  return (
    <FormShell
      label="Anything else worth knowing"
      hasExisting={hasExisting}
      onSave={onSave}
      onClear={onClear}
      pending={pending}
      error={error}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Personal context, target comp, internal referrals, anything…"
        rows={5}
        className="w-full resize-y rounded-md border border-black/10 bg-white px-2.5 py-2 text-xs leading-relaxed text-[#1C1E21] placeholder:text-gray-400 focus:border-[#482C4C] focus:outline-none focus:ring-2 focus:ring-[#482C4C]/15"
      />
    </FormShell>
  )
}

function FormShell({
  label,
  hasExisting,
  onSave,
  onClear,
  pending,
  error,
  children,
}: {
  label: string
  hasExisting: boolean
  onSave: () => void
  onClear: () => void
  pending: boolean
  error: string | null
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] text-gray-500">{label}</p>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] text-red-600">{error}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between">
        {hasExisting ? (
          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="size-3" />
            Clear
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#482C4C] px-2.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : null}
          Save
        </button>
      </div>
    </div>
  )
}

function previewOf(text: string | null): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (trimmed.length === 0) return null
  return trimmed.length > PREVIEW_CHARS
    ? trimmed.slice(0, PREVIEW_CHARS) + "…"
    : trimmed
}

function previewOfInterviewer(
  name: string | null,
  title: string | null,
  link: string | null
): string | null {
  const parts = [name, title].filter((p): p is string => !!p && p.length > 0)
  if (parts.length > 0) return parts.join(" · ")
  if (link && link.length > 0) return link
  return null
}

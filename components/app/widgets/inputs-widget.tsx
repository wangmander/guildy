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
} from "lucide-react"

import {
  clearInterviewerAction,
  clearNoteAction,
  updateJobJdAction,
  updateJobLatestMessageAction,
  updateUserResumeAction,
  upsertInterviewerAction,
  upsertNoteAction,
} from "@/app/app/actions"
import type { InputsExpansionSection } from "@/components/app/prep-overlay"

type Props = {
  jobId: string
  hasResume: boolean
  resumeText: string | null
  jdText: string | null
  latestMessage: string | null
  interviewerName: string | null
  interviewerTitle: string | null
  interviewerLink: string | null
  noteText: string | null
  hasInterviewer: boolean
  hasNote: boolean
  expansion: {
    section: InputsExpansionSection | null
    pulseToken: number
  }
  onExpand: (
    section: InputsExpansionSection | null,
    options?: { pulse?: boolean }
  ) => void
}

type RowKey = "background" | InputsExpansionSection

type Row = {
  key: RowKey
  label: string
  preview: string | null
  present: boolean
  hint?: "deep"
  clickable: boolean
  section: InputsExpansionSection | null
}

const PREVIEW_CHARS = 50

export function InputsWidget({
  jobId,
  hasResume,
  resumeText,
  jdText,
  latestMessage,
  interviewerName,
  interviewerTitle,
  interviewerLink,
  noteText,
  hasInterviewer,
  hasNote,
  expansion,
  onExpand,
}: Props) {
  const interviewerPreview = previewOfInterviewer(
    interviewerName,
    interviewerTitle,
    interviewerLink
  )

  const rows: Row[] = [
    {
      key: "background",
      label: "Intro/Cover Letter",
      preview: previewOf(resumeText),
      present: hasResume,
      clickable: true,
      section: "background",
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
  // the widget at a section, so the user's eye follows the action across columns.
  const [pulse, setPulse] = useState(false)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (expansion.pulseToken === 0) return
    setPulse(true)
    if (pulseTimer.current) clearTimeout(pulseTimer.current)
    pulseTimer.current = setTimeout(() => setPulse(false), 600)
    return () => {
      if (pulseTimer.current) clearTimeout(pulseTimer.current)
    }
  }, [expansion.pulseToken])

  const sectionRefs = {
    background: useRef<HTMLDivElement | null>(null),
    jd: useRef<HTMLDivElement | null>(null),
    message: useRef<HTMLDivElement | null>(null),
    interviewer: useRef<HTMLDivElement | null>(null),
    note: useRef<HTMLDivElement | null>(null),
  } as const

  // Scroll the active section into view when it changes.
  useEffect(() => {
    if (!expansion.section) return
    const ref = sectionRefs[expansion.section]?.current
    if (!ref) return
    requestAnimationFrame(() => {
      ref.scrollIntoView({ block: "nearest", behavior: "smooth" })
    })
    // sectionRefs is a stable object literal; no need in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expansion.section])

  const onToggle = (section: InputsExpansionSection) => {
    if (expansion.section === section) onExpand(null)
    else onExpand(section)
  }

  const onClose = () => onExpand(null)
  const isExpanded = expansion.section !== null

  return (
    <div
      className={`rounded-[16px] border bg-[var(--surface)] p-4 shadow-[var(--shadow-e1)] transition-colors duration-300 ${
        pulse
          ? "border-[var(--accent)]/40 ring-2 ring-[var(--accent)]/15"
          : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="type-rail-label text-[var(--text-faint)]">Inputs</h3>
        <span className="text-xs tabular-nums text-[var(--text-muted)]">
          {filled}/{rows.length}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-faint)]">
        Deep is sharper with all 5.
      </p>

      <ul className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <RowItem
            key={row.key}
            row={row}
            isOpen={!!row.section && expansion.section === row.section}
            onClick={
              row.clickable && row.section
                ? () => onToggle(row.section!)
                : undefined
            }
          />
        ))}
      </ul>

      {/* Inline-expand: section content lives directly in the widget, no popover. */}
      <div className="mt-3 space-y-1.5">
        <Section
          ref={sectionRefs.background}
          isOpen={expansion.section === "background"}
        >
          <BackgroundForm
            initial={resumeText ?? ""}
            onSaved={onClose}
          />
        </Section>

        <Section
          ref={sectionRefs.jd}
          isOpen={expansion.section === "jd"}
        >
          <JdForm
            jobId={jobId}
            initial={jdText ?? ""}
            onSaved={onClose}
          />
        </Section>

        <Section
          ref={sectionRefs.message}
          isOpen={expansion.section === "message"}
        >
          <LatestMessageForm
            jobId={jobId}
            initial={latestMessage ?? ""}
            onSaved={onClose}
          />
        </Section>

        <Section
          ref={sectionRefs.interviewer}
          isOpen={expansion.section === "interviewer"}
        >
          <InterviewerForm
            jobId={jobId}
            initialName={interviewerName ?? ""}
            initialTitle={interviewerTitle ?? ""}
            initialLink={interviewerLink ?? ""}
            hasExisting={hasInterviewer}
            onSaved={onClose}
          />
        </Section>

        <Section
          ref={sectionRefs.note}
          isOpen={expansion.section === "note"}
        >
          <NoteForm
            jobId={jobId}
            initial={noteText ?? ""}
            hasExisting={hasNote}
            onSaved={onClose}
          />
        </Section>
      </div>

      {/* Bottom trigger only shows when fully collapsed — Cancel inside an
          open section is the only close path so the two affordances don't
          duplicate. */}
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => onExpand("jd")}
          className="mt-3 inline-flex h-8 items-center gap-1 text-xs font-semibold text-[var(--accent-deep)] hover:underline"
        >
          <Plus className="size-3.5" />
          Add context
        </button>
      ) : null}
    </div>
  )
}

function RowItem({
  row,
  isOpen,
  onClick,
}: {
  row: Row
  isOpen: boolean
  onClick?: () => void
}) {
  const Wrapper = onClick ? "button" : "div"
  const wrapperProps = onClick
    ? {
        type: "button" as const,
        onClick,
        "aria-expanded": isOpen,
        className: `flex w-full items-start gap-2 rounded-[8px] p-1 text-left transition-colors hover:bg-[var(--surface-sunken)] ${
          isOpen ? "bg-[var(--accent-tint-bg)]" : ""
        }`,
      }
    : { className: "flex items-start gap-2 p-1" }
  return (
    <li>
      <Wrapper {...wrapperProps}>
        <span
          className={
            row.present
              ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-tint-bg)] text-[var(--accent)]"
              : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-faint)]"
          }
        >
          {row.present ? <Check className="size-3" /> : <Minus className="size-3" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={
                row.present
                  ? "text-sm text-[var(--text-primary)]"
                  : "text-sm text-[var(--text-muted)]"
              }
            >
              {row.label}
            </span>
            {row.hint === "deep" ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-[var(--accent-chip-bg)] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--accent-deep)]">
                <Sparkles className="size-2.5" />
                Deep
              </span>
            ) : null}
          </div>
          {row.preview ? (
            <p className="mt-0.5 truncate text-[11px] leading-snug text-[var(--text-faint)]">
              {row.preview}
            </p>
          ) : null}
        </div>
        {onClick ? (
          <ChevronDown
            className={
              isOpen
                ? "mt-0.5 size-3.5 shrink-0 text-[var(--accent)] transition-transform"
                : "mt-0.5 size-3.5 shrink-0 -rotate-90 text-[var(--text-faint)] transition-transform"
            }
            aria-hidden
          />
        ) : null}
      </Wrapper>
    </li>
  )
}

type SectionProps = {
  isOpen: boolean
  children: React.ReactNode
}

const Section = forwardRef<HTMLDivElement, SectionProps>(function Section(
  { isOpen, children },
  ref
) {
  if (!isOpen) return null
  return (
    <div
      ref={ref}
      className="rounded-[10px] border border-[var(--border-card)] bg-[var(--surface-sunken)] p-5"
    >
      {children}
    </div>
  )
})

function BackgroundForm({
  initial,
  onSaved,
}: {
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
      setError("Add some text first")
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await updateUserResumeAction({ resume_text: trimmed })
      if (!res.ok) return setError(res.error)
      router.refresh()
      onSaved()
    })
  }, [value, router, onSaved])

  // Background is required for prep generation across every job, so a Clear
  // affordance would break the system. FormShell hides Clear when
  // hasExisting is false; the no-op onClear is only there to satisfy the
  // shared shell's prop type.
  const noopClear = useCallback(() => {}, [])

  return (
    <FormShell
      label="Used for prep on every job. Editing updates your intro everywhere."
      hasExisting={false}
      onSave={onSave}
      onClear={noopClear}
      onCancel={onSaved}
      pending={pending}
      error={error}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Resume text, LinkedIn summary, or any background that frames your work…"
        rows={12}
        className="w-full resize-y rounded-[10px] border border-[var(--border-card)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
      />
    </FormShell>
  )
}

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
      onCancel={onSaved}
      pending={pending}
      error={error}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste the full JD…"
        rows={12}
        className="w-full resize-y rounded-[10px] border border-[var(--border-card)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
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
      onCancel={onSaved}
      pending={pending}
      error={error}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste the message…"
        rows={8}
        className="w-full resize-y rounded-[10px] border border-[var(--border-card)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
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
      onCancel={onSaved}
      pending={pending}
      error={error}
    >
      <div className="space-y-2.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="h-9 w-full rounded-[10px] border border-[var(--border-card)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Director of Design)"
          className="h-9 w-full rounded-[10px] border border-[var(--border-card)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
        />
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="LinkedIn or profile URL"
          className="h-9 w-full rounded-[10px] border border-[var(--border-card)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
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
      onCancel={onSaved}
      pending={pending}
      error={error}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Personal context, target comp, internal referrals, anything…"
        rows={8}
        className="w-full resize-y rounded-[10px] border border-[var(--border-card)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
      />
    </FormShell>
  )
}

function FormShell({
  label,
  hasExisting,
  onSave,
  onClear,
  onCancel,
  pending,
  error,
  children,
}: {
  label: string
  hasExisting: boolean
  onSave: () => void
  onClear: () => void
  onCancel: () => void
  pending: boolean
  error: string | null
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2 text-xs text-[var(--text-muted)]">{label}</p>
      {children}
      {error ? (
        <p className="mt-1.5 text-[11px] text-red-600">{error}</p>
      ) : null}
      <div className="mt-5 flex items-center justify-between gap-2 pt-3">
        {hasExisting ? (
          <button
            type="button"
            onClick={onClear}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-xs font-semibold text-[var(--text-muted)] transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            Clear
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex h-8 items-center rounded-[8px] px-2.5 text-xs font-semibold text-[var(--text-body)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-deep)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-3 animate-spin" /> : null}
            Save
          </button>
        </div>
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

"use client"

import { useEffect, useState, useTransition } from "react"
import { Loader2, Sparkles } from "lucide-react"

import {
  parseFullLoopRoundsAction,
  updateFullLoopSessionConfigAction,
} from "@/app/app/actions"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  PREP_SESSION_ROLES,
  type FullLoopSessionConfig,
  type FullLoopSessionEntry,
  type PrepSessionRole,
} from "@/lib/ai/prep-types"

type Props = {
  open: boolean
  onClose: () => void
  jobId: string
  sessionConfig: FullLoopSessionConfig
}

export function CustomizeRoundsModal({
  open,
  onClose,
  jobId,
  sessionConfig,
}: Props) {
  // origSnapshot is the baseline draft is diffed against on Save. It captures
  // the modal's open-time config and is reset whenever auto-detect lands a
  // new server-side config, so user edits after auto-detect compare against
  // the parser output rather than the pre-modal state.
  const [origSnapshot, setOrigSnapshot] =
    useState<FullLoopSessionConfig>(sessionConfig)
  const [draft, setDraft] = useState<FullLoopSessionConfig>(sessionConfig)
  const [error, setError] = useState<string | null>(null)
  const [savePending, startSave] = useTransition()
  const [autoDetectPending, startAutoDetect] = useTransition()

  // Reset both snapshot and draft when the modal opens. While closed, prop
  // changes don't reset draft so they don't clobber in-flight edits if the
  // parent re-renders for unrelated reasons.
  useEffect(() => {
    if (open) {
      setOrigSnapshot(sessionConfig)
      setDraft(sessionConfig)
      setError(null)
    }
  }, [open, sessionConfig])

  const updateRole = (
    role: PrepSessionRole,
    patch: Partial<FullLoopSessionEntry>
  ) => {
    setDraft((prev) => ({
      ...prev,
      [role]: { ...prev[role], ...patch },
    }))
  }

  const onAutoDetect = () => {
    setError(null)
    startAutoDetect(async () => {
      const res = await parseFullLoopRoundsAction({ job_id: jobId })
      if (!res.ok) {
        setError(res.error)
        return
      }
      // Refresh both snapshot and draft so subsequent Save diffs against the
      // parser output, preserving its source="parsed" tags on unchanged rows.
      setOrigSnapshot(res.config)
      setDraft(res.config)
    })
  }

  const onSave = () => {
    const merged = mergeWithSourceTags(origSnapshot, draft)
    startSave(async () => {
      const res = await updateFullLoopSessionConfigAction({
        job_id: jobId,
        config: merged,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      onClose()
    })
  }

  const pending = savePending || autoDetectPending

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-bricolage">
            Customize Full Loop Rounds
          </DialogTitle>
          <DialogDescription>
            Toggle which rounds are in this loop and rename them to match your
            recruiter&rsquo;s words.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          {PREP_SESSION_ROLES.map((role) => {
            const entry = draft[role]
            return (
              <div
                key={role}
                className="flex items-center gap-3 rounded-[10px] border border-[var(--border-card)] bg-[var(--surface)] p-3"
              >
                <Toggle
                  checked={entry.enabled}
                  onChange={(v) => updateRole(role, { enabled: v })}
                  ariaLabel={`Enable ${entry.label}`}
                />
                <Input
                  value={entry.label}
                  onChange={(e) =>
                    updateRole(role, { label: e.target.value })
                  }
                  placeholder="Round label"
                  disabled={pending}
                  className={
                    entry.enabled
                      ? ""
                      : "text-[var(--text-faint)] placeholder:text-[var(--text-fainter)]"
                  }
                />
              </div>
            )
          })}
        </div>

        {error ? (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={onAutoDetect}
            disabled={pending}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-sunken)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {autoDetectPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5 text-[var(--accent)]" />
            )}
            Auto-detect from message
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-[10px] px-3 text-xs font-semibold text-[var(--text-body)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[var(--accent)] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-deep)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savePending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"
      }`}
    >
      <span
        className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}

// Per-role diff: any role whose enabled or label differs from the snapshot
// gets source="user". Untouched roles keep their prior source so a parsed
// loop with one user edit doesn't lose the parsed provenance on the other 3.
function mergeWithSourceTags(
  original: FullLoopSessionConfig,
  draft: FullLoopSessionConfig
): FullLoopSessionConfig {
  const result = {} as FullLoopSessionConfig
  for (const role of PREP_SESSION_ROLES) {
    const orig = original[role]
    const dr = draft[role]
    const changed = orig.enabled !== dr.enabled || orig.label !== dr.label
    result[role] = {
      enabled: dr.enabled,
      label: dr.label,
      source: changed ? "user" : orig.source,
    }
  }
  return result
}

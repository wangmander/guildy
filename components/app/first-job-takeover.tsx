"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { createJobAction } from "@/app/app/actions"
import { AddJobModal } from "@/components/app/add-job-modal"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { capture } from "@/lib/analytics-client"
import { hostOf, looksLikeUrl, normalizeUrl } from "@/lib/jobLink"
import { cn } from "@/lib/utils"

// First-job takeover. Shown in place of the board when the user has zero jobs,
// because the zero-job board gave a new user no cue at all and the NSM is jobs
// added. Centerpiece is the paste box: the demo above it shows what to paste,
// the textarea takes it, and the card lands in Applied.
//
// This renders only at zero jobs. The moment one job exists, page.tsx renders
// the board exactly as before and this component is not mounted.

const BLOCKED_LINE =
  "That site blocks imports. Copy the posting text and paste it here."
const PARSE_FAILED_LINE =
  "Could not read a job posting from that. Try pasting the full posting text, or enter it by hand."

type ImportResponse =
  | {
      ok: true
      fields: {
        company: string
        role_title: string
        location: string | null
        employment_type: string | null
        requirements: string[]
      }
      jd_text: string
      input_kind: "url" | "text"
      host: string | null
    }
  | {
      ok: false
      reason: "blocked_host" | "no_posting" | "parse_failed"
      input_kind: "url" | "text"
      host: string | null
    }

function Demo() {
  return (
    <div className="mb-7 w-full overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface-sunken)] shadow-[var(--shadow-e1b)]">
      <video
        className="block h-auto w-full"
        src="/hero/first-job-demo.mp4"
        poster="/hero/first-job-demo-poster.jpg"
        autoPlay
        loop
        muted
        playsInline
        // Decorative: the three beats are restated in the copy below, so a
        // screen reader loses nothing by skipping it.
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src="/hero/first-job-demo.webm" type="video/webm" />
        <source src="/hero/first-job-demo.mp4" type="video/mp4" />
      </video>
    </div>
  )
}

export function FirstJobTakeover() {
  const router = useRouter()
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [collapsing, setCollapsing] = useState(false)
  const [, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  function handleChange(next: string) {
    setValue(next)
    if (error) setError(null)
    // hero_paste_started: first input of the session only.
    if (!startedRef.current && next.trim().length > 0) {
      startedRef.current = true
      capture("hero_paste_started")
    }
  }

  function focusTextarea() {
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = value.trim()
    if (input.length === 0 || busy) return

    const isUrl = looksLikeUrl(input)
    const host = isUrl ? hostOf(normalizeUrl(input)) : null

    capture("hero_paste_submitted", {
      input_kind: isUrl ? "url" : "text",
      ...(isUrl ? { host } : {}),
    })

    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/import-posting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      })
      const data = (await res.json()) as ImportResponse

      if (!data.ok) {
        if (data.reason === "blocked_host" || data.reason === "no_posting") {
          capture("hero_import_blocked", { host: data.host })
          setError(BLOCKED_LINE)
          // The URL is cleared so the box is ready for pasted text, which is
          // what the message just asked for.
          setValue("")
          focusTextarea()
        } else {
          // Text preserved on a parse failure: it can be long, and losing it
          // would be worse than the failure itself.
          setError(PARSE_FAILED_LINE)
          focusTextarea()
        }
        setBusy(false)
        return
      }

      const created = await createJobAction({
        company_name: data.fields.company,
        role_title: data.fields.role_title,
        tc: "",
        source_url: isUrl ? normalizeUrl(input) : "",
        jd_text: data.jd_text,
        stage: "applied",
      })

      if (!created.ok) {
        setError(created.error)
        setBusy(false)
        return
      }

      capture("kanban_job_created", {
        source: "manual",
        entry_point: "hero",
      })

      // Collapse, then let the server render the board. The refresh is fired
      // after the transition so the takeover does not pop out from under it.
      setCollapsing(true)
      setTimeout(() => {
        startTransition(() => router.refresh())
      }, 260)
    } catch {
      setError(PARSE_FAILED_LINE)
      setBusy(false)
    }
  }

  return (
    <div className="px-4 lg:px-8">
      <div
        className={cn(
          "mx-auto w-full max-w-[560px] pb-16 transition-all duration-300 ease-out",
          collapsing && "scale-[0.97] opacity-0"
        )}
      >
        <Demo />

        <h1 className="mb-1.5 text-center font-bricolage text-[24px] font-bold leading-tight text-[var(--text-primary)]">
          Add your first job
        </h1>
        <p className="mb-6 text-center text-[14px] leading-[1.5] text-[var(--text-faint)]">
          Copy a job posting, paste it below, and Guildy fills in the details.
        </p>

        <form onSubmit={handleSubmit}>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Paste a job posting here"
            aria-label="Paste a job posting here"
            // autoFocus covers the mount; the effect above re-focuses after an
            // error, when the box is cleared and the message asks for a paste.
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? "hero-import-error" : undefined}
            disabled={busy}
            className="min-h-[180px] resize-none rounded-[12px] text-[14px] leading-[1.55]"
          />

          {error ? (
            <p
              id="hero-import-error"
              role="alert"
              className="mt-2 text-[13px] leading-[1.45] text-[#B42318]"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={busy || value.trim().length === 0}
            className="mt-4 h-11 w-full rounded-[10px] text-[14px] font-semibold"
          >
            {busy ? "Reading the posting..." : "Add to my pipeline"}
          </Button>
        </form>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="text-[13px] text-[var(--text-faint)] underline underline-offset-2 transition-opacity hover:opacity-70"
          >
            or enter it by hand
          </button>
        </div>
      </div>

      <AddJobModal
        open={manualOpen}
        onOpenChange={setManualOpen}
        defaultStage="applied"
        entryPoint="hero"
      />
    </div>
  )
}

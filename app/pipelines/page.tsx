"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { Job, Stage, Status } from "@/types"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"
import { signIn, useSession } from "next-auth/react"

function safeStr(v: any, fallback = ""): string {
  if (typeof v === "string") return v
  if (v == null) return fallback
  try {
    return String(v)
  } catch {
    return fallback
  }
}

function safeArr(v: any): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => safeStr(x, "").trim()).filter(Boolean)
}

function safeJson(v: any): any {
  if (!v) return null
  if (typeof v === "object") return v
  if (typeof v !== "string") return null
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

function normalizeStage(stage: any): Stage {
  const s = safeStr(stage, "").toUpperCase()
  if (s.includes("OFFER")) return "OFFER" as Stage
  if (s.includes("INTERVIEW")) return "INTERVIEW" as Stage
  if (s.includes("RECRUITER") || s.includes("SCREEN")) return "RECRUITER_SCREEN" as Stage
  if (s.includes("APPLIED")) return "APPLIED" as Stage
  return "RECRUITER_SCREEN" as Stage
}

/**
 * Map a DB pipeline row into the Job shape, BUT with aggressive null-safety:
 * - Always provide interviewPrep + companyIntel + arrays so V0 components don't crash.
 * - Pass through LLM JSON (prep_json/insights_json) while also providing common aliases.
 */
function rowToJob(row: any): Job {
  const prep = safeJson(row?.prep_json) || {}
  const insights = safeJson(row?.insights_json) || {}

  const companyName = safeStr(row?.company, "Unknown company")
  const roleTitle = safeStr(row?.role, "Interview")
  const stageBucket = normalizeStage(row?.stage)

  const stageDetail =
    safeStr(row?.stage_detail, "").trim() ||
    safeStr(prep?.stage_detail, "").trim() ||
    safeStr(insights?.stage_detail, "").trim() ||
    ""

  const companyType =
    safeStr(prep?.company_type, "").trim() ||
    safeStr(prep?.companyType, "").trim() ||
    safeStr(insights?.company_type, "").trim() ||
    safeStr(insights?.companyType, "").trim() ||
    "Unknown"

  const companySize =
    safeStr(prep?.company_size_bucket, "").trim() ||
    safeStr(prep?.companySizeBucket, "").trim() ||
    safeStr(prep?.company_size, "").trim() ||
    safeStr(prep?.companySize, "").trim() ||
    "Unknown"

  const assumptions = safeArr(prep?.assumptions).slice(0, 8)

  const stageFocus =
    safeStr(prep?.stage_focus, "").trim() ||
    safeStr(prep?.stageFocus, "").trim() ||
    safeStr(insights?.stage_focus, "").trim() ||
    safeStr(insights?.stageFocus, "").trim() ||
    ""

  const questionsTheyMightAsk =
    safeArr(prep?.questions_they_might_ask).length
      ? safeArr(prep?.questions_they_might_ask)
      : safeArr(prep?.questionsTheyMightAsk)

  const questionsYouShouldAsk =
    safeArr(prep?.questions_you_should_ask).length
      ? safeArr(prep?.questions_you_should_ask)
      : safeArr(prep?.questionsYouShouldAsk)

  const storiesToPrepare =
    safeArr(prep?.stories_to_prepare).length ? safeArr(prep?.stories_to_prepare) : safeArr(prep?.storiesToPrepare)

  const homeworkNext24h =
    safeArr(prep?.homework_next_24h).length ? safeArr(prep?.homework_next_24h) : safeArr(prep?.homeworkNext24h)

  const nextAction =
    safeStr(insights?.next_action, "").trim() ||
    safeStr(insights?.nextAction, "").trim() ||
    safeStr(prep?.next_action, "").trim() ||
    safeStr(prep?.nextAction, "").trim() ||
    ""

  const why =
    safeStr(insights?.why, "").trim() ||
    safeStr(insights?.rationale, "").trim() ||
    safeStr(insights?.reasoning, "").trim() ||
    ""

  const tone = safeStr(insights?.tone, "").trim()
  const urgency = safeStr(insights?.urgency, "").trim()
  const responseLikelihood =
    safeStr(insights?.response_likelihood, "").trim() || safeStr(insights?.responseLikelihood, "").trim()

  const companyIntelSummary =
    safeStr(prep?.company_intel_summary, "").trim() ||
    safeStr(prep?.companyIntelSummary, "").trim() ||
    safeStr(insights?.company_intel_summary, "").trim() ||
    safeStr(insights?.companyIntelSummary, "").trim() ||
    ""

  const knownOrUnknownNote =
    companyType === "Unknown" || companySize === "Unknown"
      ? "Guildy couldn’t confidently infer company details from email alone."
      : ""

  const receivedAt = row?.last_email_at ?? undefined
  const lastEmailSubject = safeStr(row?.last_email_subject, "")
  const lastEmailFrom = safeStr(row?.last_email_from, "")
  const lastEmailSnippet = safeStr(row?.last_email_snippet, "")

  // Big: provide BOTH snake_case and camelCase keys to survive whatever V0 components expect.
  const interviewPrep: any = {
    // Stage
    stage_focus: stageFocus,
    stageFocus,
    stage_detail: stageDetail,
    stageDetail,

    // Qs
    questions_they_might_ask: questionsTheyMightAsk,
    questionsTheyMightAsk,

    questions_you_should_ask: questionsYouShouldAsk,
    questionsYouShouldAsk,

    // Stories + homework
    stories_to_prepare: storiesToPrepare,
    storiesToPrepare,

    homework_next_24h: homeworkNext24h,
    homeworkNext24h,

    // Company intel
    company_type: companyType,
    companyType,
    company_size_bucket: companySize,
    companySizeBucket: companySize,
    assumptions,
    company_intel_summary: companyIntelSummary,
    companyIntelSummary,
    truthful_note: knownOrUnknownNote,
    truthfulNote: knownOrUnknownNote,

    // Next action (some panels show it in prep section)
    next_action: nextAction,
    nextAction,
    why,
    tone,
    urgency,
    response_likelihood: responseLikelihood,
    responseLikelihood,

    // Raw (debug passthrough)
    _raw_prep_json: prep,
    _raw_insights_json: insights,
  }

  const job: any = {
    id: row.id,
    title: roleTitle,
    company: {
      name: companyName,
      type: companyType,
      size: companySize,
      intelSummary: companyIntelSummary,
      truthfulNote: knownOrUnknownNote,
    },

    stage: stageBucket,
    // If you later model real status, keep this stable for now.
    status: "WAITING" as Status,

    appliedAt: receivedAt ?? undefined,

    lastEmail: lastEmailSubject
      ? {
          fromName: companyName,
          fromEmail: lastEmailFrom || "",
          subject: lastEmailSubject,
          receivedAt: receivedAt ?? "",
          snippet: lastEmailSnippet || "",
        }
      : undefined,

    notes: safeStr(row?.notes, ""),

    // V0 panels tend to assume this exists
    interviewPrep,

    // Some versions show "company intel" separately
    companyIntel: {
      companyType,
      companySizeBucket: companySize,
      assumptions,
      companyIntelSummary,
      truthfulNote: knownOrUnknownNote,
    },

    // Some versions show "next action" separately
    insights: {
      nextAction,
      why,
      tone,
      urgency,
      responseLikelihood,
      stageDetail,
    },

    // Keep stable so map() never crashes
    recentNews: Array.isArray(row?.recent_news) ? row.recent_news : [],
  }

  return job as Job
}

function LoggedOutConnect() {
  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex items-center justify-center px-6">
      <div className="w-full max-w-xl bg-white border rounded-xl p-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center font-semibold">
            g
          </div>
          <div className="text-lg font-semibold">guildy</div>
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Connect Gmail to see your pipelines</h1>
        <p className="mt-3 text-gray-600">
          Guildy auto-builds pipelines from recruiting threads, infers stage conservatively, and generates stage-specific
          prep matched to the company + role. If it can’t infer intel, it will say so.
        </p>

        <ul className="mt-6 space-y-2 text-sm text-gray-700">
          <li>• First reach-out → recruiter screen (not “full loop”).</li>
          <li>• Prep is stage-specific (no generic boilerplate).</li>
          <li>• No fake company intel: Unknown stays Unknown.</li>
        </ul>

        <button
          onClick={() => signIn("google", { callbackUrl: "/pipelines" })}
          className="mt-8 w-full px-4 py-3 bg-black text-white rounded-lg font-medium"
        >
          Connect Gmail
        </button>
      </div>
    </div>
  )
}

export default function PipelinesPage() {
  const { data: session, status } = useSession()

  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  const userEmail = useMemo(() => session?.user?.email, [session?.user?.email])

  async function loadPipelines() {
    if (!userEmail) return

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)
      .order("last_email_at", { ascending: false })

    if (error) {
      console.error("loadPipelines error:", error)
      setJobs([])
      setSelectedJob(null)
      return
    }

    const rows = Array.isArray(data) ? data : []
    if (rows.length > 0) {
      const mapped = rows.map(rowToJob)
      setJobs(mapped)
      setSelectedJob(mapped[0] ?? null)
    } else {
      setJobs([])
      setSelectedJob(null)
    }
  }

  async function syncGmail() {
    setSyncing(true)
    try {
      await fetch("/api/gmail/sync", { method: "POST" })
    } catch (e) {
      console.error("syncGmail fetch error:", e)
    }
    await loadPipelines()
    setSyncing(false)
  }

  useEffect(() => {
    if (status === "authenticated") loadPipelines()
    if (status !== "authenticated") {
      setJobs([])
      setSelectedJob(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userEmail])

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (status !== "authenticated") {
    return <LoggedOutConnect />
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="p-4 border-b bg-white flex items-center gap-3">
        <button
          onClick={syncGmail}
          disabled={syncing || status !== "authenticated"}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          {syncing ? "Syncing Gmail…" : "Sync Gmail"}
        </button>
        <span className="text-sm text-gray-600">Imports recruiting emails into pipelines</span>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        <div className="w-full lg:w-1/2 overflow-y-auto">
          <PipelineCardList
            jobs={jobs}
            selectedJobId={selectedJob?.id}
            onSelect={(job) => {
              setSelectedJob(job)
              setIsMobileSheetOpen(true)
            }}
            onActionClick={(job) => {
              setSelectedJob(job)
              setIsMobileSheetOpen(true)
            }}
          />
        </div>

        <div ref={rightPanelRef} className="hidden lg:block w-1/2 bg-white">
          <JobDetailPanel job={selectedJob} onSaveNotes={() => {}} />
        </div>

        <MobileBottomSheet
          isOpen={isMobileSheetOpen}
          onClose={() => setIsMobileSheetOpen(false)}
          job={selectedJob}
          onSaveNotes={() => {}}
        />
      </div>
    </div>
  )
}

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

function normalizeStage(stage: any): Stage {
  const s = safeStr(stage, "").toUpperCase().trim()
  if (s.includes("OFFER")) return "OFFER" as Stage
  if (s.includes("RECRUITER") || s.includes("SCREEN")) return "RECRUITER_SCREEN" as Stage
  if (s.includes("INTERVIEW") || s.includes("LOOP") || s.includes("ONSITE")) return "INTERVIEW" as Stage
  return "APPLIED" as Stage
}

function refineStageBucket(
  stage: Stage,
  stageDetail: string,
  emailSubject: string,
  emailSnippet: string
): Stage {
  const s = safeStr(stage, "").toUpperCase()
  if (s !== "INTERVIEW") return stage

  const t = `${stageDetail} ${emailSubject} ${emailSnippet}`.toLowerCase()

  // Strong signals it's still the very first recruiter screen / scheduling step
  const recruiterSignals = [
    "recruiter",
    "talent",
    "phone screen",
    "screening",
    "screen",
    "intro call",
    "introduction call",
    "initial call",
    "quick call",
    "availability",
    "confirm your availability",
    "schedule a call",
    "schedule time",
    "calendly",
    "30-minute",
    "30 minute",
    "15-minute",
    "15 minute",
    "zoom interview",
    "google meet",
    "teams meeting",
  ]

  // Signals it's later than recruiter screen (so keep INTERVIEW)
  const laterSignals = [
    "hiring manager",
    "hm interview",
    "panel",
    "onsite",
    "on-site",
    "loop",
    "full loop",
    "final round",
    "case study",
    "presentation",
    "take home",
    "take-home",
    "assignment",
    "work sample",
    "design challenge",
    "whiteboard",
    "system design",
    "coding challenge",
    "technical challenge",
  ]

  // If we see later-stage signals, do NOT downgrade.
  if (laterSignals.some((x) => t.includes(x))) return stage

  // Otherwise, if it looks like an interview but only scheduling / intro signals exist,
  // treat it as recruiter screen (this maps to "Screening" in your UI).
  if (recruiterSignals.some((x) => t.includes(x))) return "RECRUITER_SCREEN" as Stage

  // Default: if the LLM says "INTERVIEW" but we have no later-stage evidence, keep it in Screening.
  return "RECRUITER_SCREEN" as Stage
}

function rowToJob(row: any): Job {
  const companyName = safeStr(row?.company, "Unknown company")
  const roleTitle = safeStr(row?.role, "Interview")

  let stageBucket = normalizeStage(row?.stage)

  const stageDetail =
    safeStr(row?.stage_detail, "").trim() ||
    safeStr(row?.pipeline_insights?.stage_detail, "").trim() ||
    safeStr(row?.pipeline_insights?.stage_reason, "").trim() ||
    ""

  const lastEmailSubject = safeStr(row?.last_email_subject, "")
  const lastEmailSnippet = safeStr(row?.last_email_snippet, "")

  stageBucket = refineStageBucket(stageBucket, stageDetail, lastEmailSubject, lastEmailSnippet)

  const companyIntel = row?.pipeline_insights?.company_intel ?? null
  const companyIndustry = safeStr(companyIntel?.industry, "Unknown")
  const companySize = safeStr(companyIntel?.size, "Unknown")
  const companyHq = safeStr(companyIntel?.hq_location, "Unknown")
  const companyRating = safeStr(companyIntel?.glassdoor_rating, "N/A")
  const companyType = safeStr(companyIntel?.type, "")
  const companySummary = safeStr(companyIntel?.summary, "")

  const truthfulNote =
    companyIndustry === "Unknown" && companyHq === "Unknown" && companySize === "Unknown"
      ? "Not enough reliable public info found for this company yet. Add the job post link and re-sync."
      : ""

  const stageFocus =
    safeStr(row?.pipeline_insights?.interview_prep?.prep_focus, "").trim() ||
    safeStr(row?.pipeline_insights?.prep_focus, "").trim() ||
    ""

  const theyAsk = Array.isArray(row?.pipeline_insights?.interview_prep?.questions_they_might_ask)
    ? row.pipeline_insights.interview_prep.questions_they_might_ask
    : Array.isArray(row?.pipeline_insights?.questions_they_might_ask)
      ? row.pipeline_insights.questions_they_might_ask
      : []

  const youAsk = Array.isArray(row?.pipeline_insights?.interview_prep?.questions_you_should_ask)
    ? row.pipeline_insights.interview_prep.questions_you_should_ask
    : Array.isArray(row?.pipeline_insights?.questions_you_should_ask)
      ? row.pipeline_insights.questions_you_should_ask
      : []

  const emphasize = Array.isArray(row?.pipeline_insights?.interview_prep?.what_to_emphasize)
    ? row.pipeline_insights.interview_prep.what_to_emphasize
    : Array.isArray(row?.pipeline_insights?.what_to_emphasize)
      ? row.pipeline_insights.what_to_emphasize
      : []

  const stories = Array.isArray(row?.pipeline_insights?.interview_prep?.stories_and_homework)
    ? row.pipeline_insights.interview_prep.stories_and_homework
    : Array.isArray(row?.pipeline_insights?.stories_and_homework)
      ? row.pipeline_insights.stories_and_homework
      : []

  const next24 = Array.isArray(row?.pipeline_insights?.interview_prep?.next_24h_homework)
    ? row.pipeline_insights.interview_prep.next_24h_homework
    : Array.isArray(row?.pipeline_insights?.next_24h_homework)
      ? row.pipeline_insights.next_24h_homework
      : []

  const interviewPrep =
    stageFocus || theyAsk.length || youAsk.length || emphasize.length || stories.length || next24.length
      ? {
          prepFocus: stageFocus || undefined,
          questionsTheyMightAsk: (theyAsk ?? []).map((x: any) => safeStr(x, "")).filter(Boolean),
          questionsYouShouldAsk: (youAsk ?? []).map((x: any) => safeStr(x, "")).filter(Boolean),
          whatToEmphasize: (emphasize ?? []).map((x: any) => safeStr(x, "")).filter(Boolean),
          storiesAndHomework: (stories ?? []).map((x: any) => safeStr(x, "")).filter(Boolean),
          next24hHomework: (next24 ?? []).map((x: any) => safeStr(x, "")).filter(Boolean),
          aiTip:
            safeStr(row?.pipeline_insights?.interview_prep?.ai_tip, "").trim() ||
            "If this still feels generic, add the job post link + team name and re-sync.",
        }
      : undefined

  const nextAction =
    safeStr(row?.pipeline_insights?.next_action, "").trim() ||
    safeStr(row?.pipeline_insights?.next_step, "").trim() ||
    ""

  const tone =
    safeStr(row?.pipeline_insights?.tone, "").trim() ||
    safeStr(row?.pipeline_insights?.email_tone, "").trim() ||
    ""

  const responseLikelihood =
    safeStr(row?.pipeline_insights?.response_likelihood, "").trim() ||
    safeStr(row?.pipeline_insights?.likelihood, "").trim() ||
    ""

  const urgency =
    safeStr(row?.pipeline_insights?.urgency, "").trim() ||
    safeStr(row?.pipeline_insights?.urgency_level, "").trim() ||
    ""

  const dueBy =
    safeStr(row?.pipeline_insights?.due_by, "").trim() ||
    safeStr(row?.pipeline_insights?.reply_by, "").trim() ||
    ""

  const appliedAt = row?.last_email_at ?? undefined

  return {
    id: safeStr(row?.id, ""),
    title: roleTitle,
    company: {
      name: companyName,
      industry: companyIndustry,
      size: companySize,
      hqLocation: companyHq,
      rating: companyRating,
      summary: companySummary,
      type: companyType || undefined,
      truthfulNote: truthfulNote || undefined,
    },
    stage: stageBucket,
    status: ("WAITING" as Status) ?? ("WAITING" as Status),
    appliedAt,
    lastEmail: lastEmailSubject
      ? {
          fromName: companyName || "",
          fromEmail: safeStr(row?.last_email_from, ""),
          subject: lastEmailSubject,
          receivedAt: safeStr(row?.last_email_at, ""),
          snippet: lastEmailSnippet,
        }
      : undefined,
    notes: safeStr(row?.notes, ""),
    interviewPrep,
    nextAction: nextAction || undefined,
    tone: tone || undefined,
    responseLikelihood: responseLikelihood || undefined,
    urgency: urgency || undefined,
    dueBy: dueBy || undefined,
    recentNews: Array.isArray(companyIntel?.recent_news) ? companyIntel.recent_news : [],
  }
}

function LoggedOutConnect() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 bg-white">
      <div className="w-full max-w-md border rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center font-semibold">
            G
          </div>
          <div>
            <div className="text-lg font-semibold leading-none">guildy</div>
            <div className="text-sm text-gray-500">Auto-pipelines + bespoke stage prep from Gmail</div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight mb-2">Connect Gmail to start.</h1>
        <p className="text-sm text-gray-600 mb-6">
          Guildy builds a job pipeline from your recruiting threads, estimates stage, and generates prep that matches the
          exact stage (screening vs HM vs loop).
        </p>

        <button
          onClick={() => signIn("google", { callbackUrl: "/pipelines" })}
          className="w-full px-4 py-3 bg-black text-white rounded-lg"
        >
          Connect Gmail
        </button>

        <div className="mt-6 text-xs text-gray-500">
          Tip: If company intel/prep is generic, add the job post link + team name and re-sync.
        </div>
      </div>
    </div>
  )
}

function PanelErrorBoundary({
  children,
}: {
  children: React.ReactNode
}) {
  const [hasError, setHasError] = useState(false)

  return (
    <div
      className="h-full"
      onErrorCapture={() => {
        setHasError(true)
      }}
    >
      {hasError ? (
        <div className="p-6">
          <div className="text-sm font-medium">Details panel crashed</div>
          <div className="text-sm text-gray-600 mt-1">
            Your pipeline list is still working. The crash is inside JobDetailPanel.
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

export default function PipelinesPage() {
  const { data: session, status } = useSession()
  const userEmail = session?.user?.email ?? ""

  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  const isAuthed = status === "authenticated"

  async function loadPipelines() {
    if (!userEmail) return

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)
      .order("last_email_at", { ascending: false })

    if (error) return

    if (data && data.length > 0) {
      const mapped = data.map(rowToJob)
      setJobs(mapped)
      setSelectedJob((prev) => {
        if (!prev) return mapped[0]
        const stillExists = mapped.find((j) => j.id === prev.id)
        return stillExists ?? mapped[0]
      })
    } else {
      setJobs([])
      setSelectedJob(null)
    }
  }

  async function syncGmail() {
    setSyncing(true)
    try {
      await fetch("/api/gmail/sync", { method: "POST" })
      await loadPipelines()
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (isAuthed) loadPipelines()
  }, [isAuthed])

  useEffect(() => {
    // Ensure details panel scroll position resets when switching jobs
    if (rightPanelRef.current) rightPanelRef.current.scrollTop = 0
  }, [selectedJob?.id])

  if (status === "loading") {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center text-sm text-gray-600">
        Loading…
      </div>
    )
  }

  if (status === "unauthenticated") {
    return <LoggedOutConnect />
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="p-4 border-b bg-white flex items-center gap-3">
        <button
          onClick={syncGmail}
          disabled={syncing || !isAuthed}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          {syncing ? "Syncing Gmail…" : "Sync Gmail"}
        </button>
        <span className="text-sm text-gray-600">Imports recruiting emails into pipelines</span>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
        <div className="w-full lg:w-1/2 overflow-y-auto min-h-0">
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

        <div ref={rightPanelRef} className="hidden lg:block w-1/2 bg-white overflow-y-auto min-h-0">
          <PanelErrorBoundary>
            <JobDetailPanel job={selectedJob} onSaveNotes={() => {}} />
          </PanelErrorBoundary>
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

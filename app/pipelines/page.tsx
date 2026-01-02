"use client"

import { useEffect, useRef, useState } from "react"
import type { Job, Stage, Status } from "@/types"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"
import { signIn, useSession } from "next-auth/react"

const UI_STAGES: Stage[] = ["SCREENING", "HIRING_MANAGER", "PRESENTATION", "FULL_LOOP", "OFFER_DISCUSSION"]

function safeString(v: any, fallback = ""): string {
  if (typeof v === "string") return v
  if (v == null) return fallback
  try {
    return String(v)
  } catch {
    return fallback
  }
}

function stageBucketToUiStage(stageRaw: any, stageDetail?: any): Stage {
  const s = safeString(stageRaw, "").toUpperCase().trim()
  if (UI_STAGES.includes(s as Stage)) return s as Stage

  const d = safeString(stageDetail, "").toLowerCase()

  if (s === "OFFER") return "OFFER_DISCUSSION"
  if (s === "APPLIED" || s === "RECRUITER_SCREEN") return "SCREENING"

  if (s === "INTERVIEW") {
    if (d.includes("portfolio") || d.includes("case") || d.includes("presentation")) return "PRESENTATION"
    if (d.includes("panel") || d.includes("loop") || d.includes("onsite") || d.includes("on-site")) return "FULL_LOOP"
    if (d.includes("hiring manager") || d.includes("hm")) return "HIRING_MANAGER"
    return "HIRING_MANAGER"
  }

  return "SCREENING"
}

function rowToJob(row: any): Job {
  const uiStage = stageBucketToUiStage(row?.stage, row?.stage_detail)

  const lastEmailSubject = row?.last_email_subject ? safeString(row.last_email_subject) : ""
  const lastEmailAt = row?.last_email_at ? safeString(row.last_email_at) : ""
  const lastEmailFrom = row?.last_email_from ? safeString(row.last_email_from) : ""
  const lastEmailSnippet = row?.last_email_snippet ? safeString(row.last_email_snippet) : ""

  // IMPORTANT: do NOT attach unknown shapes to Job.
  // JobDetailPanel might assume a strict schema and crash.
  return {
    id: row?.id,
    title: row?.role || "Interview",
    company: { name: row?.company || "Unknown company" },
    stage: uiStage,
    status: "WAITING" as Status,
    appliedAt: lastEmailAt || undefined,
    lastEmail: lastEmailSubject
      ? {
          fromName: row?.company ?? "",
          fromEmail: lastEmailFrom,
          subject: lastEmailSubject,
          receivedAt: lastEmailAt,
          snippet: lastEmailSnippet,
        }
      : undefined,
    notes: "",
    interviewPrep: undefined,
    recentNews: [],
  }
}

function MarketingConnect() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6">
      <div className="max-w-xl w-full">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center font-semibold">
            g
          </div>
          <div className="text-lg font-semibold">guildy</div>
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Track every pipeline. Prep every round. Close the offer.
        </h1>
        <p className="mt-3 text-gray-600">
          Connect Gmail to auto-build your job pipelines and keep stages accurate.
        </p>

        <button
          onClick={() => signIn("google", { callbackUrl: "/pipelines" })}
          className="mt-8 w-full px-4 py-3 rounded bg-black text-white font-medium"
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

  async function loadPipelines() {
    const userEmail = session?.user?.email
    if (!userEmail) return

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)
      .order("last_email_at", { ascending: false })

    if (error) {
      console.error("loadPipelines error:", error)
      return
    }

    try {
      if (data && data.length > 0) {
        const mapped = data.map(rowToJob)
        setJobs(mapped)
        setSelectedJob(mapped[0])
      } else {
        setJobs([])
        setSelectedJob(null)
      }
    } catch (e) {
      console.error("Mapping pipelines crashed. Raw data:", data)
      throw e
    }
  }

  async function syncGmail() {
    if (status !== "authenticated") return
    setSyncing(true)
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" })
      const json = await res.json().catch(() => null)
      console.log("sync result:", json)
    } finally {
      await loadPipelines()
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (status === "authenticated") loadPipelines()
  }, [status])

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (status !== "authenticated") {
    return <MarketingConnect />
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="p-4 border-b bg-white flex items-center gap-3">
        <button
          onClick={syncGmail}
          disabled={syncing}
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

"use client"

import { useEffect, useRef, useState } from "react"
import type { Job, Stage, Status } from "@/types"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"
import { signIn, useSession } from "next-auth/react"

const UI_STAGES: Stage[] = ["SCREENING", "HIRING_MANAGER", "PRESENTATION", "FULL_LOOP", "OFFER_DISCUSSION"]

function stageBucketToUiStage(stageRaw: any, stageDetail?: any): Stage {
  const s = String(stageRaw || "").toUpperCase().trim()
  if (UI_STAGES.includes(s as Stage)) return s as Stage

  const d = String(stageDetail || "").toLowerCase()

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
  const uiStage = stageBucketToUiStage(row.stage, row.stage_detail)

  return {
    id: row.id,
    title: row.role || "Interview",
    company: { name: row.company || "Unknown company" },
    stage: uiStage,
    status: ("WAITING" as unknown) as Status,
    appliedAt: row.last_email_at ?? undefined,
    lastEmail: row.last_email_subject
      ? {
          fromName: row.company ?? "",
          fromEmail: row.last_email_from ?? "",
          subject: row.last_email_subject,
          receivedAt: row.last_email_at ?? "",
          snippet: row.last_email_snippet ?? "",
        }
      : undefined,
    notes: "",
    // These are rendered by JobDetailPanel if it supports it; otherwise harmless.
    interviewPrep: (row.prep_json as any) ?? undefined,
    recentNews: [],
    // Optional: if your Job type supports it, JobDetailPanel can use it.
    insights: (row.insights_json as any) ?? undefined,
    stageDetail: row.stage_detail ?? undefined,
  } as any
}

function MarketingConnect() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6">
      <div className="max-w-xl w-full">
        <div className="text-sm font-semibold tracking-wide text-gray-500">GUILDY</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Track every pipeline. Prep every round. Close the offer.
        </h1>
        <p className="mt-3 text-gray-600">
          Connect Gmail to auto-build your job pipelines, keep stages accurate, and generate stage-specific interview prep from the latest email.
        </p>

        <ul className="mt-6 space-y-2 text-sm text-gray-700">
          <li>• Auto pipeline tracking from recruiter threads</li>
          <li>• Stage inference that won’t jump to “Full loop” without scheduling proof</li>
          <li>• Bespoke prep for the exact company + role + stage</li>
          <li>• “Next action” + urgency signals so you don’t drop the ball</li>
        </ul>

        <button
          onClick={() => signIn("google", { callbackUrl: "/pipelines" })}
          className="mt-8 w-full px-4 py-3 rounded bg-black text-white font-medium"
        >
          Connect Gmail
        </button>

        <div className="mt-3 text-xs text-gray-500">
          Only reads metadata/snippets to classify recruiting threads and build pipelines.
        </div>
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

    if (error) return

    if (data && data.length > 0) {
      const mapped = data.map(rowToJob)
      setJobs(mapped)
      setSelectedJob(mapped[0])
    } else {
      setJobs([])
      setSelectedJob(null)
    }
  }

  async function syncGmail() {
    if (status !== "authenticated") return
    setSyncing(true)
    await fetch("/api/gmail/sync", { method: "POST" })
    await loadPipelines()
    setSyncing(false)
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
        <span className="text-sm text-gray-600">Imports recruiting emails into pipelines + updates prep</span>
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

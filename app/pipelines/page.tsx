"use client"

import { useEffect, useRef, useState } from "react"
import type { Job, Stage, Status } from "@/types"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"
import { useSession } from "next-auth/react"

function rowToJob(row: any): Job {
  return {
    id: row.id,
    title: row.role || "Interview",
    company: {
      name: row.company || "Unknown company",
    },
    stage: (row.stage as Stage) ?? "APPLIED",
    status: "WAITING" as Status,
    appliedAt: row.last_email_at ?? undefined,
    lastEmail: row.last_email_subject
      ? {
          fromName: row.company ?? "",
          fromEmail: "",
          subject: row.last_email_subject,
          receivedAt: row.last_email_at ?? "",
          snippet: "",
        }
      : undefined,
    notes: "",
    interviewPrep: undefined,
    recentNews: [],
  }
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
    setSyncing(true)
    await fetch("/api/gmail/sync", { method: "POST" })
    await loadPipelines()
    setSyncing(false)
  }

  useEffect(() => {
    if (status === "authenticated") loadPipelines()
  }, [status])

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
        <span className="text-sm text-gray-600">
          Imports interview emails into pipelines
        </span>
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

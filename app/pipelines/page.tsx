"use client"

import { useState, useEffect, useRef } from "react"
import type { Job } from "@/types"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"

export default function PipelinesPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  async function loadPipelines() {
    const { data } = await supabase
      .from("pipelines")
      .select("*")
      .order("last_email_at", { ascending: false })

    if (data && data.length > 0) {
      setJobs(data as any)
      setSelectedJob(data[0] as any)
    }
  }

  async function syncGmail() {
    setSyncing(true)
    const res = await fetch("/api/gmail/sync", { method: "POST" })
    const json = await res.json()
    console.log("GMAIL SYNC RESULT:", json)
    await loadPipelines()
    setSyncing(false)
  }

  useEffect(() => {
    loadPipelines()
  }, [])

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* TEMP GMAIL SYNC BUTTON */}
      <div className="p-4 border-b bg-white flex gap-3 items-center">
        <button
          onClick={syncGmail}
          disabled={syncing}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {syncing ? "Syncing Gmail…" : "Sync Gmail"}
        </button>
        <span className="text-sm text-gray-600">
          Click once to import interview emails
        </span>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        <div className="w-full lg:w-1/2 border-b lg:border-b-0 flex flex-col overflow-y-auto custom-scrollbar">
          <PipelineCardList
            jobs={jobs}
            onSelect={(job) => {
              setSelectedJob(job)
              setIsMobileSheetOpen(true)
            }}
            onActionClick={(job) => {
              setSelectedJob(job)
              setIsMobileSheetOpen(true)
            }}
            selectedJobId={selectedJob?.id}
          />
        </div>

        <div
          ref={rightPanelRef}
          className="hidden lg:block w-1/2 overflow-y-auto bg-white custom-scrollbar"
        >
          <JobDetailPanel job={selectedJob} onSaveNotes={() => {}} idPrefix="desktop" />
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

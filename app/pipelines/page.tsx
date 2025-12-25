"use client"

import { useState, useEffect, useRef } from "react"
import type { Job, Stage, Status } from "@/types"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"

const stages = ["APPLIED", "RECRUITER_SCREEN", "INTERVIEW", "OFFER"] as const

function rowToJob(row: any): Job {
  return {
    id: row.id,
    title: row.role ?? "Untitled role",
    company: {
      name: row.company ?? "Unknown company",
    },
    stage: (row.stage as Stage) ?? "APPLIED",
    status: "WAITING" as Status,
    notes: "",
    scheduledMeeting: undefined,
    interviewPrep: undefined,
    recentNews: [],
    lastEmail: undefined,
  }
}

export default function PipelinesPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("last_email_at", { ascending: false })

      if (error) {
        console.error(error)
        return
      }

      const mapped = (data ?? []).map(rowToJob)
      setJobs(mapped)
      setSelectedJob(mapped[0] ?? null)
    }

    load()
  }, [])

  const handleSelectJob = (job: Job) => {
    setSelectedJob(job)
    setIsMobileSheetOpen(true)
    rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleActionClick = (job: Job) => {
    setSelectedJob(job)
    setIsMobileSheetOpen(true)

    setTimeout(() => {
      const targetSuffix = job.scheduledMeeting
        ? "interview-questions"
        : "company-intel"

      document
        .getElementById(`mobile-${targetSuffix}`)
        ?.scrollIntoView({ behavior: "smooth" })

      document
        .getElementById(`desktop-${targetSuffix}`)
        ?.scrollIntoView({ behavior: "smooth" })
    }, 300)
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        <div className="w-full lg:w-1/2 border-b lg:border-b-0 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="p-4 sm:p-6 lg:p-8 flex flex-col min-h-full">
            <PipelineCardList
              jobs={jobs}
              onSelect={handleSelectJob}
              onActionClick={handleActionClick}
              selectedJobId={selectedJob?.id}
            />
          </div>
        </div>

        <div
          ref={rightPanelRef}
          className="hidden lg:block w-1/2 overflow-y-auto bg-white custom-scrollbar"
        >
          <JobDetailPanel
            job={selectedJob}
            onSaveNotes={() => {}}
            idPrefix="desktop"
          />
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

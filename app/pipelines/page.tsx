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
    title: row.title ?? "Untitled role",
    company: {
      name: row.company_name ?? "Unknown company",
    },
    stage: (row.stage as Stage) ?? "APPLIED",
    status: (row.status as Status) ?? "WAITING",

    // optional / safe defaults
    location: row.location ?? undefined,
    industry: row.industry ?? undefined,
    jobType: row.job_type ?? undefined,
    tags: row.tags ?? [],
    nextEtaText: undefined,
    appliedAt: row.applied_at ?? undefined,
    postingUrl: row.posting_url ?? undefined,
    lastEmail: undefined,
    notes: row.notes ?? "",
    scheduledMeeting: row.scheduled_meeting ?? undefined,
    interviewPrep: undefined,
    recentNews: [],
  }
}

export default function PipelinesPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  // 🔁 REPLACED: load from Supabase instead of sampleJobs/storage
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error(error)
        return
      }

      const mapped = (data ?? []).map(rowToJob)
      setJobs(mapped)
      if (mapped.length > 0) {
        setSelectedJob(mapped[0])
      }
    }

    load()
  }, [])

  const handleAdvance = (jobId: string) => {
    setJobs((prevJobs) =>
      prevJobs.map((job) => {
        if (job.id === jobId) {
          const currentIndex = stages.indexOf(job.stage)
          if (currentIndex < stages.length - 1) {
            return { ...job, stage: stages[currentIndex + 1] }
          }
        }
        return job
      })
    )
  }

  const handleBack = (jobId: string) => {
    setJobs((prevJobs) =>
      prevJobs.map((job) => {
        if (job.id === jobId) {
          const currentIndex = stages.indexOf(job.stage)
          if (currentIndex > 0) {
            return { ...job, stage: stages[currentIndex - 1] }
          }
        }
        return job
      })
    )
  }

  const handleSelectJob = (job: Job) => {
    setSelectedJob(job)
    setIsMobileSheetOpen(true)
    rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleActionClick = (job: Job) => {
    setSelectedJob(job)
    setIsMobileSheetOpen(true)

    setTimeout(() => {
      const targetSuffix = job.scheduledMeeting ? "interview-questions" : "company-intel"
      document.getElementById(`mobile-${targetSuffix}`)?.scrollIntoView({ behavior: "smooth" })
      document.getElementById(`desktop-${targetSuffix}`)?.scrollIntoView({ behavior: "smooth" })
    }, 300)
  }

  const handleCloseMobileSheet = () => {
    setIsMobileSheetOpen(false)
  }

  const handleSaveNotes = (jobId: string, notes: string) => {
    setJobs((prevJobs) =>
      prevJobs.map((job) => (job.id === jobId ? { ...job, notes } : job))
    )
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-full lg:w-1/2 border-b lg:border-b-0 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="p-4 sm:p-6 lg:p-8 flex flex-col min-h-full">
            <div className="mb-4 lg:mb-6">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                Interview Pipelines
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Everything gets auto-found and organized—so you can focus on winning, not tracking.
              </p>
            </div>

            <PipelineCardList
              jobs={jobs}
              onSelect={handleSelectJob}
              onActionClick={handleActionClick}
              selectedJobId={selectedJob?.id}
            />
          </div>
        </div>

        {/* Right Panel */}
        <div ref={rightPanelRef} className="hidden lg:block w-1/2 overflow-y-auto bg-white custom-scrollbar">
          <JobDetailPanel job={selectedJob} onSaveNotes={handleSaveNotes} idPrefix="desktop" />
        </div>

        {/* Mobile */}
        <MobileBottomSheet
          isOpen={isMobileSheetOpen}
          onClose={handleCloseMobileSheet}
          job={selectedJob}
          onSaveNotes={handleSaveNotes}
        />
      </div>
    </div>
  )
}

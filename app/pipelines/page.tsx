"use client"

import { useState, useEffect, useRef } from "react"
import type { Job, Stage, Status } from "@/types"
import { sampleJobs } from "@/data/sample-jobs"
import { storage } from "@/lib/storage"
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
    notes: row.notes ?? "",
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
      // 1️⃣ Try Supabase first
      const { data } = await supabase.from("pipelines").select("*")

      let jobsToUse: Job[]

      if (data && data.length > 0) {
        jobsToUse = data.map(rowToJob)
      } else {
        // 2️⃣ EXACT v0 fallback
        const storedJobs = storage.getJobs()
        jobsToUse = storedJobs || sampleJobs
      }

      // 3️⃣ EXACT v0 sorting logic
      const sortedJobs = [...jobsToUse].sort((a, b) => {
        const dateA = a.scheduledMeeting
          ? new Date(a.scheduledMeeting.date).getTime()
          : Number.MAX_SAFE_INTEGER
        const dateB = b.scheduledMeeting
          ? new Date(b.scheduledMeeting.date).getTime()
          : Number.MAX_SAFE_INTEGER
        return dateA - dateB
      })

      setJobs(sortedJobs)
      if (sortedJobs.length > 0) {
        setSelectedJob(sortedJobs[0])
      }
    }

    load()
  }, [])

  // Keep v0 localStorage behavior for now
  useEffect(() => {
    if (jobs.length > 0) {
      storage.setJobs(jobs)
    }
  }, [jobs])

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
        {/* Left Panel - Pipeline Cards */}
        <div className="w-full lg:w-1/2 border-b lg:border-b-0 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="p-4 sm:p-6 lg:p-8 flex flex-col min-h-full">
            <div className="mb-4 lg:mb-6 flex-shrink-0">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                Interview Pipelines
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Everything gets auto-found and organized—so you can focus on winning, not tracking.
              </p>
            </div>

            <div className="flex-1">
              <PipelineCardList
                jobs={jobs}
                onSelect={handleSelectJob}
                onActionClick={handleActionClick}
                selectedJobId={selectedJob?.id}
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Job Details (Desktop Only) */}
        <div ref={rightPanelRef} className="hidden lg:block w-1/2 overflow-y-auto bg-white custom-scrollbar">
          <JobDetailPanel job={selectedJob} onSaveNotes={handleSaveNotes} idPrefix="desktop" />
        </div>

        {/* Mobile Bottom Sheet */}
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

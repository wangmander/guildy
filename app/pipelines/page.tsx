"use client"

import { useState, useEffect, useRef } from "react"
import type { Job } from "@/types"
import { sampleJobs } from "@/data/sample-jobs"
import { storage } from "@/lib/storage"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"

const stages = ["APPLIED", "RECRUITER_SCREEN", "INTERVIEW", "OFFER"] as const

export default function PipelinesPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const storedJobs = storage.getJobs()
    const jobsToUse = storedJobs || sampleJobs

    const sortedJobs = [...jobsToUse].sort((a, b) => {
      const dateA = a.scheduledMeeting ? new Date(a.scheduledMeeting.date).getTime() : Number.MAX_SAFE_INTEGER
      const dateB = b.scheduledMeeting ? new Date(b.scheduledMeeting.date).getTime() : Number.MAX_SAFE_INTEGER
      return dateA - dateB
    })

    setJobs(sortedJobs)
    if (sortedJobs.length > 0) {
      setSelectedJob(sortedJobs[0])
    }
  }, [])

  // Save jobs to localStorage whenever jobs change
  useEffect(() => {
    if (jobs.length > 0) {
      storage.setJobs(jobs)
    }
  }, [jobs])

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
      }),
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
      }),
    )
  }

  const handleSelectJob = (job: Job) => {
    setSelectedJob(job)
    setIsMobileSheetOpen(true)
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleActionClick = (job: Job) => {
    setSelectedJob(job)
    setIsMobileSheetOpen(true)

    // Use setTimeout to allow render to happen first
    setTimeout(() => {
      // Determine which section to scroll to based on job state
      const targetSuffix = job.scheduledMeeting ? "interview-questions" : "company-intel"

      const mobileEl = document.getElementById(`mobile-${targetSuffix}`)
      const desktopEl = document.getElementById(`desktop-${targetSuffix}`)

      if (mobileEl) {
        mobileEl.scrollIntoView({ behavior: "smooth", block: "start" })
      }

      if (desktopEl) {
        desktopEl.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }, 300) // Increased timeout slightly to ensure mobile sheet is mounted
  }

  const handleCloseMobileSheet = () => {
    setIsMobileSheetOpen(false)
  }

  const handleSaveNotes = (jobId: string, notes: string) => {
    setJobs((prevJobs) => prevJobs.map((job) => (job.id === jobId ? { ...job, notes } : job)))
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left Panel - Pipeline Cards */}
        <div className="w-full lg:w-1/2 border-b lg:border-b-0 flex flex-col overflow-y-auto custom-scrollbar">
          <div className="p-4 sm:p-6 lg:p-8 flex flex-col min-h-full">
            <div className="mb-4 lg:mb-6 flex-shrink-0">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Interview Pipelines</h1>
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

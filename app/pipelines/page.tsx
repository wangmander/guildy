"use client"

import { useState, useEffect } from "react"
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

  useEffect(() => {
    const storedJobs = storage.getJobs()
    const jobsToUse = storedJobs || sampleJobs
    setJobs(jobsToUse)
    if (jobsToUse.length > 0) {
      setSelectedJob(jobsToUse[0])
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
  }

  const handleCloseMobileSheet = () => {
    setIsMobileSheetOpen(false)
  }

  const handleSaveNotes = (jobId: string, notes: string) => {
    setJobs((prevJobs) => prevJobs.map((job) => (job.id === jobId ? { ...job, notes } : job)))
  }

  return (
    <div className="mx-auto max-w-7xl min-h-screen flex flex-col">
      <div className="flex flex-col lg:flex-row flex-1 border-x border-gray-300">
        {/* Left Panel - Pipeline Cards */}
        <div className="w-full lg:w-1/2 border-r-0 lg:border-r border-gray-200 border-b lg:border-b-0 flex flex-col">
          <div className="p-4 sm:p-6 lg:p-8 flex flex-col">
            <div className="mb-4 lg:mb-6">
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Interview Pipelines</h1>
              <p className="text-sm text-gray-600 mt-1">
                Everything gets auto-found and organized—so you can focus on winning, not tracking.
              </p>
            </div>

            <PipelineCardList jobs={jobs} onSelect={handleSelectJob} selectedJobId={selectedJob?.id} />
          </div>
        </div>

        {/* Right Panel - Job Details (Desktop Only) */}
        <div className="hidden lg:block w-1/2">
          <JobDetailPanel job={selectedJob} onSaveNotes={handleSaveNotes} />
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

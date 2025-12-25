"use client"

import { useState, useEffect, useRef } from "react"
import type { Job } from "@/types"
import { sampleJobs } from "@/data/sample-jobs"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"

const stages = ["APPLIED", "RECRUITER_SCREEN", "INTERVIEW", "OFFER"] as const

// ✅ ONLY CHANGE: Map Supabase data to Job type
function mapSupabaseToJob(row: any): Job {
  return {
    id: row.id || `job-${Date.now()}`,
    title: row.role || row.title || "Role Not Specified",
    company: {
      name: row.company || "Unknown Company",
      glassdoorRating: row.glassdoor_rating || null
    },
    location: row.location || "Location not specified",
    industry: row.industry || "Industry not specified",
    jobType: row.job_type || "Full-time",
    tags: row.tags || [],
    stage: stages.includes(row.stage) ? row.stage : "APPLIED",
    status: row.status || "ACTIVE",
    nextEtaText: row.next_eta_text || "TBD",
    appliedAt: row.created_at || new Date().toISOString(),
    postingUrl: row.posting_url || "",
    lastEmail: row.last_email || null,
    notes: row.notes || "",
    scheduledMeeting: row.scheduled_meeting || null,
    interviewPrep: row.interview_prep || null,
    recentNews: row.recent_news || []
  }
}

export default function PipelinesPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadJobs() {
      // ✅ ONLY CHANGE: Fetch from Supabase instead of localStorage
      const { data, error } = await supabase.from("pipelines").select("*")
      
      let jobsToUse: Job[]
      if (data && data.length > 0) {
        jobsToUse = data.map(mapSupabaseToJob)
      } else {
        jobsToUse = sampleJobs
      }

      const sortedJobs = [...jobsToUse].sort((a, b) => {
        const dateA = a.scheduledMeeting ? new Date(a.scheduledMeeting.date).getTime() : Number.MAX_SAFE_INTEGER
        const dateB = b.scheduledMeeting ? new Date(b.scheduledMeeting.date).getTime() : Number.MAX_SAFE_INTEGER
        return dateA - dateB
      })

      setJobs(sortedJobs)
      if (sortedJobs.length > 0) {
        setSelectedJob(sortedJobs[0])
      }
    }

    loadJobs()
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

    setTimeout(() => {
      const targetSuffix = job.scheduledMeeting ? "interview-questions" : "company-intel"
      const mobileEl = document.getElementById(`mobile-${targetSuffix}`)
      const desktopEl = document.getElementById(`desktop-${targetSuffix}`)

      if (mobileEl) {
        mobileEl.scrollIntoView({ behavior: "smooth", block: "start" })
      }

      if (desktopEl) {
        desktopEl.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }, 300)
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

        <div ref={rightPanelRef} className="hidden lg:block w-1/2 overflow-y-auto bg-white custom-scrollbar">
          <JobDetailPanel job={selectedJob} onSaveNotes={handleSaveNotes} idPrefix="desktop" />
        </div>

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

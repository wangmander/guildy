"use client"

import { useState, useEffect, useRef } from "react"
import type { Job } from "@/types"
import { sampleJobs } from "@/data/sample-jobs"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"

const stages = ["APPLIED", "RECRUITER_SCREEN", "INTERVIEW", "OFFER"] as const

function supabaseRowToJob(row: any): Job {
  return {
    id: row.id,
    company: row.company ?? "Unknown company",
    role: row.role ?? "Unknown role",
    stage: stages.includes(row.stage) ? row.stage : "APPLIED",
    notes: "",
    scheduledMeeting: null,
    companyIntel: {
      overview: "",
      keyPoints: [],
      competitors: [],
    },
    interviewQuestions: [],
  }
}

export default function PipelinesPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("pipelines").select("*")

      if (data && data.length > 0) {
        const mapped = data.map(supabaseRowToJob)
        setJobs(mapped)
        setSelectedJob(mapped[0])
      } else {
        setJobs(sampleJobs)
        setSelectedJob(sampleJobs[0])
      }

      if (error) console.error(error)
    }

    load()
  }, [])

  const handleSelectJob = (job: Job) => {
    setSelectedJob(job)
    setIsMobileSheetOpen(true)
    rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        <div className="w-full lg:w-1/2 border-b lg:border-b-0 flex flex-col overflow-y-auto">
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-2">Interview Pipelines</h1>
            <PipelineCardList
              jobs={jobs}
              selectedJobId={selectedJob?.id}
              onSelect={handleSelectJob}
              onActionClick={handleSelectJob}
            />
          </div>
        </div>

        <div ref={rightPanelRef} className="hidden lg:block w-1/2 overflow-y-auto">
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

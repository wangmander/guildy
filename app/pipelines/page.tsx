"use client"

import { useState, useEffect, useRef } from "react"
import type { Job } from "@/types"
import { sampleJobs } from "@/data/sample-jobs"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"

const STAGES = ["APPLIED", "RECRUITER_SCREEN", "INTERVIEW", "OFFER"] as const

function toSafeJob(input: any, index: number): Job {
  return {
    id: typeof input?.id === "string" ? input.id : `fallback-${index}`,
    company: typeof input?.company === "string" ? input.company : "Unknown Company",
    role: typeof input?.role === "string" ? input.role : "",
    stage: STAGES.includes(input?.stage) ? input.stage : "APPLIED",
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
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("pipelines").select("*")

      let finalJobs: Job[]

      if (Array.isArray(data) && data.length > 0) {
        finalJobs = data.map((row, i) => toSafeJob(row, i))
      } else {
        finalJobs = sampleJobs.map((row, i) => toSafeJob(row, i))
      }

      setJobs(finalJobs)
      setSelectedJob(finalJobs[0] ?? null)
    }

    load()
  }, [])

  function handleSelectJob(job: Job) {
    setSelectedJob(job)
    setIsMobileSheetOpen(true)
    rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  // 🚨 CRITICAL: do NOT render children until jobs exist
  if (!jobs || jobs.length === 0) {
    return <div className="p-6">Loading pipelines…</div>
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

"use client"

import { useState, useEffect, useRef } from "react"
import type { Job } from "@/types"
import { sampleJobs } from "@/data/sample-jobs"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"

const STAGES = ["APPLIED", "RECRUITER_SCREEN", "INTERVIEW", "OFFER"] as const
type Stage = typeof STAGES[number]

/**
 * Convert ANYTHING into a safe Job object the UI can never crash on
 */
function toSafeJob(input: any, index = 0): Job {
  return {
    id: typeof input?.id === "string" ? input.id : `fallback-${index}`,
    company:
      typeof input?.company === "string" && input.company.length > 0
        ? input.company
        : "Unknown Company",
    role:
      typeof input?.role === "string"
        ? input.role
        : "",
    stage:
      typeof input?.stage === "string" && STAGES.includes(input.stage as Stage)
        ? input.stage
        : "APPLIED",
    notes: typeof input?.notes === "string" ? input.notes : "",
    scheduledMeeting: input?.scheduledMeeting ?? null,
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
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")

      if (error) {
        console.error("Supabase error:", error)
      }

      if (Array.isArray(data) && data.length > 0) {
        const safe = data.map((row, i) => toSafeJob(row, i))
        setJobs(safe)
        setSelectedJob(safe[0])
      } else {
        const safeFallback = sampleJobs.map((j, i) => toSafeJob(j, i))
        setJobs(safeFallback)
        setSelectedJob(safeFallback[0])
      }
    }

    load()
  }, [])

  function handleSelectJob(job: Job) {
    setSelectedJob(job)
    setIsMobileSheetOpen(true)
    rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-full lg:w-1/2 border-b lg:border-b-0 flex flex-col overflow-y-auto">
          <div className="p-6">
            <h1 className="text-2xl font-bold mb-2">
              Interview Pipelines
            </h1>

            <PipelineCardList
              jobs={jobs.map((j, i) => toSafeJob(j, i))}
              selectedJobId={selectedJob?.id}
              onSelect={handleSelectJob}
              onActionClick={handleSelectJob}
            />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div
          ref={rightPanelRef}
          className="hidden lg:block w-1/2 overflow-y-auto"
        >
          <JobDetailPanel
            job={selectedJob}
            onSaveNotes={() => {}}
            idPrefix="desktop"
          />
        </div>

        {/* MOBILE */}
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

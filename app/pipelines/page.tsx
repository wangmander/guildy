"use client"

import React, { Component, type ReactNode, useEffect, useMemo, useRef, useState, useCallback } from "react"
import type { Job, Stage, Status } from "@/types"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"
import { signIn, useSession } from "next-auth/react"

const UI_STAGES = ["SCREENING", "HIRING_MANAGER", "PRESENTATION", "FULL_LOOP", "OFFER_DISCUSSION"] as const

// ============================================================
// UTILITY FUNCTIONS
// ============================================================
function safeStr(v: any, fallback = ""): string {
  if (typeof v === "string") return v
  if (v == null) return fallback
  return String(v)
}

function safeArr<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : []
}

function safeJson(v: any): any | null {
  if (!v) return null
  if (typeof v === "object") return v
  if (typeof v !== "string") return null
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

function pick(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== "object") return undefined
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k]
  }
  return undefined
}

function stageBucketToUiStage(rawStage: any, stageDetail?: any): Stage {
  const s = safeStr(rawStage, "").toUpperCase()
  const detail = safeStr(stageDetail, "").toUpperCase()

  if ((UI_STAGES as readonly string[]).includes(s)) return s as Stage

  if (detail.includes("OFFER") || detail.includes("NEGOTIAT")) return "OFFER_DISCUSSION" as Stage
  if (detail.includes("FULL LOOP") || detail.includes("LOOP") || detail.includes("ONSITE")) return "FULL_LOOP" as Stage
  if (detail.includes("PRESENT")) return "PRESENTATION" as Stage
  if (detail.includes("HIRING MANAGER") || detail.includes("HM")) return "HIRING_MANAGER" as Stage

  if (s.includes("OFFER")) return "OFFER_DISCUSSION" as Stage
  if (s.includes("FULL_LOOP") || s.includes("ONSITE") || s.includes("LOOP")) return "FULL_LOOP" as Stage
  if (s.includes("PRESENT")) return "PRESENTATION" as Stage
  if (s.includes("HIRING_MANAGER") || s === "HM" || s.includes("HIRING")) return "HIRING_MANAGER" as Stage

  return "SCREENING" as Stage
}

function normalizeInterviewPrep(prepAny: any): any | undefined {
  if (!prepAny || typeof prepAny !== "object") return undefined

  const stageFocus = safeStr(pick(prepAny, ["stageFocus", "prepFocus", "focus", "stage_focus", "prep_focus"]) ?? "", "")

  const qTheyAsk = safeArr<string>(pick(prepAny, ["questionsTheyMightAsk", "theyMightAsk", "questions_they_might_ask_you"]))
    .map((x) => safeStr(x).trim())
    .filter(Boolean)

  const qYouAsk = safeArr<string>(pick(prepAny, ["questionsYouShouldAskThem", "youShouldAsk", "questions_you_should_ask_them"]))
    .map((x) => safeStr(x).trim())
    .filter(Boolean)

  const emphasize = safeArr<string>(pick(prepAny, ["whatToEmphasize", "emphasize", "what_to_emphasize"]))
    .map((x) => safeStr(x).trim())
    .filter(Boolean)

  const stories = safeArr<string>(pick(prepAny, ["storiesToPrepare", "stories", "stories_to_prepare"]))
    .map((x) => safeStr(x).trim())
    .filter(Boolean)

  const homework = safeArr<string>(pick(prepAny, ["homeworkNext24h", "homework", "homework_next_24h"]))
    .map((x) => safeStr(x).trim())
    .filter(Boolean)

  if (stageFocus || qTheyAsk.length || qYouAsk.length || emphasize.length || stories.length || homework.length) {
    return {
      stageFocus,
      questionsTheyMightAsk: qTheyAsk,
      questionsYouShouldAskThem: qYouAsk,
      whatToEmphasize: emphasize,
      storiesToPrepare: stories,
      homeworkNext24h: homework,
      interviewer: {
        name: safeStr(pick(prepAny, ["interviewerName", "interviewer_name"]) ?? "Interviewer", "Interviewer"),
        role: safeStr(pick(prepAny, ["interviewerRole", "interviewer_role"]) ?? "Hiring Team", "Hiring Team"),
        bio: safeStr(pick(prepAny, ["interviewerBio", "interviewer_bio"]) ?? "", ""),
        goals: safeArr<string>(pick(prepAny, ["interviewerGoals", "interviewer_goals"])).map((x) => safeStr(x)).filter(Boolean),
      },
      sampleQuestions: qTheyAsk,
      tips: emphasize,
    }
  }

  const interviewer = pick(prepAny, ["interviewer"])
  const sampleQuestions = safeArr<string>(pick(prepAny, ["sampleQuestions", "sample_questions"]))
  const tips = safeArr<string>(pick(prepAny, ["tips"]))

  if (interviewer && typeof interviewer === "object") {
    return {
      interviewer: {
        name: safeStr(pick(interviewer, ["name"]) ?? "Interviewer", "Interviewer"),
        role: safeStr(pick(interviewer, ["role"]) ?? "Hiring Team", "Hiring Team"),
        bio: safeStr(pick(interviewer, ["bio"]) ?? "", ""),
        goals: safeArr<string>(pick(interviewer, ["goals"])).map((x) => safeStr(x)).filter(Boolean),
      },
      sampleQuestions: sampleQuestions.map((x) => safeStr(x)).filter(Boolean),
      tips: tips.map((x) => safeStr(x)).filter(Boolean),
    }
  }

  return undefined
}

function rowToJob(row: any): Job {
  const companyName = safeStr(pick(row, ["company", "company_name"]) ?? "Unknown company", "Unknown company")
  const roleTitle = safeStr(pick(row, ["role", "title"]) ?? "Interview", "Interview")

  const prepRaw =
    safeJson(pick(row, ["prep_json", "interview_prep_json", "prep", "interview_prep"])) ??
    safeJson(pick(row, ["llm_prep_json", "llm_prep"])) ??
    null

  const insightsRaw =
    safeJson(pick(row, ["insights_json", "insights"])) ??
    safeJson(pick(row, ["llm_insights_json", "llm_insights"])) ??
    null

  const stageDetail =
    safeStr(pick(row, ["stage_detail", "stageDetail"]) ?? "") ||
    safeStr(pick(prepRaw, ["stage_detail", "stageDetail", "stageDetailText"]) ?? "") ||
    safeStr(pick(insightsRaw, ["stage_detail", "stageDetail"]) ?? "")

  const uiStage = stageBucketToUiStage(pick(row, ["stage"]) ?? "", stageDetail)

  const lastEmailSubject = safeStr(pick(row, ["last_email_subject", "lastEmailSubject"]) ?? "")
  const lastEmailAt = pick(row, ["last_email_at", "lastEmailAt"])
  const lastEmailSnippet = safeStr(pick(row, ["last_email_snippet", "lastEmailSnippet"]) ?? "")
  const lastEmailFromName = safeStr(pick(row, ["last_email_from_name", "lastEmailFromName"]) ?? companyName)
  const lastEmailFromEmail = safeStr(pick(row, ["last_email_from_email", "lastEmailFromEmail", "last_email_from"]) ?? "")

  const postingUrl = safeStr(pick(row, ["job_posting_url", "posting_url", "postingUrl"]) ?? "")

  const companyIntelRaw =
    pick(insightsRaw, ["companyIntel", "company_intel"]) ??
    pick(prepRaw, ["companyIntel", "company_intel"]) ??
    safeJson(pick(row, ["company_intel_json", "companyIntelJson"])) ??
    null

  const companyIntel = companyIntelRaw && typeof companyIntelRaw === "object" ? companyIntelRaw : null
  const recentNews = safeArr<any>(pick(companyIntel, ["recentNews", "recent_news", "news"]))
  const interviewPrep = normalizeInterviewPrep(prepRaw)

  const job: any = {
    id: row.id,
    title: roleTitle,
    company: {
      name: companyName,
      glassdoorRating: pick(companyIntel, ["glassdoorRating", "glassdoor_rating"]),
    },
    stage: uiStage,
    status: (safeStr(pick(row, ["status"]) ?? "WAITING", "WAITING").toUpperCase() as Status) ?? ("WAITING" as Status),
    appliedAt: pick(row, ["applied_at", "created_at", "last_email_at"]) ?? undefined,
    location: safeStr(pick(companyIntel, ["hqLocation", "hq_location"]) ?? pick(row, ["location"]) ?? "Unknown", "Unknown"),
    industry: safeStr(pick(companyIntel, ["industry"]) ?? pick(row, ["industry"]) ?? "Unknown", "Unknown"),
    postingUrl: postingUrl || undefined,
    jobType: safeStr(pick(row, ["job_type", "jobType"]) ?? "Unknown", "Unknown"),
    nextEtaText: safeStr(pick(row, ["next_eta_text", "nextEtaText"]) ?? "TBD", "TBD"),
    stageDetail: stageDetail || undefined,
    lastEmail: lastEmailSubject
      ? {
          fromName: lastEmailFromName,
          fromEmail: lastEmailFromEmail,
          subject: lastEmailSubject,
          receivedAt: lastEmailAt ? String(lastEmailAt) : "",
          snippet: lastEmailSnippet,
        }
      : undefined,
    notes: safeStr(pick(row, ["notes"]) ?? "", ""),
    interviewPrep,
    recentNews,
    companyIntel: companyIntel || undefined,
    insights: insightsRaw || undefined,
  }

  return job as Job
}

// ============================================================
// ERROR BOUNDARY
// ============================================================
class PanelErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorText: string }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, errorText: "" }
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, errorText: safeStr(err?.message ?? err, "Panel crashed") }
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="font-semibold mb-1">Details panel crashed</div>
            <div className="opacity-90">{this.state.errorText}</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ============================================================
// LOGGED OUT STATE
// ============================================================
function LoggedOutConnect() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-white flex items-center justify-center px-6">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-black text-white flex items-center justify-center font-semibold">G</div>
          <div>
            <div className="text-2xl font-bold text-gray-900">Guildy</div>
            <div className="text-sm text-gray-600">Track every pipeline. Prep every stage. Close the offer.</div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold text-gray-900 mb-1">Connect Gmail to auto-build your pipelines</div>
          <div className="text-sm text-gray-600 mb-4">
            Guildy reads recruiting threads, detects the current stage, and generates stage-specific prep.
          </div>

          <ul className="text-sm text-gray-700 space-y-2 mb-5">
            <li>• Automatic pipeline creation per company</li>
            <li>• Stage inference from real email signals</li>
            <li>• Bespoke prep tied to your exact stage</li>
          </ul>

          <button
            onClick={() => signIn("google")}
            className="w-full px-4 py-2.5 bg-black text-white rounded-lg hover:opacity-95"
          >
            Connect Gmail
          </button>

          <div className="mt-3 text-xs text-gray-500">
            If you're already connected but got logged out, click Connect Gmail again.
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MAIN PIPELINES PAGE
// ============================================================
export default function PipelinesPage() {
  const { data: session, status } = useSession()
  const userEmail = useMemo(() => session?.user?.email ?? "", [session?.user?.email])

  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  // Refs for sync control
  const syncInFlightRef = useRef(false)
  const mountedRef = useRef(true)

  // ============================================================
  // LOAD PIPELINES FROM SUPABASE
  // ============================================================
  const loadPipelines = useCallback(async () => {
    if (!userEmail) return

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)
      .order("last_email_at", { ascending: false })

    if (error || !mountedRef.current) return

    const mapped = (data ?? []).map(rowToJob)

    setJobs(mapped)
    setSelectedJob((prev) => {
      if (!mapped.length) return null
      if (!prev) return mapped[0]
      const stillThere = mapped.find((j) => j.id === prev.id)
      return stillThere ?? mapped[0]
    })
  }, [userEmail])

  // ============================================================
  // SYNC GMAIL - Calls backend API
  // ============================================================
  const syncGmail = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" })
      if (!res.ok) {
        console.error("Gmail sync failed:", await res.text())
        return false
      }
      const data = await res.json()
      console.log("Sync result:", data)
      return true
    } catch (err) {
      console.error("Sync error:", err)
      return false
    }
  }, [])

  // ============================================================
  // SYNC AND RELOAD - Main sync function with guard
  // ============================================================
  const syncAndReload = useCallback(async () => {
    if (status !== "authenticated") return
    if (syncInFlightRef.current) return
    if (!mountedRef.current) return

    syncInFlightRef.current = true
    setSyncing(true)

    try {
      const success = await syncGmail()
      if (success && mountedRef.current) {
        await loadPipelines()
        setLastSyncAt(new Date().toLocaleTimeString())
      }
    } finally {
      syncInFlightRef.current = false
      if (mountedRef.current) {
        setSyncing(false)
      }
    }
  }, [status, syncGmail, loadPipelines])

  // ============================================================
  // AUTO-SYNC SETUP
  // - On mount (initial load)
  // - Every 10 minutes
  // - On window focus
  // - On visibility change (tab becomes visible)
  // ============================================================
  useEffect(() => {
    mountedRef.current = true

    if (status !== "authenticated") return

    // Initial sync on mount
    syncAndReload()

    // 10-minute interval
    const intervalId = setInterval(() => {
      syncAndReload()
    }, 10 * 60 * 1000) // 10 minutes

    // Focus handler
    const handleFocus = () => {
      syncAndReload()
    }

    // Visibility change handler (for when tab becomes active)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncAndReload()
      }
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      mountedRef.current = false
      clearInterval(intervalId)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [status, syncAndReload])

  // Also load pipelines when auth changes (without full sync)
  useEffect(() => {
    if (status === "authenticated") {
      loadPipelines()
    }
  }, [status, loadPipelines])

  // ============================================================
  // RENDER
  // ============================================================
  if (status === "unauthenticated") {
    return <LoggedOutConnect />
  }

  if (status === "loading") {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center text-sm text-gray-600">
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header with sync status */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Auto-sync</span>
            {syncing ? (
              <span className="text-sm text-blue-600 flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing…
              </span>
            ) : lastSyncAt ? (
              <span className="text-xs text-gray-500">Last sync: {lastSyncAt}</span>
            ) : null}
          </div>
          <span className="text-xs text-gray-500">Checks Gmail every 10 min + on focus</span>
        </div>
      </div>

      {/* Main content - single scroll container */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5F0]">
        <div className="flex flex-col lg:flex-row gap-6 p-4">
          {/* Left column - Pipeline list */}
          <div className="w-full lg:w-1/2 min-w-0">
            <div className="px-2">
              {jobs.length === 0 ? (
                <div className="rounded-xl border bg-white p-6 text-center">
                  <div className="text-gray-600 mb-2">No pipelines yet</div>
                  <div className="text-sm text-gray-500">
                    {syncing
                      ? "Scanning your Gmail for recruiting emails…"
                      : "We'll automatically detect interview emails and create pipelines."}
                  </div>
                </div>
              ) : (
                <PipelineCardList
                  jobs={jobs}
                  selectedJobId={selectedJob?.id}
                  onSelect={(job) => {
                    setSelectedJob(job)
                    setIsMobileSheetOpen(true)
                  }}
                  onActionClick={(job) => {
                    setSelectedJob(job)
                    setIsMobileSheetOpen(true)
                  }}
                />
              )}
            </div>
          </div>

          {/* Right column - Job details */}
          <div className="hidden lg:block w-full lg:w-1/2 min-w-0">
            <PanelErrorBoundary>
              <JobDetailPanel job={selectedJob} onSaveNotes={() => {}} />
            </PanelErrorBoundary>
          </div>
        </div>

        {/* Mobile bottom sheet */}
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

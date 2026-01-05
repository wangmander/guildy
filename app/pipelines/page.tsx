"use client"

import React, { Component, type ReactNode, useEffect, useMemo, useRef, useState, useCallback } from "react"
import type { Job, Stage, Status } from "@/types"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"
import { signIn, useSession } from "next-auth/react"

const UI_STAGES = ["SCREENING", "HIRING_MANAGER", "PRESENTATION", "FULL_LOOP", "OFFER_DISCUSSION"] as const

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
    const val = obj[k]
    if (val !== undefined && val !== null && val !== "") return val
  }
  return undefined
}

function stageBucketToUiStage(rawStage: any, stageDetail?: any): Stage {
  const s = safeStr(rawStage, "").toUpperCase()
  const detail = safeStr(stageDetail, "").toUpperCase()

  // Direct match
  if ((UI_STAGES as readonly string[]).includes(s)) return s as Stage

  // Stage detail hints
  if (detail.includes("OFFER") || detail.includes("NEGOTIAT")) return "OFFER_DISCUSSION" as Stage
  if (detail.includes("FULL LOOP") || detail.includes("LOOP") || detail.includes("ONSITE")) return "FULL_LOOP" as Stage
  if (detail.includes("ASSESSMENT") || detail.includes("TAKE-HOME") || detail.includes("CODING")) return "PRESENTATION" as Stage
  if (detail.includes("HIRING MANAGER") || detail.includes("HM")) return "HIRING_MANAGER" as Stage

  // Stage field mapping
  if (s.includes("OFFER")) return "OFFER_DISCUSSION" as Stage
  if (s.includes("FULL_LOOP") || s.includes("ONSITE") || s.includes("LOOP")) return "FULL_LOOP" as Stage
  if (s.includes("ASSESSMENT")) return "PRESENTATION" as Stage
  if (s.includes("HM") || s.includes("HIRING")) return "HIRING_MANAGER" as Stage

  return "SCREENING" as Stage
}

function normalizeInterviewPrep(prepAny: any): any | undefined {
  if (!prepAny || typeof prepAny !== "object") return undefined

  const stageFocus = safeStr(
    pick(prepAny, ["stageFocus", "prepFocus", "stage_focus", "prep_focus", "focus"]) ?? "", 
    ""
  )

  const qTheyAsk = safeArr<string>(
    pick(prepAny, ["questionsTheyMightAsk", "questions_they_might_ask", "theyMightAsk"])
  ).map((x) => safeStr(x).trim()).filter(Boolean)

  const qYouAsk = safeArr<string>(
    pick(prepAny, ["questionsYouShouldAsk", "questions_you_should_ask", "questionsYouShouldAskThem", "youShouldAsk"])
  ).map((x) => safeStr(x).trim()).filter(Boolean)

  const emphasize = safeArr<string>(
    pick(prepAny, ["whatToEmphasize", "what_to_emphasize", "emphasize"])
  ).map((x) => safeStr(x).trim()).filter(Boolean)

  const stories = safeArr<string>(
    pick(prepAny, ["storiesToPrepare", "stories_to_prepare", "stories"])
  ).map((x) => safeStr(x).trim()).filter(Boolean)

  const homework = safeArr<string>(
    pick(prepAny, ["homeworkNext24h", "homework_next_24h", "homework"])
  ).map((x) => safeStr(x).trim()).filter(Boolean)

  const companyIntel = pick(prepAny, ["companyIntel", "company_intel"]) || {}

  return {
    stageFocus,
    stage_focus: stageFocus,
    prepFocus: stageFocus,
    questionsTheyMightAsk: qTheyAsk,
    questions_they_might_ask: qTheyAsk,
    questionsYouShouldAsk: qYouAsk,
    questionsYouShouldAskThem: qYouAsk,
    questions_you_should_ask: qYouAsk,
    whatToEmphasize: emphasize,
    what_to_emphasize: emphasize,
    storiesToPrepare: stories,
    stories_to_prepare: stories,
    homeworkNext24h: homework,
    homework_next_24h: homework,
    industry: pick(companyIntel, ["industry"]) || "Unknown",
    size: pick(companyIntel, ["size"]) || "Unknown",
    hqLocation: pick(companyIntel, ["hqLocation", "hq_location"]) || "Unknown",
    hq_location: pick(companyIntel, ["hqLocation", "hq_location"]) || "Unknown",
    glassdoorRating: pick(companyIntel, ["glassdoorRating", "glassdoor_rating"]) || "Unknown",
    glassdoor_rating: pick(companyIntel, ["glassdoorRating", "glassdoor_rating"]) || "Unknown",
    summary: pick(companyIntel, ["summary"]) || "",
    companyIntelSummary: pick(companyIntel, ["summary"]) || "",
    recentNews: safeArr(pick(companyIntel, ["recentNews", "recent_news"])),
    recent_news: safeArr(pick(companyIntel, ["recentNews", "recent_news"])),
  }
}

function rowToJob(row: any): Job {
  const companyName = safeStr(pick(row, ["company", "company_name"]) ?? "Unknown company", "Unknown company")
  const roleTitle = safeStr(pick(row, ["role", "title"]) ?? "Interview", "Interview")

  const prepRaw = safeJson(pick(row, ["prep_json", "interview_prep_json", "prep", "interview_prep"])) ?? null
  let insightsRaw = safeJson(pick(row, ["insights_json", "insights"])) ?? null
  
  // Normalize insights field names
  if (insightsRaw) {
    insightsRaw = {
      ...insightsRaw,
      stageReason: insightsRaw.stageReason || insightsRaw.stage_reason || "",
      waitingOn: insightsRaw.waitingOn || insightsRaw.waiting_on || "you",
      nextAction: insightsRaw.nextAction || insightsRaw.next_action || "",
      urgency: insightsRaw.urgency || "med",
      responseLikelihood: insightsRaw.responseLikelihood || insightsRaw.response_likelihood || "med",
      tone: insightsRaw.tone || "neutral",
    }
  }

  const stageDetail =
    safeStr(pick(row, ["stage_detail", "stageDetail"]) ?? "") ||
    safeStr(pick(prepRaw, ["stage_detail", "stageDetail"]) ?? "") ||
    safeStr(pick(insightsRaw, ["stage_detail", "stageDetail"]) ?? "")

  const uiStage = stageBucketToUiStage(pick(row, ["stage"]) ?? "", stageDetail)

  const lastEmailSubject = safeStr(pick(row, ["last_email_subject", "lastEmailSubject"]) ?? "")
  const lastEmailAt = pick(row, ["last_email_at", "lastEmailAt"])
  const lastEmailSnippet = safeStr(pick(row, ["last_email_snippet", "lastEmailSnippet"]) ?? "")
  const lastEmailFromName = safeStr(pick(row, ["last_email_from_name", "lastEmailFromName"]) ?? companyName)
  const lastEmailFromEmail = safeStr(pick(row, ["last_email_from_email", "lastEmailFromEmail", "last_email_from"]) ?? "")

  const companyIntelRaw =
    pick(prepRaw, ["companyIntel", "company_intel"]) ??
    safeJson(pick(row, ["company_intel_json", "companyIntelJson"])) ??
    null

  const companyIntel = companyIntelRaw && typeof companyIntelRaw === "object" ? companyIntelRaw : null
  const recentNews = safeArr<any>(pick(companyIntel, ["recentNews", "recent_news", "news"]))
  
  const normalizedPrep = normalizeInterviewPrep(prepRaw) || {}
  
  // Merge insights into interviewPrep for job-detail-panel
  const interviewPrep = {
    ...normalizedPrep,
    tone: insightsRaw?.tone || "",
    urgency: insightsRaw?.urgency || "",
    responseLikelihood: insightsRaw?.responseLikelihood || "",
    response_likelihood: insightsRaw?.responseLikelihood || "",
    nextAction: insightsRaw?.nextAction || "",
    next_action: insightsRaw?.nextAction || "",
    insights: insightsRaw || {},
  }

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

function LoggedOutConnect() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-100 flex items-center justify-center px-6">
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

// Sync Progress Bar component
function SyncProgressBar({ progress, message }: { progress: number; message: string }) {
  return (
    <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
      <div className="flex items-center gap-3 mb-2">
        <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm text-blue-700 font-medium">{message}</span>
      </div>
      <div className="w-full bg-blue-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

export default function PipelinesPage() {
  const { data: session, status } = useSession()
  const userEmail = useMemo(() => session?.user?.email ?? "", [session?.user?.email])

  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  
  // Sync status
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle')
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncMessage, setSyncMessage] = useState("Connecting to Gmail...")
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [isFirstSync, setIsFirstSync] = useState(true)

  const syncInFlightRef = useRef(false)
  const mountedRef = useRef(true)

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
    
    // After first load, mark as not first sync
    if (mapped.length > 0) {
      setIsFirstSync(false)
    }
  }, [userEmail])

  const syncGmail = useCallback(async (): Promise<boolean> => {
    try {
      // Simulate progress for better UX
      setSyncProgress(10)
      setSyncMessage("Connecting to Gmail...")
      
      await new Promise(r => setTimeout(r, 300))
      setSyncProgress(25)
      setSyncMessage("Fetching emails...")
      
      const res = await fetch("/api/gmail/sync", { method: "POST" })
      
      setSyncProgress(60)
      setSyncMessage("Analyzing emails...")
      
      if (!res.ok) {
        console.error("Gmail sync failed:", await res.text())
        return false
      }
      
      setSyncProgress(85)
      setSyncMessage("Updating pipelines...")
      
      const data = await res.json()
      console.log("Sync result:", data)
      
      setSyncProgress(100)
      setSyncMessage("Complete!")
      
      return true
    } catch (err) {
      console.error("Sync error:", err)
      return false
    }
  }, [])

  const syncAndReload = useCallback(async () => {
    if (status !== "authenticated") return
    if (syncInFlightRef.current) return
    if (!mountedRef.current) return

    syncInFlightRef.current = true
    setSyncStatus('syncing')
    setSyncProgress(0)

    try {
      const success = await syncGmail()
      if (success && mountedRef.current) {
        await loadPipelines()
        setLastSyncTime(new Date())
      }
    } finally {
      syncInFlightRef.current = false
      if (mountedRef.current) {
        setSyncStatus('done')
        setTimeout(() => {
          if (mountedRef.current) {
            setSyncStatus('idle')
            setSyncProgress(0)
          }
        }, 2000)
      }
    }
  }, [status, syncGmail, loadPipelines])

  // Auto-sync setup
  useEffect(() => {
    mountedRef.current = true

    if (status !== "authenticated") return

    // Initial sync
    syncAndReload()

    // 10-minute interval
    const intervalId = setInterval(() => {
      syncAndReload()
    }, 10 * 60 * 1000)

    // Focus handler
    const handleFocus = () => {
      if (!lastSyncTime || Date.now() - lastSyncTime.getTime() > 2 * 60 * 1000) {
        syncAndReload()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!lastSyncTime || Date.now() - lastSyncTime.getTime() > 2 * 60 * 1000) {
          syncAndReload()
        }
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
  }, [status, syncAndReload, lastSyncTime])

  useEffect(() => {
    if (status === "authenticated") {
      loadPipelines()
    }
  }, [status, loadPipelines])

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

  const getTimeAgo = () => {
    if (!lastSyncTime) return ""
    const mins = Math.floor((Date.now() - lastSyncTime.getTime()) / 60000)
    if (mins < 1) return "just now"
    if (mins === 1) return "1 min ago"
    return `${mins} min ago`
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Progress bar for first sync or syncing state */}
      {syncStatus === 'syncing' && (isFirstSync || jobs.length === 0) ? (
        <SyncProgressBar progress={syncProgress} message={syncMessage} />
      ) : (
        <div className="px-4 py-3 border-b bg-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {syncStatus === 'syncing' ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm text-blue-600">Syncing...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-green-600">Up to date</span>
                  {lastSyncTime && (
                    <span className="text-xs text-gray-400">• {getTimeAgo()}</span>
                  )}
                </>
              )}
            </div>
            <span className="text-xs text-gray-400">Checks every 10 min</span>
          </div>
        </div>
      )}

      {/* Main content - gray background for whole area */}
      <div className="flex-1 overflow-hidden bg-gray-100">
        <div className="flex h-full">
          {/* Left column - Pipelines (gray background) */}
          <div className="w-full lg:w-1/2 min-w-0 overflow-y-auto p-4">
            {jobs.length === 0 ? (
              <div className="rounded-xl border bg-[#FAFAF8] p-6 text-center">
                <div className="text-gray-600 mb-2 font-medium">No pipelines yet</div>
                <div className="text-sm text-gray-500">
                  {syncStatus === 'syncing'
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

          {/* Right column - Details (white background) */}
          <div className="hidden lg:block w-1/2 min-w-0 bg-white border-l overflow-y-auto">
            <PanelErrorBoundary>
              <JobDetailPanel job={selectedJob} onSaveNotes={() => {}} />
            </PanelErrorBoundary>
          </div>
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

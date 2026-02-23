"use client"

import React, { Component, type ReactNode, useEffect, useMemo, useRef, useState, useCallback } from "react"
import type { Job, Stage, Status } from "@/types"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
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

  const narrative = safeStr(pick(prepAny, ["narrative", "pitch", "elevator_pitch", "story"]))
  const spicyOpinion = safeStr(pick(prepAny, ["spicy_opinion", "spicyOpinion", "hot_take", "opinion"]))

  const primitives = safeArr(pick(prepAny, ["primitives", "core_concepts", "concepts"]))
    .map((x) => (typeof x === "string" ? { name: x, description: "" } : x))
    .filter((x) => x && x.name)

  const proofStories = safeArr(pick(prepAny, ["proof_stories", "proofStories", "stories"]))
    .map((x) => (typeof x === "string" ? { title: x, detail: "" } : x))
    .filter((x) => x && x.title)

  const qTheyAsk = safeArr<string>(
    pick(prepAny, ["questionsTheyMightAsk", "questions_they_might_ask", "theyMightAsk", "questions_they_ask"])
  ).map((x) => {
    if (typeof x === "object") return x // Handle rich object { category, question }
    return { question: safeStr(x), category: "General" }
  }).filter(x => x.question)

  const qYouAsk = safeArr<string>(
    pick(prepAny, ["questionsYouShouldAsk", "questions_you_should_ask", "questionsYouShouldAskThem", "youShouldAsk", "questions_you_ask"])
  ).map((x) => {
    if (typeof x === "object") return x
    return { question: safeStr(x), category: "General" }
  }).filter(x => x.question)

  const emphasize = safeArr<string>(
    pick(prepAny, ["whatToEmphasize", "what_to_emphasize", "emphasize"])
  ).map((x) => safeStr(x).trim()).filter(Boolean)

  const homework = safeArr<string>(
    pick(prepAny, ["homeworkNext24h", "homework_next_24h", "homework"])
  ).map((x) => safeStr(x).trim()).filter(Boolean)

  const companyIntel = pick(prepAny, ["companyIntel", "company_intel"]) || {}
  const interviewStrategy = pick(prepAny, ["interviewStrategy", "interview_strategy"]) || {}
  const interviewerIntel = pick(prepAny, ["interviewerIntel", "interviewer_intel"]) || {}
  const stageRoadmap = safeArr(pick(prepAny, ["stageRoadmap", "stage_roadmap"]))
  const compensationIntel = pick(prepAny, ["compensationIntel", "compensation_intel"]) || {}
  const prepChecklist = safeArr(pick(prepAny, ["prepChecklist", "prep_checklist"]))

  return {
    stageFocus,
    primitives,
    questionsTheyMightAsk: qTheyAsk,
    questionsYouShouldAsk: qYouAsk,
    companyIntel: {
      industry: pick(companyIntel, ["industry"]) || "Unknown",
      size: pick(companyIntel, ["size"]) || "Unknown",
      hqLocation: pick(companyIntel, ["hqLocation", "hq_location"]) || "Unknown",
      summary: pick(companyIntel, ["summary"]) || "",
      product: pick(companyIntel, ["product"]) || "",
      businessModel: pick(companyIntel, ["businessModel", "business_model"]) || "",
      competitors: safeArr(pick(companyIntel, ["competitors"])),
      techStack: pick(companyIntel, ["techStack", "tech_stack"]) || "",
      culture: pick(companyIntel, ["culture"]) || "",
      recentNews: safeArr(pick(companyIntel, ["recentNews", "recent_news"])),
    },
    interviewStrategy: {
      goalForThisStage: pick(interviewStrategy, ["goalForThisStage", "goal"]) || "",
      whatTheyEvaluate: safeArr(pick(interviewStrategy, ["whatTheyEvaluate", "evaluate"])),
      howToSucceed: safeArr(pick(interviewStrategy, ["howToSucceed", "succeed"])),
      commonMistakes: safeArr(pick(interviewStrategy, ["commonMistakes", "mistakes"])),
      answerLength: pick(interviewStrategy, ["answerLength", "answer_length"]) || "",
    },
    interviewerIntel: {
      name: pick(interviewerIntel, ["name"]) || "",
      likelyRole: pick(interviewerIntel, ["likelyRole", "likely_role"]) || "",
      seniority: pick(interviewerIntel, ["seniority"]) || "",
      whatTheyEvaluate: pick(interviewerIntel, ["whatTheyEvaluate"]) || "",
      topicsTheyProbe: safeArr(pick(interviewerIntel, ["topicsTheyProbe", "topics"])),
      howToCalibrateAnswers: pick(interviewerIntel, ["howToCalibrateAnswers"]) || "",
    },
    stageRoadmap,
    compensationIntel: {
      salaryRange: pick(compensationIntel, ["salaryRange", "salary_range"]) || "",
      equityInfo: pick(compensationIntel, ["equityInfo", "equity_info"]) || "",
      negotiationTips: safeArr(pick(compensationIntel, ["negotiationTips", "negotiation_tips"])),
      whenToDiscuss: pick(compensationIntel, ["whenToDiscuss", "when_to_discuss"]) || "",
    },
    prepChecklist,
    // Keep legacy aliases for backward compat with existing data
    companyIntelSummary: pick(companyIntel, ["summary"]) || "",
    summary: pick(companyIntel, ["summary"]) || "",
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

  const predictedStages = safeArr<string>(pick(row, ["predicted_stages", "predictedStages"]))

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
    predicted_stages: predictedStages.length > 0 ? predictedStages : undefined,
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
  componentDidCatch() { }
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

// Debug Logs Component
function DebugLogsView() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/debug/logs")
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Error ${res.status}: Failed to fetch logs`)
      }
      const data = await res.json()
      setLogs(data.logs || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  if (loading) return <div className="text-xs text-gray-400 p-2">Loading debug logs...</div>
  if (error) return <div className="text-xs text-red-500 p-2">Error loading logs: {error}</div>
  if (logs.length === 0) return <div className="text-xs text-gray-400 p-2">No logs found.</div>

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-semibold text-gray-700">Recent Rejections (Debug)</h4>
        <button onClick={fetchLogs} className="text-[10px] text-blue-600 hover:underline">Refresh</button>
      </div>
      <table className="w-full text-left text-[10px]">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="pb-1 font-medium">Time</th>
            <th className="pb-1 font-medium">Status</th>
            <th className="pb-1 font-medium">Subject</th>
            <th className="pb-1 font-medium">Score</th>
            <th className="pb-1 font-medium">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {logs.map((log) => {
            let timeStr = "—"
            try {
              const d = new Date(log.created_at)
              if (!isNaN(d.getTime())) timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            } catch { /* ignore */ }
            const subject = typeof log.subject === "string" ? log.subject : ""
            const reason = typeof log.rejection_reason === "string" ? log.rejection_reason : ""
            return (
              <tr key={log.id} className="group hover:bg-gray-50">
                <td className="py-1 pr-2 whitespace-nowrap text-gray-400">{timeStr}</td>
                <td className="py-1 pr-2">
                  {log.detected ? (
                    <span className="text-green-600 font-bold">MATCH</span>
                  ) : (
                    <span className="text-red-500 font-bold">REJECT</span>
                  )}
                </td>
                <td className="py-1 pr-2 max-w-[150px] truncate text-gray-700" title={subject}>
                  {subject}
                </td>
                <td className="py-1 pr-2">
                  {log.score !== undefined ? `${log.score} (Max: ${log.strongest_hit ?? 0})` : "-"}
                </td>
                <td className="py-1 text-gray-500 max-w-[200px] truncate" title={reason}>
                  {reason}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function PipelinesPage() {
  const { data: session, status } = useSession()
  const userEmail = useMemo(() => session?.user?.email ?? "", [session?.user?.email])

  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  // localStorage-backed hidden set — survives refresh, reversible
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const hiddenIdsRef = useRef<Set<string>>(new Set())
  const [showHidden, setShowHidden] = useState(false)
  // Scroll reveal state for the pipeline list column
  const [isPipelineScrolling, setIsPipelineScrolling] = useState(false)
  const pipelineScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync status
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle')
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncMessage, setSyncMessage] = useState("Connecting to Gmail...")
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [isFirstSync, setIsFirstSync] = useState(true)
  const [syncStats, setSyncStats] = useState<{
    scanned: number
    detected: number
    inserted: number
    updated: number
    skipped: number
    rejected: number
    errors: number
  } | null>(null)
  const [showSyncDetails, setShowSyncDetails] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const syncInFlightRef = useRef(false)
  const mountedRef = useRef(true)

  const handlePipelineScroll = useCallback(() => {
    setIsPipelineScrolling(true)
    if (pipelineScrollTimerRef.current) clearTimeout(pipelineScrollTimerRef.current)
    pipelineScrollTimerRef.current = setTimeout(() => setIsPipelineScrolling(false), 1200)
  }, [])

  // Load hidden IDs from localStorage once user email is known
  useEffect(() => {
    if (!userEmail) return
    try {
      const stored = localStorage.getItem(`guildy:hidden:${userEmail}`)
      const ids = new Set<string>(stored ? JSON.parse(stored) : [])
      hiddenIdsRef.current = ids
      setHiddenIds(ids)
    } catch {}
  }, [userEmail])

  // Persist hidden IDs to localStorage whenever they change
  useEffect(() => {
    if (!userEmail) return
    try {
      localStorage.setItem(`guildy:hidden:${userEmail}`, JSON.stringify(Array.from(hiddenIds)))
    } catch {}
  }, [hiddenIds, userEmail])

  const hidePipeline = useCallback((job: Job) => {
    const next = new Set(hiddenIdsRef.current)
    next.add(job.id)
    hiddenIdsRef.current = next
    setHiddenIds(new Set(next))
    // If the hidden job was selected, switch to the first still-visible job
    setSelectedJob(prev => {
      if (prev?.id !== job.id) return prev
      const remaining = jobs.filter(j => j.id !== job.id && !next.has(j.id))
      return remaining[0] ?? null
    })
  }, [jobs])

  const unhidePipeline = useCallback((job: Job) => {
    const next = new Set(hiddenIdsRef.current)
    next.delete(job.id)
    hiddenIdsRef.current = next
    setHiddenIds(new Set(next))
  }, [])

  const loadPipelines = useCallback(async () => {
    if (!userEmail) return

    try {
      const res = await fetch("/api/pipelines")
      if (!res.ok) {
        console.error("[PIPELINES] Failed to fetch pipelines:", res.status)
        return
      }
      const json = await res.json()
      const data = json.pipelines || []

      if (!mountedRef.current) return

      const mapped = (data ?? []).map(rowToJob)

      setJobs(mapped)
      setSelectedJob((prev) => {
        if (!mapped.length) return null
        const visible = mapped.filter((j: Job) => !hiddenIdsRef.current.has(j.id))
        if (!prev) return visible[0] ?? mapped[0]
        const stillThere = mapped.find((j: Job) => j.id === prev.id)
        return stillThere ?? visible[0] ?? mapped[0]
      })

      if (mapped.length > 0) {
        setIsFirstSync(false)
      }
    } catch (err) {
      console.error("[PIPELINES] Error fetching pipelines:", err)
    }
  }, [userEmail])

  const syncGmail = useCallback(async (): Promise<boolean> => {
    try {
      setSyncError(null)
      // Simulate progress for better UX
      setSyncProgress(10)
      setSyncMessage("Connecting to Gmail...")

      await new Promise(r => setTimeout(r, 300))
      setSyncProgress(25)
      setSyncMessage("Fetching emails...")

      const res = await fetch("/api/gmail/sync", { method: "POST" })

      setSyncProgress(60)
      setSyncMessage("Analyzing emails...")

      const data = await res.json()
      console.log("Sync result:", data)

      if (!res.ok) {
        console.error("Gmail sync failed:", data)
        setSyncError(data.hint || data.message || "Sync failed")
        if (data.stats) {
          setSyncStats(data.stats)
        }
        return false
      }

      setSyncProgress(85)
      setSyncMessage("Updating pipelines...")

      // Store the stats from the sync
      if (data.stats) {
        setSyncStats(data.stats)
      }

      setSyncProgress(100)
      setSyncMessage("Complete!")

      return true
    } catch (err: any) {
      console.error("Sync error:", err)
      setSyncError(err?.message || "Network error")
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

  // Auto-sync setup - FIXED: Use refs to prevent infinite re-render loops
  const lastSyncTimeRef = useRef<number>(0)
  const hasInitialSyncedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    if (status !== "authenticated") return

    // Only run initial sync ONCE
    if (!hasInitialSyncedRef.current) {
      hasInitialSyncedRef.current = true
      syncAndReload()
      lastSyncTimeRef.current = Date.now()
    }

    // 10-minute interval
    const intervalId = setInterval(() => {
      syncAndReload()
      lastSyncTimeRef.current = Date.now()
    }, 10 * 60 * 1000)

    // Focus handler - only sync if last sync was more than 10 minutes ago
    const handleFocus = () => {
      if (Date.now() - lastSyncTimeRef.current > 10 * 60 * 1000) {
        syncAndReload()
        lastSyncTimeRef.current = Date.now()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastSyncTimeRef.current > 10 * 60 * 1000) {
          syncAndReload()
          lastSyncTimeRef.current = Date.now()
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
  }, [status]) // FIXED: Only depend on status, not on syncAndReload or lastSyncTime

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
    <div className="mx-auto max-w-[1600px] h-[calc(100vh-64px)] flex flex-col overflow-hidden">
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
              ) : syncError ? (
                <>
                  <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm text-amber-600">{syncError}</span>
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
            <button
              onClick={() => setShowSyncDetails(!showSyncDetails)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              {showSyncDetails ? "Hide" : "Show"} details
              <svg className={`h-3 w-3 transition-transform ${showSyncDetails ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>



          {/* Expandable sync stats panel */}
          {showSyncDetails && (
            <div className="mt-3 space-y-3">
              {syncStats ? (
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Last Sync Results</div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    <div className="bg-white rounded p-2 border">
                      <div className="text-lg font-bold text-gray-900">{syncStats.scanned}</div>
                      <div className="text-[10px] text-gray-500">Scanned</div>
                    </div>
                    <div className="bg-white rounded p-2 border">
                      <div className="text-lg font-bold text-green-600">{syncStats.detected}</div>
                      <div className="text-[10px] text-gray-500">Detected</div>
                    </div>
                    <div className="bg-white rounded p-2 border">
                      <div className="text-lg font-bold text-blue-600">{syncStats.inserted}</div>
                      <div className="text-[10px] text-gray-500">New Jobs</div>
                    </div>
                    <div className="bg-white rounded p-2 border">
                      <div className="text-lg font-bold text-purple-600">{syncStats.updated}</div>
                      <div className="text-[10px] text-gray-500">Updated</div>
                    </div>
                    <div className="bg-white rounded p-2 border">
                      <div className="text-lg font-bold text-gray-400">{syncStats.rejected}</div>
                      <div className="text-[10px] text-gray-500">Rejected</div>
                    </div>
                    <div className="bg-white rounded p-2 border">
                      <div className={`text-lg font-bold ${syncStats.errors > 0 ? 'text-red-600' : 'text-gray-400'}`}>{syncStats.errors}</div>
                      <div className="text-[10px] text-gray-500">Errors</div>
                    </div>
                  </div>
                  {lastSyncTime && (
                    <div className="mt-2 text-[10px] text-gray-400 text-right">
                      Last sync: {lastSyncTime.toLocaleTimeString()} • Checks every 10 min
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg border text-sm text-gray-500">
                  No sync data yet. Sync will run automatically.
                </div>
              )}

              {/* Debug Logs Section */}
              <div className="p-3 bg-gray-50 rounded-lg border mt-2">
                <DebugLogsView />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main content - gray background for whole area */}
      <div className="flex-1 overflow-hidden bg-gray-100">
        <div className="flex h-full">
          {/* Left column - Pipelines (WIDER) */}
          <div
            className={`w-full lg:w-[480px] xl:w-[550px] min-w-0 scroll-hide p-4 border-r bg-[#FAFAF8]${isPipelineScrolling ? " is-scrolling" : ""}`}
            onScroll={handlePipelineScroll}
          >
            {(() => {
              const visibleJobs = jobs.filter(j => !hiddenIds.has(j.id))
              const hiddenJobs = jobs.filter(j => hiddenIds.has(j.id))
              return (
                <>
                  {visibleJobs.length === 0 ? (
                    <div className="rounded-xl border border-dashed bg-white p-6 text-center">
                      <div className="text-gray-600 mb-2 font-medium">No pipelines yet</div>
                      <div className="text-sm text-gray-500">
                        {syncStatus === 'syncing'
                          ? "Scanning inbox..."
                          : hiddenJobs.length > 0
                            ? `${hiddenJobs.length} hidden below`
                            : "Connect Gmail to start."}
                      </div>
                    </div>
                  ) : (
                    <PipelineCardList
                      jobs={visibleJobs}
                      selectedJobId={selectedJob?.id}
                      onSelect={(job) => {
                        setSelectedJob(job)
                        setIsMobileSheetOpen(true)
                      }}
                      onActionClick={(job) => {
                        setSelectedJob(job)
                        setIsMobileSheetOpen(true)
                      }}
                      onDelete={hidePipeline}
                    />
                  )}

                  {hiddenJobs.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                      <button
                        onClick={() => setShowHidden(v => !v)}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {hiddenJobs.length} hidden · {showHidden ? "Hide" : "Show"}
                      </button>
                      {showHidden && (
                        <div className="mt-2 space-y-1.5">
                          {hiddenJobs.map(job => (
                            <div
                              key={job.id}
                              className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-dashed border-gray-200"
                            >
                              <span className="text-sm text-gray-400">{job.company.name}</span>
                              <button
                                onClick={() => unhidePipeline(job)}
                                className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
                              >
                                Restore
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          {/* Right column - Details (WIDER 2/3) */}
          <div className="hidden lg:block flex-1 min-w-0 bg-white overflow-y-auto">
            <PanelErrorBoundary>
              <JobDetailPanel job={selectedJob} onSaveNotes={() => { }} />
            </PanelErrorBoundary>
          </div>
        </div>

        <MobileBottomSheet
          isOpen={isMobileSheetOpen}
          onClose={() => setIsMobileSheetOpen(false)}
          job={selectedJob}
          onSaveNotes={() => { }}
        />
      </div>
    </div>
  )
}

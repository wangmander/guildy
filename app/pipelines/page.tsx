"use client"

import React, { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
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

  // Keep Screen as last resort. We will FILTER OUT junk pipelines before mapping so this doesn't look hardcoded.
  return "SCREENING" as Stage
}

function normalizeInterviewPrep(prepAny: any): any | undefined {
  if (!prepAny || typeof prepAny !== "object") return undefined

  const stageFocus = safeStr(pick(prepAny, ["stageFocus", "prepFocus", "focus", "stage_focus"]) ?? "", "")

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
    const sampleQuestions = qTheyAsk.length ? qTheyAsk : []
    const tips = emphasize.length ? emphasize : []

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
        goals: safeArr<string>(pick(prepAny, ["interviewerGoals", "interviewer_goals"]))
          .map((x) => safeStr(x))
          .filter(Boolean),
      },
      sampleQuestions,
      tips,
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
        goals: safeArr<string>(pick(interviewer, ["goals"]))
          .map((x) => safeStr(x))
          .filter(Boolean),
      },
      sampleQuestions: sampleQuestions.map((x) => safeStr(x)).filter(Boolean),
      tips: tips.map((x) => safeStr(x)).filter(Boolean),
    }
  }

  return undefined
}

// Filter out obvious junk pipelines so they don't appear as "Screening by default"
function isLikelyInterviewRow(row: any): boolean {
  const subject = safeStr(pick(row, ["last_email_subject", "lastEmailSubject"]) ?? "").toLowerCase()
  const snippet = safeStr(pick(row, ["last_email_snippet", "lastEmailSnippet"]) ?? "").toLowerCase()
  const company = safeStr(pick(row, ["company", "company_name"]) ?? "").toLowerCase()
  const role = safeStr(pick(row, ["role", "title"]) ?? "").toLowerCase()

  const prepRaw =
    safeJson(pick(row, ["prep_json", "interview_prep_json", "prep", "interview_prep"])) ??
    safeJson(pick(row, ["llm_prep_json", "llm_prep"])) ??
    null

  const insightsRaw =
    safeJson(pick(row, ["insights_json", "insights"])) ??
    safeJson(pick(row, ["llm_insights_json", "llm_insights"])) ??
    null

  const stageDetail = safeStr(pick(row, ["stage_detail", "stageDetail"]) ?? "")

  // If LLM ever ran + produced prep/insights/stage detail, keep it.
  if (prepRaw || insightsRaw || stageDetail) return true

  // Interview keyword sniff (basic, strong)
  const text = `${subject} ${snippet}`
  const hasSignals =
    text.includes("interview") ||
    text.includes("schedule") ||
    text.includes("availability") ||
    text.includes("screen") ||
    text.includes("recruiter") ||
    text.includes("hiring manager") ||
    text.includes("take-home") ||
    text.includes("assessment") ||
    text.includes("case study") ||
    text.includes("onsite") ||
    text.includes("panel") ||
    text.includes("final round") ||
    text.includes("next steps") ||
    text.includes("move forward")

  if (hasSignals) return true

  // Junk commerce / notifications
  const junk =
    subject.startsWith("ordered:") ||
    subject.includes("your order") ||
    subject.includes("receipt") ||
    subject.includes("invoice") ||
    subject.includes("shipment") ||
    subject.includes("delivered") ||
    subject.includes("tracking") ||
    subject.includes("payment") ||
    subject.includes("statement") ||
    subject.includes("security alert") ||
    subject.includes("verification code") ||
    subject.includes("one-time password") ||
    subject.includes("otp") ||
    subject.includes("newsletter") ||
    snippet.includes("unsubscribe")

  if (junk) return false

  // If company is a big retailer + role unknown, hide until it has interview signals
  const retailish = ["amazon", "ebay", "coinbase", "draftkings"].some((x) => company.includes(x))
  if (retailish && (!role || role === "unknown" || role === "interview")) return false

  // default: don't show (prevents junk showing as screening)
  return false
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
  const lastEmailFromEmail = safeStr(pick(row, ["last_email_from_email", "lastEmailFromEmail"]) ?? "")

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
            <div className="mt-2 text-xs opacity-80">
              Your pipeline list still works. This crash is inside JobDetailPanel.
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

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
            Guildy reads recruiting threads, detects the current stage, and generates stage-specific prep (not generic interview advice).
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
            If you’re already connected but got logged out, click Connect Gmail again.
          </div>
        </div>
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
  const [syncing, setSyncing] = useState(false)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  async function loadPipelines() {
    if (!userEmail) return

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)
      .order("last_email_at", { ascending: false })

    if (error) return

    const filtered = (data ?? []).filter(isLikelyInterviewRow)
    const mapped = filtered.map(rowToJob)

    setJobs(mapped)
    setSelectedJob((prev) => {
      if (!mapped.length) return null
      if (!prev) return mapped[0]
      const stillThere = mapped.find((j) => j.id === prev.id)
      return stillThere ?? mapped[0]
    })
  }

  async function syncGmail() {
    setSyncing(true)
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" })
      if (!res.ok) {
        console.error("Gmail sync failed", await res.text())
      }
    } finally {
      setSyncing(false)
    }
  }

  const syncInFlightRef = useRef(false)

  async function syncAndReload(reason: "initial" | "interval" | "manual") {
    if (status !== "authenticated") return
    if (syncInFlightRef.current) return
    syncInFlightRef.current = true
    try {
      await syncGmail()
      await loadPipelines()
    } finally {
      syncInFlightRef.current = false
    }
  }

  useEffect(() => {
    if (status !== "authenticated") return
    syncAndReload("initial")

    const id = window.setInterval(() => syncAndReload("interval"), 10 * 60 * 1000)
    const onFocus = () => syncAndReload("manual")
    window.addEventListener("focus", onFocus)

    return () => {
      window.clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userEmail])

  useEffect(() => {
    if (status === "authenticated") loadPipelines()
  }, [status, userEmail])

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
      {/* Header: move Syncing… next to Auto-sync */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Auto-sync — checks Gmail periodically</span>
            {syncing ? <span className="text-sm text-gray-500">Syncing…</span> : null}
          </div>
          <span className="text-sm text-gray-600">Imports recruiting emails into pipelines</span>
        </div>
      </div>

      {/* Single shared scroll so left + right move together */}
      <div className="flex-1 overflow-y-auto bg-[#F5F5F0]">
        <div className="flex flex-col lg:flex-row gap-6 p-4">
          {/* Left column padding fixed */}
          <div className="w-full lg:w-1/2 min-w-0">
            <div className="px-2">
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
            </div>
          </div>

          {/* Right column */}
          <div ref={rightPanelRef} className="hidden lg:block w-full lg:w-1/2 min-w-0">
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

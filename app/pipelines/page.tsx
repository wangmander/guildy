"use client"

import { useEffect, useRef, useState } from "react"
import type { Job, Stage, Status } from "@/types"
import { PipelineCardList } from "@/components/pipeline-card-list"
import { JobDetailPanel } from "@/components/job-detail-panel"
import { MobileBottomSheet } from "@/components/mobile-bottom-sheet"
import { supabase } from "@/lib/supabaseClient"
import { signIn, useSession } from "next-auth/react"

const UI_STAGES: Stage[] = ["SCREENING", "HIRING_MANAGER", "PRESENTATION", "FULL_LOOP", "OFFER_DISCUSSION"]

function safeString(v: any, fallback = ""): string {
  if (typeof v === "string") return v
  if (v == null) return fallback
  try {
    return String(v)
  } catch {
    return fallback
  }
}

function safeArrayStrings(v: any, max = 8): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => safeString(x, "").trim())
    .filter(Boolean)
    .slice(0, max)
}

function safeOneLine(v: any, fallback = ""): string {
  const s = safeString(v, fallback).replace(/\s+/g, " ").trim()
  if (!s) return fallback
  return s.length > 240 ? s.slice(0, 240).trim() + "…" : s
}

function stageBucketToUiStage(stageRaw: any, stageDetail?: any): Stage {
  const s = safeString(stageRaw, "").toUpperCase().trim()
  if (UI_STAGES.includes(s as Stage)) return s as Stage

  const d = safeString(stageDetail, "").toLowerCase()

  if (s === "OFFER") return "OFFER_DISCUSSION"
  if (s === "APPLIED" || s === "RECRUITER_SCREEN") return "SCREENING"

  if (s === "INTERVIEW") {
    if (d.includes("portfolio") || d.includes("case") || d.includes("presentation")) return "PRESENTATION"
    if (d.includes("panel") || d.includes("loop") || d.includes("onsite") || d.includes("on-site")) return "FULL_LOOP"
    if (d.includes("hiring manager") || d.includes("hm")) return "HIRING_MANAGER"
    return "HIRING_MANAGER"
  }

  // fallback
  return "SCREENING"
}

/**
 * This maps your Supabase columns into what the right panel UI expects.
 * It is intentionally defensive: missing/invalid JSON => truthful defaults.
 */
function mapLLM(row: any) {
  const prep = row?.prep_json ?? null
  const insights = row?.insights_json ?? null

  // Company intel (truthful)
  const company_type = safeString(prep?.company_type, "unknown")
  const company_size_bucket = safeString(prep?.company_size_bucket, "unknown")
  const hq_location = safeString(prep?.hq_location, "Unknown")
  const glassdoor_rating = safeString(prep?.glassdoor_rating, "N/A")
  const assumptions = safeArrayStrings(prep?.assumptions, 6)

  const intelTruth =
    company_type === "unknown" || company_size_bucket === "unknown"
      ? "Guildy couldn’t confidently infer company details from email alone."
      : ""

  const companyIntel = {
    industry: company_type !== "unknown" ? company_type : "Unknown",
    size: company_size_bucket !== "unknown" ? company_size_bucket : "Unknown",
    hqLocation: hq_location || "Unknown",
    glassdoorRating: glassdoor_rating || "N/A",
    truthNote: intelTruth,
    assumptions,
  }

  // Insights (drives Next Action + email meta)
  const insightsPack = {
    nextAction: safeOneLine(insights?.next_action, "Next action not available yet."),
    why: safeOneLine(insights?.why, ""),
    tone: safeOneLine(insights?.tone, ""),
    responseLikelihood: safeOneLine(insights?.response_likelihood, ""),
    urgency: safeOneLine(insights?.urgency, ""),
  }

  // Interview prep (drives the two question lists)
  const stageFocus = safeOneLine(
    prep?.stage_focus,
    "Prep focus not available yet. Re-sync after more emails or a scheduling link appears."
  )

  const interviewPrep = {
    stageFocus,
    keyGoals: safeArrayStrings(prep?.key_goals, 6),

    // These two names are the ones your UI almost certainly uses
    questionsTheyMightAsk: safeArrayStrings(prep?.questions_they_might_ask, 6),
    questionsYouShouldAskThem: safeArrayStrings(prep?.questions_you_should_ask, 6),

    storiesToPrepare: safeArrayStrings(prep?.stories_to_prepare, 6),
    portfolioAngles: safeArrayStrings(prep?.portfolio_angles, 6),
    homeworkNext24h: safeArrayStrings(prep?.homework_next_24h, 6),
    redFlagsToWatch: safeArrayStrings(prep?.red_flags_to_watch, 6),
    assumptions,
  }

  return { companyIntel, insightsPack, interviewPrep }
}

function rowToJob(row: any): Job {
  const uiStage = stageBucketToUiStage(row?.stage, row?.stage_detail)

  const companyName = safeString(row?.company, "Unknown company")
  const roleTitle = safeString(row?.role, "Interview")

  const lastEmailSubject = safeString(row?.last_email_subject, "")
  const lastEmailAt = safeString(row?.last_email_at, "")
  const lastEmailFrom = safeString(row?.last_email_from, "")
  const lastEmailSnippet = safeString(row?.last_email_snippet, "")

  const { companyIntel, insightsPack, interviewPrep } = mapLLM(row)

  // Build a stable object that won't crash JobDetailPanel even if it expects fields.
  const job: any = {
    id: row?.id,
    title: roleTitle,
    company: {
      name: companyName,
      industry: companyIntel.industry,
      size: companyIntel.size,
      hqLocation: companyIntel.hqLocation,
      glassdoorRating: companyIntel.glassdoorRating,
      truthNote: companyIntel.truthNote,
      assumptions: companyIntel.assumptions,
    },
    stage: uiStage,
    status: "WAITING" as Status,
    appliedAt: lastEmailAt || undefined,

    // Right-panel “Next Action” banner usually reads this
    nextAction: insightsPack.nextAction,
    nextActionWhy: insightsPack.why,

    // Stage detail if you render it anywhere
    stageDetail: safeString(row?.stage_detail, ""),

    lastEmail: lastEmailSubject
      ? {
          fromName: companyName,
          fromEmail: lastEmailFrom,
          subject: lastEmailSubject,
          receivedAt: lastEmailAt,
          snippet: lastEmailSnippet,

          // If your UI shows Tone / Likelihood / Urgency under Last Email
          tone: insightsPack.tone,
          responseLikelihood: insightsPack.responseLikelihood,
          urgency: insightsPack.urgency,
        }
      : undefined,

    interviewPrep,
    recentNews: [],
    notes: "",
  }

  return job as Job
}

function MarketingConnect() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6">
      <div className="max-w-xl w-full">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-black text-white flex items-center justify-center font-semibold">
            g
          </div>
          <div className="text-lg font-semibold">guildy</div>
        </div>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Track every pipeline. Prep every round. Close the offer.
        </h1>
        <p className="mt-3 text-gray-600">
          Connect Gmail to auto-build your pipelines, keep stages accurate, and generate stage-specific prep matched to
          the company + role. If Guildy can’t infer company intel, it will say so.
        </p>

        <ul className="mt-6 space-y-2 text-sm text-gray-700">
          <li>• Auto-detect stage from real emails (first reach-out ≠ full loop).</li>
          <li>• Bespoke prep per stage: recruiter screen → HM → panel/loop → offer.</li>
          <li>• No fake company intel: Unknown stays Unknown.</li>
        </ul>

        <button
          onClick={() => signIn("google", { callbackUrl: "/pipelines" })}
          className="mt-8 w-full px-4 py-3 rounded bg-black text-white font-medium"
        >
          Connect Gmail
        </button>
      </div>
    </div>
  )
}

export default function PipelinesPage() {
  const { data: session, status } = useSession()

  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pageError, setPageError] = useState<string>("")
  const rightPanelRef = useRef<HTMLDivElement>(null)

  async function loadPipelines() {
    setPageError("")
    const userEmail = session?.user?.email
    if (!userEmail) return

    const { data, error } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)
      .order("last_email_at", { ascending: false })

    if (error) {
      console.error("loadPipelines error:", error)
      setPageError("Failed to load pipelines.")
      return
    }

    try {
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map((r) => rowToJob(r))
        setJobs(mapped)
        setSelectedJob(mapped[0])
      } else {
        setJobs([])
        setSelectedJob(null)
      }
    } catch (e: any) {
      console.error("Pipeline mapping crashed:", e)
      setPageError("Pipelines loaded but UI mapping crashed (bad data shape).")
      // Do NOT throw (that causes the client-side exception page)
      setJobs([])
      setSelectedJob(null)
    }
  }

  async function syncGmail() {
    if (status !== "authenticated") return
    setSyncing(true)
    setPageError("")
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" })
      // Don't crash if response isn't JSON
      await res.json().catch(() => null)
    } catch (e) {
      console.error("syncGmail failed:", e)
      setPageError("Sync failed.")
    } finally {
      await loadPipelines()
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (status === "authenticated") loadPipelines()
  }, [status])

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (status !== "authenticated") {
    return <MarketingConnect />
  }

  return (
    <div className="mx-auto max-w-7xl h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      <div className="p-4 border-b bg-white flex items-center gap-3">
        <button onClick={syncGmail} disabled={syncing} className="px-4 py-2 bg-black text-white rounded disabled:opacity-50">
          {syncing ? "Syncing Gmail…" : "Sync Gmail"}
        </button>
        <span className="text-sm text-gray-600">Imports recruiting emails into pipelines</span>
      </div>

      {pageError ? (
        <div className="px-4 py-3 border-b bg-yellow-50 text-sm text-yellow-900">
          {pageError} (This page now blocks hard crashes so you can keep working.)
        </div>
      ) : null}

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        <div className="w-full lg:w-1/2 overflow-y-auto">
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

        <div ref={rightPanelRef} className="hidden lg:block w-1/2 bg-white">
          <JobDetailPanel job={selectedJob} onSaveNotes={() => {}} />
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

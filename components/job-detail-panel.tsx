"use client"

import type { Job } from "@/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useMemo, useState } from "react"
import {
  ExternalLink,
  Calendar,
  Mail,
  MapPin,
  User,
  Target,
  HelpCircle,
  Lightbulb,
  Building2,
  Clock,
  Briefcase,
  MessageCircle,
  BookOpen,
  Star,
  Activity,
} from "lucide-react"

interface JobDetailPanelProps {
  job: Job | null
  onSaveNotes: (jobId: string, notes: string) => void | Promise<void> // allow async
  isMobile?: boolean
  idPrefix?: string
}

function s(v: any, fallback = ""): string {
  if (typeof v === "string") return v
  if (v == null) return fallback
  try {
    return String(v)
  } catch {
    return fallback
  }
}

function safeDate(v: any): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function arr(v: any): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => s(x, "").trim()).filter(Boolean)
}

function firstChar(v: any): string {
  const t = s(v, "").trim()
  return t ? t.charAt(0).toUpperCase() : "?"
}

function maxDate(...dates: Array<Date | null | undefined>): Date | null {
  const xs = dates.filter((d): d is Date => !!d && !isNaN(d.getTime()))
  if (!xs.length) return null
  return new Date(Math.max(...xs.map((d) => d.getTime())))
}

function daysSince(d: Date | null): number | null {
  if (!d) return null
  const ms = Date.now() - d.getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

type WaitingOn = "you" | "them" | "unknown"
type StageMeta = {
  key: string
  label: string
  stepIndex: number // 0..3 for timeline
  terminal?: boolean
  waitingOnDefault: WaitingOn
  followUpDays: number
  typicalNextEtaDays: number
}

const STAGE_META: Record<string, StageMeta> = {
  APPLIED: { key: "APPLIED", label: "Applied", stepIndex: 0, waitingOnDefault: "them", followUpDays: 7, typicalNextEtaDays: 7 },
  RECRUITER: { key: "RECRUITER", label: "Recruiter", stepIndex: 1, waitingOnDefault: "them", followUpDays: 4, typicalNextEtaDays: 5 },
  SCREEN: { key: "SCREEN", label: "Screen", stepIndex: 2, waitingOnDefault: "them", followUpDays: 3, typicalNextEtaDays: 5 },
  INTERVIEW: { key: "INTERVIEW", label: "Interview", stepIndex: 2, waitingOnDefault: "them", followUpDays: 3, typicalNextEtaDays: 4 },
  TAKE_HOME: { key: "TAKE_HOME", label: "Take-home", stepIndex: 2, waitingOnDefault: "you", followUpDays: 2, typicalNextEtaDays: 3 },
  ONSITE: { key: "ONSITE", label: "Onsite", stepIndex: 2, waitingOnDefault: "them", followUpDays: 3, typicalNextEtaDays: 5 },
  OFFER: { key: "OFFER", label: "Offer", stepIndex: 3, waitingOnDefault: "you", followUpDays: 2, typicalNextEtaDays: 2 },
  REJECTED: { key: "REJECTED", label: "Rejected", stepIndex: 3, terminal: true, waitingOnDefault: "unknown", followUpDays: 0, typicalNextEtaDays: 0 },
  WITHDREW: { key: "WITHDREW", label: "Withdrew", stepIndex: 3, terminal: true, waitingOnDefault: "unknown", followUpDays: 0, typicalNextEtaDays: 0 },
  UNKNOWN: { key: "UNKNOWN", label: "Unknown", stepIndex: 0, waitingOnDefault: "unknown", followUpDays: 5, typicalNextEtaDays: 7 },
}

function normalizeStage(rawStage: string, rawStatus: string): StageMeta {
  const st = s(rawStage, "").trim().toUpperCase()
  const status = s(rawStatus, "").trim().toUpperCase()

  if (status === "REJECTED" || st.includes("REJECT")) return STAGE_META.REJECTED
  if (status === "WITHDREW" || st.includes("WITHDRAW")) return STAGE_META.WITHDREW
  if (st.includes("OFFER")) return STAGE_META.OFFER
  if (st.includes("ONSITE")) return STAGE_META.ONSITE
  if (st.includes("TAKE") || st.includes("HOME") || st.includes("ASSIGNMENT")) return STAGE_META.TAKE_HOME
  if (st.includes("TECH") || st.includes("INTERVIEW") || st.includes("FINAL") || st.includes("LOOP")) return STAGE_META.INTERVIEW
  if (st.includes("SCREEN") || st.includes("PHONE") || st.includes("CALL")) return STAGE_META.SCREEN
  if (st.includes("RECRUITER") || st.includes("HR") || st.includes("TALENT")) return STAGE_META.RECRUITER
  if (st.includes("APPLIED") || st.includes("SUBMIT")) return STAGE_META.APPLIED

  return STAGE_META.UNKNOWN
}

function computeFollowUp(meta: StageMeta, status: string, lastTouchAt: Date | null, meetingDate: Date | null) {
  const sStatus = s(status, "").toUpperCase()
  // If a meeting is scheduled in the future, you’re not “overdue”
  if (meetingDate && meetingDate.getTime() > Date.now()) {
    return { due: null as Date | null, label: "Meeting scheduled" }
  }
  if (!lastTouchAt || meta.terminal || meta.followUpDays <= 0) {
    return { due: null as Date | null, label: "" }
  }
  // If your system sets NEEDS_REPLY, that overrides
  if (sStatus === "NEEDS_REPLY") {
    return { due: new Date(Date.now()), label: "Reply now" }
  }
  const due = new Date(lastTouchAt.getTime() + meta.followUpDays * 24 * 60 * 60 * 1000)
  const overdue = due.getTime() <= Date.now()
  return { due: overdue ? due : null, label: overdue ? "Follow up" : "" }
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

export function JobDetailPanel({ job, onSaveNotes, isMobile = false, idPrefix = "desktop" }: JobDetailPanelProps) {
  const [notes, setNotes] = useState("")
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setNotes(s((job as any)?.notes, ""))
    setIsEditing(false)
  }, [job?.id])

  if (!job) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg font-medium">Select a job to view details</p>
            <p className="text-sm">Choose a pipeline from the left to see more information</p>
          </div>
        </div>
      </div>
    )
  }

  const j: any = job as any

  const companyName =
    s(j?.company?.name, "") ||
    s(j?.companyName, "") ||
    s(j?.company, "") ||
    "Unknown company"

  const title =
    s(j?.title, "") ||
    s(j?.role, "") ||
    "Interview"

  const location =
    s(j?.location, "") ||
    s(j?.company?.location, "") ||
    "Unknown"

  const industry =
    s(j?.industry, "") ||
    s(j?.company?.industry, "") ||
    "Unknown"

  const stageRaw = s(j?.stage, "") || "UNKNOWN"
  const statusRaw = s(j?.status, "") || "UNKNOWN"

  // LLM fields
  const insights = j?.insights || j?.insights_json || {}
  const prep = j?.interviewPrep || j?.prep_json || {}

  const nextActionLLM =
    s(insights?.nextAction, "") ||
    s(insights?.next_action, "") ||
    s(prep?.nextAction, "") ||
    s(prep?.next_action, "") ||
    ""

  const why =
    s(insights?.why, "") ||
    s(insights?.rationale, "") ||
    ""

  const tone =
    s(insights?.tone, "") ||
    s(prep?.tone, "")

  const responseLikelihood =
    s(insights?.responseLikelihood, "") ||
    s(insights?.response_likelihood, "") ||
    ""

  const urgency =
    s(insights?.urgency, "") || ""

  // Optional richer “pipeline intelligence” fields (if you pass them)
  const stageConfidence =
    s(insights?.stageConfidence, "") ||
    s(insights?.stage_confidence, "") ||
    ""

  const stageReason =
    s(insights?.stageReason, "") ||
    s(insights?.stage_reason, "") ||
    ""

  const signals: Array<{ label?: string; type?: string; confidence?: any; at?: any }> =
    Array.isArray(insights?.signals) ? insights.signals :
    Array.isArray(insights?.stageSignals) ? insights.stageSignals :
    Array.isArray(insights?.stage_signals) ? insights.stage_signals :
    []

  // Scheduled meeting
  const scheduledMeeting = j?.scheduledMeeting || j?.scheduled_meeting || null
  const meetingType = s(scheduledMeeting?.type, "")
  const meetingDate = safeDate(scheduledMeeting?.date)
  const meetingDuration = s(scheduledMeeting?.duration, "")
  const meetingLink = s(scheduledMeeting?.meetingLink, "") || s(scheduledMeeting?.meeting_link, "")

  // Last email
  const lastEmail = j?.lastEmail || null
  const lastEmailSubject = s(lastEmail?.subject, "")
  const lastEmailFromName = s(lastEmail?.fromName, "")
  const lastEmailFromEmail = s(lastEmail?.fromEmail, "")
  const lastEmailSnippet = s(lastEmail?.snippet, "")
  const lastEmailReceived = safeDate(lastEmail?.receivedAt)

  // Dates
  const appliedAt = safeDate(j?.appliedAt)
  const lastTouchAt = useMemo(() => maxDate(lastEmailReceived, meetingDate, appliedAt), [lastEmailReceived, meetingDate, appliedAt])
  const daysSinceTouch = daysSince(lastTouchAt)

  const stageMeta = useMemo(() => normalizeStage(stageRaw, statusRaw), [stageRaw, statusRaw])
  const followUp = useMemo(() => computeFollowUp(stageMeta, statusRaw, lastTouchAt, meetingDate), [stageMeta, statusRaw, lastTouchAt, meetingDate])

  // Who are we waiting on?
  const waitingOn: WaitingOn = useMemo(() => {
    const st = s(statusRaw, "").toUpperCase()
    if (st === "NEEDS_REPLY") return "you"
    if (stageMeta.terminal) return "unknown"
    // If take-home and no meeting, likely waiting on you
    if (stageMeta.key === "TAKE_HOME") return "you"
    return stageMeta.waitingOnDefault
  }, [statusRaw, stageMeta])

  // ETA guess (only if we have a touchpoint)
  const nextEtaDate = useMemo(() => {
    if (!lastTouchAt || stageMeta.terminal) return null
    return new Date(lastTouchAt.getTime() + stageMeta.typicalNextEtaDays * 24 * 60 * 60 * 1000)
  }, [lastTouchAt, stageMeta])

  const computedNextAction = useMemo(() => {
    if (meetingDate && meetingType) return `Prepare for ${meetingType} (${meetingDate.toLocaleString()})`
    if (nextActionLLM) return nextActionLLM
    if (followUp.due) return `Follow up (due ${followUp.due.toLocaleDateString()})`
    if (s(statusRaw, "").toUpperCase() === "NEEDS_REPLY") return "Reply to the latest email (confirm next step + availability)."
    if (waitingOn === "you") return "Complete the requested action (reply / take-home / scheduling) and log it in Notes."
    if (waitingOn === "them") return "Wait. If no response by follow-up threshold, send a short follow-up."
    return "Add job posting link + recruiter name and re-sync to unlock stage-specific prep."
  }, [meetingDate, meetingType, nextActionLLM, followUp.due, statusRaw, waitingOn])

  const handleSaveNotes = async () => {
    if (!j?.id) return
    try {
      await onSaveNotes(j.id, notes)
    } finally {
      setIsEditing(false)
    }
  }

  // Prep content (same as your existing logic)
  const prepFocus = s(prep?.stage_focus, "") || s(prep?.stageFocus, "") || ""

  const questionsTheyAsk =
    arr(prep?.questions_they_might_ask).length ? arr(prep?.questions_they_might_ask) : arr(prep?.questionsTheyMightAsk)

  const questionsYouAsk =
    arr(prep?.questions_you_should_ask).length ? arr(prep?.questions_you_should_ask) : arr(prep?.questionsYouShouldAsk)

  const storiesToPrepare =
    arr(prep?.stories_to_prepare).length ? arr(prep?.stories_to_prepare) : arr(prep?.storiesToPrepare)

  const homeworkNext =
    arr(prep?.homework_next_24h).length ? arr(prep?.homework_next_24h) : arr(prep?.homeworkNext24h)

  const interviewer = prep?.interviewer || null
  const interviewerName = s(interviewer?.name, "")
  const interviewerRole = s(interviewer?.role, "")
  const interviewerBio = s(interviewer?.bio, "")
  const interviewerGoals = arr(interviewer?.goals)

  const sampleQuestions = arr(prep?.sampleQuestions).length ? arr(prep?.sampleQuestions) : arr(prep?.sample_questions)
  const emphasizeTips = arr(prep?.tips).length ? arr(prep?.tips) : arr(prep?.what_to_emphasize)

  // ✅ IMPORTANT: do NOT default companyIntel to prep
  const companyIntel = j?.companyIntel || j?.company?.intel || {}
  const companyType =
    s(companyIntel?.companyType, "") ||
    s(companyIntel?.company_type, "") ||
    "Unknown"

  const companySize =
    s(companyIntel?.companySizeBucket, "") ||
    s(companyIntel?.company_size_bucket, "") ||
    s(companyIntel?.companySize, "") ||
    "Unknown"

  const companyIntelSummary =
    s(companyIntel?.companyIntelSummary, "") ||
    s(companyIntel?.company_intel_summary, "") ||
    s(j?.company?.intelSummary, "") ||
    ""

  const truthfulNote =
    s(companyIntel?.truthfulNote, "") ||
    s(companyIntel?.truthful_note, "") ||
    s(j?.company?.truthfulNote, "") ||
    ""

  const glassdoorRating = j?.company?.glassdoorRating
  const hasGlassdoor = typeof glassdoorRating === "number" && !isNaN(glassdoorRating)

  const recentNews = Array.isArray(j?.recentNews) ? j.recentNews : []
  const postingUrl = s(j?.postingUrl, "") || s(j?.posting_url, "")

  const nextEtaText = s(j?.nextEtaText, "") || s(j?.next_eta_text, "") || ""
  const jobType = s(j?.jobType, "") || s(j?.job_type, "") || ""

  const containerClass = "px-4 py-3"
  const cardClass = "p-3 mb-3"

  // Timeline steps: real progress by stageMeta
  const timelineSteps = [
    { label: "Applied" },
    { label: "Recruiter" },
    { label: "Interview" },
    { label: "Offer" },
  ]
  const currentStep = clamp(stageMeta.stepIndex, 0, timelineSteps.length - 1)

  return (
    <div className={containerClass}>
      <div className="mb-3">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl font-medium flex-shrink-0">
            {firstChar(companyName)}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-3xl font-bold text-gray-900 truncate">{companyName}</h1>
            <p className="text-xl text-gray-600 truncate">{title}</p>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <div className="flex items-center gap-1 min-w-0">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{location}</span>
              </div>
              <div className="truncate">{industry}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          <Badge variant="secondary">{stageMeta.label}</Badge>
          <Badge variant={s(statusRaw).toUpperCase() === "SCHEDULED" ? "default" : "outline"}>
            {s(statusRaw, "UNKNOWN").replace(/_/g, " ")}
          </Badge>
          <Badge variant="outline">
            Waiting on: <span className="ml-1 font-semibold">{waitingOn}</span>
          </Badge>
          {daysSinceTouch != null ? (
            <Badge variant="outline">
              Last touch: <span className="ml-1 font-semibold">{daysSinceTouch}d</span>
            </Badge>
          ) : null}
        </div>

        {/* Next Action Banner */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
          <p className="text-sm font-medium text-orange-800">
            <span className="font-semibold">Next Action:</span> {computedNextAction}
          </p>
          {why ? <p className="text-xs text-orange-700 mt-1">{why}</p> : null}
        </div>
      </div>

      {/* Pipeline Intelligence (NEW) */}
      <Card className={`${cardClass} bg-slate-50 border-slate-200`}>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5 text-slate-700" />
          <span className="font-semibold text-slate-900">Pipeline Intelligence</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Stage confidence</p>
            <p className="text-sm font-medium text-gray-900">{stageConfidence || "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Next ETA</p>
            <p className="text-sm font-medium text-gray-900">
              {nextEtaText || (nextEtaDate ? nextEtaDate.toLocaleDateString() : "TBD")}
            </p>
          </div>
        </div>

        {stageReason ? (
          <div className="bg-white rounded-lg p-2 border border-slate-100 mb-2">
            <p className="text-xs font-semibold text-gray-900 mb-0.5">Why this stage</p>
            <p className="text-sm text-gray-700">{stageReason}</p>
          </div>
        ) : null}

        {signals.length ? (
          <div className="bg-white rounded-lg p-2 border border-slate-100">
            <p className="text-xs font-semibold text-gray-900 mb-1">Thread signals</p>
            <ul className="text-sm text-gray-700 space-y-1">
              {signals.slice(0, 6).map((sig, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-slate-500 mt-0.5">•</span>
                  <span>
                    {sig.label || sig.type || "Signal"}{" "}
                    {sig.confidence != null ? <span className="text-gray-400">(conf {String(sig.confidence)})</span> : null}
                    {sig.at ? <span className="text-gray-400"> — {safeDate(sig.at)?.toLocaleString() || String(sig.at)}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            No extracted signals yet. If this job came from Gmail, add parsed “signals” (>=2 keyword matches) to unlock stage reasoning.
          </p>
        )}
      </Card>

      {/* Upcoming Meeting */}
      {meetingDate && meetingType ? (
        <Card className={`${cardClass} bg-blue-50 border-blue-200`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Upcoming Meeting</span>
            </div>
            {meetingDuration ? (
              <Badge variant="outline" className="bg-white text-blue-700 border-blue-300">
                {meetingDuration} min
              </Badge>
            ) : null}
          </div>
          <p className="text-base font-medium text-blue-900 mb-1">{meetingType}</p>
          <div className="flex items-center gap-2 text-sm text-blue-700 mb-2">
            <Clock className="w-4 h-4" />
            {meetingDate.toLocaleString()}
          </div>
          {meetingLink ? (
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
              <a href={meetingLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 mr-1" />
                Join Meeting
              </a>
            </Button>
          ) : null}
        </Card>
      ) : null}

      {/* Last Email */}
      {lastEmailSubject ? (
        <Card className={cardClass}>
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-5 h-5 text-green-600" />
            <span className="font-semibold">Last Email</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-0.5">{lastEmailSubject}</p>
          {(lastEmailFromName || lastEmailFromEmail) ? (
            <p className="text-sm text-gray-600 mb-1">
              From: {lastEmailFromName || "Unknown"}{" "}
              {lastEmailFromEmail ? <span className="text-gray-400">({lastEmailFromEmail})</span> : null}
            </p>
          ) : null}
          {lastEmailSnippet ? <p className="text-sm text-gray-700 mb-2 leading-relaxed">{lastEmailSnippet}</p> : null}
          {lastEmailReceived ? <p className="text-xs text-gray-500 mb-2">{lastEmailReceived.toLocaleString()}</p> : null}

          <div className="bg-gray-50 rounded-lg p-2 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Tone:</span>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {tone || "Unknown"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Response Likelihood:</span>
              <span className="font-medium text-gray-900">{responseLikelihood || "Unknown"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Urgency:</span>
              <span className="font-medium text-orange-600">{urgency || "Unknown"}</span>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Interview Preparation (your existing block stays; unchanged) */}
      {/* ... keep your Interview Prep Card as-is ... */}

      {/* Company Intel (truthful topics) */}
      <Card id={`${idPrefix}-company-intel`} className={cardClass}>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-yellow-600" />
          <span className="font-semibold">Company Intel</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Industry</p>
            <p className="text-sm font-medium text-gray-900">{industry}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Size</p>
            <p className="text-sm font-medium text-gray-900">{companySize}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">HQ Location</p>
            <p className="text-sm font-medium text-gray-900">{location}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Glassdoor Rating</p>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-900">
                {hasGlassdoor ? String(glassdoorRating) : "N/A"}
              </span>
              {hasGlassdoor ? <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> : null}
            </div>
          </div>
        </div>

        {truthfulNote ? (
          <div className="bg-yellow-50 rounded-lg p-2 mb-2">
            <p className="text-sm text-yellow-800">{truthfulNote}</p>
          </div>
        ) : null}

        {companyType !== "Unknown" || companyIntelSummary ? (
          <div className="bg-yellow-50 rounded-lg p-2 mb-2">
            <p className="text-xs font-semibold text-yellow-900 mb-0.5">Summary</p>
            <p className="text-sm text-yellow-800">
              {companyIntelSummary || `Type: ${companyType}`}
            </p>
          </div>
        ) : (
          <div className="bg-yellow-50 rounded-lg p-2 mb-2">
            <p className="text-sm text-yellow-800">No company intel yet. Add job posting + team name, then re-sync.</p>
          </div>
        )}

        <div className="bg-yellow-50 rounded-lg p-2 mb-2">
          <p className="text-xs font-semibold text-yellow-900 mb-0.5">Recent News</p>
          {recentNews.length > 0 ? (
            recentNews.slice(0, 5).map((news: any, index: number) => {
              const t = s(news?.title, "")
              const u = s(news?.url, "")
              if (!t) return null
              return u ? (
                <a
                  key={index}
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-yellow-800 hover:underline hover:text-yellow-900 mb-1 last:mb-0"
                >
                  {t} <ExternalLink className="inline w-3 h-3 ml-0.5" />
                </a>
              ) : (
                <p key={index} className="text-sm text-yellow-800 mb-1 last:mb-0">
                  {t}
                </p>
              )
            })
          ) : (
            <p className="text-sm text-yellow-800">No recent news available.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-900 mb-1">Common Interview Topics</p>
          <div className="flex flex-wrap gap-2">
            {arr(companyIntel?.common_topics).length ? (
              arr(companyIntel?.common_topics).slice(0, 8).map((t: string, i: number) => (
                <Badge key={i} variant="outline" className="text-xs border-yellow-200 bg-yellow-50 text-yellow-800">
                  {t}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-gray-600">No topic tags yet.</p>
            )}
          </div>
        </div>
      </Card>

      {/* Timeline Overview (REAL progress) */}
      <Card className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-gray-900" />
          <span className="font-semibold text-lg">Timeline Overview</span>
        </div>

        <div className="space-y-3 mb-4">
          {timelineSteps.map((step, idx) => {
            const filled = idx <= currentStep
            return (
              <div key={step.label} className="flex items-center gap-4">
                <span className="w-20 text-sm text-gray-500">{step.label}</span>
                <div className={`flex-1 h-2.5 rounded-full ${filled ? "bg-blue-600" : "bg-gray-100"}`} />
                <span className="w-28 text-right text-sm text-gray-500">
                  {idx === 0 ? (appliedAt ? appliedAt.toLocaleDateString() : "TBD")
                    : idx === 2 ? (meetingDate ? meetingDate.toLocaleDateString() : "—")
                    : idx === currentStep ? (nextEtaDate ? nextEtaDate.toLocaleDateString() : "—")
                    : "—"}
                </span>
              </div>
            )
          })}
        </div>

        <p className="text-sm text-gray-600">
          {stageMeta.terminal
            ? `Terminal stage: ${stageMeta.label}.`
            : nextEtaDate
              ? `Estimated next movement by ${nextEtaDate.toLocaleDateString()} (based on last touch + typical cycle).`
              : "Timeline estimates appear once stage signals exist."}
        </p>
      </Card>

      {/* Job Details + Notes */}
      <Card className={cardClass}>
        <details className="mb-2">
          <summary className="font-semibold cursor-pointer flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            Job Details
          </summary>
          <div className="mt-2 space-y-1 text-sm pl-6">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Applied:</span>
              <span>{appliedAt ? appliedAt.toLocaleDateString() : "TBD"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Next ETA:</span>
              <span>{nextEtaText || (nextEtaDate ? nextEtaDate.toLocaleDateString() : "TBD")}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Job Type:</span>
              <span>{jobType || "TBD"}</span>
            </div>

            {postingUrl ? (
              <Button size="sm" variant="outline" className="mt-2 w-full bg-transparent" asChild>
                <a href={postingUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  View Job Posting
                </a>
              </Button>
            ) : null}
          </div>
        </details>

        <details open={isMobile}>
          <summary className="font-semibold cursor-pointer">Notes</summary>
          <div className="mt-2 pl-6">
            {!isEditing ? (
              <>
                <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{notes || "No notes added yet."}</p>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit Notes
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add your notes about this job..."
                  className="min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveNotes}>
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        </details>
      </Card>
    </div>
  )
}

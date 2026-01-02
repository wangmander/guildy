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
  onSaveNotes: (jobId: string, notes: string) => void
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

  // Core identity
  const companyName =
    s(j?.company?.name, "") ||
    s(j?.companyName, "") ||
    s(j?.company, "") ||
    "Unknown company"

  const title =
    s(j?.title, "") ||
    s(j?.role, "") ||
    "Interview"

  // Optional metadata (may not exist)
  const location =
    s(j?.location, "") ||
    s(j?.company?.location, "") ||
    "Unknown"

  const industry =
    s(j?.industry, "") ||
    s(j?.company?.industry, "") ||
    "Unknown"

  const stage =
    s(j?.stage, "") || "UNKNOWN"

  const status =
    s(j?.status, "") || "UNKNOWN"

  // Notes save
  const handleSaveNotes = () => {
    try {
      onSaveNotes(j.id, notes)
    } finally {
      setIsEditing(false)
    }
  }

  // LLM fields (support both legacy + your new json shapes)
  const insights = j?.insights || j?.insights_json || {}
  const prep = j?.interviewPrep || j?.prep_json || {}

  const nextAction =
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
    s(insights?.urgency, "") ||
    ""

  // Scheduled meeting (optional)
  const scheduledMeeting = j?.scheduledMeeting || j?.scheduled_meeting || null
  const meetingType = s(scheduledMeeting?.type, "")
  const meetingDate = safeDate(scheduledMeeting?.date)
  const meetingDuration = s(scheduledMeeting?.duration, "")
  const meetingLink = s(scheduledMeeting?.meetingLink, "") || s(scheduledMeeting?.meeting_link, "")

  // Last email (optional)
  const lastEmail = j?.lastEmail || null
  const lastEmailSubject = s(lastEmail?.subject, "")
  const lastEmailFromName = s(lastEmail?.fromName, "")
  const lastEmailFromEmail = s(lastEmail?.fromEmail, "")
  const lastEmailSnippet = s(lastEmail?.snippet, "")
  const lastEmailReceived = safeDate(lastEmail?.receivedAt)

  // Prep content: support BOTH your older “interviewer/sampleQuestions/tips”
  // and your newer “stage_focus/questions_* / stories/homework”.
  const prepFocus =
    s(prep?.stage_focus, "") ||
    s(prep?.stageFocus, "") ||
    ""

  const questionsTheyAsk =
    arr(prep?.questions_they_might_ask).length
      ? arr(prep?.questions_they_might_ask)
      : arr(prep?.questionsTheyMightAsk)

  const questionsYouAsk =
    arr(prep?.questions_you_should_ask).length
      ? arr(prep?.questions_you_should_ask)
      : arr(prep?.questionsYouShouldAsk)

  const storiesToPrepare =
    arr(prep?.stories_to_prepare).length
      ? arr(prep?.stories_to_prepare)
      : arr(prep?.storiesToPrepare)

  const homeworkNext =
    arr(prep?.homework_next_24h).length
      ? arr(prep?.homework_next_24h)
      : arr(prep?.homeworkNext24h)

  // Legacy interviewer profile (optional)
  const interviewer = prep?.interviewer || null
  const interviewerName = s(interviewer?.name, "")
  const interviewerRole = s(interviewer?.role, "")
  const interviewerBio = s(interviewer?.bio, "")
  const interviewerGoals = arr(interviewer?.goals)

  const sampleQuestions =
    arr(prep?.sampleQuestions).length ? arr(prep?.sampleQuestions) : arr(prep?.sample_questions)

  const emphasizeTips =
    arr(prep?.tips).length ? arr(prep?.tips) : arr(prep?.what_to_emphasize)

  // Company intel (truthful)
  const companyIntel = j?.companyIntel || prep || {}
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

  const appliedAt = safeDate(j?.appliedAt)
  const nextEtaText = s(j?.nextEtaText, "") || s(j?.next_eta_text, "") || "TBD"
  const jobType = s(j?.jobType, "") || s(j?.job_type, "") || "TBD"

  const containerClass = "px-4 py-3"
  const cardClass = "p-3 mb-3"

  const computedNextAction = useMemo(() => {
    if (meetingDate && meetingType) {
      return `Prepare for ${meetingType} on ${meetingDate.toLocaleDateString()}`
    }
    if (nextAction) return nextAction
    return "Review the thread, extract what they asked for, and draft a crisp reply."
  }, [meetingDate, meetingType, nextAction])

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
          <Badge variant="secondary">{s(stage, "UNKNOWN").replaceAll("_", " ")}</Badge>
          <Badge variant={s(status) === "SCHEDULED" ? "default" : "outline"}>{s(status, "UNKNOWN").replaceAll("_", " ")}</Badge>
        </div>

        {/* Next Action Banner */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
          <p className="text-sm font-medium text-orange-800">
            <span className="font-semibold">Next Action:</span> {computedNextAction}
          </p>
          {why ? <p className="text-xs text-orange-700 mt-1">{why}</p> : null}
        </div>
      </div>

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

          {/* Email Insights (truthful if missing) */}
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

      {/* Interview Preparation (LLM-backed, null-safe) */}
      <Card id={`${idPrefix}-interview-prep`} className={`${cardClass} bg-violet-50 border-violet-200`}>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-5 h-5 text-violet-600" />
          <span className="font-semibold text-violet-900 text-lg">Interview Preparation</span>
        </div>

        <div className="bg-violet-100 rounded-lg p-2 mb-3">
          <p className="text-sm font-medium text-violet-900">
            <span className="font-semibold">Prep Focus:</span>{" "}
            {prepFocus || "No stage-specific prep available yet. Re-sync once more emails exist in this thread."}
          </p>
        </div>

        {/* Optional interviewer profile (only if present) */}
        {interviewerName || interviewerRole || interviewerBio || interviewerGoals.length ? (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-violet-600" />
              <span className="font-medium text-violet-900">Your Interviewer</span>
            </div>
            <div className="bg-white rounded-lg p-3 border border-violet-100">
              <h4 className="font-semibold text-gray-900 text-base">{interviewerName || "Unknown"}</h4>
              {interviewerRole ? <p className="text-sm text-violet-700 font-medium mb-1">{interviewerRole}</p> : null}
              {interviewerBio ? <p className="text-sm text-gray-700 mb-2 leading-relaxed">{interviewerBio}</p> : null}

              {interviewerGoals.length ? (
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">What they're looking for:</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {interviewerGoals.map((goal, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-violet-500 mt-0.5">•</span>
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Questions + tips: supports both schemas */}
        <div className="grid md:grid-cols-2 gap-3">
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="w-4 h-4 text-purple-600" />
              <h4 className="font-semibold text-sm text-gray-900">Questions They Might Ask You</h4>
            </div>
            <ul className="space-y-2">
              {(questionsTheyAsk.length ? questionsTheyAsk : sampleQuestions).slice(0, 7).map((q: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-purple-600 font-semibold mt-0.5">•</span>
                  <span>{q}</span>
                </li>
              ))}
              {!questionsTheyAsk.length && !sampleQuestions.length ? (
                <li className="text-sm text-gray-500">No LLM questions available yet.</li>
              ) : null}
            </ul>
          </div>

          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-amber-600" />
              <h4 className="font-semibold text-sm text-gray-900">Questions You Should Ask Them</h4>
            </div>
            <ul className="space-y-2">
              {questionsYouAsk.slice(0, 7).map((q: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-amber-600 font-semibold mt-0.5">•</span>
                  <span>{q}</span>
                </li>
              ))}
              {!questionsYouAsk.length ? <li className="text-sm text-gray-500">No LLM questions available yet.</li> : null}
            </ul>
          </div>
        </div>

        {/* Stories + homework (if present) */}
        {(storiesToPrepare.length || homeworkNext.length || emphasizeTips.length) ? (
          <div className="mt-3 grid md:grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 border border-violet-100">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-violet-600" />
                <span className="font-medium text-violet-900">What to Emphasize</span>
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                {emphasizeTips.slice(0, 7).map((tip: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-violet-500 mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
                {!emphasizeTips.length ? <li className="text-sm text-gray-500">No emphasis tips available yet.</li> : null}
              </ul>
            </div>

            <div className="bg-white rounded-lg p-3 border border-violet-100">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="w-4 h-4 text-violet-600" />
                <span className="font-medium text-violet-900">Stories + Homework</span>
              </div>

              {storiesToPrepare.length ? (
                <>
                  <p className="text-xs font-semibold text-gray-900 mb-1">Stories to prepare</p>
                  <ul className="text-sm text-gray-700 space-y-1 mb-3">
                    {storiesToPrepare.slice(0, 5).map((x: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-violet-500 mt-0.5">•</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {homeworkNext.length ? (
                <>
                  <p className="text-xs font-semibold text-gray-900 mb-1">Next 24h homework</p>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {homeworkNext.slice(0, 5).map((x: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-violet-500 mt-0.5">•</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {!storiesToPrepare.length && !homeworkNext.length ? (
                <p className="text-sm text-gray-500">No stories/homework available yet.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* AI Tip (truthful, not generic if missing) */}
        <div className="bg-violet-100 rounded-lg p-2 mt-3">
          <p className="text-sm italic text-violet-900">
            <span className="font-semibold not-italic">AI Tip:</span>{" "}
            {s(prep?.ai_tip, "") ||
              s(prep?.aiTip, "") ||
              "If the LLM output feels generic, it’s because the thread lacks role-specific signals. Add the job posting link + team name and re-sync."}
          </p>
        </div>
      </Card>

      {/* Company Intel */}
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
        ) : null}

        <div className="bg-yellow-50 rounded-lg p-2 mb-2">
          <p className="text-xs font-semibold text-yellow-900 mb-0.5">Recent News</p>
          {recentNews.length > 0 ? (
            recentNews.slice(0, 5).map((news: any, index: number) => {
              const title = s(news?.title, "")
              const url = s(news?.url, "")
              if (!title) return null
              return url ? (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-yellow-800 hover:underline hover:text-yellow-900 mb-1 last:mb-0"
                >
                  {title} <ExternalLink className="inline w-3 h-3 ml-0.5" />
                </a>
              ) : (
                <p key={index} className="text-sm text-yellow-800 mb-1 last:mb-0">
                  {title}
                </p>
              )
            })
          ) : (
            <p className="text-sm text-yellow-800">No recent news available.</p>
          )}
        </div>

        {/* Common Topics (from LLM if available) */}
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
              <>
                <Badge variant="outline" className="text-xs border-yellow-200 bg-yellow-50 text-yellow-800">
                  Role fit
                </Badge>
                <Badge variant="outline" className="text-xs border-yellow-200 bg-yellow-50 text-yellow-800">
                  Collaboration
                </Badge>
                <Badge variant="outline" className="text-xs border-yellow-200 bg-yellow-50 text-yellow-800">
                  Execution
                </Badge>
                <Badge variant="outline" className="text-xs border-yellow-200 bg-yellow-50 text-yellow-800">
                  Communication
                </Badge>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Timeline Overview (safe/static) */}
      <Card className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-gray-900" />
          <span className="font-semibold text-lg">Timeline Overview</span>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="w-20 text-sm text-gray-500">Applied</span>
            <div className="flex-1 h-2.5 bg-blue-600 rounded-full" />
            <span className="w-12 text-right text-sm text-gray-500">
              {appliedAt ? appliedAt.toLocaleDateString() : "TBD"}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="w-20 text-sm text-gray-500">Recruiter</span>
            <div className="flex-1 h-2.5 bg-blue-200 rounded-full" />
            <span className="w-12 text-right text-sm text-gray-500">—</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="w-20 text-sm text-gray-500">Interview</span>
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full" />
            <span className="w-12 text-right text-sm text-gray-400">—</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="w-20 text-sm text-gray-500">Offer</span>
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full" />
            <span className="w-12 text-right text-sm text-gray-400">—</span>
          </div>
        </div>

        <p className="text-sm text-gray-600 italic">
          {s(j?.timelineNote, "") || "Timeline estimates appear once more stage signals exist."}
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
              <span>{nextEtaText}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600">Job Type:</span>
              <span>{jobType}</span>
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

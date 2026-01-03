"use client"

import React from "react"
import type { Job } from "@/types"
import { Mail, Sparkles, Building2, Newspaper, LineChart } from "lucide-react"

type Props = {
  job: Job | null
  onSaveNotes?: (notes: string) => void
}

function safeStr(v: any, fallback = ""): string {
  if (typeof v === "string") return v
  if (v == null) return fallback
  try {
    return String(v)
  } catch {
    return fallback
  }
}

function safeArr(v: any): any[] {
  return Array.isArray(v) ? v : []
}

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ")
}

function stageLabel(stage: any): string {
  const s = safeStr(stage, "")
  if (!s) return "Unknown stage"
  const u = s.toUpperCase()
  if (u.includes("APPLIED")) return "Applied"
  if (u.includes("RECRUITER") || u.includes("SCREEN")) return "Screening"
  if (u.includes("HIRING")) return "Hiring manager"
  if (u.includes("PRESENT")) return "Presentation"
  if (u.includes("FULL")) return "Full loop"
  if (u.includes("OFFER")) return "Offer discussion"
  if (u.includes("INTERVIEW")) return "Interview"
  return titleCase(s)
}

function statusLabel(status: any): string {
  const s = safeStr(status, "")
  if (!s) return "Unknown"
  return titleCase(s)
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode
  tone?: "neutral" | "purple" | "orange" | "green"
}) {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
  const cls =
    tone === "purple"
      ? "border-purple-200 bg-purple-50 text-purple-700"
      : tone === "orange"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : tone === "green"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-gray-200 bg-gray-50 text-gray-700"
  return <span className={`${base} ${cls}`}>{children}</span>
}

function SectionCard({
  title,
  icon,
  children,
  className = "",
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-xl border bg-white shadow-sm ${className}`}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {icon}
        <div className="text-sm font-semibold text-gray-900">{title}</div>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  )
}

function Bullets({ items, empty }: { items: any[]; empty: string }) {
  const list = safeArr(items).filter((x) => safeStr(x, "").trim())
  if (!list.length) return <div className="text-sm text-gray-500">{empty}</div>
  return (
    <ul className="space-y-2 text-sm text-gray-700">
      {list.map((x, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400" />
          <span>{safeStr(x)}</span>
        </li>
      ))}
    </ul>
  )
}

export function JobDetailPanel({ job, onSaveNotes }: Props) {
  // IMPORTANT: no hooks in this component. It must be 100% render-deterministic to avoid React #310.
  if (!job) {
    return (
      <div className="h-full min-h-0 overflow-y-auto p-6">
        <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
          Select a pipeline to see details.
        </div>
      </div>
    )
  }

  const j: any = job as any
  const companyName = safeStr(j?.company?.name, "Unknown company")
  const roleTitle = safeStr(j?.title, "Interview")
  const stage = stageLabel(j?.stage)
  const status = statusLabel(j?.status)

  const prep: any = j?.interviewPrep || {}
  const insights: any = prep?.insights || {}
  const companyType = safeStr(
    j?.company?.type || prep?.company_type || prep?.companyType,
    "Unknown",
  )
  const companySize = safeStr(
    j?.company?.size || prep?.company_size_bucket || prep?.companySizeBucket,
    "Unknown",
  )
  const companySummary =
    safeStr(j?.company?.intelSummary, "") ||
    safeStr(prep?.company_intel_summary, "") ||
    safeStr(prep?.companyIntelSummary, "") ||
    ""

  const truthfulNote = safeStr(
    j?.company?.truthfulNote || prep?.truthful_note || prep?.truthfulNote,
    "",
  )

  const nextAction =
    safeStr(insights?.nextAction, "") ||
    safeStr(prep?.next_action, "") ||
    safeStr(prep?.nextAction, "") ||
    ""

  const why = safeStr(insights?.why || insights?.rationale || insights?.reasoning, "")
  const tone = safeStr(prep?.tone || insights?.tone, "")
  const urgency = safeStr(prep?.urgency || insights?.urgency, "")
  const responseLikelihood =
    safeStr(prep?.response_likelihood || prep?.responseLikelihood, "") ||
    safeStr(insights?.response_likelihood || insights?.responseLikelihood, "")

  const lastEmail: any = j?.lastEmail || {}
  const lastSubject = safeStr(lastEmail?.subject, "")
  const lastFrom = safeStr(lastEmail?.fromName || lastEmail?.fromEmail, "")
  const lastSnippet = safeStr(lastEmail?.snippet, "")
  const lastAt = safeStr(lastEmail?.receivedAt, "")

  const prepFocus = safeStr(prep?.stage_focus || prep?.stageFocus, "")
  const qThey = safeArr(
    prep?.questions_they_might_ask?.length
      ? prep?.questions_they_might_ask
      : prep?.questionsTheyMightAsk,
  )
  const qYou = safeArr(
    prep?.questions_you_should_ask?.length
      ? prep?.questions_you_should_ask
      : prep?.questionsYouShouldAsk,
  )
  const stories = safeArr(
    prep?.stories_to_prepare?.length ? prep?.stories_to_prepare : prep?.storiesToPrepare,
  )
  const homework = safeArr(
    prep?.homework_next_24h?.length ? prep?.homework_next_24h : prep?.homeworkNext24h,
  )
  const emphasize = safeArr(prep?.what_to_emphasize || prep?.whatToEmphasize)
  const topics = safeArr(
    prep?.common_topics || prep?.commonInterviewTopics || prep?.topics || prep?.tags,
  ).slice(0, 8)
  const recentNews = safeArr(j?.recentNews || prep?.recent_news || prep?.recentNews).slice(
    0,
    3,
  )

  const appliedAt = safeStr(j?.appliedAt, "")

  return (
    <div className="h-full min-h-0 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-gray-900">
            {companyName}
          </div>
          <div className="mt-1 text-gray-600">{roleTitle}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="purple">{stage}</Pill>
            <Pill>{status}</Pill>
            {companyType !== "Unknown" ? <Pill tone="orange">{companyType}</Pill> : null}
            {companySize !== "Unknown" ? <Pill tone="orange">{companySize}</Pill> : null}
          </div>
        </div>
      </div>

      {/* Next Action */}
      <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
        <div className="text-xs font-semibold text-orange-800">Next Action</div>
        <div className="mt-1 text-sm text-orange-900">
          {nextAction ||
            "No next action generated yet. Re-sync after a new email arrives or add the job link/context."}
        </div>
        {why ? <div className="mt-1 text-xs text-orange-800/80">{why}</div> : null}
      </div>

      {/* Last Email */}
      <div className="mt-4">
        <SectionCard title="Last Email" icon={<Mail className="h-4 w-4 text-emerald-600" />}>
          <div className="text-sm font-semibold text-gray-900">
            {lastSubject || "No email subject available"}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {lastFrom ? `From: ${lastFrom}` : "From: Unknown"}
          </div>
          {lastSnippet ? (
            <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{lastSnippet}</div>
          ) : null}
          {lastAt ? <div className="mt-3 text-xs text-gray-500">{lastAt}</div> : null}

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="text-[11px] font-semibold text-gray-500">Tone</div>
              <div className="mt-0.5 text-xs text-gray-800">{tone || "—"}</div>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="text-[11px] font-semibold text-gray-500">
                Response Likelihood
              </div>
              <div className="mt-0.5 text-xs text-gray-800">{responseLikelihood || "—"}</div>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <div className="text-[11px] font-semibold text-gray-500">Urgency</div>
              <div className="mt-0.5 text-xs text-gray-800">{urgency || "—"}</div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Interview Prep */}
      <div className="mt-4">
        <SectionCard
          title="Interview Preparation"
          icon={<Sparkles className="h-4 w-4 text-purple-600" />}
          className="border-purple-200"
        >
          <div className="rounded-lg bg-purple-50 px-3 py-2">
            <div className="text-[11px] font-semibold text-purple-700">Prep Focus</div>
            <div className="mt-0.5 text-sm text-purple-900">
              {prepFocus ||
                "No stage-specific focus generated yet. Re-sync after a message with clear signals (schedule, round, role scope)."}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-purple-100 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">
                Questions They Might Ask You
              </div>
              <div className="mt-3">
                <Bullets items={qThey} empty="No role-specific questions generated yet." />
              </div>
            </div>

            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
              <div className="text-sm font-semibold text-gray-900">
                Questions You Should Ask Them
              </div>
              <div className="mt-3">
                <Bullets items={qYou} empty="No targeted questions generated yet." />
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">What to Emphasize</div>
              <div className="mt-3">
                <Bullets items={emphasize} empty="No emphasis tips available yet." />
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Stories + Homework</div>
              <div className="mt-3">
                <div className="text-xs font-semibold text-gray-500">Stories to prepare</div>
                <div className="mt-2">
                  <Bullets items={stories} empty="No stories suggested yet." />
                </div>

                <div className="mt-4 text-xs font-semibold text-gray-500">
                  Next 24h homework
                </div>
                <div className="mt-2">
                  <Bullets items={homework} empty="No homework generated yet." />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            AI Tip: If the prep feels generic, your thread may lack role/team context. Add the
            job posting link + team name in the thread and re-sync.
          </div>
        </SectionCard>
      </div>

      {/* Company intel */}
      <div className="mt-4">
        <SectionCard title="Company Intel" icon={<Building2 className="h-4 w-4 text-amber-600" />}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-500">Industry</div>
              <div className="mt-1 text-sm text-gray-800">
                {safeStr(prep?.industry, "Unknown") || "Unknown"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">Size</div>
              <div className="mt-1 text-sm text-gray-800">{companySize || "Unknown"}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">HQ Location</div>
              <div className="mt-1 text-sm text-gray-800">
                {safeStr(prep?.hq_location || prep?.hqLocation, "Unknown") || "Unknown"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">Glassdoor Rating</div>
              <div className="mt-1 text-sm text-gray-800">
                {safeStr(prep?.glassdoor_rating || prep?.glassdoorRating, "N/A") || "N/A"}
              </div>
            </div>
          </div>

          {companySummary ? (
            <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2">
              <div className="text-[11px] font-semibold text-amber-800">Summary</div>
              <div className="mt-0.5 text-sm text-amber-950">{companySummary}</div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2">
              <div className="text-[11px] font-semibold text-amber-800">Summary</div>
              <div className="mt-0.5 text-sm text-amber-950">
                No verified company info available.
              </div>
            </div>
          )}

          {truthfulNote ? <div className="mt-2 text-xs text-gray-500">{truthfulNote}</div> : null}

          <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-gray-500" />
              <div className="text-[11px] font-semibold text-gray-500">Recent News</div>
            </div>
            <div className="mt-2">
              {recentNews.length ? (
                <ul className="space-y-1 text-sm text-gray-700">
                  {recentNews.map((n: any, i: number) => (
                    <li key={i}>{safeStr(n?.title || n)}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-gray-500">No recent news available.</div>
              )}
            </div>
          </div>

          {topics.length ? (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-500">Common Interview Topics</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {topics.map((t: any, i: number) => (
                  <span
                    key={i}
                    className="rounded-full border bg-white px-2.5 py-1 text-xs text-gray-700"
                  >
                    {safeStr(t)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>

      {/* Timeline overview */}
      <div className="mt-4">
        <SectionCard title="Timeline Overview" icon={<LineChart className="h-4 w-4 text-slate-600" />}>
          <div className="grid grid-cols-4 gap-3 text-xs text-gray-600">
            <div>
              <div className="font-semibold text-gray-900">Applied</div>
              <div className="mt-1">{appliedAt ? "Day 0" : "—"}</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Recruiter</div>
              <div className="mt-1">—</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Interview</div>
              <div className="mt-1">—</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Offer</div>
              <div className="mt-1">—</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                <span>Applied</span>
                <span className="text-gray-400">Day 0</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div className="h-2 w-full rounded-full bg-blue-600" />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                <span>Recruiter</span>
                <span className="text-gray-400">—</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div className="h-2 w-3/4 rounded-full bg-blue-600" />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                <span>Interview</span>
                <span className="text-gray-400">—</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div className="h-2 w-1/2 rounded-full bg-blue-600" />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                <span>Offer</span>
                <span className="text-gray-400">—</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div className="h-2 w-1/4 rounded-full bg-blue-600" />
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            This timeline is a placeholder until we track round dates per pipeline.
          </div>
        </SectionCard>
      </div>

      {/* Job details + notes */}
      <div className="mt-4">
        <SectionCard title="Job Details" icon={<Building2 className="h-4 w-4 text-gray-600" />}>
          <details>
            <summary className="cursor-pointer select-none text-sm font-semibold text-gray-900">
              Notes
            </summary>
            <div className="mt-3">
              <textarea
                className="w-full rounded-lg border p-3 text-sm outline-none focus:ring-2 focus:ring-purple-200"
                rows={4}
                placeholder="Add notes…"
                defaultValue={safeStr(j?.notes, "")}
                onBlur={(e) => onSaveNotes?.(e.currentTarget.value)}
              />
              <div className="mt-2 text-xs text-gray-500">
                Notes save on blur (you can wire this to Supabase later).
              </div>
            </div>
          </details>
        </SectionCard>
      </div>
    </div>
  )
}

export default JobDetailPanel

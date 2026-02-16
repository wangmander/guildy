"use client"

import React from "react"
import type { Job } from "@/types"
import { Mail, Building2, Target, Brain, ArrowUpRight } from "lucide-react"

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
      <div className="flex items-center gap-2 border-b px-5 py-4">
        {icon}
        <div className="text-base font-semibold text-gray-900">{title}</div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  )
}

export function JobDetailPanel({ job, onSaveNotes }: Props) {
  if (!job) {
    return (
      <div className="h-full min-h-0 overflow-y-auto p-8 flex items-center justify-center bg-gray-50/50">
        <div className="text-center max-w-sm">
          <div className="h-12 w-12 bg-white rounded-xl shadow-sm border mx-auto flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-gray-300" />
          </div>
          <h3 className="text-gray-900 font-semibold mb-1">Select a pipeline</h3>
          <p className="text-sm text-gray-500">Choose a job from the list to view company intel and interview prep.</p>
        </div>
      </div>
    )
  }

  const j: any = job as any
  const companyName = safeStr(j?.company?.name, "Unknown company")
  const roleTitle = safeStr(j?.title, "Interview")
  const stage = stageLabel(j?.stage)

  const prep: any = j?.interviewPrep || {}
  const insights: any = prep?.insights || {}

  const primitives = safeArr(prep?.primitives)
  const companySummary = safeStr(j?.company?.intelSummary || prep?.companyIntelSummary || prep?.company_intel_summary || prep?.summary || "")

  const nextAction = safeStr(insights?.nextAction || prep?.next_action || prep?.nextAction || "")
  const stageFocus = safeStr(prep?.stageFocus || prep?.stage_focus, "")

  const lastEmail: any = j?.lastEmail || {}
  const lastSnippet = safeStr(lastEmail?.snippet, "")
  const lastAt = safeStr(lastEmail?.receivedAt, "")

  // Questions
  const qThey = safeArr(prep?.questionsTheyMightAsk || prep?.questions_they_might_ask)
  const qYou = safeArr(prep?.questionsYouShouldAsk || prep?.questions_you_should_ask)

  const recentNews = safeArr(prep?.companyIntel?.recentNews || prep?.companyIntel?.recent_news)

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-gray-50/30">

      {/* Hero Header */}
      <div className="bg-white border-b px-8 py-6 sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{companyName}</h1>
            <div className="flex items-center gap-2 mt-1 text-gray-600 font-medium">
              {roleTitle}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Pill tone="purple">{stage}</Pill>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8 max-w-5xl mx-auto">

        {/* 1. Company Intel + Context (top) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Company Intel" icon={<Building2 className="h-5 w-5 text-indigo-500" />}>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              {companySummary || "No company summary available yet."}
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-400 text-xs block">Industry</span>
                <span className="font-medium text-gray-900">{safeStr(prep?.companyIntel?.industry || prep?.industry || j?.industry, "Unknown")}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">Size</span>
                <span className="font-medium text-gray-900">{safeStr(prep?.companyIntel?.size || prep?.size, "Unknown")}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">HQ</span>
                <span className="font-medium text-gray-900">{safeStr(prep?.companyIntel?.hqLocation || prep?.companyIntel?.hq_location || prep?.hqLocation || prep?.hq_location || j?.location, "Unknown")}</span>
              </div>
            </div>
            {recentNews.length > 0 && (
              <div>
                <span className="text-gray-400 text-xs block mb-2">Recent News</span>
                <ul className="space-y-1.5">
                  {recentNews.map((n: any, i: number) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                      {safeStr(n)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Context" icon={<Mail className="h-5 w-5 text-gray-400" />}>
            <div className="space-y-4">
              <div className="rounded-lg bg-orange-50 p-3 border border-orange-100">
                <div className="text-xs font-bold text-orange-700 uppercase mb-1">Next Action</div>
                <div className="text-sm text-orange-900 font-medium">
                  {nextAction || "Wait for reply"}
                </div>
              </div>

              {stageFocus && (
                <div className="rounded-lg bg-indigo-50 p-3 border border-indigo-100">
                  <div className="text-xs font-bold text-indigo-700 uppercase mb-1">Stage Focus</div>
                  <div className="text-sm text-indigo-900 font-medium">{stageFocus}</div>
                </div>
              )}

              <div className="text-sm">
                <div className="font-medium text-gray-900 mb-1">Last Email</div>
                <div className="text-gray-600 line-clamp-2 italic">"{lastSnippet}"</div>
                <div className="text-xs text-gray-400 mt-1">{lastAt}</div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* 2. Questions They'll Ask — the core prep value */}
        <SectionCard title="Questions They'll Ask You" icon={<Target className="h-5 w-5 text-red-400" />}>
          <div className="space-y-4">
            {qThey.map((q: any, i: number) => (
              <div key={i} className="border-l-2 border-red-200 pl-4">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                  {q.category || "General"}
                </div>
                <div className="text-sm text-gray-800 font-medium">{q.question}</div>
              </div>
            ))}
            {qThey.length === 0 && <div className="text-gray-400 italic text-sm">Waiting for more context...</div>}
          </div>
        </SectionCard>

        {/* 3. Questions You Should Ask */}
        <SectionCard title="Smart Questions to Ask Them" icon={<ArrowUpRight className="h-5 w-5 text-green-500" />}>
          <div className="space-y-4">
            {qYou.map((q: any, i: number) => (
              <div key={i} className="border-l-2 border-green-200 pl-4">
                <div className="text-[10px] text-green-600/70 font-bold uppercase tracking-wider mb-0.5">
                  {q.category || "Strategic"}
                </div>
                <div className="text-sm text-gray-800 font-medium">{q.question}</div>
              </div>
            ))}
            {qYou.length === 0 && <div className="text-gray-400 italic text-sm">Waiting for more context...</div>}
          </div>
        </SectionCard>

        {/* 4. Key Topics — what this company cares about */}
        {primitives.length > 0 && (
          <SectionCard title="Key Topics to Know" icon={<Brain className="h-5 w-5 text-gray-400" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {primitives.map((p: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="font-semibold text-gray-900 text-sm mb-1">{p.name}</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{p.description}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <div className="pb-10">
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-500 select-none">
              <span>Notes</span>
              <span className="h-px flex-1 bg-gray-200"></span>
            </summary>
            <div className="mt-4">
              <textarea
                className="w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-4 text-sm"
                rows={6}
                placeholder="Jot down your thoughts..."
                defaultValue={safeStr(j?.notes, "")}
                onBlur={(e) => onSaveNotes?.(e.currentTarget.value)}
              />
            </div>
          </details>
        </div>

      </div>
    </div>
  )
}

export default JobDetailPanel

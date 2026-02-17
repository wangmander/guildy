"use client"

import React from "react"
import type { Job } from "@/types"
import { Mail, Building2, Target, Brain, ArrowUpRight, Shield, User, Map, DollarSign, CheckSquare } from "lucide-react"

type Props = {
  job: Job | null
  onSaveNotes?: (notes: string) => void
}

function safeStr(v: any, fallback = ""): string {
  if (typeof v === "string") return v
  if (v == null) return fallback
  try { return String(v) } catch { return fallback }
}

function safeArr(v: any): any[] {
  return Array.isArray(v) ? v : []
}

function titleCase(s: string) {
  return s.toLowerCase().split(/[_\s]+/).filter(Boolean).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ")
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

function Pill({ children, tone }: { children: React.ReactNode; tone?: "neutral" | "purple" | "orange" | "green" | "red" | "blue" }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
  const colors: Record<string, string> = {
    purple: "border-purple-200 bg-purple-50 text-purple-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    neutral: "border-gray-200 bg-gray-50 text-gray-700",
  }
  return <span className={`${base} ${colors[tone || "neutral"]}`}>{children}</span>
}

function SectionCard({ title, icon, children, className = "" }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
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

// Group questions by category
function groupByCategory(items: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {}
  for (const item of items) {
    const cat = safeStr(item?.category, "General")
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(item)
  }
  return groups
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
          <p className="text-sm text-gray-500">Choose a job from the list to view your interview prep.</p>
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

  // Company Intel
  const ci = prep?.companyIntel || {}
  const companySummary = safeStr(ci?.summary || prep?.companyIntelSummary || prep?.summary || "")
  const product = safeStr(ci?.product || "")
  const businessModel = safeStr(ci?.businessModel || "")
  const competitors = safeArr(ci?.competitors)
  const techStack = safeStr(ci?.techStack || "")
  const culture = safeStr(ci?.culture || "")
  const recentNews = safeArr(ci?.recentNews || ci?.recent_news)

  // Interview Strategy
  const strategy = prep?.interviewStrategy || {}
  const goalForStage = safeStr(strategy?.goalForThisStage || "")
  const whatTheyEvaluate = safeArr(strategy?.whatTheyEvaluate)
  const howToSucceed = safeArr(strategy?.howToSucceed)
  const commonMistakes = safeArr(strategy?.commonMistakes)
  const answerLength = safeStr(strategy?.answerLength || "")

  // Interviewer Intel
  const interviewer = prep?.interviewerIntel || {}
  const interviewerName = safeStr(interviewer?.name || "")
  const interviewerRole = safeStr(interviewer?.likelyRole || "")
  const interviewerSeniority = safeStr(interviewer?.seniority || "")
  const interviewerEvaluates = safeStr(interviewer?.whatTheyEvaluate || "")
  const interviewerTopics = safeArr(interviewer?.topicsTheyProbe)
  const interviewerCalibrate = safeStr(interviewer?.howToCalibrateAnswers || "")

  // Stage Roadmap
  const stageRoadmap = safeArr(prep?.stageRoadmap)

  // Compensation
  const comp = prep?.compensationIntel || {}
  const salaryRange = safeStr(comp?.salaryRange || "")
  const equityInfo = safeStr(comp?.equityInfo || "")
  const negotiationTips = safeArr(comp?.negotiationTips)
  const whenToDiscuss = safeStr(comp?.whenToDiscuss || "")

  // Prep Checklist
  const prepChecklist = safeArr(prep?.prepChecklist)

  // Questions
  const qThey = safeArr(prep?.questionsTheyMightAsk || prep?.questions_they_might_ask)
  const qYou = safeArr(prep?.questionsYouShouldAsk || prep?.questions_you_should_ask)
  const qTheyGrouped = groupByCategory(qThey)
  const qYouGrouped = groupByCategory(qYou)

  // Context
  const nextAction = safeStr(insights?.nextAction || prep?.next_action || prep?.nextAction || "")
  const stageFocus = safeStr(prep?.stageFocus || prep?.stage_focus, "")
  const lastEmail: any = j?.lastEmail || {}
  const lastSnippet = safeStr(lastEmail?.snippet, "")
  const lastAt = safeStr(lastEmail?.receivedAt, "")
  const primitives = safeArr(prep?.primitives)

  const hasStrategy = goalForStage || whatTheyEvaluate.length > 0 || howToSucceed.length > 0
  const hasInterviewer = interviewerName || interviewerRole
  const hasComp = salaryRange || equityInfo

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-gray-50/30">

      {/* Hero Header */}
      <div className="bg-white border-b px-8 py-6 sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{companyName}</h1>
            <div className="flex items-center gap-2 mt-1 text-gray-600 font-medium">{roleTitle}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Pill tone="purple">{stage}</Pill>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8 max-w-5xl mx-auto">

        {/* 1. Company Intel + Context */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Company Intel" icon={<Building2 className="h-5 w-5 text-indigo-500" />}>
            {companySummary && <p className="text-sm text-gray-600 leading-relaxed mb-4">{companySummary}</p>}
            {product && (
              <div className="mb-3">
                <span className="text-gray-400 text-xs block mb-1">What They Build</span>
                <span className="text-sm text-gray-800">{product}</span>
              </div>
            )}
            {businessModel && (
              <div className="mb-3">
                <span className="text-gray-400 text-xs block mb-1">Business Model</span>
                <span className="text-sm text-gray-800">{businessModel}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div>
                <span className="text-gray-400 text-xs block">Industry</span>
                <span className="font-medium text-gray-900">{safeStr(ci?.industry || prep?.industry || j?.industry, "Unknown")}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">Size</span>
                <span className="font-medium text-gray-900">{safeStr(ci?.size || prep?.size, "Unknown")}</span>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">HQ</span>
                <span className="font-medium text-gray-900">{safeStr(ci?.hqLocation || ci?.hq_location || prep?.hqLocation || j?.location, "Unknown")}</span>
              </div>
            </div>
            {competitors.length > 0 && (
              <div className="mb-3">
                <span className="text-gray-400 text-xs block mb-1">Competitors</span>
                <div className="flex flex-wrap gap-1.5">
                  {competitors.map((c: any, i: number) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md">{safeStr(c)}</span>
                  ))}
                </div>
              </div>
            )}
            {techStack && (
              <div className="mb-3">
                <span className="text-gray-400 text-xs block mb-1">Tech Stack</span>
                <span className="text-sm text-gray-700">{techStack}</span>
              </div>
            )}
            {culture && (
              <div className="mb-3">
                <span className="text-gray-400 text-xs block mb-1">Culture</span>
                <span className="text-sm text-gray-700">{culture}</span>
              </div>
            )}
            {recentNews.length > 0 && (
              <div>
                <span className="text-gray-400 text-xs block mb-1">Recent News</span>
                <ul className="space-y-1">
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

          <div className="space-y-6">
            {/* Context */}
            <SectionCard title="Context" icon={<Mail className="h-5 w-5 text-gray-400" />}>
              <div className="space-y-3">
                <div className="rounded-lg bg-orange-50 p-3 border border-orange-100">
                  <div className="text-xs font-bold text-orange-700 uppercase mb-1">Next Action</div>
                  <div className="text-sm text-orange-900 font-medium">{nextAction || "Wait for reply"}</div>
                </div>
                {stageFocus && (
                  <div className="rounded-lg bg-indigo-50 p-3 border border-indigo-100">
                    <div className="text-xs font-bold text-indigo-700 uppercase mb-1">Stage Focus</div>
                    <div className="text-sm text-indigo-900 font-medium">{stageFocus}</div>
                  </div>
                )}
                {lastSnippet && (
                  <div className="text-sm">
                    <div className="font-medium text-gray-900 mb-1">Last Email</div>
                    <div className="text-gray-600 line-clamp-2 italic">"{lastSnippet}"</div>
                    <div className="text-xs text-gray-400 mt-1">{lastAt}</div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Interviewer Intel */}
            {hasInterviewer && (
              <SectionCard title="Interviewer Intel" icon={<User className="h-5 w-5 text-blue-500" />}>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {interviewerName ? interviewerName[0]?.toUpperCase() : "?"}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{interviewerName || "Unknown"}</div>
                      <div className="text-xs text-gray-500">{interviewerRole}{interviewerSeniority ? ` · ${titleCase(interviewerSeniority)}` : ""}</div>
                    </div>
                  </div>
                  {interviewerEvaluates && (
                    <div className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3 border border-blue-100">
                      {interviewerEvaluates}
                    </div>
                  )}
                  {interviewerTopics.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-400 font-medium">Topics They'll Probe</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {interviewerTopics.map((t: any, i: number) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-100">{safeStr(t)}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {interviewerCalibrate && (
                    <div className="text-sm text-gray-600 italic">{interviewerCalibrate}</div>
                  )}
                </div>
              </SectionCard>
            )}
          </div>
        </div>

        {/* 2. Interview Strategy */}
        {hasStrategy && (
          <SectionCard title="Interview Strategy" icon={<Shield className="h-5 w-5 text-amber-500" />}>
            <div className="space-y-5">
              {goalForStage && (
                <div className="rounded-lg bg-amber-50 p-4 border border-amber-100">
                  <div className="text-xs font-bold text-amber-700 uppercase mb-1">Goal for This Stage</div>
                  <div className="text-sm text-amber-900 font-medium">{goalForStage}</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {whatTheyEvaluate.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">What They Evaluate</div>
                    <ul className="space-y-1.5">
                      {whatTheyEvaluate.map((item: any, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                          {safeStr(item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {howToSucceed.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">How to Succeed</div>
                    <ul className="space-y-1.5">
                      {howToSucceed.map((item: any, i: number) => (
                        <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                          {safeStr(item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {commonMistakes.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Common Mistakes to Avoid</div>
                  <ul className="space-y-1.5">
                    {commonMistakes.map((item: any, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                        {safeStr(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {answerLength && (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 border">
                  <span className="font-medium text-gray-700">Answer length: </span>{answerLength}
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* 3. Stage Roadmap */}
        {stageRoadmap.length > 0 && (
          <SectionCard title="Stage Roadmap" icon={<Map className="h-5 w-5 text-indigo-500" />}>
            <div className="flex flex-col gap-0">
              {stageRoadmap.map((s: any, i: number) => {
                const status = safeStr(s?.status, "upcoming")
                const isCurrent = status === "current"
                const isCompleted = status === "completed"
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent ? "bg-indigo-600 text-white ring-4 ring-indigo-100" :
                        isCompleted ? "bg-emerald-500 text-white" :
                        "bg-gray-200 text-gray-500"
                      }`}>
                        {isCompleted ? "✓" : i + 1}
                      </div>
                      {i < stageRoadmap.length - 1 && (
                        <div className={`w-0.5 h-8 ${isCompleted ? "bg-emerald-300" : "bg-gray-200"}`} />
                      )}
                    </div>
                    <div className="pb-4">
                      <div className={`text-sm font-semibold ${isCurrent ? "text-indigo-700" : isCompleted ? "text-emerald-700" : "text-gray-500"}`}>
                        {safeStr(s?.stage, "Stage")}
                        {isCurrent && <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">You are here</span>}
                      </div>
                      {s?.whatItTests && <div className="text-xs text-gray-500 mt-0.5">{s.whatItTests}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}

        {/* 4. Questions They'll Ask — grouped by category */}
        <SectionCard title="Questions They'll Ask You" icon={<Target className="h-5 w-5 text-red-400" />}>
          {Object.keys(qTheyGrouped).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(qTheyGrouped).map(([category, questions]) => (
                <div key={category}>
                  <div className="text-xs font-bold text-red-500/80 uppercase tracking-wider mb-3 pb-1 border-b border-red-100">
                    {category}
                  </div>
                  <div className="space-y-3">
                    {questions.map((q: any, i: number) => (
                      <div key={i} className="text-sm text-gray-800 font-medium pl-3 border-l-2 border-red-200">
                        {q.question}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 italic text-sm">Waiting for more context...</div>
          )}
        </SectionCard>

        {/* 5. Smart Questions to Ask */}
        <SectionCard title="Smart Questions to Ask Them" icon={<ArrowUpRight className="h-5 w-5 text-green-500" />}>
          {Object.keys(qYouGrouped).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(qYouGrouped).map(([category, questions]) => (
                <div key={category}>
                  <div className="text-xs font-bold text-green-600/70 uppercase tracking-wider mb-3 pb-1 border-b border-green-100">
                    {category}
                  </div>
                  <div className="space-y-3">
                    {questions.map((q: any, i: number) => (
                      <div key={i} className="text-sm text-gray-800 font-medium pl-3 border-l-2 border-green-200">
                        {q.question}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 italic text-sm">Waiting for more context...</div>
          )}
        </SectionCard>

        {/* 6. 24-Hour Prep Checklist */}
        {prepChecklist.length > 0 && (
          <SectionCard title="24-Hour Prep Checklist" icon={<CheckSquare className="h-5 w-5 text-violet-500" />}>
            <div className="space-y-2">
              {prepChecklist.map((item: any, i: number) => (
                <label key={i} className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" className="mt-1 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 leading-relaxed">{safeStr(item)}</span>
                </label>
              ))}
            </div>
          </SectionCard>
        )}

        {/* 7. Key Topics to Know */}
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

        {/* 8. Compensation Intel */}
        {hasComp && (
          <SectionCard title="Compensation Intel" icon={<DollarSign className="h-5 w-5 text-emerald-500" />}>
            <div className="space-y-3">
              {salaryRange && (
                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Estimated Range</span>
                  <span className="text-sm font-semibold text-gray-900">{salaryRange}</span>
                </div>
              )}
              {equityInfo && (
                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Equity</span>
                  <span className="text-sm text-gray-700">{equityInfo}</span>
                </div>
              )}
              {negotiationTips.length > 0 && (
                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Negotiation Tips</span>
                  <ul className="space-y-1">
                    {negotiationTips.map((tip: any, i: number) => (
                      <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                        {safeStr(tip)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {whenToDiscuss && (
                <div className="text-sm text-gray-500 bg-emerald-50 rounded-lg p-3 border border-emerald-100 italic">
                  {whenToDiscuss}
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Notes */}
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

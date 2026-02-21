// ============================================================
// Guildy Gmail Detection V2 — Domain Types
// ============================================================

export type GuildyStage =
  | "applied"
  | "screen"
  | "technical"
  | "onsite"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "other"

export type StageDelta =
  | "none"
  | "applied"
  | "screen"
  | "technical"
  | "onsite"
  | "offer"
  | "rejected"
  | "withdrawn"

export type MessageType =
  | "recruiter_outreach"
  | "application_confirmation"
  | "scheduling"
  | "interview_invite"
  | "interview_followup"
  | "rejection"
  | "offer"
  | "assessment"
  | "thread_reply"
  | "non_recruiting"

export interface RecruitingAnalysisResult {
  is_recruiting_thread_related: boolean
  confidence: number // 0.0–1.0
  company_name: string | null
  job_title: string | null
  message_type: MessageType
  current_stage: GuildyStage
  stage_delta: StageDelta
  summary: string
}

export interface EmailSignal {
  userEmail: string
  gmailMessageId: string
  threadId: string
  subject: string
  from: string       // raw "Name <email>" header
  fromName: string   // parsed display name
  fromEmail: string  // parsed email address
  snippet: string
  bodyText: string   // full extracted plain text
  receivedAt: string // ISO string
}

export interface RouterDecision {
  routeToLLM: boolean
  reason: "ats_domain" | "jobish_subject" | "warm_lead_score" | "no_signal"
  score: number
  isATS: boolean
  isJobishSubject: boolean
}

export interface ProcessResult {
  accepted: boolean
  pipelineId: string | null
  isNewPipeline: boolean
  action:
    | "thread_inheritance"
    | "new_recruiting"
    | "updated_existing"
    | "hard_junk"
    | "no_signal"
    | "llm_rejected"
    | "dismissed"
    | "error"
  llmResult: RecruitingAnalysisResult | null
  companyName: string | null
  jobTitle: string | null
}

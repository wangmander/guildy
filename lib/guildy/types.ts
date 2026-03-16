// ============================================================
// Guildy Gmail Detection V3 — Domain Types
// ============================================================

export type GuildyStage =
  | "applied"
  | "screen"
  | "hm_screen"
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
  | "hm_screen"
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
    | "budget_exceeded"
    | "already_processed"
    | "previously_rejected"
    | "low_confidence_company"
    | "error"
  llmResult: RecruitingAnalysisResult | null
  llmCalled: boolean
  miniCallsUsed: number   // 0 or 1
  stageAdvanced: boolean
  companyName: string | null
  jobTitle: string | null
  errorDetail?: string
  routerReason?: string
}

// Pipeline reference stored in preloaded maps
export interface PipelineRef {
  id: string
  company: string | null
  role: string | null
  stage: string
}

// Preloaded maps — built once per sync, passed into every processEmailSignal call
export interface SyncMaps {
  processedMessages: Map<string, string | null>    // msgId → pipelineId (null = orphan)
  ghostedMessages: Set<string>                      // gmail_message_ids from ghost_logs
  pipelineThreads: Map<string, string>              // threadId → pipelineId
  pipelinesByCompany: Map<string, PipelineRef[]>    // normalizedCompany → pipeline refs
  pipelinesById: Map<string, PipelineRef>           // pipelineId → data
  pipelineRichness: Map<string, number>             // pipelineId → prep richness score
  dismissedThreads: Set<string>                     // gmail_thread_ids
}

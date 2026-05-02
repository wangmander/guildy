// Guildy V2 types. Hand-written to match supabase/migrations/20260502000002_v2_schema.sql.
// Replace with `supabase gen types typescript` output once the CLI is wired up.

export type Tier = "free" | "deep"

export type JobState = "passive" | "active"

export type StageKey =
  | "applied"
  | "screen"
  | "hiring_manager"
  | "interview_loop"
  | "final"
  | "offer"
  | "closed"

export type PrepStatus = "none" | "quick_generated" | "deep_generated"

export type PrepTier = "quick" | "deep"

export type JobContextType = "jd" | "latest_message" | "interviewer" | "note" | "other"

export interface UserProfile {
  id: string
  email: string
  resume_url: string | null
  resume_text: string | null
  background_text: string | null
  tier: Tier
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  user_id: string
  company_name: string
  role_title: string
  tc: string | null
  source_url: string | null
  jd_text: string | null
  state: JobState
  stage: StageKey
  prep_status: PrepStatus
  latest_message: string | null
  created_at: string
  updated_at: string
  activated_at: string | null
}

export interface StageEvent {
  id: string
  job_id: string
  user_id: string
  from_stage: StageKey | null
  to_stage: StageKey
  note: string | null
  created_at: string
}

export interface JobContext {
  id: string
  job_id: string
  user_id: string
  type: JobContextType
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface PrepVersion {
  id: string
  job_id: string
  user_id: string
  tier: PrepTier
  model_used: string
  context_hash: string | null
  output: Record<string, unknown>
  created_at: string
}

export interface StageLabel {
  id: string
  user_id: string
  stage_key: StageKey
  custom_label: string
}

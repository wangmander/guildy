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

// Which of the four resume input paths a stored resume came through. Kept
// for diagnostics; nothing downstream branches on it.
export type ResumeSource = "upload_drop" | "upload_browse" | "paste" | "handoff"

export type ResumeFileExt = "pdf" | "docx" | "txt"

// Write side of the resume. user_profiles.resume_text stays the read path;
// every ingest writes both in one call. See lib/resume/ingest.ts.
export interface Resume {
  user_id: string
  source: ResumeSource
  file_name: string | null
  file_ext: ResumeFileExt | null
  byte_size: number | null
  parsed_text: string
  char_count: number
  created_at: string
  updated_at: string
}

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

// Feature 3: TC comparison matrix. One row per job, all comp fields nullable.
export interface JobCompensation {
  id: string
  job_id: string
  user_id: string
  base: number | null
  signing_bonus: number | null
  annual_bonus_pct: number | null
  equity_grant_total: number | null
  vesting_years: number | null
  location: string | null
  benefits_notes: string | null
  // Matrix rebuild: per-offer soft ratings { soft_dim_key: 1-10 }.
  ratings: Record<string, number>
  created_at: string
  updated_at: string
}

// Matrix rebuild: per-user comparison priorities on user_profiles. Nullable in
// the DB; null resolves in code to the preset soft set + equal weights.
export interface CompPriorities {
  enabled_soft: string[]
  weights: Record<string, number>
}

export type Stage = "SCREENING" | "HIRING_MANAGER" | "PRESENTATION" | "FULL_LOOP" | "OFFER_DISCUSSION" | "REJECTED"
export type Status = "WAITING" | "SCHEDULED" | "FEEDBACK_PENDING" | "DECLINED" | "NEGOTIATING"

export interface EmailSnippet {
  fromName: string
  fromEmail: string
  subject: string
  receivedAt: string
  snippet: string
}

export interface ScheduledMeeting {
  date: string
  type: string
  meetingLink: string
  duration: number
}

export interface InterviewPrep {
  stageFocus?: string
  narrative?: string
  spicyOpinion?: string
  primitives?: Array<{ name: string; description: string }>
  proofStories?: Array<{ title: string; detail: string }>
  questionsTheyMightAsk?: Array<{ category: string; question: string }>
  questionsYouShouldAsk?: Array<{ category: string; question: string }>
  whatToEmphasize?: string[]
  homeworkNext24h?: string[]
  industry?: string
  size?: string
  hqLocation?: string
  companyIntelSummary?: string
  summary?: string
  recentNews?: string[]
  insights?: any
  nextAction?: string
  tone?: string
  urgency?: string
  responseLikelihood?: string
}

export interface NewsItem {
  title: string
  url: string
  date?: string
}

export interface Job {
  id: string
  title: string
  company: {
    name: string
    logoUrl?: string
    glassdoorRating?: number
  }
  location?: string
  industry?: string
  jobType?: "PM" | "Design" | "Eng" | "Data" | "Other"
  tags?: string[]
  stage: Stage
  status: Status
  nextEtaText?: string
  appliedAt?: string
  postingUrl?: string
  lastEmail?: EmailSnippet
  notes?: string
  scheduledMeeting?: ScheduledMeeting
  interviewPrep?: InterviewPrep
  recentNews?: NewsItem[]
  stageDetail?: string
  insights?: any
  companyIntel?: any
  predicted_stages?: string[]
}

export type Stage = "APPLIED" | "RECRUITER_SCREEN" | "INTERVIEW" | "OFFER"
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
  duration: number // in minutes
}

export interface InterviewPrep {
  interviewer: {
    name: string
    role: string
    profileUrl?: string
    bio: string
    goals: string[]
  }
  sampleQuestions: string[]
  tips: string[]
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
  industry?: "Tech" | "Healthcare" | "Finance" | "Other"
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
}

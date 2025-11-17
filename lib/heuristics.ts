import type { Job, Status } from "@/types"

export const applyEmailHeuristics = (jobs: Job[]): Job[] => {
  return jobs.map((job) => {
    if (!job.lastEmail?.subject) return job

    const subject = job.lastEmail.subject.toLowerCase()
    let newStage = job.stage
    let newStatus: Status = "WAITING"
    let newEta = "TBD"

    // Apply heuristics based on email subject
    if (subject.includes("interview") || subject.includes("schedule")) {
      newStage = "INTERVIEW"
      newStatus = "SCHEDULED"
      newEta = "prep this week"
    } else if (subject.includes("submitted") || subject.includes("received")) {
      newStage = "APPLIED"
      newStatus = "WAITING"
      newEta = "recruiter in ~5-10d"
    } else if (subject.includes("thank you") && subject.includes("process")) {
      newStage = "RECRUITER_SCREEN"
      newStatus = "FEEDBACK_PENDING"
      newEta = "update in ~2-3d"
    } else if (subject.includes("offer")) {
      newStage = "OFFER"
      newStatus = "SCHEDULED"
      newEta = "review today"
    } else if (subject.includes("unfortunately") || subject.includes("regret")) {
      newStatus = "DECLINED"
      newEta = "closed"
    }

    return {
      ...job,
      stage: newStage,
      status: newStatus,
      nextEtaText: newEta,
    }
  })
}

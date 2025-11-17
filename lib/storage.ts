import type { Job } from "@/types"

const STORAGE_KEYS = {
  GMAIL_CONNECTED: "jinder_gmail_connected",
  CONNECTED_EMAIL: "jinder_connected_email",
  JOBS: "jinder_jobs",
}

export const storage = {
  getGmailConnected: (): boolean => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(STORAGE_KEYS.GMAIL_CONNECTED) === "true"
  },

  setGmailConnected: (connected: boolean): void => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.GMAIL_CONNECTED, connected.toString())
  },

  getConnectedEmail: (): string => {
    if (typeof window === "undefined") return ""
    return localStorage.getItem(STORAGE_KEYS.CONNECTED_EMAIL) || ""
  },

  setConnectedEmail: (email: string): void => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.CONNECTED_EMAIL, email)
  },

  getJobs: (): Job[] | null => {
    if (typeof window === "undefined") return null
    const stored = localStorage.getItem(STORAGE_KEYS.JOBS)
    return stored ? JSON.parse(stored) : null
  },

  setJobs: (jobs: Job[]): void => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs))
  },

  clearAll: (): void => {
    if (typeof window === "undefined") return
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key)
    })
  },
}

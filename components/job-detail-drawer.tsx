"use client"

import type { Job } from "@/types"
import { X, ExternalLink, Calendar, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"

interface JobDetailDrawerProps {
  job: Job | null
  open: boolean
  onClose: () => void
  onSaveNotes: (jobId: string, notes: string) => void
}

export function JobDetailDrawer({ job, open, onClose, onSaveNotes }: JobDetailDrawerProps) {
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (job) {
      setNotes(job.notes || "")
    }
  }, [job])

  const handleNotesChange = (value: string) => {
    setNotes(value)
    if (job) {
      onSaveNotes(job.id, value)
    }
  }

  if (!open || !job) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={onClose} />

      {/* Drawer */}
      <div
        className={`
        fixed right-0 top-0 h-full w-full lg:w-96 bg-white shadow-xl z-50
        transform transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "translate-x-full"}
        overflow-y-auto
      `}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Job Details</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Job Basics */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Job Basics</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Title</label>
                <p className="text-sm font-medium text-gray-900">{job.title}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Company</label>
                <p className="text-sm font-medium text-gray-900">{job.company.name}</p>
              </div>
              {job.location && (
                <div>
                  <label className="text-xs text-gray-500">Location</label>
                  <p className="text-sm text-gray-700">{job.location}</p>
                </div>
              )}
              {job.postingUrl && (
                <div>
                  <label className="text-xs text-gray-500">Original Posting</label>
                  <a
                    href={job.postingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    View posting <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Application Details */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Application Details</h3>
            <div className="space-y-3">
              {job.appliedAt && (
                <div>
                  <label className="text-xs text-gray-500">Date Applied</label>
                  <p className="text-sm text-gray-700 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(job.appliedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
              {job.industry && (
                <div>
                  <label className="text-xs text-gray-500">Industry</label>
                  <p className="text-sm text-gray-700">{job.industry}</p>
                </div>
              )}
            </div>
          </div>

          {/* Last Email */}
          {job.lastEmail && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Last Email</h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-600">
                    From: {job.lastEmail.fromName} ({job.lastEmail.fromEmail})
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{job.lastEmail.subject}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{new Date(job.lastEmail.receivedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-700">{job.lastEmail.snippet}</p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Notes</h3>
            <Textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add your notes about this job application..."
              className="min-h-[120px] resize-none"
            />
          </div>
        </div>
      </div>
    </>
  )
}

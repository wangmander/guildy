"use client"

import type { Job } from "@/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { ExternalLink, Calendar, Mail, MapPin, User, Target, HelpCircle, Lightbulb } from 'lucide-react'

interface JobDetailPanelProps {
  job: Job | null
  onSaveNotes: (jobId: string, notes: string) => void
}

export function JobDetailPanel({ job, onSaveNotes }: JobDetailPanelProps) {
  const [notes, setNotes] = useState(job?.notes || "")
  const [isEditing, setIsEditing] = useState(false)

  if (!job) {
    return (
      <div className="bg-white m-6 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg font-medium">Select a job to view details</p>
            <p className="text-sm">Choose a pipeline from the left to see more information</p>
          </div>
        </div>
      </div>
    )
  }

  const handleSaveNotes = () => {
    onSaveNotes(job.id, notes)
    setIsEditing(false)
  }

  return (
    <div className="bg-white m-6 rounded-lg shadow-sm p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-lg font-medium">
            {job.company.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{job.company.name}</h1>
            <p className="text-lg text-gray-600">{job.title}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {job.location}
              </div>
              <div>{job.industry}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Badge variant="secondary">{job.stage.replace("_", " ")}</Badge>
          <Badge variant={job.status === "SCHEDULED" ? "default" : "outline"}>{job.status.replace("_", " ")}</Badge>
        </div>
      </div>

      {/* Interview Prep */}
      {job.interviewPrep && (
        <Card className="p-4 mb-6 bg-purple-50 border-purple-200">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-purple-900 text-lg">Interview Preparation</span>
          </div>

          {/* Interviewer Profile */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-purple-900">Your Interviewer</span>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <h4 className="font-semibold text-gray-900 text-lg">{job.interviewPrep.interviewer.name}</h4>
              <p className="text-sm text-purple-700 font-medium mb-3">{job.interviewPrep.interviewer.role}</p>
              <p className="text-sm text-gray-700 mb-4">{job.interviewPrep.interviewer.bio}</p>

              <div className="mb-3">
                <p className="text-sm font-semibold text-gray-900 mb-2">Interview Goals:</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  {job.interviewPrep.interviewer.goals.map((goal, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-purple-500 mt-1 font-bold">•</span>
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Sample Questions */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-purple-900">Likely Questions</span>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <ul className="text-sm text-gray-700 space-y-3">
                {job.interviewPrep.sampleQuestions.map((question, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-purple-600 font-semibold mt-0.5 text-xs bg-purple-100 rounded-full w-5 h-5 flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="font-medium">{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tips */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-purple-900">Preparation Tips</span>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <ul className="text-sm text-gray-700 space-y-2">
                {job.interviewPrep.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1 font-bold">•</span>
                    <span className="font-medium">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Scheduled Meeting */}
      {job.scheduledMeeting && (
        <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-900">Upcoming Meeting</span>
          </div>
          <p className="text-sm text-blue-800 mb-2">{job.scheduledMeeting.type}</p>
          <p className="text-sm text-blue-700 mb-3">
            {new Date(job.scheduledMeeting.date).toLocaleString()} ({job.scheduledMeeting.duration} min)
          </p>
          <Button size="sm" variant="outline" asChild>
            <a href={job.scheduledMeeting.meetingLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" />
              Join Meeting
            </a>
          </Button>
        </Card>
      )}

      {/* Last Email */}
      {job.lastEmail && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-4 h-4 text-gray-600" />
            <span className="font-medium">Last Email</span>
          </div>
          <p className="text-sm font-medium text-gray-900 mb-1">{job.lastEmail.subject}</p>
          <p className="text-sm text-gray-600 mb-2">
            From: {job.lastEmail.fromName} ({job.lastEmail.fromEmail})
          </p>
          <p className="text-sm text-gray-700 mb-2">{job.lastEmail.snippet}</p>
          <p className="text-xs text-gray-500">{new Date(job.lastEmail.receivedAt).toLocaleString()}</p>
        </Card>
      )}

      {/* Job Details */}
      <Card className="p-4 mb-6">
        <h3 className="font-medium mb-3">Job Details</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Applied:</span>
            <span>{new Date(job.appliedAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Next ETA:</span>
            <span>{job.nextEtaText}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Job Type:</span>
            <span>{job.jobType}</span>
          </div>
        </div>
        <Button size="sm" variant="outline" className="mt-3 bg-transparent" asChild>
          <a href={job.postingUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3 h-3 mr-1" />
            View Job Posting
          </a>
        </Button>
      </Card>

      {/* Notes */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Notes</h3>
          {!isEditing ? (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveNotes}>
                Save
              </Button>
            </div>
          )}
        </div>
        {isEditing ? (
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add your notes about this job..."
            className="min-h-[100px]"
          />
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.notes || "No notes added yet."}</p>
        )}
      </Card>
    </div>
  )
}

"use client"

import type { Job } from "@/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { ExternalLink, Calendar, Mail, MapPin, User, Target, HelpCircle, Lightbulb, TrendingUp, Building2, Clock, Briefcase } from 'lucide-react'

interface JobDetailPanelProps {
  job: Job | null
  onSaveNotes: (jobId: string, notes: string) => void
  isMobile?: boolean
}

export function JobDetailPanel({ job, onSaveNotes, isMobile = false }: JobDetailPanelProps) {
  const [notes, setNotes] = useState(job?.notes || "")
  const [isEditing, setIsEditing] = useState(false)

  if (!job) {
    return (
      <div className="px-4 py-6">
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

  const containerClass = "px-4 py-4"
  const cardClass = "p-4 mb-4"

  return (
    <div className={containerClass}>
      <div className="mb-4">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-lg font-medium flex-shrink-0">
            {job.company.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
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

        <div className="flex gap-2 mb-4">
          <Badge variant="secondary">{job.stage.replace("_", " ")}</Badge>
          <Badge variant={job.status === "SCHEDULED" ? "default" : "outline"}>{job.status.replace("_", " ")}</Badge>
        </div>

        {/* Next Action Banner */}
        <div className="bg-[#3B5CCC]/10 border border-[#3B5CCC]/20 rounded-lg p-3">
          <p className="text-sm font-medium text-[#3B5CCC]">
            <span className="font-semibold">Next Action:</span>{" "}
            {job.scheduledMeeting 
              ? `Prepare for ${job.scheduledMeeting.type} on ${new Date(job.scheduledMeeting.date).toLocaleDateString()}`
              : job.status === "FEEDBACK_PENDING"
              ? "Follow up on interview feedback"
              : "Review job requirements and prepare application materials"}
          </p>
        </div>
      </div>

      {job.scheduledMeeting && (
        <Card className={`${cardClass} bg-blue-50 border-blue-200`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Upcoming Meeting</span>
            </div>
            <Badge variant="outline" className="bg-white text-blue-700 border-blue-300">
              {job.scheduledMeeting.duration} min
            </Badge>
          </div>
          <p className="text-base font-medium text-blue-900 mb-2">{job.scheduledMeeting.type}</p>
          <div className="flex items-center gap-2 text-sm text-blue-700 mb-3">
            <Clock className="w-4 h-4" />
            {new Date(job.scheduledMeeting.date).toLocaleString()}
          </div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
            <a href={job.scheduledMeeting.meetingLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" />
              Join Meeting
            </a>
          </Button>
        </Card>
      )}

      {job.lastEmail && (
        <Card className={cardClass}>
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-gray-600" />
            <span className="font-semibold">Last Email</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">{job.lastEmail.subject}</p>
          <p className="text-sm text-gray-600 mb-2">
            From: {job.lastEmail.fromName} <span className="text-gray-400">({job.lastEmail.fromEmail})</span>
          </p>
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">{job.lastEmail.snippet}</p>
          <p className="text-xs text-gray-500 mb-3">{new Date(job.lastEmail.receivedAt).toLocaleString()}</p>
          
          {/* Email Insights */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Tone:</span>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Positive</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Response Likelihood:</span>
              <span className="font-medium text-gray-900">High</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Urgency:</span>
              <span className="font-medium text-orange-600">Reply by Monday</span>
            </div>
          </div>
        </Card>
      )}

      {job.interviewPrep && (
        <Card className={`${cardClass} bg-purple-50 border-purple-200`}>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-purple-900 text-lg">Interview Preparation</span>
          </div>

          {/* Prep Focus Summary */}
          <div className="bg-purple-100 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-purple-900">
              <span className="font-semibold">Prep Focus:</span> For {job.scheduledMeeting?.type || "this stage"}, 
              emphasize communication clarity and showcase relevant portfolio work.
            </p>
          </div>

          {/* Interviewer Profile */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-purple-900">Your Interviewer</span>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <h4 className="font-semibold text-gray-900 text-base">{job.interviewPrep.interviewer.name}</h4>
              <p className="text-sm text-purple-700 font-medium mb-2">{job.interviewPrep.interviewer.role}</p>
              <p className="text-sm text-gray-700 mb-3 leading-relaxed">{job.interviewPrep.interviewer.bio}</p>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">What they're looking for:</p>
                <ul className="text-sm text-gray-700 space-y-1.5">
                  {job.interviewPrep.interviewer.goals.map((goal, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-purple-500 mt-0.5">•</span>
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
              <span className="font-medium text-purple-900">Example Questions</span>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100 space-y-3">
              {job.interviewPrep.sampleQuestions.map((question, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-purple-600 font-semibold text-xs bg-purple-100 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-700">{question}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Tip */}
          <div className="bg-purple-100 rounded-lg p-3 mb-4">
            <p className="text-sm italic text-purple-900">
              <span className="font-semibold not-italic">AI Tip:</span> Your past responses may sound generic—personalize 
              with a specific example from your recent project work.
            </p>
          </div>

          {/* Tips */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-purple-900">What to Emphasize</span>
            </div>
            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <ul className="text-sm text-gray-700 space-y-2">
                {job.interviewPrep.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-gray-600" />
          <span className="font-semibold">Company Intel</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Industry</p>
            <p className="text-sm font-medium text-gray-900">{job.industry}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Size</p>
            <p className="text-sm font-medium text-gray-900">500-1000 employees</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">HQ Location</p>
            <p className="text-sm font-medium text-gray-900">{job.location}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Design Team</p>
            <p className="text-sm font-medium text-gray-900">15-20 people</p>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 mb-3">
          <p className="text-xs font-semibold text-blue-900 mb-1">Recent News</p>
          <p className="text-sm text-blue-800">Series B funding announced - $50M raised for product expansion</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-900 mb-2">Common Interview Topics</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">Product thinking</Badge>
            <Badge variant="outline" className="text-xs">Collaboration</Badge>
            <Badge variant="outline" className="text-xs">User research</Badge>
            <Badge variant="outline" className="text-xs">Design systems</Badge>
          </div>
        </div>
      </Card>

      <Card className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          <span className="font-semibold">Timeline Overview</span>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-20 text-xs text-gray-500">Applied</div>
            <div className="flex-1 h-2 bg-[#3B5CCC] rounded-full"></div>
            <div className="w-12 text-xs text-gray-600 text-right">Day 0</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 text-xs text-gray-500">Recruiter</div>
            <div className="flex-1 h-2 bg-[#3B5CCC] rounded-full"></div>
            <div className="w-12 text-xs text-gray-600 text-right">Day 3</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 text-xs text-gray-500">Interview</div>
            <div className="flex-1 h-2 bg-[#3B5CCC]/40 rounded-full"></div>
            <div className="w-12 text-xs text-gray-600 text-right">Day 8</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 text-xs text-gray-500">Offer</div>
            <div className="flex-1 h-2 bg-gray-200 rounded-full"></div>
            <div className="w-12 text-xs text-gray-400 text-right">TBD</div>
          </div>
        </div>

        <p className="text-xs text-gray-600 mt-3 italic">
          Response time is 1 day faster than average for this stage
        </p>
      </Card>

      <Card className={cardClass}>
        <details className="mb-3">
          <summary className="font-semibold cursor-pointer flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-gray-600" />
            Job Details
          </summary>
          <div className="mt-3 space-y-2 text-sm pl-6">
            <div className="flex justify-between">
              <span className="text-gray-600">Applied:</span>
              <span>{new Date(job.appliedAt || Date.now()).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Next ETA:</span>
              <span>{job.nextEtaText}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Job Type:</span>
              <span>{job.jobType}</span>
            </div>
            <Button size="sm" variant="outline" className="mt-2 w-full" asChild>
              <a href={job.postingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 mr-1" />
                View Job Posting
              </a>
            </Button>
          </div>
        </details>

        <details>
          <summary className="font-semibold cursor-pointer">Notes</summary>
          <div className="mt-3 pl-6">
            {!isEditing ? (
              <>
                <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{job.notes || "No notes added yet."}</p>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit Notes
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add your notes about this job..."
                  className="min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveNotes}>
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        </details>
      </Card>
    </div>
  )
}

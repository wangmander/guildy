"use client"

import type { Job } from "@/types"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import {
  ExternalLink,
  Calendar,
  Mail,
  MapPin,
  User,
  Target,
  HelpCircle,
  Lightbulb,
  Building2,
  Clock,
  Briefcase,
  MessageCircle,
  BookOpen,
  Star,
  Activity,
} from "lucide-react"

interface JobDetailPanelProps {
  job: Job | null
  onSaveNotes: (jobId: string, notes: string) => void
  isMobile?: boolean
  idPrefix?: string
}

export function JobDetailPanel({ job, onSaveNotes, isMobile = false, idPrefix = "desktop" }: JobDetailPanelProps) {
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

  const containerClass = "px-4 py-3"
  const cardClass = "p-3 mb-3"

  return (
    <div className={containerClass}>
      <div className="mb-3">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl font-medium flex-shrink-0">
            {job.company.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-3xl font-bold text-gray-900">{job.company.name}</h1>
            <p className="text-xl text-gray-600">{job.title}</p>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {job.location}
              </div>
              <div>{job.industry}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <Badge variant="secondary">{job.stage.replace("_", " ")}</Badge>
          <Badge variant={job.status === "SCHEDULED" ? "default" : "outline"}>{job.status.replace("_", " ")}</Badge>
        </div>

        {/* Next Action Banner */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
          <p className="text-sm font-medium text-orange-800">
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Upcoming Meeting</span>
            </div>
            <Badge variant="outline" className="bg-white text-blue-700 border-blue-300">
              {job.scheduledMeeting.duration} min
            </Badge>
          </div>
          <p className="text-base font-medium text-blue-900 mb-1">{job.scheduledMeeting.type}</p>
          <div className="flex items-center gap-2 text-sm text-blue-700 mb-2">
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
          <div className="flex items-center gap-2 mb-2">
            {/* Changed Last Email icon color from pink to green */}
            <Mail className="w-5 h-5 text-green-600" />
            <span className="font-semibold">Last Email</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-0.5">{job.lastEmail.subject}</p>
          <p className="text-sm text-gray-600 mb-1">
            From: {job.lastEmail.fromName} <span className="text-gray-400">({job.lastEmail.fromEmail})</span>
          </p>
          <p className="text-sm text-gray-700 mb-2 leading-relaxed">{job.lastEmail.snippet}</p>
          <p className="text-xs text-gray-500 mb-2">{new Date(job.lastEmail.receivedAt).toLocaleString()}</p>

          {/* Email Insights */}
          <div className="bg-gray-50 rounded-lg p-2 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Tone:</span>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Positive
              </Badge>
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
        <Card id={`${idPrefix}-interview-prep`} className={`${cardClass} bg-violet-50 border-violet-200`}>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-violet-600" />
            <span className="font-semibold text-violet-900 text-lg">Interview Preparation</span>
          </div>

          {/* Prep Focus Summary */}
          <div className="bg-violet-100 rounded-lg p-2 mb-3">
            <p className="text-sm font-medium text-violet-900">
              <span className="font-semibold">Prep Focus:</span> For {job.scheduledMeeting?.type || "this stage"},
              emphasize communication clarity and showcase relevant portfolio work.
            </p>
          </div>

          {/* Interviewer Profile */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-violet-600" />
              <span className="font-medium text-violet-900">Your Interviewer</span>
            </div>
            <div className="bg-white rounded-lg p-3 border border-violet-100">
              <h4 className="font-semibold text-gray-900 text-base">{job.interviewPrep.interviewer.name}</h4>
              <p className="text-sm text-violet-700 font-medium mb-1">{job.interviewPrep.interviewer.role}</p>
              <p className="text-sm text-gray-700 mb-2 leading-relaxed">{job.interviewPrep.interviewer.bio}</p>

              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">What they're looking for:</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  {job.interviewPrep.interviewer.goals.map((goal, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-violet-500 mt-0.5">•</span>
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Sample Questions */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="w-4 h-4 text-violet-600" />
              <span className="font-medium text-violet-900">Example Questions</span>
            </div>
            <div className="bg-white rounded-lg p-3 border border-violet-100 space-y-2">
              {job.interviewPrep.sampleQuestions.map((question, index) => (
                <div key={index} className="flex items-start gap-3">
                  <span className="text-violet-600 font-semibold text-xs bg-violet-100 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span className="text-sm text-gray-700">{question}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Tip */}
          <div className="bg-violet-100 rounded-lg p-2 mb-3">
            <p className="text-sm italic text-violet-900">
              <span className="font-semibold not-italic">AI Tip:</span> Your past responses may sound
              generic—personalize with a specific example from your recent project work.
            </p>
          </div>

          {/* Tips */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-violet-600" />
              <span className="font-medium text-violet-900">What to Emphasize</span>
            </div>
            <div className="bg-white rounded-lg p-3 border border-violet-100">
              <ul className="text-sm text-gray-700 space-y-1">
                {job.interviewPrep.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-violet-500 mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card id={`${idPrefix}-interview-questions`} className={cardClass}>
        <div className="flex items-center gap-2 mb-2">
          {/* Changed Interview Prep icon color from rose to purple */}
          <BookOpen className="w-5 h-5 text-purple-600" />
          <div>
            <h3 className="font-semibold text-base">Interview Prep</h3>
            <p className="text-sm text-gray-600">Prepare with focus for your next conversation.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {/* Questions They Might Ask You */}
          {/* Changed background and border colors from rose to purple */}
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
            <div className="flex items-center gap-2 mb-2">
              {/* Changed icon color from rose to purple */}
              <HelpCircle className="w-4 h-4 text-purple-600" />
              <h4 className="font-semibold text-sm text-gray-900">Questions They Might Ask You</h4>
            </div>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-gray-700">
                {/* Changed bullet color from rose to purple */}
                <span className="text-purple-600 font-semibold mt-0.5">•</span>
                <span>Walk me through a project where you improved reliability.</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                {/* Changed bullet color from rose to purple */}
                <span className="text-purple-600 font-semibold mt-0.5">•</span>
                <span>How do you collaborate with product and design teams?</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                {/* Changed bullet color from rose to purple */}
                <span className="text-purple-600 font-semibold mt-0.5">•</span>
                <span>Describe a time you managed infrastructure scaling challenges.</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                {/* Changed bullet color from rose to purple */}
                <span className="text-purple-600 font-semibold mt-0.5">•</span>
                <span>What's your approach to monitoring and incident response?</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                {/* Changed bullet color from rose to purple */}
                <span className="text-purple-600 font-semibold mt-0.5">•</span>
                <span>How do you prioritize technical debt vs new features?</span>
              </li>
            </ul>
          </div>

          {/* Questions You Should Ask Them */}
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-amber-600" />
              <h4 className="font-semibold text-sm text-gray-900">Questions You Should Ask Them</h4>
            </div>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-amber-600 font-semibold mt-0.5">•</span>
                <span>What does success look like in this role after 90 days?</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-amber-600 font-semibold mt-0.5">•</span>
                <span>How does the team measure operational excellence?</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-amber-600 font-semibold mt-0.5">•</span>
                <span>What are the current challenges the infrastructure team faces?</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-amber-600 font-semibold mt-0.5">•</span>
                <span>How does this role contribute to the company's technical roadmap?</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-amber-600 font-semibold mt-0.5">•</span>
                <span>What's the team's approach to professional development?</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Optional: Future "Generate More" placeholder */}
        <div className="mt-3 pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500 italic">
            💡 Tip: Practice answering these questions out loud to build confidence before your interview.
          </p>
        </div>
      </Card>

      <Card id={`${idPrefix}-company-intel`} className={cardClass}>
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-yellow-600" />
          <span className="font-semibold">Company Intel</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Industry</p>
            <p className="text-sm font-medium text-gray-900">{job.industry}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Size</p>
            <p className="text-sm font-medium text-gray-900">500-1000 employees</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">HQ Location</p>
            <p className="text-sm font-medium text-gray-900">{job.location}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Glassdoor Rating</p>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-gray-900">{job.company.glassdoorRating || "N/A"}</span>
              {job.company.glassdoorRating && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />}
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-2 mb-2">
          <p className="text-xs font-semibold text-yellow-900 mb-0.5">Recent News</p>
          {job.recentNews && job.recentNews.length > 0 ? (
            job.recentNews.map((news, index) => (
              <a
                key={index}
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-yellow-800 hover:underline hover:text-yellow-900 mb-1 last:mb-0"
              >
                {news.title} <ExternalLink className="inline w-3 h-3 ml-0.5" />
              </a>
            ))
          ) : (
            <p className="text-sm text-yellow-800">No recent news available.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-900 mb-1">Common Interview Topics</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs border-yellow-200 bg-yellow-50 text-yellow-800">
              Product thinking
            </Badge>
            <Badge variant="outline" className="text-xs border-yellow-200 bg-yellow-50 text-yellow-800">
              Collaboration
            </Badge>
            <Badge variant="outline" className="text-xs border-yellow-200 bg-yellow-50 text-yellow-800">
              User research
            </Badge>
            <Badge variant="outline" className="text-xs border-yellow-200 bg-yellow-50 text-yellow-800">
              Design systems
            </Badge>
          </div>
        </div>
      </Card>

      <Card className={cardClass}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-gray-900" />
          <span className="font-semibold text-lg">Timeline Overview</span>
        </div>

        <div className="space-y-4 mb-6">
          {/* Applied */}
          <div className="flex items-center gap-4">
            <span className="w-20 text-sm text-gray-500">Applied</span>
            <div className="flex-1 h-2.5 bg-blue-600 rounded-full" />
            <span className="w-12 text-right text-sm text-gray-500">Day 0</span>
          </div>

          {/* Recruiter */}
          <div className="flex items-center gap-4">
            <span className="w-20 text-sm text-gray-500">Recruiter</span>
            <div className="flex-1 h-2.5 bg-blue-600 rounded-full" />
            <span className="w-12 text-right text-sm text-gray-500">Day 3</span>
          </div>

          {/* Interview */}
          <div className="flex items-center gap-4">
            <span className="w-20 text-sm text-gray-500">Interview</span>
            <div className="flex-1 h-2.5 bg-blue-200 rounded-full" />
            <span className="w-12 text-right text-sm text-gray-500">Day 8</span>
          </div>

          {/* Offer */}
          <div className="flex items-center gap-4">
            <span className="w-20 text-sm text-gray-500">Offer</span>
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full" />
            <span className="w-12 text-right text-sm text-gray-400">TBD</span>
          </div>
        </div>

        <p className="text-sm text-gray-600 italic">Response time is 1 day faster than average for this stage</p>
      </Card>

      <Card className={cardClass}>
        <details className="mb-2">
          <summary className="font-semibold cursor-pointer flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            Job Details
          </summary>
          <div className="mt-2 space-y-1 text-sm pl-6">
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
            <Button size="sm" variant="outline" className="mt-2 w-full bg-transparent" asChild>
              <a href={job.postingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 mr-1" />
                View Job Posting
              </a>
            </Button>
          </div>
        </details>

        <details>
          <summary className="font-semibold cursor-pointer">Notes</summary>
          <div className="mt-2 pl-6">
            {!isEditing ? (
              <>
                <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{job.notes || "No notes added yet."}</p>
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

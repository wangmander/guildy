"use client"

import type { Job } from "@/types"
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

const cardStyle = {
  backgroundColor: "white",
  borderRadius: "12px",
  padding: "16px",
  marginBottom: "16px",
  border: "1px solid #E5E7EB",
  boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)"
}

const badgeStyle = {
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: "500",
  marginRight: "8px"
}

export function JobDetailPanel({ job, onSaveNotes, isMobile = false, idPrefix = "desktop" }: JobDetailPanelProps) {
  const [notes, setNotes] = useState(job?.notes || "")
  const [isEditing, setIsEditing] = useState(false)

  if (!job) {
    return (
      <div style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
          <div style={{ textAlign: "center", color: "#6B7280" }}>
            <p style={{ fontSize: "18px", fontWeight: "500", marginBottom: "8px" }}>Select a job to view details</p>
            <p style={{ fontSize: "14px" }}>Choose a pipeline from the left to see more information</p>
          </div>
        </div>
      </div>
    )
  }

  const handleSaveNotes = () => {
    onSaveNotes(job.id, notes)
    setIsEditing(false)
  }

  const companyName = typeof job.company === 'string' ? job.company : job.company?.name || 'Unknown Company'
  const companyInitial = companyName.charAt(0).toUpperCase()
  const jobTitle = job.role || job.title || 'Role'
  const jobLocation = job.location || 'Location not specified'
  const jobIndustry = job.industry || 'Industry not specified'
  const glassdoorRating = typeof job.company === 'object' ? job.company?.glassdoorRating : null

  return (
    <div style={{ padding: "16px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
          <div style={{
            width: "64px",
            height: "64px",
            backgroundColor: "#F3F4F6",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            fontWeight: "500",
            flexShrink: 0
          }}>
            {companyInitial}
          </div>
          <div style={{ flex: 1, paddingTop: "4px" }}>
            <h1 style={{ fontSize: "30px", fontWeight: "700", color: "#111827", marginBottom: "4px" }}>
              {companyName}
            </h1>
            <p style={{ fontSize: "20px", color: "#4B5563", marginBottom: "4px" }}>{jobTitle}</p>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "14px", color: "#6B7280" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <MapPin style={{ width: "16px", height: "16px" }} />
                {jobLocation}
              </div>
              <div>{jobIndustry}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <span style={{ ...badgeStyle, backgroundColor: "#F3F4F6", color: "#374151" }}>
            {job.stage.replace("_", " ")}
          </span>
          <span style={{ ...badgeStyle, backgroundColor: "#DBEAFE", color: "#1E40AF", border: "1px solid #BFDBFE" }}>
            {job.status?.replace("_", " ") || "ACTIVE"}
          </span>
        </div>

        <div style={{ 
          backgroundColor: "#FEF3C7", 
          border: "1px solid #FCD34D", 
          borderRadius: "8px", 
          padding: "12px" 
        }}>
          <p style={{ fontSize: "14px", fontWeight: "500", color: "#92400E" }}>
            <span style={{ fontWeight: "600" }}>Next Action:</span>{" "}
            {job.scheduledMeeting
              ? `Prepare for ${job.scheduledMeeting.type} on ${new Date(job.scheduledMeeting.date).toLocaleDateString()}`
              : job.status === "FEEDBACK_PENDING"
                ? "Follow up on interview feedback"
                : "Review job requirements and prepare application materials"}
          </p>
        </div>
      </div>

      {/* Interview Prep Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <BookOpen style={{ width: "20px", height: "20px", color: "#9333EA" }} />
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "600" }}>Interview Prep</h3>
            <p style={{ fontSize: "14px", color: "#6B7280" }}>Prepare with focus for your next conversation.</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* Questions They Might Ask */}
          <div style={{
            backgroundColor: "#F5F3FF",
            borderRadius: "8px",
            padding: "12px",
            border: "1px solid #E9D5FF"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <HelpCircle style={{ width: "16px", height: "16px", color: "#9333EA" }} />
              <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>
                Questions They Might Ask You
              </h4>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {[
                "Walk me through a project where you improved reliability.",
                "How do you collaborate with product and design teams?",
                "Describe a time you managed infrastructure scaling challenges.",
                "What's your approach to monitoring and incident response?",
                "How do you prioritize technical debt vs new features?"
              ].map((q, i) => (
                <li key={i} style={{ 
                  display: "flex", 
                  gap: "8px", 
                  fontSize: "14px", 
                  color: "#374151",
                  marginBottom: "8px"
                }}>
                  <span style={{ color: "#9333EA", fontWeight: "600" }}>•</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Questions You Should Ask */}
          <div style={{
            backgroundColor: "#FEF3C7",
            borderRadius: "8px",
            padding: "12px",
            border: "1px solid #FDE68A"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <MessageCircle style={{ width: "16px", height: "16px", color: "#D97706" }} />
              <h4 style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>
                Questions You Should Ask Them
              </h4>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {[
                "What does success look like in this role after 90 days?",
                "How does the team measure operational excellence?",
                "What are the current challenges the infrastructure team faces?",
                "How does this role contribute to the company's technical roadmap?",
                "What's the team's approach to professional development?"
              ].map((q, i) => (
                <li key={i} style={{ 
                  display: "flex", 
                  gap: "8px", 
                  fontSize: "14px", 
                  color: "#374151",
                  marginBottom: "8px"
                }}>
                  <span style={{ color: "#D97706", fontWeight: "600" }}>•</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid #E5E7EB"
        }}>
          <p style={{ fontSize: "12px", color: "#6B7280", fontStyle: "italic" }}>
            💡 Tip: Practice answering these questions out loud to build confidence before your interview.
          </p>
        </div>
      </div>

      {/* Company Intel Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Building2 style={{ width: "20px", height: "20px", color: "#EAB308" }} />
          <span style={{ fontWeight: "600" }}>Company Intel</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <div>
            <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "2px" }}>Industry</p>
            <p style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>{jobIndustry}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "2px" }}>Size</p>
            <p style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>500-1000 employees</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "2px" }}>HQ Location</p>
            <p style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>{jobLocation}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#6B7280", marginBottom: "2px" }}>Glassdoor Rating</p>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#111827" }}>
                {glassdoorRating || "N/A"}
              </span>
              {glassdoorRating && <Star style={{ width: "12px", height: "12px", fill: "#FBBF24", color: "#FBBF24" }} />}
            </div>
          </div>
        </div>

        <div style={{ 
          backgroundColor: "#FEF3C7", 
          borderRadius: "8px", 
          padding: "8px", 
          marginBottom: "8px" 
        }}>
          <p style={{ fontSize: "12px", fontWeight: "600", color: "#78350F", marginBottom: "4px" }}>
            Recent News
          </p>
          <p style={{ fontSize: "14px", color: "#92400E" }}>No recent news available.</p>
        </div>

        <div>
          <p style={{ fontSize: "12px", fontWeight: "600", color: "#111827", marginBottom: "4px" }}>
            Common Interview Topics
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {["Product thinking", "Collaboration", "User research", "Design systems"].map(topic => (
              <span key={topic} style={{
                ...badgeStyle,
                margin: 0,
                backgroundColor: "#FEF3C7",
                color: "#92400E",
                border: "1px solid #FDE68A"
              }}>
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Activity style={{ width: "20px", height: "20px", color: "#111827" }} />
          <span style={{ fontWeight: "600", fontSize: "18px" }}>Timeline Overview</span>
        </div>

        <div style={{ marginBottom: "24px" }}>
          {[
            { label: "Applied", progress: 100, day: "Day 0", color: "#2563EB" },
            { label: "Recruiter", progress: 100, day: "Day 3", color: "#2563EB" },
            { label: "Interview", progress: 50, day: "Day 8", color: "#BFDBFE" },
            { label: "Offer", progress: 0, day: "TBD", color: "#F3F4F6" }
          ].map(stage => (
            <div key={stage.label} style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "16px",
              marginBottom: "16px"
            }}>
              <span style={{ width: "80px", fontSize: "14px", color: "#6B7280" }}>{stage.label}</span>
              <div style={{ 
                flex: 1, 
                height: "10px", 
                backgroundColor: stage.color, 
                borderRadius: "9999px" 
              }} />
              <span style={{ 
                width: "48px", 
                textAlign: "right", 
                fontSize: "14px", 
                color: stage.progress === 0 ? "#9CA3AF" : "#6B7280" 
              }}>
                {stage.day}
              </span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: "14px", color: "#6B7280", fontStyle: "italic" }}>
          Response time is 1 day faster than average for this stage
        </p>
      </div>

      {/* Notes Card */}
      <div style={cardStyle}>
        <details style={{ marginBottom: "8px" }}>
          <summary style={{ 
            fontWeight: "600", 
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <Briefcase style={{ width: "16px", height: "16px", color: "#6366F1" }} />
            Job Details
          </summary>
          <div style={{ marginTop: "8px", paddingLeft: "24px", fontSize: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#6B7280" }}>Applied:</span>
              <span>{new Date(job.appliedAt || Date.now()).toLocaleDateString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#6B7280" }}>Next ETA:</span>
              <span>{job.nextEtaText || "TBD"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ color: "#6B7280" }}>Job Type:</span>
              <span>{job.jobType || "Full-time"}</span>
            </div>
            {job.postingUrl && (
              <Button size="sm" variant="outline" style={{ width: "100%", marginTop: "8px" }} asChild>
                <a href={job.postingUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink style={{ width: "12px", height: "12px", marginRight: "4px" }} />
                  View Job Posting
                </a>
              </Button>
            )}
          </div>
        </details>

        <details>
          <summary style={{ fontWeight: "600", cursor: "pointer" }}>Notes</summary>
          <div style={{ marginTop: "8px", paddingLeft: "24px" }}>
            {!isEditing ? (
              <>
                <p style={{ fontSize: "14px", color: "#374151", marginBottom: "8px", whiteSpace: "pre-wrap" }}>
                  {job.notes || "No notes added yet."}
                </p>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  Edit Notes
                </Button>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add your notes about this job..."
                  style={{ minHeight: "100px" }}
                />
                <div style={{ display: "flex", gap: "8px" }}>
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
      </div>
    </div>
  )
}

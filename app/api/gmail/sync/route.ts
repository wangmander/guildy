import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { google } from "googleapis"
import { createClient } from "@supabase/supabase-js"
import OpenAI from "openai"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

// ============================================================
// INSTANT REJECT PATTERNS - Marketing/Transactional/Support
// ============================================================
const INSTANT_REJECT_PATTERNS: string[] = [
  // Support/Tickets
  "support ticket", "ticket number", "ticket #", "ticket id", "case number",
  "customer support", "customer service", "support team", "support request",
  "help desk", "helpdesk", "technical support",
  
  // Billing/Payments
  "billing", "billing update", "billing statement", "billing issue",
  "payment due", "payment received", "payment confirmation", "payment failed",
  "your invoice", "invoice #", "amount due", "past due",
  
  // Upgrades/Subscriptions
  "upgrade your", "upgrade now", "upgrade to", "upgrade plan", "downgrade",
  "subscription", "your subscription", "renew your", "trial ending", "trial expired",
  "plan expires", "renew now",
  
  // Orders/Shipping
  "your order", "order status", "order update", "order confirmation",
  "order shipped", "has been shipped", "tracking number", "track your order",
  "shipment notification", "shipping confirmation", "shipping update",
  "out for delivery", "was delivered", "has been delivered", "your package",
  
  // Receipts
  "your receipt", "order receipt", "payment receipt", "purchase confirmation",
  
  // Marketing/Promotions
  "special offer", "exclusive offer", "limited offer", "offer expires",
  "offer ends", "claim your offer", "redeem offer", "offer code",
  "limited time", "deal of the day", "flash sale", "act now",
  "% off", "percent off", "discount code", "promo code", "coupon code",
  "shop now", "buy now", "order now", "sale ends", "don't miss out",
  "free shipping", "black friday", "cyber monday", "clearance",
  "save up to", "biggest sale", "exclusive access",
  
  // Unsubscribe
  "unsubscribe", "email preferences", "manage your preferences",
  "manage preferences", "update preferences", "opt out", "opt-out",
  "stop receiving", "remove from list",
  
  // Security/Account
  "verification code", "verify your email", "confirm your email",
  "one-time password", "your otp", "security code", "security alert",
  "password reset", "reset your password", "new sign-in", "login attempt",
  "two-factor", "2fa", "suspicious activity",
  
  // Banking/Financial (non-job)
  "your statement", "account statement", "bank statement", "your bill",
  "bill is ready", "minimum payment", "auto-pay", "account balance",
  "apy", "cashback", "reward points", "credit score", "credit limit",
  
  // Entertainment/Social
  "now streaming", "new episode", "watch now", "your playlist",
  "friend request", "tagged you", "mentioned you", "new follower",
  "liked your", "commented on", "new message from",
  
  // Food/Travel
  "your order is on the way", "your driver", "food delivery",
  "flight confirmation", "hotel reservation", "boarding pass",
  "reservation confirmed", "itinerary",
  
  // Returns
  "return request", "refund processed", "return label",
  
  // Newsletters
  "newsletter", "weekly digest", "daily digest", "weekly roundup",
  "monthly update", "news roundup", "weekly newsletter",
  
  // Product companies
  "supabase", "vercel", "github", "notion", "slack", "figma",
  "linear", "stripe", "twilio", "firebase", "heroku", "netlify",
  "aws", "azure", "digitalocean", "cloudflare",
]

// ============================================================
// BLOCKED SENDER PATTERNS
// ============================================================
const BLOCKED_SENDER_PATTERNS: string[] = [
  "noreply@", "no-reply@", "donotreply@", "do-not-reply@",
  "notifications@", "notification@", "updates@", "update@",
  "marketing@", "promo@", "promotions@", "deals@", "offers@",
  "newsletter@", "news@", "info@", "hello@",
  "support@", "help@", "helpdesk@", "customerservice@",
  "billing@", "invoice@", "invoices@", "payments@",
  "orders@", "order@", "shipping@", "delivery@", "tracking@",
  "alerts@", "alert@", "mailer@", "mail@",
  "automated@", "auto@", "system@", "transactional@",
  "sendgrid.", "mailchimp.", "mailgun.", "amazonses.",
  "postmark.", "mandrill.", "sparkpost.", "mailjet.",
  "constantcontact.", "hubspot.", "marketo.",
  "messaging.", "email.", "engage.", "campaigns.",
  "bounce.", "reply.", "mailer-daemon",
]

// ============================================================
// POSITIVE RECRUITING PHRASES - 150+ signals
// ============================================================
const PHRASE_WEIGHTS: Array<{ phrase: string; w: number }> = [
  // === TIER 1: VERY HIGH (10) ===
  { phrase: "interview request", w: 10 },
  { phrase: "interview invitation", w: 10 },
  { phrase: "invite you to interview", w: 10 },
  { phrase: "schedule an interview", w: 10 },
  { phrase: "interview confirmation", w: 10 },
  { phrase: "your application", w: 10 },
  { phrase: "application status", w: 10 },
  { phrase: "reviewing your application", w: 10 },
  { phrase: "received your application", w: 10 },
  { phrase: "thanks for applying", w: 10 },
  { phrase: "thank you for applying", w: 10 },
  { phrase: "your candidacy", w: 10 },
  { phrase: "not moving forward", w: 10 },
  { phrase: "move forward with other candidates", w: 10 },
  { phrase: "regret to inform", w: 10 },
  
  // === TIER 2: HIGH (8-9) ===
  { phrase: "interview", w: 8 },
  { phrase: "interviewing", w: 8 },
  { phrase: "phone screen", w: 9 },
  { phrase: "screening call", w: 9 },
  { phrase: "recruiter screen", w: 9 },
  { phrase: "recruiter call", w: 8 },
  { phrase: "technical screen", w: 9 },
  { phrase: "technical interview", w: 9 },
  { phrase: "hiring manager", w: 9 },
  { phrase: "hiring manager interview", w: 9 },
  { phrase: "talent acquisition", w: 8 },
  { phrase: "recruiting team", w: 9 },
  { phrase: "recruiter", w: 8 },
  { phrase: "onsite interview", w: 9 },
  { phrase: "virtual onsite", w: 9 },
  { phrase: "on-site", w: 9 },
  { phrase: "full loop", w: 9 },
  { phrase: "panel interview", w: 9 },
  { phrase: "final round", w: 9 },
  { phrase: "final interview", w: 9 },
  { phrase: "offer letter", w: 9 },
  { phrase: "job offer", w: 9 },
  { phrase: "extend an offer", w: 9 },
  { phrase: "background check", w: 8 },
  { phrase: "reference check", w: 8 },
  { phrase: "take-home assignment", w: 9 },
  { phrase: "take-home", w: 8 },
  { phrase: "take home", w: 8 },
  { phrase: "coding challenge", w: 8 },
  { phrase: "coding test", w: 8 },
  { phrase: "technical assessment", w: 9 },
  { phrase: "case study interview", w: 9 },
  { phrase: "design exercise", w: 8 },
  { phrase: "portfolio review", w: 8 },
  { phrase: "job opportunity", w: 8 },
  { phrase: "career opportunity", w: 8 },
  { phrase: "open role", w: 8 },
  { phrase: "open position", w: 8 },
  { phrase: "interested in your profile", w: 9 },
  { phrase: "interested in your background", w: 9 },
  { phrase: "impressed by your", w: 8 },
  { phrase: "discuss the role", w: 8 },
  { phrase: "discuss this role", w: 8 },
  { phrase: "not selected", w: 9 },
  { phrase: "position has been filled", w: 9 },
  { phrase: "move you forward", w: 9 },
  { phrase: "moving you forward", w: 9 },
  { phrase: "pleased to move you", w: 9 },
  { phrase: "next round", w: 8 },
  { phrase: "advance to", w: 8 },
  { phrase: "proceed to", w: 8 },
  
  // === TIER 3: MEDIUM (6-7) ===
  { phrase: "people team", w: 6 },
  { phrase: "hr team", w: 6 },
  { phrase: "introductory call", w: 7 },
  { phrase: "intro call", w: 7 },
  { phrase: "initial call", w: 7 },
  { phrase: "screening", w: 6 },
  { phrase: "round 2", w: 7 },
  { phrase: "second round", w: 7 },
  { phrase: "third round", w: 7 },
  { phrase: "team interview", w: 7 },
  { phrase: "meet the team", w: 7 },
  { phrase: "next steps", w: 6 },
  { phrase: "move forward", w: 6 },
  { phrase: "moving forward", w: 6 },
  { phrase: "compensation", w: 6 },
  { phrase: "salary range", w: 7 },
  { phrase: "salary expectations", w: 7 },
  { phrase: "greenhouse", w: 6 },
  { phrase: "lever", w: 6 },
  { phrase: "ashby", w: 6 },
  { phrase: "workday", w: 6 },
  { phrase: "icims", w: 6 },
  { phrase: "hirevue", w: 7 },
  { phrase: "goodtime", w: 6 },
  { phrase: "calendly", w: 5 },
  { phrase: "your resume", w: 6 },
  { phrase: "your cv", w: 6 },
  { phrase: "join our team", w: 6 },
  { phrase: "hiring for", w: 7 },
  { phrase: "we're hiring", w: 7 },
  { phrase: "love to chat", w: 6 },
  { phrase: "love to connect", w: 6 },
  { phrase: "reaching out on behalf of", w: 7 },
  { phrase: "reaching out about", w: 6 },
  { phrase: "hackerrank", w: 7 },
  { phrase: "codesignal", w: 7 },
  { phrase: "codility", w: 7 },
  { phrase: "coderpad", w: 7 },
  { phrase: "karat", w: 7 },
  { phrase: "triplebyte", w: 7 },
  { phrase: "system design", w: 7 },
  { phrase: "behavioral interview", w: 7 },
  { phrase: "culture fit", w: 6 },
  { phrase: "values interview", w: 6 },
  
  // === TIER 4: LOWER (3-5) ===
  { phrase: "opportunity", w: 4 },
  { phrase: "position", w: 3 },
  { phrase: "role", w: 3 },
  { phrase: "candidate", w: 4 },
  { phrase: "candidacy", w: 5 },
  { phrase: "availability", w: 4 },
  { phrase: "available", w: 3 },
  { phrase: "schedule", w: 4 },
  { phrase: "scheduling", w: 4 },
  { phrase: "schedule time", w: 5 },
  { phrase: "select slots", w: 5 },
  { phrase: "select a few slots", w: 6 },
  { phrase: "time slots", w: 5 },
  { phrase: "book time", w: 5 },
  { phrase: "set up a call", w: 5 },
  { phrase: "quick call", w: 4 },
  { phrase: "brief call", w: 4 },
  { phrase: "30 minute", w: 4 },
  { phrase: "30-minute", w: 4 },
  { phrase: "45 minute", w: 4 },
  { phrase: "zoom", w: 3 },
  { phrase: "google meet", w: 3 },
  { phrase: "teams call", w: 3 },
  { phrase: "video call", w: 3 },
  { phrase: "phone call", w: 3 },
  { phrase: "this week", w: 3 },
  { phrase: "next week", w: 3 },
  { phrase: "reaching out", w: 4 },
  { phrase: "reach out", w: 3 },
  { phrase: "on behalf of", w: 4 },
  { phrase: "learn more about you", w: 4 },
  { phrase: "hear from you", w: 3 },
  { phrase: "connect with you", w: 3 },
  { phrase: "chat with you", w: 3 },
  { phrase: "speak with you", w: 3 },
  { phrase: "talk with you", w: 3 },
  { phrase: "your profile", w: 4 },
  { phrase: "your background", w: 4 },
  { phrase: "your experience", w: 4 },
  { phrase: "job", w: 2 },
  { phrase: "hiring", w: 4 },
  { phrase: "talent", w: 3 },
  { phrase: "recruiting", w: 5 },
  { phrase: "application", w: 4 },
  { phrase: "applied", w: 4 },
  { phrase: "applying", w: 4 },
]

const MIN_SCORE = 6
const MIN_STRONG_HIT = 4

// ============================================================
// MEGA COMPREHENSIVE STAGE DETECTION SYSTEM
// Organized by: Stage → Company Type → Job Type → Signals
// ============================================================
const STAGE_DETECTION_SYSTEM = `

##############################################################################
#                    COMPREHENSIVE STAGE DETECTION SYSTEM                     #
#                                                                             #
# This system determines interview stages based on:                          #
# 1. Email content signals                                                   #
# 2. Company type (Startup, Scale-up, Enterprise, FAANG, etc.)              #
# 3. Job function (Engineering, Design, PM, Sales, etc.)                    #
# 4. Industry context (Tech, Finance, Consulting, Healthcare, etc.)         #
##############################################################################

================================================================================
STEP 1: IDENTIFY COMPANY TYPE
================================================================================

First, classify the company into one of these categories:

**STARTUP (Seed to Series B, <100 employees)**
Signals: "seed", "series A", "series B", "early stage", "founding team", small team mentions, no formal process language, founder interviews common

**SCALE-UP (Series C+, 100-1000 employees)**
Signals: "series C", "series D", "growth stage", "scaling", hyper-growth mentions, more structured but still fast

**ENTERPRISE (1000+ employees, established)**
Signals: Large well-known companies, formal processes, multiple interview stages, structured timelines

**FAANG/BIG TECH (Google, Meta, Apple, Amazon, Netflix, Microsoft, etc.)**
Signals: Company name recognition, "bar raiser", "loop", very structured multi-stage process, levels mentioned (L3, L4, L5, etc.)

**CONSULTING (McKinsey, BCG, Bain, Deloitte, Accenture, etc.)**
Signals: "case interview", "case study", "fit interview", "partner interview", "consulting" mentions

**FINANCE/BANKING (Goldman, JP Morgan, hedge funds, PE, VC)**
Signals: "superday", "modeling test", "stock pitch", "investment committee", "deal team"

**AGENCY/SERVICES (Design agencies, dev shops, marketing agencies)**
Signals: "portfolio review", "client work", "billable", project-based language

**HEALTHCARE/PHARMA**
Signals: Compliance mentions, regulatory, clinical, longer timelines

================================================================================
STEP 2: IDENTIFY JOB FUNCTION
================================================================================

**ENGINEERING (Software, Hardware, Data, ML, DevOps, QA)**
- Software Engineer, Frontend, Backend, Full Stack
- Data Engineer, ML Engineer, Data Scientist
- DevOps, SRE, Platform Engineer
- QA, SDET, Test Engineer
- Hardware Engineer, Firmware

**DESIGN (Product, UX, UI, Brand, Research)**
- Product Designer, UX Designer, UI Designer
- UX Researcher, Design Researcher
- Brand Designer, Visual Designer
- Design Manager, Head of Design

**PRODUCT (PM, TPM, PMM)**
- Product Manager, Senior PM, Group PM
- Technical Program Manager, TPM
- Product Marketing Manager

**SALES (AE, SDR, BDR, Sales Eng, Account Mgmt)**
- Account Executive, Enterprise AE
- Sales Development Rep, BDR
- Sales Engineer, Solutions Engineer
- Account Manager, Customer Success

**MARKETING (Growth, Content, Brand, Demand Gen)**
- Growth Marketing, Performance Marketing
- Content Marketing, SEO
- Brand Marketing
- Demand Generation

**FINANCE (FP&A, Accounting, Controller)**
- Financial Analyst, FP&A
- Accountant, Controller
- Finance Manager

**OPERATIONS (Ops, Strategy, BizOps)**
- Operations Manager
- Business Operations, BizOps
- Strategy & Operations

**HR/PEOPLE (Recruiting, HR, People Ops)**
- Recruiter, Talent Acquisition
- HR Business Partner
- People Operations

**LEGAL/COMPLIANCE**
- General Counsel, Legal Counsel
- Compliance Officer
- Paralegal

**EXECUTIVE (C-Suite, VP, Director)**
- CEO, CTO, CFO, COO, CPO
- VP Engineering, VP Product, VP Sales
- Director level

================================================================================
STEP 3: STAGE DETECTION BY COMPANY TYPE + JOB FUNCTION
================================================================================

###############################################################################
STAGE 1: RECRUITER_SCREEN (UI: "Screening")
Initial contact, application acknowledgment, or first conversation
###############################################################################

>>> UNIVERSAL SIGNALS (apply to all) <<<
- "received your application", "application has been received"
- "thank you for applying", "thanks for applying"
- "we have received your resume"
- "application is being reviewed", "reviewing your materials"
- "we'll be in touch", "someone will reach out"
- "reaching out on behalf of", "reaching out about"
- "saw your profile", "came across your profile", "found your profile"
- "interested in your background", "impressed by your experience"
- "thought you'd be a great fit", "you'd be perfect for"
- "love to chat", "love to connect", "would love to speak"
- "quick call", "brief conversation", "informal chat"
- "learn more about your experience"
- "schedule a call", "schedule time to chat"
- "select a few slots", "pick a time", "share your availability"
- "calendly", "goodtime", "calendar link"
- "30 minute call", "15 minute chat", "quick 20 minutes"
- "phone screen", "screening call", "intro call"
- "initial conversation", "first call", "preliminary call"
- "recruiter call", "talent call", "TA call"
- "get to know you better"

>>> BY COMPANY TYPE <<<

STARTUP:
- "chat with our founder", "meet [founder name]"
- "informal conversation", "casual chat"
- "see if there's a fit", "explore the opportunity"
- Often skip straight to founder/hiring manager

SCALE-UP:
- "talent partner", "people team"
- "initial screen with recruiting"
- May have dedicated recruiting team

ENTERPRISE:
- "talent acquisition specialist"
- "university recruiting" (for new grads)
- "experienced hire recruiting"
- More formal language

FAANG/BIG TECH:
- "technical recruiter", "sourcer"
- "recruiter phone screen"
- Level discussions (L3, L4, L5, E3, E4, etc.)
- "team matching" mentions (Google)

CONSULTING:
- "recruiting coordinator"
- "fit interview prep"
- "coffee chat", "networking call"
- Campus recruiting language

FINANCE:
- "campus recruiting", "experienced hire"
- "first round", "HR screen"
- "diversity recruiting"

>>> BY JOB FUNCTION <<<

ENGINEERING:
- "technical recruiter"
- "engineering recruiting"
- Initial discussion of tech stack

DESIGN:
- "design recruiter"
- "portfolio discussion"
- "share your work"

PRODUCT:
- "PM recruiting"
- "product sense discussion"

SALES:
- "sales recruiter"
- "discuss your sales experience"
- "quota", "territory" discussions early

###############################################################################
STAGE 2: HM_SCREEN (UI: "Hiring manager")
Meeting with hiring manager / potential direct manager
###############################################################################

>>> UNIVERSAL SIGNALS <<<
- "hiring manager", "your future manager", "the manager"
- "team lead", "team leader"
- "director", "senior director"
- "VP", "vice president"
- "department head", "head of [department]"
- "[Name], who leads the team"
- "[Name], who manages the [team]"
- "meet with [manager title]"
- "speak with the hiring manager"
- "manager interview", "leadership interview"
- "meet your potential manager"
- "team lead interview"
- "discuss the role in depth"
- "deep dive on the position"
- "learn more about the team"

>>> BY COMPANY TYPE <<<

STARTUP:
- "meet with our CTO/CPO/CEO" (for IC roles)
- "founder interview"
- "co-founder chat"
- Often combined with technical

SCALE-UP:
- "engineering manager", "design manager"
- "product lead"
- May have multiple manager rounds

ENTERPRISE:
- "hiring manager interview"
- "line manager"
- More formal structure
- "skip level" for senior roles

FAANG/BIG TECH:
- "hiring manager" or "HM" explicitly
- "hiring committee" mentions
- "team matching call" (Google)
- Manager is often separate from technical loop

CONSULTING:
- Less common as separate stage
- Often embedded in case days

FINANCE:
- "desk head", "group head"
- "MD interview" (Managing Director)
- "team lead discussion"

>>> BY JOB FUNCTION <<<

ENGINEERING:
- "engineering manager", "eng manager", "EM"
- "tech lead", "staff engineer"
- "principal engineer"
- "CTO" (at startups)
- "VP Engineering", "VP Eng"
- "Director of Engineering"

DESIGN:
- "design manager", "design lead"
- "head of design", "design director"
- "VP Design", "Chief Design Officer"
- "creative director"

PRODUCT:
- "product lead", "group PM", "GPM"
- "head of product", "VP Product"
- "CPO", "Chief Product Officer"
- "director of product"

SALES:
- "sales manager", "sales director"
- "VP Sales", "CRO"
- "regional director"
- "area VP"

MARKETING:
- "marketing manager", "marketing director"
- "VP Marketing", "CMO"
- "head of growth"

FINANCE:
- "finance manager", "FP&A manager"
- "controller", "CFO"
- "finance director"

OPERATIONS:
- "ops manager", "head of ops"
- "COO", "VP Operations"
- "director of operations"

###############################################################################
STAGE 3: ASSESSMENT (UI: "Presentation" or keep as ASSESSMENT)
Technical assessments, take-homes, coding challenges, case studies, exercises
###############################################################################

>>> UNIVERSAL SIGNALS <<<
- "assessment", "test", "exercise"
- "take-home", "take home", "homework"
- "assignment", "project"
- "complete by", "due date", "deadline"
- "submit your", "return the completed"
- "48 hours", "one week", "3 days"
- "timed", "proctored"

>>> BY COMPANY TYPE <<<

STARTUP:
- "small project", "sample task"
- "paid trial", "contract to hire project"
- "work sample"
- Often shorter, practical exercises

SCALE-UP:
- Mix of take-homes and live coding
- "coding exercise"
- "technical assessment"

ENTERPRISE:
- Standardized assessments
- "online assessment", "OA"
- Vendor platforms common

FAANG/BIG TECH:
- "online assessment", "OA"
- "HackerRank", "LeetCode style"
- "CodeSignal", "Codility"
- "take-home" less common (prefer live)
- "system design document" (for senior)

CONSULTING:
- "case study", "case interview"
- "market sizing", "estimation"
- "framework", "structure"
- "written case"
- "McKinsey PST", "BCG potential test"
- "case prep", "case practice"

FINANCE:
- "modeling test", "financial model"
- "3-statement model", "LBO model", "DCF"
- "stock pitch", "investment memo"
- "valuation exercise"
- "Excel test", "modeling exercise"
- "paper LBO"

>>> BY JOB FUNCTION <<<

ENGINEERING:
- "coding challenge", "coding test", "coding assessment"
- "algorithm questions", "data structures"
- "HackerRank", "LeetCode", "CodeSignal", "Codility", "CoderPad"
- "HireVue coding", "Karat interview"
- "system design exercise"
- "take-home project", "build a [feature]"
- "pair programming exercise"
- "code review exercise"
- "debugging exercise"
- "live coding"
- "whiteboard coding" (though declining)

DATA SCIENCE/ML:
- "data challenge", "ML challenge"
- "Kaggle-style", "prediction task"
- "data analysis exercise"
- "SQL test", "Python assessment"
- "statistics test"
- "A/B test analysis"

DESIGN:
- "design exercise", "design challenge"
- "whiteboard design", "design prompt"
- "portfolio review", "portfolio presentation"
- "design critique", "critique session"
- "UX exercise", "UI challenge"
- "Figma exercise", "design in Figma"
- "product design challenge"
- "app critique"
- "redesign exercise"

PRODUCT:
- "product case", "PM case study"
- "product sense", "product intuition"
- "estimation question", "market sizing"
- "product strategy", "go-to-market"
- "PRD exercise", "spec writing"
- "metrics case", "analytics case"
- "feature prioritization"
- "roadmap exercise"

SALES:
- "sales presentation", "pitch deck"
- "mock pitch", "demo presentation"
- "role play", "mock call"
- "cold call exercise", "prospecting exercise"
- "discovery call simulation"
- "negotiation exercise"

MARKETING:
- "marketing case", "campaign strategy"
- "content exercise", "writing sample"
- "growth case study"
- "channel strategy"
- "analytics exercise"

FINANCE:
- "modeling test" (see above)
- "accounting test"
- "Excel assessment"
- "case study" (different from consulting)

###############################################################################
STAGE 4: LOOP (UI: "Full loop")
Final rounds - onsite, virtual onsite, panel interviews, multiple interviews
###############################################################################

>>> UNIVERSAL SIGNALS <<<
- "onsite", "on-site", "office visit"
- "virtual onsite", "remote onsite"
- "full loop", "interview loop", "final loop"
- "panel interview", "panel discussion"
- "meet the team", "team interviews"
- "series of interviews", "multiple interviews"
- "back-to-back interviews", "consecutive interviews"
- "full day of interviews", "interview day"
- "final round", "final interview", "last round"
- "final stage", "last step before offer"
- "concluding interviews"
- "4-5 interviews", "5-6 rounds"
- "fly you out", "travel to [city]"
- "visit our office", "come to headquarters"
- "meet with leadership", "executive interview"

>>> BY COMPANY TYPE <<<

STARTUP:
- "meet the team", "team day"
- "meet our investors" (rare, for senior)
- "founder final chat"
- Often 3-4 conversations total

SCALE-UP:
- "virtual onsite", "remote loop"
- "meet multiple team members"
- 4-6 interviews typical

ENTERPRISE:
- "assessment center" (some)
- "panel interviews"
- "site visit"
- Very structured, full day common

FAANG/BIG TECH:
- "onsite" or "virtual onsite" (THE key signal)
- "loop" explicitly
- "bar raiser" (Amazon specific)
- "hiring committee" (Google - post loop)
- "packet review" (Google, Meta)
- 4-6 interviews in one day
- "lunch interview" (non-evaluative)
- Each interviewer has specific focus:
  * "coding interview" (x2)
  * "system design interview"
  * "behavioral interview" / "leadership principles" (Amazon)
  * "culture fit" / "Googleyness" (Google)
  * "cross-functional interview"

CONSULTING:
- "case day", "interview day"
- "partner interview", "partner round"
- "final round cases"
- "office visit"
- "superday" (some firms)
- Multiple cases + fit interviews

FINANCE:
- "superday", "Super Day" (THE key signal)
- "final rounds in [NYC/city]"
- "office day"
- "meet the desk", "desk interviews"
- "investment committee" (for certain roles)
- "partner meeting" (PE/VC)
- Multiple back-to-back interviews

AGENCY:
- "team presentation"
- "client presentation"
- "portfolio defense"
- "creative review"

>>> BY JOB FUNCTION <<<

ENGINEERING:
- "technical loop", "coding loop"
- "system design interview"
- "architecture discussion"
- "code review session"
- "pair programming"
- "behavioral/leadership"
- "team matching" (Google)
- "bar raiser" (Amazon)
- For senior: "staff project presentation", "tech talk"

DATA SCIENCE:
- "technical presentation"
- "present your analysis"
- "model review"
- "cross-functional interviews"

DESIGN:
- "portfolio presentation"
- "design presentation"
- "whiteboard challenge"
- "critique session"
- "stakeholder interview"
- "cross-functional" (PM, Eng interviews)
- "design leadership" (for managers)

PRODUCT:
- "product presentation"
- "case presentation"
- "cross-functional loop"
- "engineering interview"
- "design interview"
- "leadership/exec interview"
- "strategy discussion"

SALES:
- "final presentation"
- "executive pitch"
- "meet leadership"
- "role play series"
- "team selling scenario"

EXECUTIVE:
- "board interview"
- "investor meeting"
- "executive team meet"
- "presentation to leadership"
- Reference checks often happen here

###############################################################################
STAGE 5: OFFER (UI: "Offer discussion")
Offer extended, compensation discussion, negotiation, pre-boarding
###############################################################################

>>> UNIVERSAL SIGNALS <<<
- "offer letter", "formal offer", "written offer"
- "extend an offer", "extending an offer"
- "pleased to offer", "excited to offer", "happy to offer"
- "offering you the position", "offering you the role"
- "you got the job", "welcome to the team"
- "congratulations", "thrilled to have you"
- "verbal offer", "pending offer"
- "offer details", "offer package"

COMPENSATION SIGNALS:
- "compensation package", "total compensation", "comp package"
- "base salary", "salary offer", "annual salary"
- "equity", "stock options", "RSUs", "stock grant", "ISO", "NSO"
- "signing bonus", "sign-on bonus", "relocation bonus"
- "benefits package", "health insurance", "401k"
- "PTO", "vacation policy", "unlimited PTO"
- "discuss compensation", "talk through the offer"
- "target bonus", "annual bonus"
- "level" discussions with comp (L5 at $X)

NEGOTIATION SIGNALS:
- "negotiate", "negotiation", "counter offer"
- "flexibility on", "room to move on"
- "let us know your thoughts", "open to discussion"
- "what would it take", "what are you looking for"
- "competing offer", "other offers"
- "match", "beat", "improve"
- "deadline to decide", "offer expires"

PRE-BOARDING SIGNALS:
- "background check", "background verification"
- "reference check", "provide references"
- "start date", "when can you start", "proposed start"
- "onboarding", "first day", "orientation"
- "paperwork", "employment agreement", "I-9", "W-4"
- "drug test", "pre-employment screening"
- "equipment", "laptop setup"

>>> BY COMPANY TYPE <<<

STARTUP:
- Often more flexibility in negotiation
- Equity discussion prominent
- "cliff", "vesting schedule"
- May discuss title flexibility

FAANG/BIG TECH:
- Very structured comp bands
- Level explicitly tied to comp
- RSU/equity significant portion
- "refreshers" mentioned
- May have "team matching" after offer (Google)

FINANCE:
- "all-in comp", "total comp"
- Bonus heavy
- "guaranteed bonus"
- "sign-on", "stub bonus"

###############################################################################
STAGE 6: REJECTED (UI: "Rejected")
Application rejected at any stage
###############################################################################

>>> UNIVERSAL SIGNALS <<<
- "not moving forward", "won't be moving forward"
- "decided not to proceed", "unable to proceed"
- "not selected", "not been selected"
- "pursuing other candidates", "gone with other candidates"
- "position has been filled", "role has been filled"
- "no longer considering", "removed from consideration"
- "unfortunately", "regret to inform", "sorry to say"
- "competitive applicant pool", "many qualified candidates"
- "difficult decision", "tough decision"
- "not the right fit", "not a match"
- "keep your resume on file", "reach out in the future"
- "encourage you to apply again", "other opportunities"

PROCESS ENDED (not personal rejection):
- "position has been put on hold", "role is on hold"
- "hiring freeze", "no longer hiring for this role"
- "team restructuring", "org changes"
- "budget constraints", "headcount frozen"
- "role has been closed"

================================================================================
STEP 4: STAGE ADVANCEMENT RULES
================================================================================

When determining stage from email thread with multiple emails:

1. ALWAYS look at the MOST RECENT email primarily
2. Look for explicit stage transition language:
   - "moving you to the next round"
   - "we'd like to proceed with"
   - "scheduling your [next stage]"

3. Stage can only go FORWARD (except rejection):
   RECRUITER_SCREEN → HM_SCREEN → ASSESSMENT → LOOP → OFFER
   (Any stage can → REJECTED)

4. ASSESSMENT and HM_SCREEN order varies by company:
   - Some companies: HM first, then assessment
   - Others: Assessment first to filter, then HM
   - Look at email content to determine actual order

5. If multiple stages mentioned, pick the FURTHEST along:
   - "completed phone screen, scheduling onsite" → LOOP
   - "passed assessment, meeting hiring manager" → HM_SCREEN

6. Default to RECRUITER_SCREEN if:
   - Initial outreach
   - Application acknowledgment
   - Scheduling first conversation
   - Unclear which stage

================================================================================
OUTPUT FORMAT
================================================================================

Based on your analysis, return:
{
  "stage_bucket": "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stage_detail": "Specific description, e.g., 'Scheduling technical phone screen with engineering manager'",
  "company_type": "STARTUP" | "SCALE_UP" | "ENTERPRISE" | "FAANG" | "CONSULTING" | "FINANCE" | "AGENCY" | "OTHER",
  "job_function": "ENGINEERING" | "DESIGN" | "PRODUCT" | "SALES" | "MARKETING" | "FINANCE" | "OPERATIONS" | "HR" | "LEGAL" | "EXECUTIVE" | "OTHER",
  "confidence": 0.0-1.0
}
`

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function normalize(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function normalizeForMatch(s: string) {
  return " " + normalize(s) + " "
}

function shouldInstantReject(textLower: string, fromEmail: string): boolean {
  const fromLower = fromEmail.toLowerCase()
  for (const pattern of BLOCKED_SENDER_PATTERNS) {
    if (fromLower.includes(pattern)) return true
  }
  for (const pattern of INSTANT_REJECT_PATTERNS) {
    if (textLower.includes(pattern.toLowerCase())) return true
  }
  return false
}

function hasBannerImages(html: string): boolean {
  if (!html) return false
  const imgTags = html.toLowerCase().match(/<img[^>]*>/g) || []
  if (imgTags.length > 4) return true
  for (const img of imgTags) {
    const widthMatch = img.match(/width\s*[=:]\s*["']?(\d+)/)
    if (widthMatch && parseInt(widthMatch[1]) > 500) return true
  }
  return false
}

function scoreEmailText(textLower: string) {
  const hay = normalizeForMatch(textLower)
  let score = 0
  let strongest = 0
  const hits: string[] = []

  for (const item of PHRASE_WEIGHTS) {
    const needle = " " + normalize(item.phrase) + " "
    if (hay.includes(needle)) {
      score += item.w
      if (item.w > strongest) strongest = item.w
      hits.push(`${item.phrase}(${item.w})`)
    }
  }

  return { score, strongest, hits }
}

function safeJsonParse<T>(s: any): T | null {
  try {
    if (!s) return null
    let cleaned = typeof s === "string" ? s.trim() : s
    if (typeof cleaned === "string") {
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7)
      else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3)
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3)
      cleaned = cleaned.trim()
    }
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}

function decodeBase64Url(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/")
  const pad = normalized.length % 4
  const padded = pad ? normalized + "=".repeat(4 - pad) : normalized
  return Buffer.from(padded, "base64").toString("utf-8")
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractBodyFromPayload(payload: any): { text: string; html: string } {
  let text = ""
  let html = ""
  function walk(part: any) {
    if (!part) return
    const mime = (part.mimeType || "").toLowerCase()
    const bodyData = part.body?.data
    if (bodyData && typeof bodyData === "string") {
      const decoded = decodeBase64Url(bodyData)
      if (mime === "text/plain") text += "\n" + decoded
      if (mime === "text/html") html += "\n" + decoded
    }
    if (Array.isArray(part.parts)) part.parts.forEach(walk)
  }
  walk(payload)
  return { text: text.trim(), html: html.trim() }
}

function getUiStage(bucket: string): string {
  const map: Record<string, string> = {
    "RECRUITER_SCREEN": "SCREENING",
    "HM_SCREEN": "HM",
    "ASSESSMENT": "ASSESSMENT",
    "LOOP": "FULL_LOOP",
    "OFFER": "OFFER_DISCUSSION",
    "REJECTED": "REJECTED",
  }
  return map[bucket] || "SCREENING"
}

// ============================================================
// LLM ANALYSIS
// ============================================================
async function analyzeEmail(input: {
  subject: string
  snippet: string
  fromEmail: string
  fromName: string
  bodyExcerpt: string
  existingEmails?: Array<{ subject: string; snippet: string; from: string; date: string }>
}) {
  let threadContext = ""
  if (input.existingEmails && input.existingEmails.length > 0) {
    threadContext = "\n\n=== PREVIOUS EMAILS IN THIS PIPELINE (oldest first) ===\n"
    for (const e of input.existingEmails) {
      threadContext += `[${e.date}] From: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}\n---\n`
    }
    threadContext += "\n=== NEW EMAIL TO ANALYZE (most recent) ===\n"
  }

  const systemPrompt = `You are Guildy, an expert interview pipeline analyzer and career coach.

${STAGE_DETECTION_SYSTEM}

Your task:
1. Determine if this is a RECRUITING email (NOT marketing, support, newsletters)
2. Identify the company type (Startup, Scale-up, Enterprise, FAANG, Consulting, Finance, etc.)
3. Identify the job function (Engineering, Design, PM, Sales, etc.)
4. Determine the CURRENT interview stage using the comprehensive system above
5. Generate specific, actionable prep content tailored to this company type, job function, and stage

CRITICAL RULES:
- Use the COMPREHENSIVE STAGE DETECTION SYSTEM to identify signals
- Consider company type AND job function for accurate stage detection
- For existing pipelines with multiple emails, look at the FULL THREAD to determine current stage
- Stage can only advance forward (or to rejected)
- Be specific in stage_detail - mention exactly what's happening
- Generate ALL prep fields with real content, never placeholders

Output ONLY valid JSON.`

  const userPrompt = `${threadContext}
From: ${input.fromName} <${input.fromEmail}>
Subject: ${input.subject}
Snippet: ${input.snippet}

Email Body:
${input.bodyExcerpt.slice(0, 2500)}

Analyze this email and return JSON:

{
  "is_recruiting": true or false,
  "company": "Company Name",
  "role": "Job Title",
  "company_type": "STARTUP" | "SCALE_UP" | "ENTERPRISE" | "FAANG" | "CONSULTING" | "FINANCE" | "AGENCY" | "OTHER",
  "job_function": "ENGINEERING" | "DESIGN" | "PRODUCT" | "SALES" | "MARKETING" | "FINANCE" | "OPERATIONS" | "HR" | "LEGAL" | "EXECUTIVE" | "OTHER",
  "stage_bucket": "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stage_detail": "Specific description of current stage based on email signals",
  
  "insights": {
    "stageReason": "Cite specific signals from email that indicate this stage, referencing company type and job function patterns",
    "waitingOn": "you" or "them",
    "nextAction": "Specific action based on stage, company type, and job function",
    "urgency": "low" | "med" | "high",
    "responseLikelihood": "low" | "med" | "high",
    "tone": "friendly" | "formal" | "neutral" | "urgent"
  },
  
  "prep": {
    "stageFocus": "What to prepare for this specific stage at this company type for this job function",
    "questionsTheyMightAsk": [
      "5 questions specific to this stage + company type + job function"
    ],
    "questionsYouShouldAsk": [
      "5 smart questions tailored to company type and role"
    ],
    "whatToEmphasize": [
      "3 things to emphasize based on company type and job function"
    ],
    "storiesToPrepare": [
      "3 STAR story topics relevant to this role and stage"
    ],
    "homeworkNext24h": [
      "3 specific prep tasks for this stage at this company type"
    ],
    "companyIntel": {
      "industry": "Industry",
      "size": "Based on company_type classification",
      "hqLocation": "If known",
      "glassdoorRating": "If known",
      "summary": "Brief description",
      "recentNews": []
    }
  }
}`

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 2500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    })

    const content = res.choices?.[0]?.message?.content || ""
    const parsed = safeJsonParse<any>(content)
    
    if (!parsed) {
      console.error("Failed to parse LLM response:", content.slice(0, 500))
      return null
    }

    // Ensure all fields have values
    return {
      is_recruiting: parsed.is_recruiting ?? false,
      company: parsed.company || "Unknown",
      role: parsed.role || "Unknown",
      company_type: parsed.company_type || "OTHER",
      job_function: parsed.job_function || "OTHER",
      stage_bucket: parsed.stage_bucket || "RECRUITER_SCREEN",
      stage_detail: parsed.stage_detail || "Initial contact",
      insights: {
        stageReason: parsed.insights?.stageReason || "Recruiting activity detected",
        waitingOn: parsed.insights?.waitingOn || "you",
        nextAction: parsed.insights?.nextAction || "Review and respond",
        urgency: parsed.insights?.urgency || "med",
        responseLikelihood: parsed.insights?.responseLikelihood || "med",
        tone: parsed.insights?.tone || "neutral",
      },
      prep: {
        stageFocus: parsed.prep?.stageFocus || "Prepare for interview",
        questionsTheyMightAsk: parsed.prep?.questionsTheyMightAsk?.length > 0 
          ? parsed.prep.questionsTheyMightAsk 
          : ["Tell me about yourself", "Why this role?", "Relevant experience?", "Strengths?", "Questions for us?"],
        questionsYouShouldAsk: parsed.prep?.questionsYouShouldAsk?.length > 0 
          ? parsed.prep.questionsYouShouldAsk 
          : ["What does success look like?", "Team structure?", "Challenges?", "Growth?", "Next steps?"],
        whatToEmphasize: parsed.prep?.whatToEmphasize?.length > 0 
          ? parsed.prep.whatToEmphasize 
          : ["Relevant experience", "Problem-solving", "Communication"],
        storiesToPrepare: parsed.prep?.storiesToPrepare?.length > 0 
          ? parsed.prep.storiesToPrepare 
          : ["Challenging project", "Team collaboration", "Leadership"],
        homeworkNext24h: parsed.prep?.homeworkNext24h?.length > 0 
          ? parsed.prep.homeworkNext24h 
          : ["Research company", "Review JD", "Prep intro"],
        companyIntel: {
          industry: parsed.prep?.companyIntel?.industry || "Unknown",
          size: parsed.prep?.companyIntel?.size || parsed.company_type || "Unknown",
          hqLocation: parsed.prep?.companyIntel?.hqLocation || "Unknown",
          glassdoorRating: parsed.prep?.companyIntel?.glassdoorRating || "Unknown",
          summary: parsed.prep?.companyIntel?.summary || "Research needed",
          recentNews: parsed.prep?.companyIntel?.recentNews || [],
        },
      },
    }
  } catch (err) {
    console.error("LLM error:", err)
    return null
  }
}

// ============================================================
// MAIN SYNC ENDPOINT
// ============================================================
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "NO SESSION" }, { status: 401 })

    const accessToken = (session as any).accessToken
    const userEmail = session.user?.email
    if (!accessToken || !userEmail) {
      return NextResponse.json({ error: "MISSING TOKEN OR EMAIL" }, { status: 401 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: "v1", auth })

    const { data: lastEmailRows } = await supabase
      .from("emails")
      .select("received_at")
      .eq("user_email", userEmail)
      .order("received_at", { ascending: false })
      .limit(1)

    const lastMs = lastEmailRows?.[0]?.received_at ? new Date(lastEmailRows[0].received_at).getTime() : null
    const afterUnix = lastMs ? Math.floor((lastMs - 21 * 24 * 60 * 60 * 1000) / 1000) : null
    const q = afterUnix ? `after:${afterUnix} -in:trash -in:chats` : "newer_than:1y -in:trash -in:chats"

    let messages: Array<{ id?: string | null }> = []
    let pageToken: string | undefined

    do {
      const page = await gmail.users.messages.list({ userId: "me", q, maxResults: 100, pageToken })
      messages = messages.concat(page.data.messages ?? [])
      pageToken = page.data.nextPageToken ?? undefined
    } while (pageToken && messages.length < 300)

    const stats = { scanned: messages.length, skipped: 0, rejected: 0, accepted: 0, inserted: 0, updated: 0 }

    const { data: existingPipelines } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)

    const pipelines = existingPipelines ?? []

    for (const msg of messages) {
      if (!msg.id) continue

      const { data: existing } = await supabase
        .from("emails")
        .select("id")
        .eq("user_email", userEmail)
        .eq("gmail_message_id", msg.id)
        .maybeSingle()

      if (existing) {
        stats.skipped++
        continue
      }

      const full = await gmail.users.messages.get({ userId: "me", id: msg.id, format: "full" })
      const headers = full.data.payload?.headers ?? []
      const subject = headers.find(h => h.name === "Subject")?.value || ""
      const fromHeader = headers.find(h => h.name === "From")?.value || ""
      const dateHeader = headers.find(h => h.name === "Date")?.value || ""
      const snippet = full.data.snippet || ""

      const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/)
      const fromName = fromMatch ? fromMatch[1].replace(/"/g, "").trim() : fromHeader
      const fromEmail = fromMatch ? fromMatch[2].trim() : fromHeader

      const internalMs = full.data.internalDate ? Number(full.data.internalDate) : NaN
      const receivedAt = Number.isFinite(internalMs)
        ? new Date(internalMs).toISOString()
        : dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()

      const { text: bodyPlain, html: bodyHtml } = extractBodyFromPayload(full.data.payload)
      const bodyText = bodyPlain || (bodyHtml ? stripHtml(bodyHtml) : "")
      const fullText = `${subject}\n${snippet}\n${fromHeader}\n${bodyText}`
      const textLower = fullText.toLowerCase()

      if (shouldInstantReject(textLower, fromEmail)) {
        stats.rejected++
        continue
      }

      if (hasBannerImages(bodyHtml)) {
        stats.rejected++
        continue
      }

      const { score, strongest, hits } = scoreEmailText(textLower)
      console.log(`[SCORE] "${subject.slice(0, 50)}": ${score} (strongest=${strongest}) [${hits.slice(0, 5).join(", ")}]`)

      if (score < MIN_SCORE || strongest < MIN_STRONG_HIT) {
        stats.rejected++
        continue
      }

      const fromDomain = fromEmail.split("@")[1]?.split(".")[0] || ""
      const existingPipeline = pipelines.find((p: any) => {
        const pc = normalize(p.company)
        const ed = normalize(fromDomain)
        return pc.includes(ed) || ed.includes(pc)
      })

      let existingEmails: Array<{ subject: string; snippet: string; from: string; date: string }> = []
      if (existingPipeline) {
        const { data: pEmails } = await supabase
          .from("emails")
          .select("subject, snippet, from_email, received_at")
          .eq("pipeline_id", existingPipeline.id)
          .order("received_at", { ascending: true })

        existingEmails = (pEmails || []).map(e => ({
          subject: e.subject || "",
          snippet: e.snippet || "",
          from: e.from_email || "",
          date: e.received_at || "",
        }))
      }

      const analysis = await analyzeEmail({
        subject,
        snippet,
        fromEmail,
        fromName,
        bodyExcerpt: bodyText.slice(0, 3000),
        existingEmails: existingEmails.length > 0 ? existingEmails : undefined,
      })

      if (!analysis || !analysis.is_recruiting) {
        stats.rejected++
        continue
      }

      stats.accepted++

      const company = analysis.company || "Unknown"
      const role = analysis.role || "Unknown"
      const uiStage = getUiStage(analysis.stage_bucket)

      const companyN = normalize(company)
      let matchedPipeline = pipelines.find((p: any) => {
        const pc = normalize(p.company)
        return pc === companyN || pc.includes(companyN) || companyN.includes(pc)
      })

      let pipelineId: string

      if (!matchedPipeline) {
        const { data: created, error } = await supabase
          .from("pipelines")
          .insert({
            user_email: userEmail,
            company,
            role,
            stage: uiStage,
            stage_detail: analysis.stage_detail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail,
            last_email_from_name: fromName,
            last_email_snippet: snippet,
            insights_json: analysis.insights,
            prep_json: analysis.prep,
          })
          .select()
          .single()

        if (error || !created?.id) {
          console.error("Create pipeline error:", error)
          continue
        }

        pipelineId = created.id
        pipelines.push(created)
        stats.inserted++
        console.log(`[NEW] ${company} - ${role} @ ${uiStage} (${analysis.company_type}/${analysis.job_function})`)

      } else {
        pipelineId = matchedPipeline.id
        const oldStage = matchedPipeline.stage

        const { error } = await supabase
          .from("pipelines")
          .update({
            stage: uiStage,
            stage_detail: analysis.stage_detail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail,
            last_email_from_name: fromName,
            last_email_snippet: snippet,
            insights_json: analysis.insights,
            prep_json: analysis.prep,
          })
          .eq("id", pipelineId)

        if (!error) {
          matchedPipeline.stage = uiStage
          stats.updated++
          console.log(`[UPDATE] ${company}: ${oldStage} → ${uiStage} (${analysis.stage_detail})`)
        }
      }

      await supabase.from("emails").insert({
        user_email: userEmail,
        pipeline_id: pipelineId,
        gmail_message_id: msg.id,
        from_email: fromEmail,
        subject,
        snippet,
        received_at: receivedAt,
      })
    }

    return NextResponse.json({ success: true, stats })
  } catch (err: any) {
    console.error("Sync error:", err)
    return NextResponse.json({ error: "EXCEPTION", message: err?.message }, { status: 500 })
  }
}

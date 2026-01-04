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

/**
 * DO NOT REMOVE PHRASES.
 * You may ONLY add phrases or increase detection strength.
 */
const PHRASE_WEIGHTS: Array<{ phrase: string; w: number }> = [
  // 1) High-signal interview scheduling phrases (VERY HIGH)
  { phrase: "interview", w: 6 },
  { phrase: "interview request", w: 10 },
  { phrase: "interview invitation", w: 10 },
  { phrase: "invite you to interview", w: 10 },
  { phrase: "interview scheduling", w: 9 },
  { phrase: "schedule an interview", w: 10 },
  { phrase: "book an interview", w: 9 },
  { phrase: "interview availability", w: 8 },
  { phrase: "interview time", w: 8 },
  { phrase: "interview slot", w: 9 },
  { phrase: "interview confirmation", w: 10 },
  { phrase: "confirmed interview", w: 10 },
  { phrase: "reschedule interview", w: 9 },
  { phrase: "rescheduling interview", w: 9 },
  { phrase: "interview rescheduled", w: 9 },
  { phrase: "calendar invite", w: 8 },
  { phrase: "calendar invitation", w: 8 },
  { phrase: "invite sent", w: 7 },
  { phrase: "send an invite", w: 7 },
  { phrase: "zoom invite", w: 7 },
  { phrase: "google meet invite", w: 7 },
  { phrase: "microsoft teams invite", w: 7 },
  { phrase: "teams invite", w: 6 },

  // 2) Screening / recruiter phrases (HIGH)
  { phrase: "recruiter", w: 6 },
  { phrase: "talent acquisition", w: 6 },
  { phrase: "talent team", w: 6 },
  { phrase: "people team", w: 6 },
  { phrase: "people operations", w: 6 },
  { phrase: "hr team", w: 6 },
  { phrase: "human resources", w: 6 },
  { phrase: "screening", w: 7 },
  { phrase: "screen", w: 5 },
  { phrase: "phone screen", w: 7 },
  { phrase: "introductory call", w: 7 },
  { phrase: "intro call", w: 7 },
  { phrase: "initial call", w: 6 },
  { phrase: "quick call", w: 6 },
  { phrase: "brief call", w: 6 },
  { phrase: "15 minute call", w: 6 },
  { phrase: "30 minute call", w: 6 },
  { phrase: "short call", w: 5 },
  { phrase: "screening call", w: 7 },

  // 3) Later stage / onsite / loop phrases (HIGH)
  { phrase: "onsite", w: 9 },
  { phrase: "on-site", w: 9 },
  { phrase: "full loop", w: 9 },
  { phrase: "loop", w: 7 },
  { phrase: "panel", w: 7 },
  { phrase: "panel interview", w: 9 },
  { phrase: "interview panel", w: 9 },
  { phrase: "final round", w: 9 },
  { phrase: "final interview", w: 9 },
  { phrase: "round 2", w: 7 },
  { phrase: "round two", w: 7 },
  { phrase: "second round", w: 7 },
  { phrase: "third round", w: 7 },
  { phrase: "round 3", w: 7 },
  { phrase: "round three", w: 7 },
  { phrase: "hiring manager", w: 8 },
  { phrase: "hiring manager interview", w: 9 },
  { phrase: "team interview", w: 8 },
  { phrase: "meet the team", w: 8 },

  // 4) Assessments / exercises (MED/HIGH)
  { phrase: "assessment", w: 7 },
  { phrase: "take-home", w: 7 },
  { phrase: "take home", w: 7 },
  { phrase: "homework", w: 6 },
  { phrase: "exercise", w: 6 },
  { phrase: "case study", w: 7 },
  { phrase: "design exercise", w: 8 },
  { phrase: "portfolio review", w: 7 },
  { phrase: "whiteboard", w: 7 },
  { phrase: "technical screen", w: 7 },
  { phrase: "coding challenge", w: 7 },

  // 5) Positive progression / next steps (MED/HIGH)
  { phrase: "next steps", w: 7 },
  { phrase: "move forward", w: 7 },
  { phrase: "moving forward", w: 7 },
  { phrase: "progress to the next round", w: 8 },
  { phrase: "advance to the next round", w: 8 },
  { phrase: "we'd like to proceed", w: 7 },
  { phrase: "we'd love to move you forward", w: 8 },
  { phrase: "we would like to move you forward", w: 8 },
  { phrase: "schedule time", w: 6 },
  { phrase: "schedule a call", w: 7 },
  { phrase: "book time", w: 7 },
  { phrase: "availability", w: 6 },

  // 6) Offers / closing (HIGH) — but keep low weight
  { phrase: "offer", w: 7 },
  { phrase: "offer letter", w: 9 },
  { phrase: "compensation", w: 7 },
  { phrase: "equity", w: 6 },
  { phrase: "salary", w: 6 },
  { phrase: "signing bonus", w: 8 },
  { phrase: "start paperwork", w: 8 },
  { phrase: "onboarding", w: 7 },
  { phrase: "employment offer", w: 9 },

  // 7) Rejection variants (HIGH)
  { phrase: "not moving forward", w: 9 },
  { phrase: "move forward with other candidates", w: 9 },
  { phrase: "we have decided not to move forward", w: 9 },
  { phrase: "we are unable to move forward", w: 9 },
  { phrase: "closed the role", w: 8 },

  // 8) ATS / recruiting tool names inside body (MED/HIGH)
  { phrase: "greenhouse", w: 6 },
  { phrase: "lever", w: 5 },
  { phrase: "workday", w: 6 },
  { phrase: "ashby", w: 6 },
  { phrase: "smartrecruiters", w: 6 },
  { phrase: "icims", w: 6 },
  { phrase: "hirevue", w: 6 },
  { phrase: "goodtime", w: 6 },
  { phrase: "calendly", w: 6 },

  // ---- Added (ONLY appended; nothing removed)
  { phrase: "phone screen", w: 6 },
  { phrase: "phone screening", w: 6 },
  { phrase: "screening call", w: 7 },
  { phrase: "intro call", w: 7 },
  { phrase: "initial call", w: 6 },
  { phrase: "30-minute", w: 6 },
  { phrase: "30 minute", w: 6 },
  { phrase: "15-minute", w: 5 },
  { phrase: "zoom interview", w: 8 },
  { phrase: "video interview", w: 8 },
  { phrase: "google meet", w: 7 },
  { phrase: "meet with the team", w: 7 },
  { phrase: "portfolio review", w: 7 },
  { phrase: "design exercise", w: 8 },
  { phrase: "take-home", w: 7 },
  { phrase: "take home", w: 7 },
  { phrase: "case study", w: 7 },
  { phrase: "whiteboard", w: 7 },
  { phrase: "technical screen", w: 7 },
  { phrase: "panel interview", w: 8 },
  { phrase: "hiring manager interview", w: 8 },
  { phrase: "final round", w: 8 },

  // ===== Added: short rejection markers (non-rigid; <= 3 words each) =====
  { phrase: "unfortunately", w: 8 },
  { phrase: "regret", w: 7 },
  { phrase: "regrets", w: 7 },
  { phrase: "decided", w: 6 },
  { phrase: "decision", w: 5 },
  { phrase: "unable", w: 7 },
  { phrase: "cannot", w: 6 },
  { phrase: "will not", w: 7 },
  { phrase: "we won't", w: 7 },
  { phrase: "not selected", w: 9 },
  { phrase: "other candidates", w: 8 },
  { phrase: "position filled", w: 8 },
  { phrase: "role filled", w: 8 },
  { phrase: "position closed", w: 8 },
  { phrase: "role closed", w: 8 },
  { phrase: "moving on", w: 6 },
  { phrase: "moved on", w: 6 },
]

type StageBucket =
  | "RECRUITER_SCREEN"
  | "HM_SCREEN"
  | "ASSESSMENT"
  | "LOOP"
  | "OFFER"
  | "REJECTED"

type Stage =
  | "APPLIED"
  | "SCREENING"
  | "HM"
  | "ASSESSMENT"
  | "FULL_LOOP"
  | "OFFER_DISCUSSION"
  | "REJECTED"

const MIN_SCORE = 9
const MIN_HITS = 2

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

type ShortPhrase = { chunk: string; w: number; parent: string; cap: number }

function normalizeForMatch(s: string) {
  return " " + normalize(s) + " "
}

function splitIntoChunks(words: string[]) {
  // Prefer 3-grams, then 2-grams, then 1-grams (filtered)
  const chunks: string[] = []
  const join = (a: string[]) => a.join(" ").trim()

  const ngram = (n: number) => {
    if (words.length < n) return
    for (let i = 0; i <= words.length - n; i++) {
      chunks.push(join(words.slice(i, i + n)))
    }
  }

  ngram(3)
  ngram(2)
  ngram(1)
  return chunks
}

function buildShortPhraseWeights(list: Array<{ phrase: string; w: number }>): ShortPhrase[] {
  const stop = new Set([
    "we",
    "have",
    "has",
    "had",
    "to",
    "the",
    "a",
    "an",
    "and",
    "or",
    "of",
    "in",
    "on",
    "for",
    "with",
    "at",
    "this",
    "that",
    "are",
    "is",
    "be",
    "not",
    "will",
    "won't",
    "cant",
    "cannot",
    "you",
    "your",
    "our",
    "us",
    "i",
  ])

  const out: ShortPhrase[] = []
  const seen = new Set<string>()

  for (const item of list) {
    const raw = item.phrase || ""
    const w = item.w || 0
    if (!raw.trim() || w <= 0) continue

    const words = normalize(raw).split(" ").filter(Boolean)

    // Always use <=3 word phrases directly (exact match with word boundaries)
    if (words.length <= 3) {
      const chunk = words.join(" ")
      const key = `${chunk}|${chunk}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ chunk, w, parent: chunk, cap: w })
      }
      continue
    }

    // For 4+ word phrases: DO NOT require rigid exact match.
    // Instead, generate overlapping 2–3 word chunks (plus selective 1-word chunks) and cap total contribution to the original weight.
    const parent = words.join(" ")
    const cap = w

    const chunks = splitIntoChunks(words)

    for (const c of chunks) {
      const cw = c.split(" ").filter(Boolean).length
      if (cw === 0) continue

      // Filter noisy 1-word chunks
      if (cw === 1) {
        const tok = c
        if (tok.length <= 3) continue
        if (stop.has(tok)) continue
      }

      // Weights by chunk size (bounded, conservative)
      let chunkW = 1
      if (cw === 3) chunkW = Math.max(2, Math.round(w * 0.6))
      else if (cw === 2) chunkW = Math.max(2, Math.round(w * 0.5))
      else chunkW = 1

      const key = `${c}|${parent}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ chunk: c, w: chunkW, parent, cap })
    }
  }

  return out
}

// Build once at module load (fast)
const SHORT_PHRASE_WEIGHTS: ShortPhrase[] = buildShortPhraseWeights(PHRASE_WEIGHTS)

function scoreEmailText(textLower: string) {
  const hay = normalizeForMatch(textLower)

  let score = 0
  const hits: Array<{ phrase: string; w: number }> = []
  const parentAccum: Record<string, number> = {}

  for (const item of SHORT_PHRASE_WEIGHTS) {
    const needle = " " + item.chunk + " "
    if (!hay.includes(needle)) continue

    const prev = parentAccum[item.parent] ?? 0
    const next = Math.min(item.cap, prev + item.w)
    const delta = next - prev
    if (delta <= 0) continue

    parentAccum[item.parent] = next
    score += delta
    hits.push({ phrase: item.chunk, w: delta })
  }

  return { score, hits }
}

function defaultStageDetail(bucket: StageBucket) {
  switch (bucket) {
    case "RECRUITER_SCREEN":
      return "Screening"
    case "HM_SCREEN":
      return "Hiring manager"
    case "ASSESSMENT":
      return "Assessment"
    case "LOOP":
      return "Full loop"
    case "OFFER":
      return "Offer discussion"
    case "REJECTED":
      return "Rejected"
    default:
      return "Screening"
  }
}

function stageBucketToUiStage(bucket: StageBucket): Stage {
  switch (bucket) {
    case "RECRUITER_SCREEN":
      return "SCREENING"
    case "HM_SCREEN":
      return "HM"
    case "ASSESSMENT":
      return "ASSESSMENT"
    case "LOOP":
      return "FULL_LOOP"
    case "OFFER":
      return "OFFER_DISCUSSION"
    case "REJECTED":
      return "REJECTED"
    default:
      return "SCREENING"
  }
}

function advanceOnly(prev: StageBucket, next: StageBucket): StageBucket {
  const order: StageBucket[] = ["RECRUITER_SCREEN", "HM_SCREEN", "ASSESSMENT", "LOOP", "OFFER", "REJECTED"]
  const pi = order.indexOf(prev)
  const ni = order.indexOf(next)
  if (pi === -1) return next
  if (ni === -1) return prev
  // REJECTED always wins
  if (next === "REJECTED") return "REJECTED"
  // otherwise don't regress
  return ni >= pi ? next : prev
}

function capInterviewIfNoSchedulingEvidence(proposed: StageBucket, scheduleStrong: boolean) {
  if (!scheduleStrong) {
    if (proposed === "LOOP" || proposed === "OFFER") return "RECRUITER_SCREEN"
  }
  return proposed
}

function safeJsonParse<T>(s: any): T | null {
  try {
    if (!s) return null
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

async function estimateStageFromLLM(input: {
  subject: string
  snippet: string
  fromEmail: string
  userEmail: string
  scheduleStrong: boolean
  offerStrong: boolean
  score: number
  hits: Array<{ phrase: string; w: number }>
}) {
  const sys = "You are an expert recruiter ops assistant. Output ONLY strict JSON. Do not add extra keys."
  const prompt = `Infer the current interview stage bucket from this single email.
Return JSON with:
{
  "stage_bucket": "RECRUITER_SCREEN" | "HM_SCREEN" | "ASSESSMENT" | "LOOP" | "OFFER" | "REJECTED",
  "stage_detail": string,
  "company": string,
  "role": string,
  "reason": string,
  "confidence": number
}

Rules:
- Be conservative. If not sure, choose RECRUITER_SCREEN.
- If offer/compensation negotiation language, choose OFFER.
- If rejection language, choose REJECTED.
- If it's a recruiter scheduling first call, choose RECRUITER_SCREEN.
- If it's explicitly a hiring manager call, choose HM_SCREEN.
- If it mentions take-home / exercise / case study, choose ASSESSMENT.
- If it mentions onsite / loop / panel / final rounds with multiple people, choose LOOP.
- Use scheduleStrong/offerStrong as evidence.
- If you cannot reliably infer company/role, set them to "Unknown".

Email:
From: ${input.fromEmail}
To (user): ${input.userEmail}
Subject: ${input.subject}
Snippet: ${input.snippet}

Signals:
scheduleStrong=${input.scheduleStrong}
offerStrong=${input.offerStrong}
score=${input.score}
hits=${input.hits.map((h) => `${h.phrase}(${h.w})`).join(", ")}
`

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: prompt },
    ],
  })

  const txt = res.choices?.[0]?.message?.content || ""
  const parsed = safeJsonParse<{
    stage_bucket: StageBucket
    stage_detail: string
    company: string
    role: string
    reason: string
    confidence: number
  }>(txt)

  if (!parsed?.stage_bucket) return null
  return parsed
}

async function generateInsightsAndPrep(input: {
  company: string
  role: string
  stage_bucket: StageBucket
  stage_detail: string
  subject: string
  snippet: string
  fromEmail: string
  receivedAt: string
}) {
  const sys = "You are Guildy, a job pipeline + interview prep assistant. Output ONLY strict JSON. Do not hallucinate company facts."
  const prompt = `Generate bespoke, stage-specific insights + interview prep for THIS job.

Return JSON with this shape:
{
  "insights": {
    "stage_reason": string,
    "stage_confidence": number,
    "signals": [{"type": string, "label": string, "confidence": number, "at": string}],
    "waiting_on": "you" | "them",
    "next_action": string,
    "urgency": "low" | "med" | "high",
    "response_likelihood": "low" | "med" | "high"
  },
  "prep": {
    "prep_focus": string,
    "questions_they_might_ask_you": string[],
    "questions_you_should_ask_them": string[],
    "what_to_emphasize": string[],
    "stories_to_prepare": string[],
    "homework_next_24h": string[],
    "company_intel": {
      "industry": string,
      "size": string,
      "hq_location": string,
      "glassdoor_rating": string,
      "summary": string,
      "recent_news": string[]
    }
  }
}

Hard constraints:
- Make it STAGE-SPECIFIC to: ${input.stage_bucket} (${input.stage_detail})
- Make it ROLE-SPECIFIC to: ${input.role}
- Make it COMPANY-SPECIFIC to: ${input.company}
- If you cannot verify company intel from the email context, set fields to "Unknown" and summary to "No verified company info available."
- No generic fluff. No broad advice. Use tight bullets.

Context email:
Company=${input.company}
Role=${input.role}
Stage=${input.stage_bucket} (${input.stage_detail})
From=${input.fromEmail}
Subject=${input.subject}
Snippet=${input.snippet}
ReceivedAt=${input.receivedAt}
`

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: prompt },
    ],
  })

  const txt = res.choices?.[0]?.message?.content || ""
  const parsed = safeJsonParse<any>(txt)
  return parsed
}

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

    const MAX_MESSAGES_PER_RUN = 250
    const PAGE_SIZE = 100
    const SAFETY_LOOKBACK_DAYS = 7

    const { data: lastEmailRows } = await supabase
      .from("emails")
      .select("received_at")
      .eq("user_email", userEmail)
      .order("received_at", { ascending: false })
      .limit(1)

    const lastReceivedAt = lastEmailRows?.[0]?.received_at
      ? new Date(lastEmailRows[0].received_at).getTime()
      : null

    const afterUnix = lastReceivedAt
      ? Math.floor((lastReceivedAt - SAFETY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000)
      : null

    const qBase = afterUnix ? `after:${afterUnix}` : "newer_than:365d"
    const q = `${qBase} -in:chats`

    let pageToken: string | undefined = undefined
    const messages: Array<{ id?: string | null; threadId?: string | null }> = []

    do {
      const page = await gmail.users.messages.list({
        userId: "me",
        q,
        maxResults: PAGE_SIZE,
        pageToken,
        includeSpamTrash: true,
      })

      const pageMsgs = page.data.messages ?? []
      for (const msg of pageMsgs) {
        messages.push(msg)
        if (messages.length >= MAX_MESSAGES_PER_RUN) break
      }

      pageToken = page.data.nextPageToken ?? undefined
    } while (pageToken && messages.length < MAX_MESSAGES_PER_RUN)

    let scanned = messages.length
    let llmCalls = 0
    let inserted = 0
    let updated = 0
    let emailsInserted = 0
    let prepGenerated = 0

    const { data: existingPipelines } = await supabase
      .from("pipelines")
      .select("*")
      .eq("user_email", userEmail)

    const pipelines = existingPipelines ?? []

    for (const msg of messages) {
      if (!msg.id) continue

      const { data: existingEmail } = await supabase
        .from("emails")
        .select("id")
        .eq("user_email", userEmail)
        .eq("gmail_message_id", msg.id)
        .maybeSingle()
      if (existingEmail) continue

      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      })

      const headers = full.data.payload?.headers ?? []
      const subject = headers.find((h) => h.name === "Subject")?.value || ""
      const fromHeader = headers.find((h) => h.name === "From")?.value || ""
      const dateHeader = headers.find((h) => h.name === "Date")?.value || ""
      const snippet = full.data.snippet || ""

      const fromEmailMatch = fromHeader.match(/<([^>]+)>/)
      const fromEmail = (fromEmailMatch?.[1] || fromHeader || "").trim()

      const textLower = `${subject}\n${snippet}\n${fromHeader}`.toLowerCase()
      const { score, hits } = scoreEmailText(textLower)

      const scheduleStrong =
        textLower.includes("schedule an interview") ||
        textLower.includes("calendar invite") ||
        textLower.includes("availability") ||
        textLower.includes("zoom") ||
        textLower.includes("google meet") ||
        textLower.includes("teams") ||
        textLower.includes("book time") ||
        textLower.includes("phone screen") ||
        textLower.includes("screening call")

      const offerStrong =
        textLower.includes("offer letter") ||
        textLower.includes("compensation") ||
        textLower.includes("equity") ||
        textLower.includes("salary") ||
        textLower.includes("signing bonus") ||
        textLower.includes("employment offer")

      const accepted = score >= MIN_SCORE || hits.length >= MIN_HITS
      if (!accepted) continue

      const stageGuess = await estimateStageFromLLM({
        subject,
        snippet,
        fromEmail,
        userEmail,
        scheduleStrong,
        offerStrong,
        score,
        hits,
      })
      llmCalls++

      if (!stageGuess?.stage_bucket) continue

      const proposed = stageGuess.stage_bucket
      const cappedStage = capInterviewIfNoSchedulingEvidence(proposed, scheduleStrong)

      const company = (stageGuess.company || "").trim() || "Unknown"
      const role = (stageGuess.role || "").trim() || "Unknown"
      const stageDetail = (stageGuess.stage_detail || "").trim() || defaultStageDetail(cappedStage)

      const companyN = normalize(company)
      const roleN = normalize(role)

      let match = pipelines.find((p: any) => normalize(p.company) === companyN && normalize(p.role) === roleN)
      const isNewPipeline = !match

      const receivedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()

      const prepPack = await generateInsightsAndPrep({
        company,
        role,
        stage_bucket: cappedStage,
        stage_detail: stageDetail,
        subject,
        snippet,
        fromEmail,
        receivedAt,
      })
      prepGenerated++

      const insights_json = prepPack?.insights ?? null
      const prep_json = prepPack?.prep ?? null

      let pipelineId: string | null = null

      if (isNewPipeline) {
        const { data: created, error: createErr } = await supabase
          .from("pipelines")
          .insert({
            user_email: userEmail,
            company,
            role,
            stage: stageBucketToUiStage(cappedStage),
            stage_detail: stageDetail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail || fromHeader,
            last_email_snippet: snippet,
            insights_json,
            prep_json,
          })
          .select()
          .single()

        if (createErr || !created?.id) continue
        pipelineId = created.id
        pipelines.push(created)
        inserted++
      } else {
        pipelineId = match.id

        const prevStage: StageBucket =
          (String(match.stage || "").toUpperCase() as StageBucket) || "RECRUITER_SCREEN"
        const nextStage = advanceOnly(prevStage, cappedStage)

        const { error: updErr } = await supabase
          .from("pipelines")
          .update({
            stage: stageBucketToUiStage(nextStage),
            stage_detail: stageDetail,
            last_email_subject: subject,
            last_email_at: receivedAt,
            last_email_from: fromEmail || fromHeader,
            last_email_snippet: snippet,
            insights_json,
            prep_json,
          })
          .eq("id", pipelineId)

        if (!updErr) {
          match.stage = nextStage
          match.stage_detail = stageDetail
          match.last_email_subject = subject
          match.last_email_at = receivedAt
          match.last_email_from = fromEmail || fromHeader
          match.last_email_snippet = snippet
          match.insights_json = insights_json
          match.prep_json = prep_json
          updated++
        }
      }

      const { error: emailErr } = await supabase.from("emails").insert({
        user_email: userEmail,
        pipeline_id: pipelineId,
        gmail_message_id: msg.id,
        from_email: fromEmail || fromHeader,
        subject,
        snippet,
        received_at: receivedAt,
      })

      if (!emailErr) emailsInserted++
    }

    return NextResponse.json({
      scanned,
      llmCalls,
      inserted,
      updated,
      emailsInserted,
      prepGenerated,
      q,
    })
  } catch (err: any) {
    return NextResponse.json({ error: "EXCEPTION", message: err?.message || String(err) }, { status: 500 })
  }
}

import type { PrepOutput } from "@/lib/ai/prep-types"

// Teaser-safe projection of a prep. This is the ONLY prep-derived content that
// ever lands in shared_preps or renders on the public /p/[id] page. By
// construction it carries no answer plans, positioning, risks, or interviewer
// insights, and (per the share-create flow) it is generated JD-only with no
// resume input, so it contains zero resume-derived content.
export type ShareTeaser = {
  purpose: { headline: string; summary: string }
  // Question text only, no answer plans. Capped at 3.
  sample_questions: string[]
}

export type SharedPrep = {
  id: string
  role_title: string | null
  company_name: string | null
  // The public JD, carried so the viewer's prep can be pre-filled by id. The
  // JD is public job-posting text, not personal data.
  jd_text: string
  teaser: ShareTeaser
  created_at: string
}

export function buildTeaser(prep: PrepOutput): ShareTeaser {
  return {
    purpose: {
      headline: prep.purpose.headline,
      summary: prep.purpose.summary,
    },
    sample_questions: prep.questions_they_ask
      .slice(0, 3)
      .map((q) => q.question),
  }
}

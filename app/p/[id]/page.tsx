import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { marketingBaseUrl } from "@/lib/share/cors"
import { getSharedPrepById } from "@/lib/share/store"

// Public, no auth. Server-rendered teaser of a shared prep plus the CTA that
// routes the viewer into the existing unauth prep flow for the same role.
// Renders ONLY teaser-safe fields (purpose + 3 sample questions). Never the
// full prep, never resume.

export const dynamic = "force-dynamic"

function roleLabel(role: string | null, company: string | null): string {
  const base = role && role.trim().length > 0 ? role : "this role"
  return company && company.trim().length > 0 ? `${base} at ${company}` : base
}

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const data = await getSharedPrepById(params.id)
  if (!data) {
    return { title: "Prep not found - Guildy" }
  }
  const title = `Interview prep for ${roleLabel(data.role_title, data.company_name)}`
  const description =
    data.teaser?.purpose?.summary?.slice(0, 200) ??
    "See a free interview prep teaser and generate your own."
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  }
}

export default async function SharePage({
  params,
}: {
  params: { id: string }
}) {
  const data = await getSharedPrepById(params.id)
  if (!data) notFound()

  const heading = roleLabel(data.role_title, data.company_name)
  const ctaHref = `${marketingBaseUrl()}/?ref=${data.id}`
  const questions = data.teaser?.sample_questions ?? []

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center px-4 py-[8vh]">
      <div className="w-full max-w-[640px] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-12 bg-[#482C4C] rounded-b-[1.1rem] rounded-t-[0.5rem] flex items-center justify-center text-white font-serif font-bold text-2xl pb-0.5 shadow-md">
            G
          </div>
          <span className="text-[#482C4C] font-serif font-bold text-2xl tracking-tight">
            guildy
          </span>
        </div>

        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Interview prep preview
            </p>
            <h1 className="text-2xl font-semibold text-[#1C1E21]">{heading}</h1>
          </div>

          {data.teaser?.purpose ? (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-[#482C4C]">
                {data.teaser.purpose.headline}
              </h2>
              <p className="text-base leading-relaxed text-[#1C1E21]">
                {data.teaser.purpose.summary}
              </p>
            </div>
          ) : null}

          {questions.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Questions they might ask
              </h3>
              <ul className="space-y-2">
                {questions.map((q, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3 text-[15px] text-[#1C1E21]"
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-xl border border-dashed border-[#D6C7DD] bg-[#FBF7FC] p-5 text-center space-y-3">
            <p className="text-sm text-gray-600">
              This is a preview. Get the full prep - positioning, likely
              questions with answer plans, risks, and a prep checklist - built
              for your background.
            </p>
            <a
              href={ctaHref}
              className="inline-block w-full rounded-lg bg-[#482C4C] px-6 py-3 font-medium text-base text-white transition-colors hover:bg-[#3a2440]"
            >
              Generate your own prep for this role
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          Guildy builds bespoke interview prep from your resume and the job
          description.
        </p>
      </div>
    </div>
  )
}
